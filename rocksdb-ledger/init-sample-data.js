const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const levelup = require('levelup');
const rocksdb = require('rocksdb');
const fs = require('fs');

const dbPath = process.env.ROCKSDB_PATH || './data/ledger';
const ledgerSecret = process.env.ROCKSDB_LEDGER_SECRET || '';

if (!ledgerSecret.trim()) {
  console.error('ERROR: ROCKSDB_LEDGER_SECRET is not set in .env');
  process.exit(1);
}

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = levelup(rocksdb(dbPath));

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

const keyBlock = (electionId, blockIndex) => `block!${electionId}!${String(blockIndex).padStart(16, '0')}`;
const keyLastIndex = (electionId) => `meta!${electionId}!last_index`;
const keyVoted = (electionId, voterId) => `voted!${electionId}!${voterId}`;

const dbBatch = (ops) =>
  new Promise((resolve, reject) => {
    db.batch(ops, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

async function initializeSampleData() {
  try {
    console.log('Initializing RocksDB with sample blockchain data...');

    // Sample election ID (you can update this with real election IDs from your app)
    const sampleElectionId = 'sample-election-001';
    
    // Create sample blocks
    const blocks = [
      {
        candidateId: 'candidate-A',
        voterId: 'voter-001',
        voterName: 'Alice Johnson',
      },
      {
        candidateId: 'candidate-B',
        voterId: 'voter-002',
        voterName: 'Bob Smith',
      },
      {
        candidateId: 'candidate-A',
        voterId: 'voter-003',
        voterName: 'Carol White',
      },
    ];

    const ops = [];
    let previousHash = '0'.repeat(64);
    let blockIndex = 0;

    for (const blockData of blocks) {
      const nonce = crypto.randomBytes(16).toString('hex');
      const voteCommitment = sha256(`${sampleElectionId}|${blockData.candidateId}|${nonce}`);
      const createdAt = new Date(new Date().getTime() - Math.random() * 3600000).toISOString();

      const plaintextVote = JSON.stringify({
        election_id: sampleElectionId,
        candidate_id: blockData.candidateId,
        voter_id: blockData.voterId,
        voter_name: blockData.voterName,
        submitted_at: createdAt,
      });

      const encryptedVote = encryptVotePayload(plaintextVote, ledgerSecret);
      const currentHash = makeBlockHash(blockIndex, encryptedVote, voteCommitment, previousHash, createdAt);

      const block = {
        id: crypto.randomUUID(),
        election_id: sampleElectionId,
        voter_id: blockData.voterId,
        block_index: blockIndex,
        encrypted_vote: encryptedVote,
        vote_commitment: voteCommitment,
        previous_hash: previousHash,
        current_hash: currentHash,
        created_at: createdAt,
      };

      ops.push({ type: 'put', key: keyBlock(sampleElectionId, blockIndex), value: JSON.stringify(block) });
      ops.push({ type: 'put', key: keyLastIndex(sampleElectionId), value: String(blockIndex) });
      ops.push({ type: 'put', key: keyVoted(sampleElectionId, blockData.voterId), value: block.id });

      previousHash = currentHash;
      blockIndex++;

      console.log(`✓ Created block ${blockIndex} for voter: ${blockData.voterName}`);
    }

    // Write all blocks to database
    await dbBatch(ops);

    console.log(`\n✅ Successfully initialized ${blocks.length} sample blocks`);
    console.log(`Election ID: ${sampleElectionId}`);
    console.log(`Use this Election ID in your app to view the blockchain ledger`);
    console.log(`\nDatabase path: ${dbPath}`);

  } catch (error) {
    console.error('ERROR initializing database:', error);
    process.exit(1);
  } finally {
    db.close(() => {
      console.log('\nDatabase connection closed.');
      process.exit(0);
    });
  }
}

initializeSampleData();
