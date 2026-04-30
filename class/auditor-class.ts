import { BaseService } from '@/class/base-service';
import {
  getVerificationReport,
  verifyFullBlockchain,
  type FullBlockchainVerification,
} from '@/class/blockchain-verification';
import type { AuditLogRow, CandidateRow, VerifyChainResultRow, VoteBlockRow } from '@/class/database-types';
import type { IAuditLogRepository, ICandidateRepository, IVoteLedgerRepository } from '@/class/service-contracts';
import {
  countVotesFromBlockchain,
  generateVerificationReport,
  verifyVoteCounts,
  type VoteCountVerificationResult,
  type VoteCounts,
} from '@/class/vote-count-verification';

export class AuditorService extends BaseService {
  constructor(
    private readonly voteLedgerRepository: IVoteLedgerRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly candidateRepository: ICandidateRepository
  ) {
    super();
  }

  async getLedger(electionId: string): Promise<VoteBlockRow[]> {
    this.requireNonEmpty(electionId, 'Election id');
    return this.voteLedgerRepository.listLedger(electionId);
  }

  async verifyLedger(electionId: string): Promise<VerifyChainResultRow> {
    this.requireNonEmpty(electionId, 'Election id');
    return this.voteLedgerRepository.verifyChain(electionId);
  }

  async getAuditLogs(limit = 100): Promise<AuditLogRow[]> {
    return this.auditLogRepository.listRecent(limit);
  }

  /**
   * Filter audit logs by type and/or search query
   * Supports filtering by:
   * - type: 'ADMIN_ACTION' | 'VOTE' | 'SYSTEM'
   * - searchText: searches in action field
   */
  filterAuditLogs(
    logs: AuditLogRow[],
    type?: string | null,
    searchText?: string | null,
    startDate?: string | null,
    endDate?: string | null
  ): AuditLogRow[] {
    let filtered = logs;

    // Filter by type (searching in action field)
    if (type) {
      filtered = filtered.filter((log) => {
        const action = log.action.toUpperCase();
        return action.includes(type.toUpperCase());
      });
    }

    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((log) => {
        const actionLower = log.action.toLowerCase();
        const metadataStr = JSON.stringify(log.metadata).toLowerCase();
        return actionLower.includes(searchLower) || metadataStr.includes(searchLower);
      });
    }

    // Filter by date range
    if (startDate) {
      const startDateTime = new Date(startDate).getTime();
      filtered = filtered.filter((log) => {
        const logTime = new Date(log.created_at).getTime();
        return logTime >= startDateTime;
      });
    }

    if (endDate) {
      const endDateTime = new Date(endDate).getTime() + 86400000; // Add 1 day to include the entire end date
      filtered = filtered.filter((log) => {
        const logTime = new Date(log.created_at).getTime();
        return logTime <= endDateTime;
      });
    }

    // Sort by timestamp descending (newest first)
    return filtered.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  /**
   * Get formatted logs with type classification
   * Converts action strings to log types: ADMIN_ACTION, VOTE, SYSTEM
   */
  getFormattedAuditLogs(logs: AuditLogRow[]): Array<AuditLogRow & { displayType: string }> {
    return logs.map((log) => ({
      ...log,
      displayType: this.classifyLogType(log.action),
    }));
  }

  /**
   * Classify log entry to determine its type
   */
  private classifyLogType(action: string): string {
    const upperAction = action.toUpperCase();
    if (
      upperAction.includes('ADMIN') ||
      upperAction.includes('CREATED') ||
      upperAction.includes('ADDED') ||
      upperAction.includes('UPDATED') ||
      upperAction.includes('DELETED') ||
      upperAction.includes('ELECTION') ||
      upperAction.includes('CANDIDATE')
    ) {
      return 'ADMIN_ACTION';
    }
    if (upperAction.includes('VOTE') || upperAction.includes('CAST')) {
      return 'VOTE';
    }
    if (
      upperAction.includes('VERIFIED') ||
      upperAction.includes('CHECK') ||
      upperAction.includes('BLOCKCHAIN') ||
      upperAction.includes('INTEGRITY')
    ) {
      return 'SYSTEM';
    }
    return 'SYSTEM';
  }

  /**
   * Get candidates for an election
   * Used for vote count verification mapping
   */
  async getElectionCandidates(electionId: string): Promise<CandidateRow[]> {
    this.requireNonEmpty(electionId, 'Election id');
    return this.candidateRepository.listByElection(electionId);
  }

  /**
   * Count votes from blockchain ledger
   * Extract and count votes per candidate from all blocks
   */
  async countVotesFromLedger(electionId: string): Promise<VoteCounts> {
    this.requireNonEmpty(electionId, 'Election id');
    const blocks = await this.getLedger(electionId);
    const candidates = await this.getElectionCandidates(electionId);
    return countVotesFromBlockchain(blocks, candidates);
  }

  /**
   * Verify vote counts: Compare blockchain votes with computed results
   * This is the core verification function for detecting vote count mismatches
   */
  async verifyVoteCountConsistency(
    electionId: string,
    resultCounts: VoteCounts
  ): Promise<VoteCountVerificationResult> {
    this.requireNonEmpty(electionId, 'Election id');
    this.requireNonEmpty(resultCounts, 'Result counts');

    const blocks = await this.getLedger(electionId);
    const candidates = await this.getElectionCandidates(electionId);
    const blockchainCounts = countVotesFromBlockchain(blocks, candidates);

    return verifyVoteCounts(blockchainCounts, resultCounts, candidates);
  }

  /**
   * Generate verification report for auditing purposes
   * Returns a detailed human-readable report of the vote count verification
   */
  async generateVoteCountReport(
    electionId: string,
    resultCounts: VoteCounts
  ): Promise<string> {
    const verificationResult = await this.verifyVoteCountConsistency(electionId, resultCounts);
    return generateVerificationReport(verificationResult);
  }

  /**
   * Verify full blockchain integrity
   * Performs comprehensive checks including:
   * ✅ Hash correctness (SHA-256 recalculation)
   * ✅ Hash linkage between blocks
   * Detects any tampering at block level
   * 
   * Has timeout protection to prevent hanging
   * IMPORTANT: Returns error status in summary instead of throwing, so auditors can see what went wrong
   */
  async verifyFullBlockchainIntegrity(electionId: string): Promise<FullBlockchainVerification> {
    this.requireNonEmpty(electionId, 'Election id');
    
    try {
      // Create a timeout promise (10 seconds)
      const timeoutPromise = new Promise<FullBlockchainVerification>((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT: Blockchain verification took longer than 10 seconds'));
        }, 10000);
      });

      // Create the actual verification promise
      const verificationPromise = (async () => {
        const blocks = await this.getLedger(electionId);
        
        // Validate blocks before verification
        if (!Array.isArray(blocks)) {
          throw new Error('ERROR: Blocks data is not an array. Received: ' + typeof blocks);
        }
        
        if (blocks.length === 0) {
          console.warn('No blocks found for election:', electionId);
          // Return valid result for empty blockchain (no votes cast yet)
          return {
            isFullyValid: true,
            totalBlocks: 0,
            invalidBlocks: [],
            allBlocksStatus: [],
            timestamp: new Date().toISOString(),
            summary: 'Empty blockchain (no votes cast yet)',
          };
        }
        
        // Validate that blocks have required fields
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          if (!block.id || block.block_index === undefined || !block.current_hash || !block.previous_hash) {
            throw new Error(
              `ERROR: Block ${i} is missing required fields. Block: ${JSON.stringify(block)}`
            );
          }
        }
        
        return verifyFullBlockchain(blocks);
      })();

      // Race between verification and timeout
      return await Promise.race([verificationPromise, timeoutPromise]);
    } catch (error) {
      // ✅ NEW: Return error status instead of success result
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Blockchain verification error:', error);
      
      // Return error status that auditors can see
      return {
        isFullyValid: false,
        totalBlocks: 0,
        invalidBlocks: [],
        allBlocksStatus: [],
        timestamp: new Date().toISOString(),
        summary: `⚠️ VERIFICATION FAILED: ${errorMessage}`,
      };
    }
  }

  /**
   * Generate detailed blockchain integrity report
   * Returns human-readable report for auditing
   */
  async generateBlockchainIntegrityReport(electionId: string): Promise<string> {
    const verification = await this.verifyFullBlockchainIntegrity(electionId);
    return getVerificationReport(verification);
  }

  /**
   * 🚨 TAMPER DETECTION: Analyze audit logs for suspicious patterns
   * Detects:
   * - Unauthorized access attempts
   * - Vote modifications after election close
   * - Admin permission changes
   * - Unusual bulk operations
   * - Time gaps in logging
   */
  async detectSuspiciousAuditPatterns(
    logs: AuditLogRow[]
  ): Promise<{ isSuspicious: boolean; findings: string[] }> {
    const findings: string[] = [];
    let isSuspicious = false;

    if (logs.length === 0) {
      return { isSuspicious: false, findings: ['No audit logs found'] };
    }

    // Sort by timestamp
    const sortedLogs = [...logs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Check 1: Vote modifications after election
    const voteModifications = logs.filter((log) =>
      log.action.toUpperCase().includes('VOTE') && log.action.toUpperCase().includes('MODIFY')
    );
    if (voteModifications.length > 0) {
      findings.push(`⚠️ ALERT: ${voteModifications.length} vote modification entries found`);
      isSuspicious = true;
    }

    // Check 2: Unauthorized deletions
    const deletions = logs.filter(
      (log) =>
        log.action.toUpperCase().includes('DELETE') ||
        log.action.toUpperCase().includes('REMOVE')
    );
    if (deletions.length > 5) {
      findings.push(`⚠️ ALERT: Unusual number of deletions (${deletions.length})`);
      isSuspicious = true;
    }

    // Check 3: Permission changes
    const permissionChanges = logs.filter((log) =>
      log.action.toUpperCase().includes('PERMISSION') ||
      log.action.toUpperCase().includes('ROLE') ||
      log.action.toUpperCase().includes('ACCESS')
    );
    if (permissionChanges.length > 0) {
      findings.push(
        `⚠️ ALERT: ${permissionChanges.length} permission/access changes detected`
      );
      isSuspicious = true;
    }

    // Check 4: Bulk operations (many operations in short time)
    const timeWindow = 60000; // 1 minute
    let maxOpsInWindow = 0;
    for (let i = 0; i < sortedLogs.length - 1; i++) {
      const logTime = new Date(sortedLogs[i].created_at).getTime();
      const windowEnd = logTime + timeWindow;
      const opsInWindow = sortedLogs.filter(
        (log) => new Date(log.created_at).getTime() <= windowEnd
      ).length;
      maxOpsInWindow = Math.max(maxOpsInWindow, opsInWindow);
    }
    if (maxOpsInWindow > 20) {
      findings.push(
        `⚠️ ALERT: Bulk operations detected (${maxOpsInWindow} operations in 1 minute)`
      );
      isSuspicious = true;
    }

    // Check 5: Gaps in logging (indicates potential log deletion)
    const timeGaps: number[] = [];
    for (let i = 0; i < sortedLogs.length - 1; i++) {
      const gap =
        new Date(sortedLogs[i + 1].created_at).getTime() -
        new Date(sortedLogs[i].created_at).getTime();
      if (gap > 3600000) {
        // 1 hour gap
        timeGaps.push(gap);
      }
    }
    if (timeGaps.length > 2) {
      findings.push(
        `⚠️ ALERT: Multiple large time gaps in audit logs (${timeGaps.length} gaps > 1 hour)`
      );
      isSuspicious = true;
    }

    // Check 6: Unauthorized actor (actor_id changes)
    const actors = logs.filter((log) => log.actor_id).map((log) => log.actor_id);
    const uniqueActors = new Set(actors);
    if (uniqueActors.size > 5) {
      findings.push(
        `⚠️ ALERT: Many different actors (${uniqueActors.size}) modifying election data`
      );
      isSuspicious = true;
    }

    if (!isSuspicious && findings.length === 0) {
      findings.push('✅ No suspicious patterns detected in audit logs');
    }

    return { isSuspicious, findings };
  }

  /**
   * 🚨 TAMPER DETECTION: Detect vote deletion or count anomalies
   * Compares blockchain vote count with expected count
   */
  async detectVoteDeletion(
    electionId: string,
    expectedVoteCount: number
  ): Promise<{ votesDeleted: boolean; analysis: string[] }> {
    const analysis: string[] = [];
    let votesDeleted = false;

    const blocks = await this.getLedger(electionId);
    const actualVoteCount = blocks.length;

    if (actualVoteCount < expectedVoteCount) {
      const missing = expectedVoteCount - actualVoteCount;
      analysis.push(`⚠️ CRITICAL: ${missing} votes missing from blockchain`);
      analysis.push(`Expected: ${expectedVoteCount}, Found: ${actualVoteCount}`);
      votesDeleted = true;
    } else if (actualVoteCount === expectedVoteCount) {
      analysis.push(`✅ Vote count matches expected: ${actualVoteCount}`);
    } else {
      analysis.push(
        `⚠️ WARNING: More votes than expected (${actualVoteCount} > ${expectedVoteCount})`
      );
      analysis.push('Indicates possible vote duplication or injection');
    }

    // Check for duplicate nonces (indicates vote replay or injection)
    const nonces = blocks.map((b) => b.nonce);
    const nonceSet = new Set(nonces);
    if (nonceSet.size < nonces.length) {
      const duplicates = nonces.length - nonceSet.size;
      analysis.push(
        `⚠️ CRITICAL: ${duplicates} duplicate nonces found (vote injection detected)`
      );
      votesDeleted = true;
    }

    return { votesDeleted, analysis };
  }

  /**
   * 🚨 COMPREHENSIVE TAMPER DETECTION REPORT
   * Combines blockchain integrity, vote count, audit log analysis
   * and generates comprehensive security report for auditors
   */
  async generateComprehensiveTamperReport(
    electionId: string,
    expectedVoteCount: number
  ): Promise<string> {
    const blocks = await this.getLedger(electionId);
    const logs = await this.getAuditLogs(1000); // Get last 1000 audit entries
    const blockchainVerification = await this.verifyFullBlockchainIntegrity(electionId);
    const auditPatterns = await this.detectSuspiciousAuditPatterns(logs);
    const voteDeletion = await this.detectVoteDeletion(electionId, expectedVoteCount);

    let report = '═════════════════════════════════════════════════════════════════\n';
    report += '         🚨 COMPREHENSIVE TAMPER DETECTION REPORT 🚨             \n';
    report += '═════════════════════════════════════════════════════════════════\n\n';

    report += `Election ID: ${electionId}\n`;
    report += `Timestamp: ${new Date().toISOString()}\n`;
    report += `Total Blocks: ${blocks.length}\n`;
    report += `Expected Votes: ${expectedVoteCount}\n\n`;

    // Blockchain Integrity Status
    report += '───────────────────────────────────────────────────────────────\n';
    report += 'BLOCKCHAIN INTEGRITY STATUS\n';
    report += '───────────────────────────────────────────────────────────────\n';
    report += `${blockchainVerification.summary}\n`;
    if (blockchainVerification.tamperedBlockIndices) {
      report += `Tampered Blocks: ${blockchainVerification.tamperedBlockIndices.join(', ')}\n`;
    }
    if (blockchainVerification.chainBreakPoints) {
      report += `Chain Breaks: ${blockchainVerification.chainBreakPoints.join(', ')}\n`;
    }
    report += '\n';

    // Vote Count Analysis
    report += '───────────────────────────────────────────────────────────────\n';
    report += 'VOTE COUNT ANALYSIS\n';
    report += '───────────────────────────────────────────────────────────────\n';
    for (const finding of voteDeletion.analysis) {
      report += `${finding}\n`;
    }
    report += '\n';

    // Audit Log Analysis
    report += '───────────────────────────────────────────────────────────────\n';
    report += 'AUDIT LOG ANALYSIS\n';
    report += '───────────────────────────────────────────────────────────────\n';
    report += `Suspicious Patterns: ${auditPatterns.isSuspicious ? '🚨 YES' : '✅ NO'}\n`;
    for (const finding of auditPatterns.findings) {
      report += `${finding}\n`;
    }
    report += '\n';

    // Overall Risk Assessment
    report += '═════════════════════════════════════════════════════════════════\n';
    report += 'OVERALL RISK ASSESSMENT\n';
    report += '═════════════════════════════════════════════════════════════════\n';

    const riskFactors = [
      blockchainVerification.isFullyValid ? 0 : 1,
      voteDeletion.votesDeleted ? 2 : 0,
      auditPatterns.isSuspicious ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

    if (riskFactors === 0) {
      report += '✅ LOW RISK: No tampering detected\n';
      report += 'Election results appear secure and unmodified\n';
    } else if (riskFactors <= 2) {
      report += '⚠️ MEDIUM RISK: Some irregularities detected\n';
      report += 'Recommend further investigation before certification\n';
    } else {
      report += '🚨 HIGH RISK: Multiple tampering indicators detected\n';
      report += 'DO NOT CERTIFY RESULTS - Immediate investigation required\n';
    }

    report += '\nRECOMMENDED ACTIONS:\n';
    report += '1. Review all invalid blocks for signs of tampering\n';
    report += '2. Investigate suspicious audit log patterns\n';
    report += '3. Verify vote counts match blockchain records\n';
    report += '4. Check for unauthorized system access\n';
    report += '5. Consider re-running the election if tampering confirmed\n';

    report += '═════════════════════════════════════════════════════════════════\n';

    return report;
  }
}
