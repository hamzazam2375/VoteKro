import { AdminService } from '@/class/admin-class';
import { AuditorService } from '@/class/auditor-class';
import { AuthService } from '@/class/auth-class';
import { EmailService } from '@/class/email-service';
import {
    SupabaseAuditLogRepository,
    SupabaseAuthRepository,
    SupabaseCandidateRepository,
    SupabaseElectionRepository,
    SupabaseProfileRepository,
    SupabaseVoteLedgerRepository,
    SupabaseVoterRegistryRepository,
} from '@/class/supabase-repositories';
import { VotingService } from '@/class/voting-class';

export class ServiceFactory {
  private readonly authRepository = new SupabaseAuthRepository();
  readonly profileRepository = new SupabaseProfileRepository();
  readonly electionRepository = new SupabaseElectionRepository();
  readonly candidateRepository = new SupabaseCandidateRepository();
  private readonly voterRegistryRepository = new SupabaseVoterRegistryRepository();
  /** Votes always persist in Supabase `vote_blocks` via `cast_vote_secure`. */
  private readonly voteLedgerRepository = new SupabaseVoteLedgerRepository();
  private readonly auditLogRepository = new SupabaseAuditLogRepository();
  private readonly emailServiceInstance = new EmailService();

  private readonly authServiceInstance = new AuthService(this.authRepository, this.profileRepository);
  private readonly adminServiceInstance = new AdminService(
    this.authServiceInstance,
    this.profileRepository,
    this.electionRepository,
    this.candidateRepository,
    this.voterRegistryRepository,
    this.emailServiceInstance
  );
  private readonly votingServiceInstance = new VotingService(
    this.authRepository,
    this.electionRepository,
    this.candidateRepository,
    this.voterRegistryRepository,
    this.voteLedgerRepository,
    this.profileRepository
  );
  private readonly auditorServiceInstance = new AuditorService(
    this.voteLedgerRepository,
    this.auditLogRepository,
    this.candidateRepository,
    this.electionRepository
  );

  get authService(): AuthService {
    return this.authServiceInstance;
  }

  get adminService(): AdminService {
    return this.adminServiceInstance;
  }

  get votingService(): VotingService {
    return this.votingServiceInstance;
  }

  get auditorService(): AuditorService {
    return this.auditorServiceInstance;
  }
}

export const serviceFactory = new ServiceFactory();
