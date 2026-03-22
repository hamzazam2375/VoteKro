import { AuthService } from '@/class/auth-class';
import { BaseService } from '@/class/base-service';
import type { CandidateRow, ElectionRow, ProfileRow, VoterRegistryRow } from '@/class/database-types';
import { EmailService } from '@/class/email-service';
import { ValidationError } from '@/class/errors';
import type {
  AddCandidateInput,
  CreateElectionInput,
  ICandidateRepository,
  IElectionRepository,
  IProfileRepository,
  IVoterRegistryRepository,
} from '@/class/service-contracts';

type RegisterUserInput = {
  fullName: string;
  email: string;
  password?: string;
};

export class AdminService extends BaseService {
  constructor(
    private readonly authService: AuthService,
    private readonly profileRepository: IProfileRepository,
    private readonly electionRepository: IElectionRepository,
    private readonly candidateRepository: ICandidateRepository,
    private readonly voterRegistryRepository: IVoterRegistryRepository,
    private readonly emailService: EmailService
  ) {
    super();
  }

  async getDashboardOverview(): Promise<{ profile: ProfileRow; auditorExists: boolean; registeredVotersCount: number }> {
    const profile = await this.authService.getRequiredProfile('admin');
    let auditorProfile: ProfileRow | null = null;
    let registeredVotersCount = 0;
    try {
      auditorProfile = await this.profileRepository.getByRole('auditor');
    } catch (error) {
      // This lookup is only used for UI hints; failing it should not block admin access.
      console.warn('Unable to determine whether an auditor exists:', error);
    }

    try {
      registeredVotersCount = await this.profileRepository.countByRole('voter');
    } catch (error) {
      // Keep dashboard available even if count lookup fails.
      console.warn('Unable to count registered voters:', error);
    }

    return {
      profile,
      auditorExists: !!auditorProfile,
      registeredVotersCount,
    };
  }

  async registerAuditor(input: RegisterUserInput): Promise<ProfileRow> {
    const fullName = input.fullName.trim();
    const email = input.email.trim();

    await this.authService.getRequiredProfile('admin');

    this.requireNonEmpty(fullName, 'Full name');
    this.requireNonEmpty(email, 'Email');
    this.requireValidEmail(email);

    const generatedPassword = input.password?.trim() || this.generateRandomPassword();

    const profile = await this.authService.signUp({
      email,
      password: generatedPassword,
      fullName,
      role: 'auditor',
    });

    try {
      await this.emailService.sendAuditorCredentials(email, fullName, generatedPassword);
    } catch (emailError) {
      throw new ValidationError(
        `Auditor account was created but credentials email could not be sent: ${
          emailError instanceof Error ? emailError.message : 'Unknown email error'
        }`
      );
    }

    return profile;
  }

  async registerVoter(input: RegisterUserInput): Promise<ProfileRow> {
    const fullName = input.fullName.trim();
    const email = input.email.trim();

    await this.authService.getRequiredProfile('admin');

    this.requireNonEmpty(fullName, 'Full name');
    this.requireNonEmpty(email, 'Email');
    this.requireValidEmail(email);

    const generatedPassword = input.password?.trim() || this.generateRandomPassword();

    const profile = await this.authService.signUp({
      email,
      password: generatedPassword,
      fullName,
      role: 'voter',
    });

    try {
      await this.emailService.sendVoterCredentials(email, fullName, generatedPassword);
    } catch (emailError) {
      throw new ValidationError(
        `Voter account was created but credentials email could not be sent: ${
          emailError instanceof Error ? emailError.message : 'Unknown email error'
        }`
      );
    }

    return profile;
  }

  async createElection(input: CreateElectionInput): Promise<ElectionRow> {
    this.requireNonEmpty(input.title, 'Election title');
    this.requireValidDateRange(input.startsAtIso, input.endsAtIso);

    const userId = await this.authService.requireCurrentUserId();
    return this.electionRepository.create(input, userId);
  }

  async addCandidate(input: AddCandidateInput): Promise<CandidateRow> {
    this.requireNonEmpty(input.electionId, 'Election id');
    this.requireNonEmpty(input.displayName, 'Candidate name');

    return this.candidateRepository.create(input);
  }

  async registerVoterForElection(electionId: string, voterId: string): Promise<VoterRegistryRow> {
    this.requireNonEmpty(electionId, 'Election id');
    this.requireNonEmpty(voterId, 'Voter id');

    return this.voterRegistryRepository.registerEligible(electionId, voterId);
  }

  async updateElectionStatus(electionId: string, status: ElectionRow['status']): Promise<ElectionRow> {
    this.requireNonEmpty(electionId, 'Election id');
    return this.electionRepository.updateStatus(electionId, status);
  }

  private requireValidEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Please provide a valid email address');
    }
  }

  private generateRandomPassword(length: number = 10): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      password += chars[randomIndex];
    }
    return password;
  }

  private requireMinimumLength(value: string, minLength: number, fieldName: string): void {
    if (value.length < minLength) {
      throw new ValidationError(`${fieldName} must be at least ${minLength} characters`);
    }
  }
}
