import { BaseService } from '@/class/base-service';
import type { AuditLogRow, CandidateRow, VerifyChainResultRow, VoteBlockRow } from '@/class/database-types';
import type { IAuditLogRepository, ICandidateRepository, IVoteLedgerRepository } from '@/class/service-contracts';
import {
  countVotesFromBlockchain,
  verifyVoteCounts,
  generateVerificationReport,
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
}
