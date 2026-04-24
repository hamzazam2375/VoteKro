# VoteKro: Secure Digital Voting (React Native + Supabase)

This project now includes a secure online database schema and TypeScript class/service layer for a decentralized-style digital voting system based on blockchain concepts.

## What was added

- Online database schema: `database/supabase-schema.sql`
- Strong role model: Admin, Voter, Auditor
- Blockchain-style vote ledger with hash linking and tamper checks
- One-person-one-vote enforcement through transaction-safe RPC
- Typed domain classes: `lib/models/entities.ts`
- Secure service layer: `lib/services/*`
- Crypto helpers (SHA-256 nonce + commitments): `lib/security/crypto.ts`

## Database design highlights

- `profiles`: system users + role and verification state
- `elections`: election metadata, schedule, status lifecycle
- `candidates`: candidates per election
- `voter_registry`: eligibility + has-voted tracking (no vote choice stored)
- `vote_blocks`: immutable encrypted vote chain (`previous_hash`, `current_hash`)
- `audit_logs`: admin and voting activity logs

Core secure SQL functions:

- `cast_vote_secure(...)`: verifies user, election window, and duplicate-vote prevention
- `append_vote_block(...)`: appends next block using previous hash
- `verify_chain(...)`: validates blockchain integrity for auditors

## Security model

- HTTPS/TLS for all app-to-cloud communication
- Row-Level Security (RLS) enabled on all critical tables
- Role-based access control via `profiles.role`
- Clients cannot directly insert vote blocks
- Votes cast through RPC function with eligibility checks
- Vote payload intended to be encrypted before storage
- Hash commitments and chain verification detect tampering

## Setup

1. Install dependencies

```bash
npm install
```

2. Create a Supabase project (online PostgreSQL)

3. Open Supabase SQL Editor and execute:

```sql
-- paste and run
database/supabase-schema.sql
```

4. Add environment variables in `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
EXPO_PUBLIC_CAST_VOTE_EDGE_URL=
EXPO_PUBLIC_ROCKSDB_LEDGER_URL=
```

Optional (free local RocksDB blockchain ledger):

1. Start the RocksDB service in `rocksdb-ledger/`.
2. Set `EXPO_PUBLIC_ROCKSDB_LEDGER_URL` (for example `http://localhost:8787`).
3. App will route vote cast, ledger list, and chain verification through the RocksDB service.

5. Start the app

```bash
npx expo start
```

## Class and service usage

- `AuthService`: sign in/out and load profile
- `AdminService`: create elections, add candidates, register voters, open/close elections
- `VotingService`: load candidates, cast vote through secure RPC, verify election chain
- `AuditorService`: inspect ledger, verify chain, read audit logs

Import example:

```ts
import { AdminService, VotingService, AuditorService } from '@/lib/services';
```

## Production hardening recommendations

- Encrypt `encrypted_vote` in a trusted server component (Edge Function), not directly on device
- Enable MFA for admin accounts
- Rotate JWT secrets and database credentials regularly
- Add rate limiting for auth and vote APIs
- Add independent result publication signatures for auditors
