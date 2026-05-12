import type { VoteBlockRow } from "@/class/database-types";
import { env } from "@/class/env";

type VotePlainPayload = {
  election_id?: string;
  candidate_id?: string;
  voter_id?: string;
};

function base64ToUint8Array(b64: string): Uint8Array {
  const normalized = b64.replace(/\s/g, "");
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(normalized);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  // Node / test
  const { Buffer } = globalThis as typeof globalThis & {
    Buffer?: { from(data: string, enc: string): { length: number; [i: number]: number } };
  };
  if (Buffer) {
    return Uint8Array.from(Buffer.from(normalized, "base64"));
  }
  throw new Error("No base64 decoder available");
}

/**
 * Decrypts PostgreSQL payload (base64 JSON) from the ledger and tallies by candidate_id.
 */
export async function tallyVotesFromEncryptedLedger(
  ledger: VoteBlockRow[],
  currentUserId?: string | null,
): Promise<{
  counts: Map<string, number>;
  myCandidateId: string | null;
  myVoteBlock: VoteBlockRow | null;
  decryptWorked: boolean;
}> {
  const counts = new Map<string, number>();
  let myCandidateId: string | null = null;
  let myVoteBlock: VoteBlockRow | null = null;
  let anySuccess = false;

  for (const vote of ledger) {
    const raw = vote.encrypted_vote?.trim();
    if (!raw) {
      continue;
    }

    try {
      const plainStr = typeof atob === "function" 
        ? atob(raw) 
        : Buffer.from(raw, 'base64').toString('utf8');
      
      const payload = JSON.parse(plainStr);
      const candidateId = payload.candidate_id;

      if (!candidateId || typeof candidateId !== "string") {
        continue;
      }

      anySuccess = true;
      counts.set(candidateId, (counts.get(candidateId) ?? 0) + 1);

      if (
        currentUserId &&
        payload.voter_id &&
        payload.voter_id === currentUserId
      ) {
        myCandidateId = candidateId;
        myVoteBlock = vote;
      }
    } catch {
      // Skip blocks we cannot decrypt
    }
  }

  return {
    counts,
    myCandidateId,
    myVoteBlock,
    decryptWorked: anySuccess,
  };
}
