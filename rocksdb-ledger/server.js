const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const levelup = require('levelup');
const rocksdb = require('rocksdb');
const fs = require('fs');

const port = Number(process.env.PORT || 8787);
const dbPath = process.env.ROCKSDB_PATH || './data/ledger';
const ledgerSecret = process.env.ROCKSDB_LEDGER_SECRET || '';

if (!ledgerSecret.trim()) {
  throw new Error('ROCKSDB_LEDGER_SECRET is required');
}

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = levelup(rocksdb(dbPath));

const app = express();
app.use(cors());
app.use(express.json());

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const deriveKey = (secret) => crypto.createHash('sha256').update(secret).digest();

const encryptVotePayload = (payloadText, secret) => {
  const iv = crypto.randomBytes(12);
  const key = deriveKey(secret);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payloadText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
};

const makeBlockHash = (blockIndex, encryptedVote, voteCommitment, previousHash, createdAt) => {
  return sha256(`${blockIndex}|${encryptedVote}|${voteCommitment}|${previousHash}|${createdAt}`);
};

const keyLastIndex = (electionId) => `meta!${electionId}!last_index`;
const keyVoted = (electionId, voterId) => `voted!${electionId}!${voterId}`;
const keyBlock = (electionId, blockIndex) => `block!${electionId}!${String(blockIndex).padStart(16, '0')}`;

const dbGet = (key) =>
  new Promise((resolve, reject) => {
    db.get(key, (error, value) => {
      if (!error) {
        resolve(value.toString('utf8'));
        return;
      }

      if (error.notFound) {
        resolve(null);
        return;
      }

      reject(error);
    });
  });

const dbBatch = (ops) =>
  new Promise((resolve, reject) => {
    db.batch(ops, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const listBlocks = (electionId) =>
  new Promise((resolve, reject) => {
    const start = keyBlock(electionId, 0);
    const end = `block!${electionId}!~`;
    const items = [];

    db.createReadStream({ gte: start, lte: end })
      .on('data', (entry) => {
        items.push(JSON.parse(entry.value.toString('utf8')));
      })
      .on('error', reject)
      .on('end', () => resolve(items));
  });

app.get('/health', (_req, res) => {
  res.json({ ok: true, engine: 'rocksdb' });
});

app.post('/cast-vote-secure', async (req, res) => {
  try {
    const { electionId, candidateId, voterId, nonce } = req.body || {};

    if (!electionId || !candidateId || !voterId) {
      res.status(400).json({ message: 'electionId, candidateId and voterId are required' });
      return;
    }

    const votedMarker = await dbGet(keyVoted(electionId, voterId));
    if (votedMarker) {
      res.status(409).json({ message: 'Voter already has a recorded vote for this election' });
      return;
    }

    const lastIndexRaw = await dbGet(keyLastIndex(electionId));
    const lastIndex = lastIndexRaw === null ? -1 : Number(lastIndexRaw);
    const blockIndex = lastIndex + 1;

    const previousBlockRaw = lastIndex >= 0 ? await dbGet(keyBlock(electionId, lastIndex)) : null;
    const previousBlock = previousBlockRaw ? JSON.parse(previousBlockRaw) : null;
    const previousHash = previousBlock ? previousBlock.current_hash : '0'.repeat(64);

    const safeNonce = (typeof nonce === 'string' && nonce.trim().length > 0) ? nonce.trim() : crypto.randomBytes(16).toString('hex');
    const voteCommitment = sha256(`${electionId}|${candidateId}|${safeNonce}`);
    const createdAt = new Date().toISOString();

    const plaintextVote = JSON.stringify({
      election_id: electionId,
      candidate_id: candidateId,
      voter_id: voterId,
      submitted_at: createdAt,
    });

    const encryptedVote = encryptVotePayload(plaintextVote, ledgerSecret);
    const currentHash = makeBlockHash(blockIndex, encryptedVote, voteCommitment, previousHash, createdAt);

    const block = {
      id: crypto.randomUUID(),
      election_id: electionId,
      block_index: blockIndex,
      encrypted_vote: encryptedVote,
      vote_commitment: voteCommitment,
      previous_hash: previousHash,
      current_hash: currentHash,
      created_at: createdAt,
    };

    await dbBatch([
      { type: 'put', key: keyBlock(electionId, blockIndex), value: JSON.stringify(block) },
      { type: 'put', key: keyLastIndex(electionId), value: String(blockIndex) },
      { type: 'put', key: keyVoted(electionId, voterId), value: block.id },
    ]);

    res.status(201).json(block);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/ledger/:electionId', async (req, res) => {
  try {
    const blocks = await listBlocks(req.params.electionId);
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/verify-chain/:electionId', async (req, res) => {
  try {
    const blocks = await listBlocks(req.params.electionId);
    let expectedPrev = '0'.repeat(64);

    for (const block of blocks) {
      if (block.previous_hash !== expectedPrev) {
        res.json({ is_valid: false, invalid_block_index: block.block_index, reason: 'previous_hash mismatch' });
        return;
      }

      const expectedHash = makeBlockHash(
        block.block_index,
        block.encrypted_vote,
        block.vote_commitment,
        block.previous_hash,
        block.created_at
      );

      if (block.current_hash !== expectedHash) {
        res.json({ is_valid: false, invalid_block_index: block.block_index, reason: 'current_hash mismatch' });
        return;
      }

      expectedPrev = block.current_hash;
    }

    res.json({ is_valid: true, invalid_block_index: null, reason: null });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.listen(port, () => {
  console.log(`RocksDB ledger API running on http://localhost:${port}`);
});
