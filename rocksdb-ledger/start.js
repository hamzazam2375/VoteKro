#!/usr/bin/env node
const path = require('path');
process.chdir(path.dirname(__filename));

console.log('Attempting to start RocksDB Ledger Server...');
console.log('Working directory:', process.cwd());
console.log('Node version:', process.version);

// Load and run the server
try {
  require('./server.js');
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
