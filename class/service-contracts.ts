import type {
    AuditLogRow,
    CandidateRow,
    ElectionRow,
    ProfileRow,
    VerifyChainResultRow,
    VoteBlockRow,
    VoterRegistryRow,
} from '@/class/database-types';

export interface CreateElectionInput {
  title: string;
  description?: string;
  startsAtIso: string;
  endsAtIso: string;
}

export interface AddCandidateInput {
  electionId: string;
  displayName: string;
  partyName?: string;
  candidateNumber: number;
}

export interface CastVoteInput {
  electionId: string;
  candidateId: string;
  encryptedVote: string;
  nonce?: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'auditor' | 'voter';
  adminId?: string;
}

export interface IAuthRepository {
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<string>;
  signOut(): Promise<void>;
  getCurrentUserId(): Promise<string | null>;
}

export interface IProfileRepository {
  getByUserId(userId: string): Promise<ProfileRow | null>;
  getByRole(role: ProfileRow['role']): Promise<ProfileRow | null>;
  create(userId: string, fullName: string, role: ProfileRow['role']): Promise<ProfileRow>;
}

export interface IElectionRepository {
  create(input: CreateElectionInput, createdBy: string): Promise<ElectionRow>;
  updateStatus(electionId: string, status: ElectionRow['status']): Promise<ElectionRow>;
  findById(electionId: string): Promise<ElectionRow | null>;
  listAll(): Promise<ElectionRow[]>;
}

export interface ICandidateRepository {
  create(input: AddCandidateInput): Promise<CandidateRow>;
  listByElection(electionId: string): Promise<CandidateRow[]>;
}

export interface IVoterRegistryRepository {
  registerEligible(electionId: string, voterId: string): Promise<VoterRegistryRow>;
  getByElectionAndVoter(electionId: string, voterId: string): Promise<VoterRegistryRow | null>;
}

export interface IVoteLedgerRepository {
  castVoteSecure(electionId: string, encryptedVote: string, voteCommitment: string): Promise<VoteBlockRow>;
  verifyChain(electionId: string): Promise<VerifyChainResultRow>;
  listLedger(electionId: string): Promise<VoteBlockRow[]>;
}

export interface IAuditLogRepository {
  listRecent(limit?: number): Promise<AuditLogRow[]>;
}
