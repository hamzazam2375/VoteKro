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
