import type {
  CandidateRow,
  ElectionRow,
  ElectionStatus,
  UserRole,
  VoteBlockRow,
} from '@/class/database-types';
     


export class UserAccount {
  constructor(
    public readonly id: string,
    public readonly fullName: string,
    public readonly role: UserRole,
    public readonly isVerified: boolean
  ) {}

  canManageElection(): boolean {
    return this.role === 'admin';
  }

  canAudit(): boolean {
    return this.role === 'admin' || this.role === 'auditor';
  }
}

export class Election {
  constructor(public readonly row: ElectionRow) {}

  isVotingOpen(now = new Date()): boolean {
    if (this.row.status !== 'open') {
      return false;
    }

    const current = now.getTime();
    const startsAt = new Date(this.row.starts_at).getTime();
    const endsAt = new Date(this.row.ends_at).getTime();

    return current >= startsAt && current <= endsAt;
  }

  transitionTo(nextStatus: ElectionStatus): Election {
    return new Election({ ...this.row, status: nextStatus });
  }
}

export class Candidate {
  constructor(public readonly row: CandidateRow) {}

  label(): string {
    return `${this.row.candidate_number}. ${this.row.display_name}`;
  }
}

export class VoteBlock {
  constructor(public readonly row: VoteBlockRow) {}

  isGenesis(): boolean {
    return this.row.block_index === 0;
  }

  linksFrom(previous: VoteBlock | null): boolean {
    if (!previous) {
      return this.row.previous_hash === '0'.repeat(64);
    }

    return this.row.previous_hash === previous.row.current_hash;
  }
}
