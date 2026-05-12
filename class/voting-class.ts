import { BaseService } from "@/class/base-service";
import { sha256 } from "@/class/crypto";
import type {
    CandidateRow,
    ElectionRow,
    VerifyChainResultRow,
    VoteBlockRow,
    VoterRegistryRow,
    VoteVerificationReceipt,
} from "@/class/database-types";
import { AuthenticationError, ValidationError } from "@/class/errors";
import type {
    CastVoteInput,
    DecryptedTallyRow,
    IAuthRepository,
    ICandidateRepository,
    IElectionRepository,
    IProfileRepository,
    IVoteLedgerRepository,
    IVoterRegistryRepository,
    MyDecryptedVoteReceiptRow,
} from "@/class/service-contracts";
export class VotingService extends BaseService {
  constructor(
    private readonly authRepository: IAuthRepository,
    private readonly electionRepository: IElectionRepository,
    private readonly candidateRepository: ICandidateRepository,
    private readonly voterRegistryRepository: IVoterRegistryRepository,
    private readonly voteLedgerRepository: IVoteLedgerRepository,
    private readonly profileRepository: IProfileRepository,
  ) {
    super();
  }

  async getActiveElections(now = new Date()): Promise<ElectionRow[]> {
    const elections = await this.electionRepository.listAll();
    return elections.filter((election) => {
      const startsAt = new Date(election.starts_at).getTime();
      const endsAt = new Date(election.ends_at).getTime();
      const current = now.getTime();
      return current >= startsAt && current <= endsAt;
    });
  }

  async getRemainingVotingTime(
    electionId: string,
    now = new Date(),
  ): Promise<{
    remainingMs: number;
    remainingTime: string;
    votingActive: boolean;
  }> {
    this.requireNonEmpty(electionId, "Election id");

    const election = await this.electionRepository.findById(electionId);
    if (!election) {
      throw new ValidationError("Election not found");
    }

    const startsAt = new Date(election.starts_at).getTime();
    const endsAt = new Date(election.ends_at).getTime();
    const currentTime = now.getTime();

    // Voting has not started
    if (currentTime < startsAt) {
      const timeUntilStart = startsAt - currentTime;
      const days = Math.floor(timeUntilStart / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (timeUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor(
        (timeUntilStart % (1000 * 60 * 60)) / (1000 * 60),
      );

      return {
        remainingMs: 0,
        remainingTime: `Starts in ${days}d ${hours}h ${minutes}m`,
        votingActive: false,
      };
    }

    // Voting is active
    if (currentTime <= endsAt) {
      const remainingMs = endsAt - currentTime;
      const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor(
        (remainingMs % (1000 * 60 * 60)) / (1000 * 60),
      );
      const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

      return {
        remainingMs,
        remainingTime: `${days}d ${hours}h ${minutes}m ${seconds}s remaining`,
        votingActive: true,
      };
    }

    // Voting has ended
    return {
      remainingMs: 0,
      remainingTime: "Voting has ended",
      votingActive: false,
    };
  }

  async isVotingWindowOpen(
    electionId: string,
    now = new Date(),
  ): Promise<boolean> {
    this.requireNonEmpty(electionId, "Election id");

    try {
      const election = await this.electionRepository.findById(electionId);
      if (!election) {
        return false;
      }

      const startsAt = new Date(election.starts_at).getTime();
      const endsAt = new Date(election.ends_at).getTime();
      const currentTime = now.getTime();

      return currentTime >= startsAt && currentTime <= endsAt;
    } catch {
      return false;
    }
  }

  async listAllElections(): Promise<ElectionRow[]> {
    return this.electionRepository.listAll();
  }

  async getElectionCandidates(electionId: string): Promise<CandidateRow[]> {
    this.requireNonEmpty(electionId, "Election id");
    return this.candidateRepository.listByElection(electionId);
  }

  async getMyRegistryStatus(
    electionId: string,
  ): Promise<VoterRegistryRow | null> {
    this.requireNonEmpty(electionId, "Election id");

    const userId = await this.authRepository.getCurrentUserId();
    if (!userId) {
      return null;
    }

    return this.voterRegistryRepository.getByElectionAndVoter(
      electionId,
      userId,
    );
  }

  async getMyVotedElectionIds(): Promise<string[]> {
    const userId = await this.authRepository.getCurrentUserId();
    if (!userId) {
      return [];
    }

    return this.voterRegistryRepository.listVotedElectionIds(userId);
  }

  async tallyDecryptedVoteBlocksForElection(
    electionId: string,
    encryptionKey?: string | null,
  ): Promise<DecryptedTallyRow[] | null> {
    this.requireNonEmpty(electionId, "Election id");
    return this.voteLedgerRepository.tallyDecryptedVoteBlocks(
      electionId,
      encryptionKey,
    );
  }

  async getMyDecryptedVoteReceiptForElection(
    electionId: string,
    encryptionKey?: string | null,
  ): Promise<MyDecryptedVoteReceiptRow | null> {
    this.requireNonEmpty(electionId, "Election id");
    return this.voteLedgerRepository.getMyDecryptedVoteReceipt(
      electionId,
      encryptionKey,
    );
  }

  async verifyVoterEligibility(
    electionId: string,
    now = new Date(),
  ): Promise<VoterRegistryRow> {
    this.requireNonEmpty(electionId, "Election id");

    // Get current authenticated user
    const userId = await this.authRepository.getCurrentUserId();
    if (!userId) {
      throw new AuthenticationError("User is not authenticated");
    }

    // Get the election
    const election = await this.electionRepository.findById(electionId);
    if (!election) {
      throw new ValidationError("Election not found");
    }

    // Validate voting time window (must be within start and end times)
    await this.validateVotingTimeWindow(election, now);

    // Get voter's registration status for this election
    const voterRegistry =
      await this.voterRegistryRepository.getByElectionAndVoter(
        electionId,
        userId,
      );

    if (!voterRegistry) {
      throw new ValidationError("Voter is not registered for this election");
    }

    // Verify voter is eligible (approved)
    if (!voterRegistry.is_eligible) {
      throw new ValidationError("Voter is not approved for this election");
    }

    // Verify voter has not already voted
    if (voterRegistry.has_voted) {
      throw new ValidationError("Voter has already voted in this election");
    }

    return voterRegistry;
  }

  private async validateVotingTimeWindow(
    election: ElectionRow,
    now = new Date(),
  ): Promise<void> {
    const startsAt = new Date(election.starts_at).getTime();
    const endsAt = new Date(election.ends_at).getTime();
    const currentTime = now.getTime();

    // Check if voting has not started yet
    if (currentTime < startsAt) {
      const hoursRemaining = Math.floor(
        (startsAt - currentTime) / (1000 * 60 * 60),
      );
      const minutesRemaining = Math.floor(
        ((startsAt - currentTime) % (1000 * 60 * 60)) / (1000 * 60),
      );

      throw new ValidationError(
        `Voting has not started yet. The election will start in ${hoursRemaining} hours and ${minutesRemaining} minutes. Start time: ${new Date(startsAt).toLocaleString()}`,
      );
    }

    // Check if voting has ended
    if (currentTime > endsAt) {
      const timeOverdue = currentTime - endsAt;
      const hoursOverdue = Math.floor(timeOverdue / (1000 * 60 * 60));
      const minutesOverdue = Math.floor(
        (timeOverdue % (1000 * 60 * 60)) / (1000 * 60),
      );

      throw new ValidationError(
        `Voting period has ended. The election ended ${hoursOverdue} hours and ${minutesOverdue} minutes ago. End time was: ${new Date(endsAt).toLocaleString()}`,
      );
    }
  }

  private async generateVerificationToken(
    electionId: string,
    voteCommitment: string,
    nonce: string,
  ): Promise<string> {
    // Generate unique verification token: SHA256(electionId|voteCommitment|nonce)
    return sha256(`${electionId}|${voteCommitment}|${nonce}`);
  }

  private generateClientNonce(): string {
    // 16 random bytes as hex (32 chars); used when DB-side nonce generation is unavailable.
    const cryptoObj = globalThis.crypto as
      | { getRandomValues: (arr: Uint8Array) => Uint8Array }
      | undefined;
    if (cryptoObj?.getRandomValues) {
      const bytes = new Uint8Array(16);
      cryptoObj.getRandomValues(bytes);
      return Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    }

    // Fallback for environments without Web Crypto.
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(
      0,
      32,
    );
  }

  async castVote(input: CastVoteInput): Promise<VoteBlockRow> {
    this.requireNonEmpty(input.electionId, "Election id");
    this.requireNonEmpty(input.candidateId, "Candidate id");

    const userId = await this.authRepository.getCurrentUserId();
    if (!userId) {
      throw new AuthenticationError("User is not authenticated");
    }

    // Verify voter eligibility before casting vote
    await this.verifyVoterEligibility(input.electionId);

    // Cast vote ANONYMOUSLY - voterId is used for authentication but not stored
    // Vote choice is stored without voter identity to maintain anonymity
    const nonce = input.nonce?.trim() || this.generateClientNonce();
    const voteBlock = await this.voteLedgerRepository.castVoteSecure(
      input.electionId,
      input.candidateId,
      nonce,
      userId,
    );

    // Generate unique verification token for vote verification
    const verificationToken = await this.generateVerificationToken(
      input.electionId,
      voteBlock.vote_commitment,
      voteBlock.nonce,
    );

    return voteBlock;
  }

  async verifyElectionChain(electionId: string): Promise<VerifyChainResultRow> {
    this.requireNonEmpty(electionId, "Election id");
    return this.voteLedgerRepository.verifyChain(electionId);
  }

  async verifyVoteInBlockchain(
    electionId: string,
    verificationToken: string,
  ): Promise<VoteVerificationReceipt> {
    this.requireNonEmpty(electionId, "Election id");
    this.requireNonEmpty(verificationToken, "Verification token");

    // Get all votes for this election
    const votes = await this.voteLedgerRepository.listLedger(electionId);

    // Find the vote that matches this verification token
    // Token format: SHA256(electionId|voteCommitment|nonce)
    let matchedVote: VoteBlockRow | null = null;

    for (const vote of votes) {
      const generatedToken = await this.generateVerificationToken(
        electionId,
        vote.vote_commitment,
        vote.nonce,
      );

      if (generatedToken === verificationToken) {
        matchedVote = vote;
        break;
      }
    }

    if (!matchedVote) {
      throw new ValidationError(
        "Vote not found in blockchain. Please verify your verification token is correct.",
      );
    }

    // Verify the entire election chain is valid
    const chainVerification =
      await this.voteLedgerRepository.verifyChain(electionId);
    if (!chainVerification.is_valid) {
      throw new ValidationError(
        `Blockchain integrity check failed at block ${chainVerification.invalid_block_index}. Reason: ${chainVerification.reason}`,
      );
    }

    // Return verification receipt (without voter identity)
    return {
      verificationToken,
      electionId,
      blockIndex: matchedVote.block_index,
      voteCommitment: matchedVote.vote_commitment,
      createdAt: matchedVote.created_at,
      message: `✓ Your vote has been verified in the blockchain at block #${matchedVote.block_index}. The election blockchain is valid and uncompromised.`,
    };
  }
}
