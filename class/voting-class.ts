import { BaseService } from '@/class/base-service';
import type { CandidateRow, ElectionRow, VerifyChainResultRow, VoteBlockRow, VoterRegistryRow } from '@/class/database-types';
import { AuthenticationError, ValidationError } from '@/class/errors';
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

  async listAllElections(): Promise<ElectionRow[]> {
    return this.electionRepository.listAll();
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

  async verifyVoterEligibility(electionId: string, now = new Date()): Promise<VoterRegistryRow> {
    this.requireNonEmpty(electionId, 'Election id');

    // Get current authenticated user
    const userId = await this.authRepository.getCurrentUserId();
    if (!userId) {
      throw new AuthenticationError('User is not authenticated');
    }

    // Get the election
    const election = await this.electionRepository.findById(electionId);
    if (!election) {
      throw new ValidationError('Election not found');
    }

    // Verify election is active
    if (election.status !== 'open') {
      throw new ValidationError('Election is not active. Current status: ' + election.status);
    }

    const startsAt = new Date(election.starts_at).getTime();
    const endsAt = new Date(election.ends_at).getTime();
    const currentTime = now.getTime();

    if (currentTime < startsAt) {
      throw new ValidationError('Election has not started yet');
    }

    if (currentTime > endsAt) {
      throw new ValidationError('Election has ended');
    }

    // Get voter's registration status for this election
    const voterRegistry = await this.voterRegistryRepository.getByElectionAndVoter(electionId, userId);

    if (!voterRegistry) {
      throw new ValidationError('Voter is not registered for this election');
    }

    // Verify voter is eligible (approved)
    if (!voterRegistry.is_eligible) {
      throw new ValidationError('Voter is not approved for this election');
    }

    // Verify voter has not already voted
    if (voterRegistry.has_voted) {
      throw new ValidationError('Voter has already voted in this election');
    }

    return voterRegistry;
  }

  async castVote(input: CastVoteInput): Promise<VoteBlockRow> {
    this.requireNonEmpty(input.electionId, 'Election id');
    this.requireNonEmpty(input.candidateId, 'Candidate id');

    const userId = await this.authRepository.getCurrentUserId();
    if (!userId) {
      throw new AuthenticationError('User is not authenticated');
    }

    // Verify voter eligibility before casting vote
    await this.verifyVoterEligibility(input.electionId);

    // Mark voter as having voted (for duplicate prevention)
    await this.voterRegistryRepository.markAsVoted(input.electionId, userId);

    // Cast vote ANONYMOUSLY - vote is stored without voter identity
    // voterId is intentionally not passed to maintain anonymity
    return this.voteLedgerRepository.castVoteSecure(input.electionId, input.candidateId, input.nonce);
  }

  async verifyElectionChain(electionId: string): Promise<VerifyChainResultRow> {
    this.requireNonEmpty(electionId, 'Election id');
    return this.voteLedgerRepository.verifyChain(electionId);
  }
}
