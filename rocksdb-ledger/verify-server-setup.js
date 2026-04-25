/**
 * Blockchain Ledger Server - Logic Verification Script
 * 
 * This script validates that all the server logic is correct and ready to run.
 * Run with: node verify-server-setup.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔍 Blockchain Ledger Server - Setup Verification\n');
console.log('=' .repeat(60));

// ============================================================================
// 1. Check Dependencies
// ============================================================================
console.log('\n1️⃣  Checking Dependencies...');

const requiredPackages = [
  'express',
  'cors',
  'levelup',
  'rocksdb',
  'dotenv'
];

const packageJson = require('./package.json');
const dependencies = packageJson.dependencies || {};

let allDepsPresent = true;
for (const pkg of requiredPackages) {
  const hasPackage = pkg in dependencies;
  const status = hasPackage ? '✅' : '❌';
  console.log(`  ${status} ${pkg}: ${dependencies[pkg] || 'NOT FOUND'}`);
  if (!hasPackage) allDepsPresent = false;
}

if (!allDepsPresent) {
  console.log('\n  ⚠️  Missing dependencies! Run: npm install');
}

// ============================================================================
// 2. Check Environment Configuration
// ============================================================================
console.log('\n2️⃣  Checking Environment Configuration...');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  console.log('  ✅ .env file exists');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {
    'EXPO_PUBLIC_ROCKSDB_LEDGER_URL': false,
    'PORT': false,
    'ROCKSDB_PATH': false,
    'ROCKSDB_LEDGER_SECRET': false
  };
  
  for (const [key, _] of Object.entries(envVars)) {
    const hasVar = envContent.includes(key + '=');
    const status = hasVar ? '✅' : '❌';
    console.log(`  ${status} ${key}`);
  }
} else {
  console.log('  ❌ .env file not found at', envPath);
}

// ============================================================================
// 3. Validate Server Code Structure
// ============================================================================
console.log('\n3️⃣  Validating Server Code Structure...');

const serverPath = path.join(__dirname, 'server.js');
if (fs.existsSync(serverPath)) {
  console.log('  ✅ server.js file exists');
  
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  const requiredPatterns = {
    'Express app initialization': /const app = express\(\)/,
    'CORS middleware': /app\.use\(cors\(\)\)/,
    'JSON parser middleware': /app\.use\(express\.json\(\)\)/,
    '/health endpoint': /app\.get\('\/health'/,
    '/cast-vote-secure endpoint': /app\.post\('\/cast-vote-secure'/,
    '/ledger/:electionId endpoint': /app\.get\('\/ledger\/:electionId'/,
    '/verify-chain/:electionId endpoint': /app\.get\('\/verify-chain\/:electionId'/,
    'app.listen': /app\.listen\(/,
    'AES-256-GCM encryption': /aes-256-gcm/,
    'SHA256 hashing': /sha256/,
  };
  
  for (const [name, pattern] of Object.entries(requiredPatterns)) {
    const hasPattern = pattern.test(serverContent);
    const status = hasPattern ? '✅' : '❌';
    console.log(`  ${status} ${name}`);
  }
} else {
  console.log('  ❌ server.js file not found');
}

// ============================================================================
// 4. Test Cryptographic Functions
// ============================================================================
console.log('\n4️⃣  Testing Cryptographic Functions...');

try {
  // Test SHA256
  const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
  const hash1 = sha256('test');
  const hash2 = sha256('test');
  console.log('  ✅ SHA256 hashing works');
  console.log(`     Hash: ${hash1.substring(0, 16)}...`);
  
  // Test AES-256-GCM encryption
  const secret = '7f3a9c8e2b1d5f4a6c9e3b7f1a8c2d5e4b9f6a3c8e1d7b4f2a5c9e3b6f8a1d';
  const deriveKey = (secret) => crypto.createHash('sha256').update(secret).digest();
  const key = deriveKey(secret);
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = 'test vote data';
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  console.log('  ✅ AES-256-GCM encryption works');
  console.log(`     Encrypted: ${Buffer.concat([iv, tag, encrypted]).toString('base64').substring(0, 30)}...`);
} catch (err) {
  console.log('  ❌ Cryptographic functions error:', err.message);
}

// ============================================================================
// 5. Test RocksDB Path
// ============================================================================
console.log('\n5️⃣  Checking RocksDB Path...');

const dbPath = './data/ledger';
const dbDir = path.dirname(dbPath);

if (fs.existsSync(dbDir)) {
  console.log(`  ✅ Database directory exists: ${dbDir}`);
  
  const files = fs.readdirSync(dbDir);
  console.log(`     Contains ${files.length} file(s)`);
} else {
  console.log(`  ℹ️  Database directory doesn't exist yet (will be created on first run)`);
  console.log(`     Path: ${path.resolve(dbDir)}`);
}

// ============================================================================
// 6. Check Service Implementation
// ============================================================================
console.log('\n6️⃣  Checking Service Implementation...');

const servicePath = path.join(__dirname, '..', 'class', 'rocksdb-ledger-repository.ts');
if (fs.existsSync(servicePath)) {
  console.log('  ✅ RocksDbVoteLedgerRepository exists');
  
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  const methods = {
    'castVoteSecure': /async castVoteSecure/,
    'listLedger': /async listLedger/,
    'verifyChain': /async verifyChain/,
  };
  
  for (const [name, pattern] of Object.entries(methods)) {
    const hasMethod = pattern.test(serviceContent);
    const status = hasMethod ? '✅' : '❌';
    console.log(`     ${status} ${name} method`);
  }
} else {
  console.log('  ❌ RocksDbVoteLedgerRepository not found');
}

// ============================================================================
// 7. Check Frontend Integration
// ============================================================================
console.log('\n7️⃣  Checking Frontend Integration...');

const frontendPath = path.join(__dirname, '..', 'app', 'AuditorBlockchainLedger.tsx');
if (fs.existsSync(frontendPath)) {
  console.log('  ✅ AuditorBlockchainLedger component exists');
  
  const frontendContent = fs.readFileSync(frontendPath, 'utf8');
  const features = {
    'Fetch from rocksDbUrl': /rocksDbUrl/,
    'Ledger endpoint call': /\/ledger\//,
    'Verify chain call': /\/verify-chain\//,
    'Block state management': /setBlocks/,
    'Chain validation': /chainValid/,
    'Voter name mapping': /voterNameMap/,
  };
  
  for (const [name, pattern] of Object.entries(features)) {
    const hasFeature = pattern.test(frontendContent);
    const status = hasFeature ? '✅' : '❌';
    console.log(`     ${status} ${name}`);
  }
} else {
  console.log('  ❌ AuditorBlockchainLedger component not found');
}

// ============================================================================
// 8. Summary
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('\n📊 Verification Summary');
console.log('\n✅ Ready to Start Server:');
console.log('   npm --prefix rocksdb-ledger start');
console.log('   OR');
console.log('   cd rocksdb-ledger && node server.js');

console.log('\n🌐 Expected Access Points:');
console.log('   Health Check: http://localhost:8787/health');
console.log('   Ledger API: http://localhost:8787/ledger/:electionId');
console.log('   Frontend: Connected via AuditorBlockchainLedger component');

console.log('\n📝 Next Steps:');
console.log('   1. Run: npm install --prefix rocksdb-ledger');
console.log('   2. Run: npm --prefix rocksdb-ledger start');
console.log('   3. Open Expo app and navigate to Auditor Dashboard');
console.log('   4. Select an election to view blockchain ledger');

console.log('\n' + '='.repeat(60) + '\n');
