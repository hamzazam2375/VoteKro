import { BaseService } from '@/class/base-service';
import type { CandidateRow, ElectionRow, VerifyChainResultRow, VoteBlockRow, VoterRegistryRow } from '@/class/database-types';
import { EmailService } from '@/class/email-service';
import { AuthenticationError, ValidationError } from '@/class/errors';
import type {
  CastVoteInput,
  IAuthRepository,
  ICandidateRepository,
  IElectionRepository,
  IProfileRepository,
  IVoteLedgerRepository,
  IVoterRegistryRepository,
} from '@/class/service-contracts';

export class VotingService extends BaseService {
  private readonly emailService = new EmailService();

  constructor(
    private readonly authRepository: IAuthRepository,
    private readonly electionRepository: IElectionRepository,
    private readonly candidateRepository: ICandidateRepository,
    private readonly voterRegistryRepository: IVoterRegistryRepository,
    private readonly voteLedgerRepository: IVoteLedgerRepository,
    private readonly profileRepository: IProfileRepository
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
    const voteBlock = await this.voteLedgerRepository.castVoteSecure(input.electionId, input.candidateId, input.nonce);

    // Send vote confirmation email
    try {
      await this.sendVoteConfirmationEmail(userId, input.electionId, input.candidateId);
    } catch (error) {
      // Log error but don't fail the vote casting if email fails
      console.error('Failed to send vote confirmation email:', error);
    }

    return voteBlock;
  }

  async verifyElectionChain(electionId: string): Promise<VerifyChainResultRow> {
    this.requireNonEmpty(electionId, 'Election id');
    return this.voteLedgerRepository.verifyChain(electionId);
  }

  private async sendVoteConfirmationEmail(
    userId: string,
    electionId: string,
    candidateId: string
  ): Promise<void> {
    // Get voter profile for email
    const profile = await this.profileRepository.getByUserId(userId);
    if (!profile?.user_id) {
      throw new ValidationError('Voter profile not found');
    }

    // Get election details
    const election = await this.electionRepository.findById(electionId);
    if (!election) {
      throw new ValidationError('Election not found');
    }

    // Get candidate details
    const candidates = await this.candidateRepository.listByElection(electionId);
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) {
      throw new ValidationError('Candidate not found');
    }

    // Get voter email from auth
    const { data: { user } } = await (await import('@/class/supabase-client')).supabase.auth.getUser();
    const voterEmail = user?.email;
    if (!voterEmail) {
      throw new ValidationError('Voter email not found');
    }

    // Send confirmation email
    await this.emailService.sendEmail({
      to: voterEmail,
      subject: `Vote Confirmation - ${election.title}`,
      html: this.generateVoteConfirmationEmail(
        profile.full_name,
        election.title,
        candidate.display_name,
        candidate.party_name || 'Independent'
      ),
    });
  }

  private generateVoteConfirmationEmail(
    voterName: string,
    electionTitle: string,
    candidateName: string,
    partyName: string
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

            <p><strong>Important Notes:</strong></p>
            <ul style="line-height: 1.8;">
              <li>Your vote is <strong>completely anonymous</strong> - your identity is not linked to your vote on the ledger</li>
              <li>Your vote is <strong>encrypted</strong> and secured on the blockchain</li>
              <li>You can only vote once per election - this prevents duplicate voting</li>
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
