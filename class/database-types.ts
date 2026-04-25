export type UserRole = 'admin' | 'voter' | 'auditor';
export type ElectionStatus = 'draft' | 'open' | 'closed' | 'published';

export interface ProfileRow {
  user_id: string;
  full_name: string;
  role: UserRole;
  voter_code_hash: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ElectionRow {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: ElectionStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateRow {
  id: string;
  election_id: string;
  display_name: string;
  party_name: string | null;
  candidate_number: number;
  created_at: string;
}

export interface VoterRegistryRow {
  id: string;
  election_id: string;
  voter_id: string;
  is_eligible: boolean;
  has_voted: boolean;
  voted_at: string | null;
  created_at: string;
}

export interface VoteBlockRow {
  id: string;
  election_id: string;
  voter_id: string | null;
  block_index: number;
  encrypted_vote: string;
  vote_commitment: string;
  previous_hash: string;
  current_hash: string;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface VerifyChainResultRow {
  is_valid: boolean;
  invalid_block_index: number | null;
  reason: string | null;
}
