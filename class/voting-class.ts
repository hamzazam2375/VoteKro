import { BaseService } from '@/class/base-service';
import type { CandidateRow, ElectionRow, VerifyChainResultRow, VoteBlockRow, VoterRegistryRow } from '@/class/database-types';
import { AuthenticationError } from '@/class/errors';
import type {
  CastVoteInput,
  IAuthRepository,
  ICandidateRepository,
  IElectionRepository,
  IVoteLedgerRepository,
  IVoterRegistryRepository,
} from '@/class/service-contracts';

export class VotingService extends BaseService {
  constructor(
    private readonly authRepository: IAuthRepository,
    private readonly electionRepository: IElectionRepository,
    private readonly candidateRepository: ICandidateRepository,
    private readonly voterRegistryRepository: IVoterRegistryRepository,
    private readonly voteLedgerRepository: IVoteLedgerRepository
  ) {
    super();
  }

  async getActiveElections(now = new Date()): Promise<ElectionRow[]> {
    const elections = await this.electionRepository.listAll();
    return elections.filter((election) => {
      if (election.status !== 'open') {
        return false;
      }

      const startsAt = new Date(election.starts_at).getTime();
      const endsAt = new Date(election.ends_at).getTime();
      const current = now.getTime();
      return current >= startsAt && current <= endsAt;
    });
  }

  async getElectionCandidates(electionId: string): Promise<CandidateRow[]> {
    this.requireNonEmpty(electionId, 'Election id');
    return this.candidateRepository.listByElection(electionId);
  }

  async getMyRegistryStatus(electionId: string): Promise<VoterRegistryRow | null> {
    this.requireNonEmpty(electionId, 'Election id');

    const userId = await this.authRepository.getCurrentUserId();
    if (!userId) {
      return null;
    }

    return this.voterRegistryRepository.getByElectionAndVoter(electionId, userId);
  }

  async castVote(input: CastVoteInput): Promise<VoteBlockRow> {
    this.requireNonEmpty(input.electionId, 'Election id');
    this.requireNonEmpty(input.candidateId, 'Candidate id');

    const userId = await this.authRepository.getCurrentUserId();
    if (!userId) {
      throw new AuthenticationError('User is not authenticated');
    }

    return this.voteLedgerRepository.castVoteSecure(input.electionId, input.candidateId, input.nonce, userId);
  }

  async verifyElectionChain(electionId: string): Promise<VerifyChainResultRow> {
    this.requireNonEmpty(electionId, 'Election id');
    return this.voteLedgerRepository.verifyChain(electionId);
  }
}
