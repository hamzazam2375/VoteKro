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
import { EmailService } from "@/class/email-service";
import { AuthenticationError, ValidationError } from "@/class/errors";
import type {
    CastVoteInput,
    IAuthRepository,
    ICandidateRepository,
    IElectionRepository,
    IProfileRepository,
    IVoteLedgerRepository,
    IVoterRegistryRepository,
} from "@/class/service-contracts";

export class VotingService extends BaseService {
  private readonly emailService = new EmailService();

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

  async castVote(input: CastVoteInput): Promise<VoteBlockRow> {
    this.requireNonEmpty(input.electionId, "Election id");
    this.requireNonEmpty(input.candidateId, "Candidate id");

    const userId = await this.authRepository.getCurrentUserId();
    if (!userId) {
      throw new AuthenticationError("User is not authenticated");
    }

    // Verify voter eligibility before casting vote
    await this.verifyVoterEligibility(input.electionId);

    // Mark voter as having voted (for duplicate prevention)
    await this.voterRegistryRepository.markAsVoted(input.electionId, userId);

    // Cast vote ANONYMOUSLY - vote is stored without voter identity
    // voterId is intentionally not passed to maintain anonymity
    const voteBlock = await this.voteLedgerRepository.castVoteSecure(
      input.electionId,
      input.candidateId,
      input.nonce,
    );

    // Generate unique verification token for vote verification
    const verificationToken = await this.generateVerificationToken(
      input.electionId,
      voteBlock.vote_commitment,
      voteBlock.nonce,
    );

    // Send confirmation email with verification token
    try {
      await this.sendVoteConfirmationEmail(
        userId,
        input.electionId,
        input.candidateId,
        verificationToken,
      );
    } catch (error) {
      // Log error but don't fail the vote casting if email fails
      console.error("Failed to send vote confirmation email:", error);
    }

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

  private async sendVoteConfirmationEmail(
    userId: string,
    electionId: string,
    candidateId: string,
    verificationToken: string,
  ): Promise<void> {
    // Get voter profile for email
    const profile = await this.profileRepository.getByUserId(userId);
    if (!profile?.user_id) {
      throw new ValidationError("Voter profile not found");
    }

    // Get election details
    const election = await this.electionRepository.findById(electionId);
    if (!election) {
      throw new ValidationError("Election not found");
    }

    // Get candidate details
    const candidates =
      await this.candidateRepository.listByElection(electionId);
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) {
      throw new ValidationError("Candidate not found");
    }

    // Get voter email from auth
    const {
      data: { user },
    } = await (await import("@/class/supabase-client")).supabase.auth.getUser();
    const voterEmail = user?.email;
    if (!voterEmail) {
      throw new ValidationError("Voter email not found");
    }

    // Send confirmation email
    await this.emailService.sendEmail({
      to: voterEmail,
      subject: `Vote Confirmation - ${election.title}`,
      html: this.generateVoteConfirmationEmail(
        profile.full_name,
        election.title,
        candidate.display_name,
        candidate.party_name || "Independent",
        verificationToken,
      ),
    });
  }

  private generateVoteConfirmationEmail(
    voterName: string,
    electionTitle: string,
    candidateName: string,
    partyName: string,
    verificationToken: string,
  ): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5aa0;">✓ Your Vote Has Been Recorded</h2>
            <p>Dear ${voterName},</p>
            <p>Thank you for participating in the election. Your vote has been successfully recorded and secured on the blockchain.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #2c5aa0; margin-top: 0;">Vote Details:</h3>
              <p><strong>Election:</strong> ${electionTitle}</p>
              <p><strong>Candidate:</strong> ${candidateName}</p>
              <p><strong>Party:</strong> ${partyName}</p>
              <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <div style="background-color: #e8f4f8; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2c5aa0;">
              <h3 style="color: #2c5aa0; margin-top: 0;">🔐 Verify Your Vote in Blockchain</h3>
              <p>You can verify that your vote is securely stored on the blockchain without revealing your identity:</p>
              
              <div style="background-color: white; padding: 15px; border-radius: 3px; margin: 10px 0; word-break: break-all;">
                <p style="margin: 0; font-size: 12px; color: #666;">Verification Token:</p>
                <p style="margin: 5px 0; font-family: monospace; font-size: 11px; color: #000; font-weight: bold;">
                  ${verificationToken}
                </p>
              </div>
              
              <p style="font-size: 13px; color: #555;">
                Save this token to verify your vote later using the blockchain verification tool in the VoteKro app.
              </p>
            </div>

            <p><strong>Important Notes:</strong></p>
            <ul style="line-height: 1.8;">
              <li>Your vote is <strong>completely anonymous</strong> - your identity is not linked to your vote on the ledger</li>
              <li>Your vote is <strong>encrypted</strong> and secured on the blockchain</li>
              <li>You can only vote once per election - this prevents duplicate voting</li>
              <li>Use your verification token to prove your vote exists without revealing how you voted</li>
              <li>The integrity of all votes can be verified using our blockchain verification system</li>
            </ul>

            <p>If you did not cast this vote or have any concerns, please contact us immediately.</p>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
              This is an automated confirmation email from VoteKro. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;
  }
}
