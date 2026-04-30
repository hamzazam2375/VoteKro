#!/usr/bin/env node

/**
 * Utility script to install crypto-js dependency
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Installing dependencies...\n');

try {
  // Try to install crypto-js
  console.log('📦 Installing crypto-js...');
  execSync('npm install crypto-js@4.2.0', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  console.log('✅ crypto-js installed successfully\n');
  
  // Verify installation
  const nodePath = path.join(__dirname, 'node_modules', 'crypto-js');
  if (fs.existsSync(nodePath)) {
    console.log('✅ Verified: crypto-js is available at', nodePath);
    console.log('✅ Installation complete!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Warning: crypto-js installation could not be verified');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error installing dependencies:', error.message);
  process.exit(1);
}
