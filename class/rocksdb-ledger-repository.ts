import type { VerifyChainResultRow, VoteBlockRow } from '@/class/database-types';
import { DataAccessError } from '@/class/errors';
import type { IVoteLedgerRepository } from '@/class/service-contracts';

type RocksDbVerifyResponse = {
  is_valid: boolean;
  invalid_block_index: number | null;
  reason: string | null;
};

export class RocksDbVoteLedgerRepository implements IVoteLedgerRepository {
  constructor(private readonly baseUrl: string) {}

  async castVoteSecure(electionId: string, candidateId: string, nonce?: string, voterId?: string): Promise<VoteBlockRow> {
    if (!voterId) {
      throw new DataAccessError('RocksDB ledger requires authenticated voter id');
    }

    const response = await fetch(`${this.baseUrl}/cast-vote-secure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ electionId, candidateId, nonce, voterId }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new DataAccessError(`Failed to cast vote in RocksDB ledger: ${errorBody || response.statusText}`);
    }

    return (await response.json()) as VoteBlockRow;
  }

  async verifyChain(electionId: string): Promise<VerifyChainResultRow> {
    const response = await fetch(`${this.baseUrl}/verify-chain/${encodeURIComponent(electionId)}`);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new DataAccessError(`Failed to verify RocksDB chain: ${errorBody || response.statusText}`);
    }

    return (await response.json()) as RocksDbVerifyResponse;
  }

  async listLedger(electionId: string): Promise<VoteBlockRow[]> {
    const response = await fetch(`${this.baseUrl}/ledger/${encodeURIComponent(electionId)}`);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new DataAccessError(`Failed to list RocksDB ledger: ${errorBody || response.statusText}`);
    }

    return (await response.json()) as VoteBlockRow[];
  }
}
