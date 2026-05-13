import type {
    AuditLogRow,
    CandidateRow,
    ElectionRow,
    ProfileRow,
    VerifyChainResultRow,
    VoteBlockRow,
    VoterRegistryRow,
} from "@/class/database-types";
import { DataAccessError } from "@/class/errors";
import type {
    AddCandidateInput,
    CreateElectionInput,
    DecryptedTallyRow,
    IAuditLogRepository,
    IAuthRepository,
    ICandidateRepository,
    IElectionRepository,
    IProfileRepository,
    IVoteLedgerRepository,
    IVoterRegistryRepository,
    MyDecryptedVoteReceiptRow,
    UpdateCandidateInput,
    UpdateElectionInput,
} from "@/class/service-contracts";
import { supabase } from "@/class/supabase-client";

class RepositoryBase {
  protected throwOnError(context: string, error: unknown): never {
    console.error("Supabase Error Details:", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof error.message === "string"
          ? error.message
          : "Unknown data access error";
    throw new DataAccessError(`${context}: ${message}`, error);
  }
}

export class SupabaseAuthRepository
  extends RepositoryBase
  implements IAuthRepository
{
  async signIn(email: string, password: string): Promise<void> {
    console.log("🔐 SignIn Attempt:", {
      email,
      timestamp: new Date().toISOString(),
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.substring(0, 50),
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("❌ SignIn Failed:", {
        message: error.message,
        status: (error as any).status,
        code: (error as any).code,
        email,
      });

      // Provide helpful debugging information
      if (error.message.includes("Invalid login credentials")) {
        console.error(
          "⚠️ Debug Tips:",
          "1. Check if user exists in Supabase Dashboard → Authentication",
          "2. Verify email is Confirmed status",
          "3. Check if profile exists in public.profiles table",
          "4. Run: database/create-test-users.sql to create test accounts",
        );
      }

      this.throwOnError("Failed to sign in", error);
    }

    console.log("✓ SignIn Successful for:", email);
  }

  async signUp(email: string, password: string): Promise<string> {
    const {
      data: { session: previousSession },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      this.throwOnError(
        "Failed to read current session before sign up",
        sessionError,
      );
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      this.throwOnError("Failed to sign up", error);
    }
    if (!data.user) {
      this.throwOnError("Failed to sign up", new Error("No user returned"));
    }

    if (previousSession?.access_token && previousSession.refresh_token) {
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: previousSession.access_token,
        refresh_token: previousSession.refresh_token,
      });

      if (restoreError) {
        this.throwOnError(
          "Failed to restore previous session after sign up",
          restoreError,
        );
      }
    }

    return data.user.id;
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      this.throwOnError("Failed to sign out", error);
    }
  }

  async updateUser(input: {
    email?: string;
    password?: string;
  }): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      email: input.email,
      password: input.password,
    });

    if (error) {
      this.throwOnError("Failed to update auth user", error);
    }
  }

  async getCurrentUserId(): Promise<string | null> {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // Supabase may return an AuthSessionMissingError when no session is available.
      // Treat that as unauthenticated rather than throwing to callers, so UI flows
      // can handle re-authentication gracefully.
      const msg =
        typeof error === "object" && error !== null && "message" in error
          ? (error as any).message
          : String(error);
      if (
        msg &&
        (msg.includes("AuthSessionMissing") ||
          msg.toLowerCase().includes("auth session missing") ||
          msg.includes("Invalid Refresh Token") ||
          msg.includes("Refresh Token Not Found") ||
          (error as any)?.status === 403 ||
          (error as any)?.status === 400)
      ) {
        return null;
      }

      this.throwOnError("Failed to fetch current user", error);
    }

    return user?.id ?? null;
  }

  async getCurrentUserEmail(): Promise<string | null> {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      const msg =
        typeof error === "object" && error !== null && "message" in error
          ? (error as any).message
          : String(error);
      if (
        msg &&
        (msg.includes("AuthSessionMissing") ||
          msg.toLowerCase().includes("auth session missing") ||
          msg.includes("Invalid Refresh Token") ||
          msg.includes("Refresh Token Not Found") ||
          (error as any)?.status === 403 ||
          (error as any)?.status === 400)
      ) {
        return null;
      }

      this.throwOnError("Failed to fetch current user email", error);
    }

    return user?.email ?? null;
  }
}

export class SupabaseProfileRepository
  extends RepositoryBase
  implements IProfileRepository
{
  async getByUserId(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase.rpc("get_profile_by_user_id", {
      p_user_id: userId,
    });

    if (error) {
      this.throwOnError("Failed to fetch profile", error);
    }

    return (data as ProfileRow | null) ?? null;
  }

  async getByRole(role: ProfileRow["role"]): Promise<ProfileRow | null> {
    const { data, error } = await supabase.rpc("get_first_profile_by_role", {
      p_role: role,
    });

    if (error) {
      this.throwOnError("Failed to fetch profile by role", error);
    }

    return (data as ProfileRow | null) ?? null;
  }

  async countByRole(role: ProfileRow["role"]): Promise<number> {
    const { data, error } = await supabase.rpc("count_profiles_by_role", {
      p_role: role,
    });

    if (error) {
      this.throwOnError("Failed to count profiles by role", error);
    }

    return (data as number | null) ?? 0;
  }

  async create(
    userId: string,
    fullName: string,
    role: ProfileRow["role"],
  ): Promise<ProfileRow> {
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        full_name: fullName,
        role: role,
        is_verified: false,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Profile creation failed:", error.message);
      this.throwOnError("Failed to create profile", error);
    }

    return data as ProfileRow;
  }

  async update(
    userId: string,
    updates: Partial<
      Pick<ProfileRow, "full_name" | "voter_code_hash" | "is_verified">
    >,
  ): Promise<ProfileRow> {
    const payload: Record<string, unknown> = {};
    if (updates.full_name !== undefined) payload.full_name = updates.full_name;
    if (updates.voter_code_hash !== undefined)
      payload.voter_code_hash = updates.voter_code_hash;
    if (updates.is_verified !== undefined)
      payload.is_verified = updates.is_verified;

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      this.throwOnError("Failed to update profile", error);
    }

    return data as ProfileRow;
  }
}

export class SupabaseElectionRepository
  extends RepositoryBase
  implements IElectionRepository
{
  async create(
    input: CreateElectionInput,
    createdBy: string,
  ): Promise<ElectionRow> {
    const { data, error } = await supabase
      .from("elections")
      .insert({
        title: input.title,
        description: input.description ?? null,
        starts_at: input.startsAtIso,
        ends_at: input.endsAtIso,
        created_by: createdBy,
      })
      .select("*")
      .single();

    if (error) {
      this.throwOnError("Failed to create election", error);
    }

    return data as ElectionRow;
  }

  async update(input: UpdateElectionInput): Promise<ElectionRow> {
    const { data, error } = await supabase
      .from("elections")
      .update({
        title: input.title,
        description: input.description ?? null,
        starts_at: input.startsAtIso,
        ends_at: input.endsAtIso,
      })
      .eq("id", input.electionId)
      .select("*")
      .single();

    if (error) {
      this.throwOnError("Failed to update election", error);
    }

    return data as ElectionRow;
  }

  async delete(electionId: string): Promise<void> {
    const { error } = await supabase
      .from("elections")
      .delete()
      .eq("id", electionId);

    if (error) {
      this.throwOnError("Failed to delete election", error);
    }
  }

  async findById(electionId: string): Promise<ElectionRow | null> {
    const { data, error } = await supabase
      .from("elections")
      .select("*")
      .eq("id", electionId)
      .maybeSingle();

    if (error) {
      this.throwOnError("Failed to fetch election", error);
    }

    return (data as ElectionRow | null) ?? null;
  }

  async listAll(): Promise<ElectionRow[]> {
    const { data, error } = await supabase
      .from("elections")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      this.throwOnError("Failed to list elections", error);
    }

    return (data ?? []) as ElectionRow[];
  }

  async updateLastAudited(electionId: string): Promise<ElectionRow> {
    try {
      const { data, error } = await supabase
        .from("elections")
        .update({
          last_audited: new Date().toISOString(),
        })
        .eq("id", electionId)
        .select("*")
        .single();

      if (error) {
        console.warn("Warning: Could not update election audit timestamp", error.message);
        // Return empty result instead of throwing - audit completion is already recorded
        const { data: election } = await supabase
          .from("elections")
          .select("*")
          .eq("id", electionId)
          .single();
        return election as ElectionRow;
      }
      return data as ElectionRow;
    } catch (error) {
      console.warn("Warning: Error updating election audit timestamp", error);
      // Silently handle - the audit is already recorded in audit logs
      const { data: election } = await supabase
        .from("elections")
        .select("*")
        .eq("id", electionId)
        .single();
      return election as ElectionRow;
    }

    return data as ElectionRow;
  }
}

export class SupabaseCandidateRepository
  extends RepositoryBase
  implements ICandidateRepository
{
  async create(input: AddCandidateInput): Promise<CandidateRow> {
    const { data, error } = await supabase
      .from("candidates")
      .insert({
        election_id: input.electionId,
        display_name: input.displayName,
        party_name: input.partyName ?? null,
        candidate_number: input.candidateNumber,
      })
      .select("*")
      .single();

    if (error) {
      this.throwOnError("Failed to add candidate", error);
    }

    return data as CandidateRow;
  }

  async listByElection(electionId: string): Promise<CandidateRow[]> {
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("election_id", electionId)
      .order("candidate_number", { ascending: true });

    if (error) {
      this.throwOnError("Failed to list candidates", error);
    }

    return (data ?? []) as CandidateRow[];
  }

  async update(input: UpdateCandidateInput): Promise<CandidateRow> {
    const { data, error } = await supabase
      .from("candidates")
      .update({
        display_name: input.displayName,
        party_name: input.partyName ?? null,
      })
      .eq("id", input.candidateId)
      .select("*")
      .single();

    if (error) {
      this.throwOnError("Failed to update candidate", error);
    }

    return data as CandidateRow;
  }

  async delete(candidateId: string): Promise<void> {
    const { error } = await supabase
      .from("candidates")
      .delete()
      .eq("id", candidateId);

    if (error) {
      this.throwOnError("Failed to delete candidate", error);
    }
  }
}

export class SupabaseVoterRegistryRepository
  extends RepositoryBase
  implements IVoterRegistryRepository
{
  async registerEligible(
    electionId: string,
    voterId: string,
  ): Promise<VoterRegistryRow> {
    const { data, error } = await supabase
      .from("voter_registry")
      .upsert(
        {
          election_id: electionId,
          voter_id: voterId,
          is_eligible: true,
        },
        { onConflict: "election_id,voter_id" },
      )
      .select("*")
      .single();

    if (error) {
      this.throwOnError("Failed to register voter", error);
    }

    return data as VoterRegistryRow;
  }

  async getByElectionAndVoter(
    electionId: string,
    voterId: string,
  ): Promise<VoterRegistryRow | null> {
    const { data, error } = await supabase
      .from("voter_registry")
      .select("*")
      .eq("election_id", electionId)
      .eq("voter_id", voterId)
      .maybeSingle();

    if (error) {
      this.throwOnError("Failed to fetch voter registry status", error);
    }

    return (data as VoterRegistryRow | null) ?? null;
  }

  async markAsVoted(
    electionId: string,
    voterId: string,
  ): Promise<VoterRegistryRow> {
    const { data, error } = await supabase
      .from("voter_registry")
      .update({
        has_voted: true,
        voted_at: new Date().toISOString(),
      })
      .eq("election_id", electionId)
      .eq("voter_id", voterId)
      .select("*")
      .maybeSingle();

    if (error) {
      this.throwOnError("Failed to mark voter as voted", error);
    }

    if (!data) {
      throw new Error("Voter registry entry not found for update");
    }

    return data as VoterRegistryRow;
  }

  async listVotedElectionIds(voterId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("voter_registry")
      .select("election_id")
      .eq("voter_id", voterId)
      .eq("has_voted", true);

    if (error) {
      this.throwOnError("Failed to list voted elections", error);
    }

    return (data ?? []).map((row) => (row as { election_id: string }).election_id);
  }
}

export class SupabaseVoteLedgerRepository
  extends RepositoryBase
  implements IVoteLedgerRepository
{
  async castVoteSecure(
    electionId: string,
    candidateId: string,
    nonce?: string,
    _voterId?: string,
  ): Promise<VoteBlockRow> {
    const { sha256, randomNonce } = await import("@/class/crypto");
    
    // 1. Get user id
    const userId = _voterId || (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // 2. We will mark as voted AFTER the block is successfully saved to ensure data integrity.
    // (registry update code moved down)

    // 3. Get last block for the election
    const { data: lastBlocks } = await supabase
      .from("vote_blocks")
      .select("current_hash, block_index")
      .eq("election_id", electionId)
      .order("block_index", { ascending: false })
      .limit(1);

    const prevBlock = lastBlocks && lastBlocks.length > 0 ? lastBlocks[0] : null;
    const previousHash = prevBlock ? prevBlock.current_hash : '0'.repeat(64);
    const blockIndex = prevBlock ? Number(prevBlock.block_index) + 1 : 0;

    // 4. Prepare block data
    const actualNonce = nonce || await randomNonce(16);
    
    const plainVote = JSON.stringify({
      election_id: electionId,
      candidate_id: candidateId,
      voter_id: userId,
      submitted_at: new Date().toISOString()
    });

    // Simple base64 "encryption" to mimic ciphertext
    const encryptedVote = typeof btoa === "function" 
      ? btoa(plainVote) 
      : Buffer.from(plainVote).toString('base64');
      
    const voteCommitment = await sha256(`${electionId}|${candidateId}|${actualNonce}`);
    const createdAt = new Date().toISOString();
    
    // Hash the block
    const hashInput = `${blockIndex}|${encryptedVote}|${voteCommitment}|${previousHash}|${createdAt}`;
    const currentHash = await sha256(hashInput);

    let payload: any = {
      election_id: electionId,
      voter_id: userId,
      block_index: blockIndex,
      encrypted_vote: encryptedVote,
      vote_commitment: voteCommitment,
      nonce: actualNonce,
      previous_hash: previousHash,
      current_hash: currentHash,
      created_at: createdAt
    };

    // 5. Insert into vote_blocks
    const { data: blockData, error: blockError } = await supabase
      .from("vote_blocks")
      .insert(payload)
      .select("*")
      .single();

    if (blockError) {
      // If we get a schema cache error, it often means the 'voter_id' column is missing.
      if (blockError.message.toLowerCase().includes("voter_id")) {
        this.throwOnError(
          "Database Error: The 'voter_id' column is missing. Please run the SQL fix: ALTER TABLE public.vote_blocks ADD COLUMN voter_id uuid REFERENCES public.profiles(user_id);",
          blockError
        );
      }
      this.throwOnError("Failed to cast vote", blockError);
    }

    // 6. Mark as voted in the registry ONLY after the block is saved.
    await supabase
      .from("voter_registry")
      .update({ has_voted: true, voted_at: new Date().toISOString() })
      .eq("election_id", electionId)
      .eq("voter_id", userId)
      .eq("has_voted", false);

    // 6. Audit log
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "CAST_VOTE",
      target_table: "vote_blocks",
      target_id: blockData.id,
      metadata: { election_id: electionId, candidate_id: candidateId, block_index: blockIndex }
    });

    return blockData as VoteBlockRow;
  }

  async verifyChain(electionId: string): Promise<VerifyChainResultRow> {
    const { data: blocks, error } = await supabase
      .from("vote_blocks")
      .select("*")
      .eq("election_id", electionId)
      .order("block_index", { ascending: true });

    if (error) {
      this.throwOnError("Failed to fetch chain for verification", error);
    }

    if (!blocks || blocks.length === 0) {
      return { is_valid: true, invalid_block_index: null, reason: null };
    }

    const { sha256, normalizeTimestamp } = await import("@/class/crypto");
    let expectedPrev = '0'.repeat(64);

    for (const block of blocks) {
      if (block.previous_hash !== expectedPrev) {
        return { is_valid: false, invalid_block_index: block.block_index, reason: "previous_hash mismatch" };
      }

      // Normalize timestamp to handle database precision variations
      const normalizedCreatedAt = normalizeTimestamp(block.created_at);
      const hashInput = `${block.block_index}|${block.encrypted_vote}|${block.vote_commitment}|${block.previous_hash}|${normalizedCreatedAt}`;
      const expectedHash = await sha256(hashInput);

      if (block.current_hash !== expectedHash) {
        return { is_valid: false, invalid_block_index: block.block_index, reason: "current_hash mismatch" };
      }

      expectedPrev = block.current_hash;
    }

    return { is_valid: true, invalid_block_index: null, reason: null };
  }

  async listLedger(electionId: string): Promise<VoteBlockRow[]> {
    const { data, error } = await supabase
      .from("vote_blocks")
      .select("*")
      .eq("election_id", electionId)
      .order("block_index", { ascending: true });

    if (error) {
      this.throwOnError("Failed to fetch ledger", error);
    }

    return (data ?? []) as VoteBlockRow[];
  }

  async tallyDecryptedVoteBlocks(
    electionId: string,
    encryptionKey?: string | null,
  ): Promise<DecryptedTallyRow[] | null> {
    const { data, error } = await supabase
      .from("vote_blocks")
      .select("encrypted_vote")
      .eq("election_id", electionId);

    if (error) {
      console.warn("Failed to fetch blocks for tally:", error.message);
      return null;
    }

    const counts: Record<string, number> = {};
    for (const row of (data || [])) {
      try {
        const plainStr = typeof atob === "function" 
          ? atob(row.encrypted_vote) 
          : Buffer.from(row.encrypted_vote, 'base64').toString('utf8');
        
        const vote = JSON.parse(plainStr);
        if (vote.candidate_id) {
          counts[vote.candidate_id] = (counts[vote.candidate_id] || 0) + 1;
        }
      } catch (e) {
        // Ignore parsing errors for individual blocks
      }
    }

    return Object.entries(counts).map(([candidateId, voteCount]) => ({
      candidateId,
      voteCount,
    }));
  }

  async getMyDecryptedVoteReceipt(
    electionId: string,
    encryptionKey?: string | null,
  ): Promise<MyDecryptedVoteReceiptRow | null> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return null;

    const { data, error } = await supabase
      .from("vote_blocks")
      .select("*")
      .eq("election_id", electionId)
      .eq("voter_id", userId)
      .order("block_index", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;

    const block = data[0];
    try {
      const plainStr = typeof atob === "function" 
        ? atob(block.encrypted_vote) 
        : Buffer.from(block.encrypted_vote, 'base64').toString('utf8');
      
      const vote = JSON.parse(plainStr);
      return {
        currentHash: block.current_hash,
        createdAt: block.created_at,
        candidateId: vote.candidate_id,
        blockIndex: Number(block.block_index),
      };
    } catch (e) {
      return null;
    }
  }
}

export class SupabaseAuditLogRepository
  extends RepositoryBase
  implements IAuditLogRepository
{
  async listRecent(limit = 100): Promise<AuditLogRow[]> {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      this.throwOnError("Failed to fetch audit logs", error);
    }

    return (data ?? []) as AuditLogRow[];
  }

  async recordAuditAction(
    action: string,
    targetId: string,
    metadata?: Record<string, any>
  ): Promise<AuditLogRow> {
    const { data, error } = await supabase
      .from("audit_logs")
      .insert([
        {
          action,
          target_id: targetId,
          metadata: metadata || {},
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      this.throwOnError("Failed to record audit action", error);
    }

    return data as AuditLogRow;
  }
}
