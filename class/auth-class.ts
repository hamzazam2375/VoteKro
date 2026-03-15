import { BaseService } from '@/class/base-service';
import type { ProfileRow } from '@/class/database-types';
import { AuthenticationError, ValidationError } from '@/class/errors';
import type { IAuthRepository, IProfileRepository, SignUpInput } from '@/class/service-contracts';

const DASHBOARD_ROUTE_BY_ROLE = {
  admin: '/AdminDashboard',
  auditor: '/AuditorDashboard',
  voter: '/VoterDashboard',
} as const;

export type DashboardRoute = (typeof DASHBOARD_ROUTE_BY_ROLE)[ProfileRow['role']];

export class AuthService extends BaseService {
  constructor(
    private readonly authRepository: IAuthRepository,
    private readonly profileRepository: IProfileRepository
  ) {
    super();
  }

  async signIn(email: string, password: string): Promise<void> {
    const normalizedEmail = email.trim();

    this.requireNonEmpty(normalizedEmail, 'Email');
    this.requireNonEmpty(password, 'Password');
    await this.authRepository.signIn(normalizedEmail, password);
  }

  async signUp(input: SignUpInput): Promise<ProfileRow> {
    const normalizedEmail = input.email.trim();
    const normalizedFullName = input.fullName.trim();

    this.requireNonEmpty(normalizedEmail, 'Email');
    this.requireNonEmpty(input.password, 'Password');
    this.requireNonEmpty(normalizedFullName, 'Full name');

    // Create auth user
    const userId = await this.authRepository.signUp(normalizedEmail, input.password);

    // Create profile with the new user ID
    // The RLS policy now allows this through service_role
    const profile = await this.profileRepository.create(userId, normalizedFullName, input.role);

    return profile;
  }

  async loginForRole(email: string, password: string, expectedRole: ProfileRow['role']): Promise<ProfileRow> {
    await this.signIn(email, password);

    const profile = await this.getCurrentProfile();
    if (!profile) {
      await this.signOut();
      throw new AuthenticationError('Profile not found. Please contact support.');
    }

    if (profile.role !== expectedRole) {
      await this.signOut();
      throw new AuthenticationError(this.getRoleMismatchMessage(expectedRole, profile.role));
    }

    return profile;
  }

  async getRequiredProfile(requiredRole: ProfileRow['role']): Promise<ProfileRow> {
    const profile = await this.getCurrentProfile();
    if (!profile) {
      throw new AuthenticationError('Not authenticated');
    }

    if (profile.role !== requiredRole) {
      throw new AuthenticationError(`Access denied. ${this.getRoleLabel(requiredRole)} role required.`);
    }

    return profile;
  }

  async registerAdmin(input: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Promise<ProfileRow> {
    const fullName = input.fullName.trim();
    const email = input.email.trim();

    this.requireNonEmpty(fullName, 'Full name');
    this.requireNonEmpty(email, 'Email');
    this.requireNonEmpty(input.password, 'Password');
    this.requireNonEmpty(input.confirmPassword, 'Confirm password');
    this.requireMinimumLength(input.password, 8, 'Password');

    if (input.password !== input.confirmPassword) {
      throw new ValidationError('Password and confirm password do not match');
    }

    this.requireEmailAddress(email);

    return this.signUp({
      email,
      password: input.password,
      fullName,
      role: 'admin',
    });
  }

  async signOut(): Promise<void> {
    await this.authRepository.signOut();
  }

  async getCurrentProfile(): Promise<ProfileRow | null> {
    const userId = await this.authRepository.getCurrentUserId();
    if (!userId) {
      return null;
    }

    return this.profileRepository.getByUserId(userId);
  }

  async requireCurrentUserId(): Promise<string> {
    const userId = await this.authRepository.getCurrentUserId();
    if (!userId) {
      throw new AuthenticationError('User is not authenticated');
    }

    return userId;
  }

  getDashboardRoute(role: ProfileRow['role']): DashboardRoute {
    return DASHBOARD_ROUTE_BY_ROLE[role];
  }

  getErrorMessage(error: unknown, fallbackMessage: string): string {
    return error instanceof Error ? error.message : fallbackMessage;
  }

  getLoginErrorAlert(error: unknown): { title: string; message: string } {
    const errorMessage = this.getErrorMessage(error, 'An error occurred during login');

    if (errorMessage.includes('Email not confirmed')) {
      return {
        title: 'Email Not Verified',
        message: 'Please check your email and click the verification link before logging in.',
      };
    }

    if (errorMessage.includes('Invalid login credentials')) {
      return {
        title: 'Login Failed',
        message: 'Invalid email or password. Please try again.',
      };
    }

    return {
      title: 'Login Failed',
      message: errorMessage,
    };
  }

  getRegistrationErrorAlert(error: unknown): { title: string; message: string } {
    return {
      title: 'Registration Failed',
      message: this.getErrorMessage(error, 'An error occurred during registration'),
    };
  }

  private requireMinimumLength(value: string, minLength: number, fieldName: string): void {
    if (value.length < minLength) {
      throw new ValidationError(`${fieldName} must be at least ${minLength} characters`);
    }
  }

  private requireEmailAddress(email: string): void {
    if (!email.includes('@')) {
      throw new ValidationError('Please enter a valid email address');
    }
  }

  private getRoleLabel(role: ProfileRow['role']): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  private getRoleMismatchMessage(expectedRole: ProfileRow['role'], actualRole: ProfileRow['role']): string {
    if (expectedRole === 'voter') {
      return `This account is registered as ${actualRole}, not voter. Please use a voter account.`;
    }

    return `This account is registered as ${actualRole}, not ${expectedRole}. Please select the correct role.`;
  }
}
