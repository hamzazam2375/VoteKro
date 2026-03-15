import type {
    AuditLogRow,
    CandidateRow,
    ElectionRow,
    ProfileRow,
    VerifyChainResultRow,
    VoteBlockRow,
    VoterRegistryRow,
} from '@/class/database-types';
import { DataAccessError } from '@/class/errors';
import type {
    AddCandidateInput,
    CreateElectionInput,
    IAuditLogRepository,
    IAuthRepository,
    ICandidateRepository,
    IElectionRepository,
    IProfileRepository,
    IVoteLedgerRepository,
    IVoterRegistryRepository,
} from '@/class/service-contracts';
import { supabase } from '@/class/supabase-client';

class RepositoryBase {
  protected throwOnError(context: string, error: unknown): never {
    console.error('Supabase Error Details:', error);
    const message = error instanceof Error ? error.message : 'Unknown data access error';
    throw new DataAccessError(`${context}: ${message}`, error);
  }
}

export class SupabaseAuthRepository extends RepositoryBase implements IAuthRepository {
  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      this.throwOnError('Failed to sign in', error);
    }
  }

  async signUp(email: string, password: string): Promise<string> {
    const {
      data: { session: previousSession },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      this.throwOnError('Failed to read current session before sign up', sessionError);
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      this.throwOnError('Failed to sign up', error);
    }
    if (!data.user) {
      this.throwOnError('Failed to sign up', new Error('No user returned'));
    }

    if (previousSession?.access_token && previousSession.refresh_token) {
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: previousSession.access_token,
        refresh_token: previousSession.refresh_token,
      });

      if (restoreError) {
        this.throwOnError('Failed to restore previous session after sign up', restoreError);
      }
    }

    return data.user.id;
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      this.throwOnError('Failed to sign out', error);
    }
  }

  async getCurrentUserId(): Promise<string | null> {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      this.throwOnError('Failed to fetch current user', error);
    }

    return user?.id ?? null;
  }
}

export class SupabaseProfileRepository extends RepositoryBase implements IProfileRepository {
  async getByUserId(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.throwOnError('Failed to fetch profile', error);
    }

    return (data as ProfileRow | null) ?? null;
  }

  async getByRole(role: ProfileRow['role']): Promise<ProfileRow | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', role)
      .maybeSingle();

    if (error) {
      this.throwOnError('Failed to fetch profile by role', error);
    }

    return (data as ProfileRow | null) ?? null;
  }

  async countByRole(role: ProfileRow['role']): Promise<number> {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', role);

    if (error) {
      this.throwOnError('Failed to count profiles by role', error);
    }

    return count ?? 0;
  }

  async create(userId: string, fullName: string, role: ProfileRow['role']): Promise<ProfileRow> {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        full_name: fullName,
        role: role,
        is_verified: false,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Profile creation failed:', error.message);
      this.throwOnError('Failed to create profile', error);
    }

    return data as ProfileRow;
  }
}

export class SupabaseElectionRepository extends RepositoryBase implements IElectionRepository {
  async create(input: CreateElectionInput, createdBy: string): Promise<ElectionRow> {
    const { data, error } = await supabase
      .from('elections')
      .insert({
        title: input.title,
        description: input.description ?? null,
        starts_at: input.startsAtIso,
        ends_at: input.endsAtIso,
        status: 'draft',
        created_by: createdBy,
      })
      .select('*')
      .single();

    if (error) {
      this.throwOnError('Failed to create election', error);
    }

    return data as ElectionRow;
  }

  async updateStatus(electionId: string, status: ElectionRow['status']): Promise<ElectionRow> {
    const { data, error } = await supabase
      .from('elections')
      .update({ status })
      .eq('id', electionId)
      .select('*')
      .single();

    if (error) {
      this.throwOnError('Failed to update election status', error);
    }

    return data as ElectionRow;
  }

  async findById(electionId: string): Promise<ElectionRow | null> {
    const { data, error } = await supabase.from('elections').select('*').eq('id', electionId).maybeSingle();

    if (error) {
      this.throwOnError('Failed to fetch election', error);
    }

    return (data as ElectionRow | null) ?? null;
  }

  async listAll(): Promise<ElectionRow[]> {
    const { data, error } = await supabase.from('elections').select('*').order('created_at', { ascending: false });

    if (error) {
      this.throwOnError('Failed to list elections', error);
    }

    return (data ?? []) as ElectionRow[];
  }
}

export class SupabaseCandidateRepository extends RepositoryBase implements ICandidateRepository {
  async create(input: AddCandidateInput): Promise<CandidateRow> {
    const { data, error } = await supabase
      .from('candidates')
      .insert({
        election_id: input.electionId,
        display_name: input.displayName,
        party_name: input.partyName ?? null,
        candidate_number: input.candidateNumber,
      })
      .select('*')
      .single();

    if (error) {
      this.throwOnError('Failed to add candidate', error);
    }

    return data as CandidateRow;
  }

  async listByElection(electionId: string): Promise<CandidateRow[]> {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('election_id', electionId)
      .order('candidate_number', { ascending: true });

    if (error) {
      this.throwOnError('Failed to list candidates', error);
    }

    return (data ?? []) as CandidateRow[];
  }
}

export class SupabaseVoterRegistryRepository extends RepositoryBase implements IVoterRegistryRepository {
  async registerEligible(electionId: string, voterId: string): Promise<VoterRegistryRow> {
    const { data, error } = await supabase
      .from('voter_registry')
      .upsert(
        {
          election_id: electionId,
          voter_id: voterId,
          is_eligible: true,
        },
        { onConflict: 'election_id,voter_id' }
      )
      .select('*')
      .single();

    if (error) {
      this.throwOnError('Failed to register voter', error);
    }

    return data as VoterRegistryRow;
  }

  async getByElectionAndVoter(electionId: string, voterId: string): Promise<VoterRegistryRow | null> {
    const { data, error } = await supabase
      .from('voter_registry')
      .select('*')
      .eq('election_id', electionId)
      .eq('voter_id', voterId)
      .maybeSingle();

    if (error) {
      this.throwOnError('Failed to fetch voter registry status', error);
    }

    return (data as VoterRegistryRow | null) ?? null;
  }
}

export class SupabaseVoteLedgerRepository extends RepositoryBase implements IVoteLedgerRepository {
  async castVoteSecure(electionId: string, encryptedVote: string, voteCommitment: string): Promise<VoteBlockRow> {
    const { data, error } = await supabase.rpc('cast_vote_secure', {
      p_election_id: electionId,
      p_encrypted_vote: encryptedVote,
      p_vote_commitment: voteCommitment,
    });

    if (error) {
      this.throwOnError('Failed to cast vote', error);
    }

    return data as VoteBlockRow;
  }

  async verifyChain(electionId: string): Promise<VerifyChainResultRow> {
    const { data, error } = await supabase.rpc('verify_chain', {
      p_election_id: electionId,
    });

    if (error) {
      this.throwOnError('Failed to verify blockchain', error);
    }

    const rows = (data ?? []) as VerifyChainResultRow[];
    return (
      rows[0] ?? {
        is_valid: false,
        invalid_block_index: null,
        reason: 'No verification result returned',
      }
    );
  }

  async listLedger(electionId: string): Promise<VoteBlockRow[]> {
    const { data, error } = await supabase
      .from('vote_blocks')
      .select('*')
      .eq('election_id', electionId)
      .order('block_index', { ascending: true });

    if (error) {
      this.throwOnError('Failed to fetch ledger', error);
    }

    return (data ?? []) as VoteBlockRow[];
  }
}

export class SupabaseAuditLogRepository extends RepositoryBase implements IAuditLogRepository {
  async listRecent(limit = 100): Promise<AuditLogRow[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.throwOnError('Failed to fetch audit logs', error);
    }

    return (data ?? []) as AuditLogRow[];
  }
}
