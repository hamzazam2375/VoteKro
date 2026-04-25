# RocksDB Ledger Backend Setup & Troubleshooting Guide

## 🚀 Quick Start

### 1. **Start the RocksDB Server**

Navigate to the `rocksdb-ledger` directory and run:

```bash
npm start
```

Or directly:

```bash
node server.js
```

**Expected Output:**
```
RocksDB ledger API running on http://localhost:8787
```

### 2. **Initialize Sample Data (Optional)**

If you want to populate the database with sample blockchain data:

```bash
node init-sample-data.js
```

This will create 3 sample blocks in election `sample-election-001`.

### 3. **Verify Server is Running**

Open your browser and navigate to:
```
http://localhost:8787/health
```

**Expected Response:**
```json
{"ok": true, "engine": "rocksdb"}
```

---

## 🔧 API Endpoints

### Health Check
- **GET** `/health`
- Returns: `{"ok": true, "engine": "rocksdb"}`

### Cast Vote
- **POST** `/cast-vote-secure`
- Body: `{ "electionId": "...", "candidateId": "...", "voterId": "...", "nonce": "..." }`

### Fetch Blockchain Ledger
- **GET** `/ledger/:electionId`
- Returns: Array of vote blocks with full blockchain data

### Verify Chain Integrity
- **GET** `/verify-chain/:electionId`
- Returns: `{"is_valid": true/false, "invalid_block_index": null, "reason": null}`

---

## ⚙️ Configuration

The server reads from `.env` file:

```env
PORT=8787
ROCKSDB_PATH=./data/ledger
ROCKSDB_LEDGER_SECRET=<your-secret-key>
```

**Important:** `ROCKSDB_LEDGER_SECRET` must be set and match across all instances.

---

## 🎯 Frontend Integration

The Auditor Ledger View (`AuditorBlockchainLedger.tsx`) automatically connects to:

```
http://localhost:8787/ledger/:electionId
```

The frontend reads the URL from `.env`:
```
EXPO_PUBLIC_ROCKSDB_LEDGER_URL=http://localhost:8787
```

---

## ❌ Troubleshooting

### Problem: "Failed to fetch" in Frontend

**Cause 1: Server not running**
- ✅ Solution: Start the server with `npm start`
- Verify with: `curl http://localhost:8787/health`

**Cause 2: Wrong port**
- ✅ Check `.env` files match (both root `.env` and server's `.env`)
- ✅ Verify PORT=8787 in `.env`

**Cause 3: CORS error**
- ✅ Server has `cors()` enabled - should work on localhost
- ✅ Try accessing from different origin? Add to server: `app.use(cors({ origin: '*' }))`

**Cause 4: Election ID doesn't exist in database**
- ✅ Initialize sample data: `node init-sample-data.js`
- ✅ Use election ID: `sample-election-001`

### Problem: "ROCKSDB_LEDGER_SECRET is required"

- ✅ Add to `.env`: `ROCKSDB_LEDGER_SECRET=7f3a9c8e2b1d5f4a6c9e3b7f1a8c2d5e4b9f6a3c8e1d7b4f2a5c9e3b6f8a1d`
- ✅ Restart server after adding

### Problem: Database locked or corrupt

- ✅ Delete `data/ledger` directory
- ✅ Restart server (will recreate fresh database)

---

## 📊 Architecture Flow

```
┌─────────────────────┐
│  Auditor UI         │
│  (Expo App)         │
└──────────┬──────────┘
           │ HTTP GET /ledger/:electionId
           ↓
┌─────────────────────┐
│  Express.js Server  │
│  (this directory)   │
└──────────┬──────────┘
           │ Read/Write
           ↓
┌─────────────────────┐
│  RocksDB Database   │
│  (./data/ledger)    │
└─────────────────────┘
```

---

## 🧪 Testing

### Test 1: Health Check
```bash
curl http://localhost:8787/health
```

### Test 2: Get Blockchain Ledger
```bash
curl http://localhost:8787/ledger/sample-election-001
```

### Test 3: Verify Chain
```bash
curl http://localhost:8787/verify-chain/sample-election-001
```

---

## 📝 Notes

- ✅ Frontend reads blockchain from `/ledger/:electionId`
- ✅ All vote data is encrypted in RocksDB
- ✅ Voter IDs are stored separately for auditor access
- ✅ Server runs on port `8787` by default
- ✅ Requires Node.js 14+

---

## 🔐 Security

- ✅ Auditor can only **read** blockchain (no write access)
- ✅ Encrypted votes cannot be decrypted by auditor
- ✅ Voter ID is stored separately for auditor visibility
- ✅ Chain integrity is verified on every request
