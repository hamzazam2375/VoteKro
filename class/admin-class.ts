import { AuthService } from '@/class/auth-class';
import { BaseService } from '@/class/base-service';
import type { CandidateRow, ElectionRow, ProfileRow, VoterRegistryRow } from '@/class/database-types';
import { ValidationError } from '@/class/errors';
import type {
    AddCandidateInput,
    CreateElectionInput,
    ICandidateRepository,
    IElectionRepository,
    IProfileRepository,
    IVoterRegistryRepository,
} from '@/class/service-contracts';

export class AdminService extends BaseService {
  constructor(
    private readonly authService: AuthService,
    private readonly profileRepository: IProfileRepository,
    private readonly electionRepository: IElectionRepository,
    private readonly candidateRepository: ICandidateRepository,
    private readonly voterRegistryRepository: IVoterRegistryRepository
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

  async registerAuditor(input: { fullName: string; email: string }): Promise<ProfileRow> {
    const fullName = input.fullName.trim();
    const email = input.email.trim();

    await this.authService.getRequiredProfile('admin');

    this.requireNonEmpty(fullName, 'Full name');
    this.requireNonEmpty(email, 'Email');
    this.requireGmailAddress(email);

    const generatedPassword = fullName.split(/\s+/)[0];
    if (!generatedPassword) {
      throw new ValidationError('Password could not be generated from full name');
    }

    return this.authService.signUp({
      email,
      password: generatedPassword,
      fullName,
      role: 'auditor',
    });
  }

  async registerVoter(input: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Promise<ProfileRow> {
    const fullName = input.fullName.trim();
    const email = input.email.trim();
    const password = input.password;
    const confirmPassword = input.confirmPassword;

    await this.authService.getRequiredProfile('admin');

    this.requireNonEmpty(fullName, 'Full name');
    this.requireNonEmpty(email, 'Email');
    this.requireNonEmpty(password, 'Password');
    this.requireNonEmpty(confirmPassword, 'Confirm password');
    this.requireMinimumLength(password, 8, 'Password');

    if (password !== confirmPassword) {
      throw new ValidationError('Password and confirm password do not match');
    }

    this.requireGmailAddress(email);

    return this.authService.signUp({
      email,
      password,
      fullName,
      role: 'voter',
    });
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

  private requireGmailAddress(email: string): void {
    if (!email.includes('@') || !email.toLowerCase().endsWith('@gmail.com')) {
      throw new ValidationError('Email must end with @gmail.com');
    }
  }

  private requireMinimumLength(value: string, minLength: number, fieldName: string): void {
    if (value.length < minLength) {
      throw new ValidationError(`${fieldName} must be at least ${minLength} characters`);
    }
  }
}
