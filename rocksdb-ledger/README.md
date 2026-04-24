# RocksDB Ledger Service

This service stores vote blocks in a free local RocksDB database and exposes HTTP endpoints used by the app.

## Endpoints

- `GET /health`
- `POST /cast-vote-secure`
- `GET /ledger/:electionId`
- `GET /verify-chain/:electionId`

## Run

1. Install dependencies:

```bash
npm install
```

2. Set environment variables (see `.env.example`):

- `PORT`
- `ROCKSDB_PATH`
- `ROCKSDB_LEDGER_SECRET`

3. Start server:

```bash
npm start
```

## Notes

- This service prevents duplicate votes per `(electionId, voterId)`.
- Encrypted vote payload uses AES-256-GCM and only encrypted payload is stored.
- Block hash links every block to previous hash.
