import type { VoteBlockRow } from '@/class/database-types';
import { sha256 } from '@/class/sha256-util';

/**
 * Represents the validation status of a single block
 */
export interface BlockVerificationStatus {
  index: number;
  blockId: string;
  hashValid: boolean;
  linkValid: boolean;
  nonceValid: boolean;
  timestampValid: boolean;
  formatValid: boolean;
  recalculatedHash?: string;
  currentHash: string;
  previousHash: string;
  errors: string[];
  tamperedFields?: string[];
}

/**
 * Complete blockchain verification result
 */
export interface FullBlockchainVerification {
  isFullyValid: boolean;
  totalBlocks: number;
  invalidBlocks: BlockVerificationStatus[];
  allBlocksStatus: BlockVerificationStatus[];
  timestamp: string;
  summary: string;
  tamperedBlockIndices?: number[];
  chainBreakPoints?: number[];
  nonceAnomalies?: string[];
  timestampAnomalies?: string[];
  formatViolations?: string[];
}

/**
 * Calculate hash for a block using SHA-256
 * Hash = SHA256(index + timestamp + encryptedVote + previousHash)
 *
 * @param block - The vote block to calculate hash for
 * @returns SHA-256 hash as hex string
 * @throws Error if block is missing required fields
 */
export function calculateBlockHash(block: VoteBlockRow): string {
  // Validate required fields
  if (!block || typeof block !== 'object') {
    throw new Error('Block is null, undefined, or not an object');
  }
  
  if (block.block_index === undefined || block.block_index === null) {
    throw new Error('Block missing required field: block_index');
  }
  
  if (!block.created_at) {
    throw new Error('Block missing required field: created_at');
  }
  
  if (!block.encrypted_vote) {
    throw new Error('Block missing required field: encrypted_vote');
  }
  
  if (!block.previous_hash) {
    throw new Error('Block missing required field: previous_hash');
  }
  
  const data = `${block.block_index}|${block.created_at}|${block.encrypted_vote}|${block.previous_hash}`;
  return sha256(data);
}

/**
 * Verify a single block's hash correctness
 * Recalculates the hash and compares with stored hash
 *
 * @param block - The block to verify
 * @returns true if hash is valid, false otherwise
 * @throws Error if block is invalid or missing required fields
 */
export function verifyBlockHash(block: VoteBlockRow): boolean {
  if (!block || typeof block !== 'object') {
    throw new Error('Block is null, undefined, or not an object');
  }
  
  if (!block.current_hash) {
    throw new Error('Block missing required field: current_hash');
  }
  
  const recalculatedHash = calculateBlockHash(block);
  return recalculatedHash === block.current_hash;
}

/**
 * Verify hash linkage between two blocks
 * Checks if current block's previousHash matches previous block's currentHash
 *
 * @param currentBlock - The current block
 * @param previousBlock - The previous block in the chain
 * @returns true if link is valid, false otherwise
 */
export function verifyHashLink(currentBlock: VoteBlockRow, previousBlock: VoteBlockRow): boolean {
  return currentBlock.previous_hash === previousBlock.current_hash;
}

/**
 * Verify the genesis block (first block)
 * Genesis block should have previousHash = '0' * 64
 *
 * @param genesisBlock - The first block
 * @returns true if genesis block is valid, false otherwise
 */
export function verifyGenesisBlock(genesisBlock: VoteBlockRow): boolean {
  if (genesisBlock.block_index !== 0) {
    return false;
  }

  // Genesis block should have previousHash of all zeros
  const expectedPreviousHash = '0'.repeat(64);
  const validPreviousHash = genesisBlock.previous_hash === expectedPreviousHash;
  const validHash = verifyBlockHash(genesisBlock);

  return validPreviousHash && validHash;
}

/**
 * Perform full blockchain integrity verification with comprehensive tamper detection
 * Checks:
 * ✓ Hash correctness (recalculation and comparison)
 * ✓ Hash chain linkage
 * ✓ Nonce presence and validity (new security check)
 * ✓ Timestamp monotonicity (increasing block times)
 * ✓ Data format validation (base64, hex, etc)
 * ✓ Block sequence integrity (no gaps or duplicates)
 * ✓ Missing required fields
 * 
 * IMPORTANT: This function validates all input and throws descriptive errors
 * instead of silently failing
 *
 * @param blocks - Array of blocks to verify
 * @returns FullBlockchainVerification result with detailed tamper detection
 * @throws Error if blocks are invalid, null, or malformed
 */
export function verifyFullBlockchain(blocks: VoteBlockRow[]): FullBlockchainVerification {
  const allBlocksStatus: BlockVerificationStatus[] = [];
  const invalidBlocks: BlockVerificationStatus[] = [];
  const tamperedBlockIndices: number[] = [];
  const chainBreakPoints: number[] = [];
  const nonceAnomalies: string[] = [];
  const timestampAnomalies: string[] = [];
  const formatViolations: string[] = [];

  let isFullyValid = true;

  // ✅ Validate input parameter
  if (blocks === null || blocks === undefined) {
    throw new Error('Blocks parameter is null or undefined');
  }
  
  if (!Array.isArray(blocks)) {
    throw new Error('Blocks parameter is not an array. Received type: ' + typeof blocks);
  }

  if (blocks.length === 0) {
    console.log('Empty blockchain - no blocks to verify');
    return {
      isFullyValid: true,
      totalBlocks: 0,
      invalidBlocks: [],
      allBlocksStatus: [],
      timestamp: new Date().toISOString(),
      summary: 'Empty blockchain (no blocks)',
    };
  }

  // Check for gaps and duplicates in block sequence
  const blockIndices = blocks.map((b, i) => ({ index: i, blockIndex: b.block_index }));
  const blockIndexValues = blocks.map(b => b.block_index);
  const duplicateIndices = blockIndexValues.filter((val, i) => blockIndexValues.indexOf(val) !== i);
  if (duplicateIndices.length > 0) {
    formatViolations.push(`⚠️ CRITICAL: Duplicate block indices found: ${[...new Set(duplicateIndices)].join(', ')}`);
    isFullyValid = false;
  }

  let previousTimestamp: Date | null = null;

  // Verify each block
  for (let i = 0; i < blocks.length; i++) {
    const currentBlock = blocks[i];
    const blockStatus: BlockVerificationStatus = {
      index: i,
      blockId: currentBlock.id || 'unknown',
      hashValid: false,
      linkValid: i === 0, // Genesis block has no previous link
      nonceValid: true,
      timestampValid: true,
      formatValid: true,
      currentHash: currentBlock.current_hash || '',
      previousHash: currentBlock.previous_hash || '',
      errors: [],
      tamperedFields: [],
    };

    // 🔍 TAMPER CHECK 1: Required fields presence
    if (!currentBlock.encrypted_vote) {
      blockStatus.errors.push('⚠️ CRITICAL: Missing encrypted_vote field');
      blockStatus.tamperedFields?.push('encrypted_vote');
      isFullyValid = false;
      tamperedBlockIndices.push(i);
    }

    if (!currentBlock.vote_commitment) {
      blockStatus.errors.push('⚠️ CRITICAL: Missing vote_commitment field');
      blockStatus.tamperedFields?.push('vote_commitment');
      isFullyValid = false;
      tamperedBlockIndices.push(i);
    }

    // 🔍 TAMPER CHECK 2: Nonce validation (NEW)
    if (!currentBlock.nonce || currentBlock.nonce.trim().length === 0) {
      blockStatus.nonceValid = false;
      blockStatus.errors.push('⚠️ CRITICAL: Nonce missing or empty (audit trail compromised)');
      blockStatus.tamperedFields?.push('nonce');
      nonceAnomalies.push(`Block ${i}: Nonce missing`);
      isFullyValid = false;
      tamperedBlockIndices.push(i);
    } else if (!/^[a-f0-9]+$/.test(currentBlock.nonce.toLowerCase())) {
      blockStatus.nonceValid = false;
      blockStatus.errors.push('⚠️ INVALID: Nonce format invalid (not hex)');
      blockStatus.tamperedFields?.push('nonce');
      nonceAnomalies.push(`Block ${i}: Nonce format invalid`);
      isFullyValid = false;
    }

    // 🔍 TAMPER CHECK 3: Data format validation
    // Check encrypted_vote is base64
    if (!/^[A-Za-z0-9+/=]+$/.test(currentBlock.encrypted_vote)) {
      blockStatus.formatValid = false;
      blockStatus.errors.push('⚠️ CRITICAL: Encrypted vote not in base64 format');
      formatViolations.push(`Block ${i}: encrypted_vote format invalid`);
      isFullyValid = false;
      tamperedBlockIndices.push(i);
    }

    // Check hash formats (should be 64-char hex)
    if (!/^[a-f0-9]{64}$/i.test(currentBlock.current_hash)) {
      blockStatus.formatValid = false;
      blockStatus.errors.push('⚠️ INVALID: current_hash format incorrect (not 64-char hex)');
      formatViolations.push(`Block ${i}: current_hash format invalid`);
      isFullyValid = false;
    }

    if (!/^[a-f0-9]{64}$/i.test(currentBlock.previous_hash)) {
      blockStatus.formatValid = false;
      blockStatus.errors.push('⚠️ INVALID: previous_hash format incorrect (not 64-char hex)');
      formatViolations.push(`Block ${i}: previous_hash format invalid`);
      isFullyValid = false;
    }

    // Check vote_commitment format (should be 64-char hex)
    if (!/^[a-f0-9]{64}$/i.test(currentBlock.vote_commitment)) {
      blockStatus.formatValid = false;
      blockStatus.errors.push('⚠️ INVALID: vote_commitment format incorrect');
      formatViolations.push(`Block ${i}: vote_commitment format invalid`);
      isFullyValid = false;
    }

    // 🔍 TAMPER CHECK 4: Block index sequence
    if (currentBlock.block_index !== i) {
      blockStatus.errors.push(`⚠️ TAMPER: Block index mismatch. Expected ${i}, got ${currentBlock.block_index}`);
      blockStatus.tamperedFields?.push('block_index');
      isFullyValid = false;
      tamperedBlockIndices.push(i);
    }

    try {
      // 🔍 TAMPER CHECK 5: Hash correctness
      const recalculatedHash = calculateBlockHash(currentBlock);
      blockStatus.recalculatedHash = recalculatedHash;
      blockStatus.hashValid = recalculatedHash === currentBlock.current_hash;

      if (!blockStatus.hashValid) {
        blockStatus.errors.push(`⚠️ TAMPER: Hash mismatch (block data modified)`);
        blockStatus.tamperedFields?.push('current_hash');
        isFullyValid = false;
        tamperedBlockIndices.push(i);
        console.warn(`Block ${i} hash mismatch - data tampering detected`);
      }

      // 🔍 TAMPER CHECK 6: Hash chain linkage
      if (i > 0) {
        const previousBlock = blocks[i - 1];
        blockStatus.linkValid = verifyHashLink(currentBlock, previousBlock);

        if (!blockStatus.linkValid) {
          blockStatus.errors.push(`⚠️ BREAK: Chain broken (previous block link violated)`);
          blockStatus.tamperedFields?.push('previous_hash');
          isFullyValid = false;
          chainBreakPoints.push(i);
          console.warn(`Block ${i} chain link broken - block deletion or reordering detected`);
        }
      }

      // 🔍 TAMPER CHECK 7: Timestamp monotonicity
      const currentTimestamp = new Date(currentBlock.created_at);
      if (previousTimestamp && currentTimestamp <= previousTimestamp) {
        blockStatus.timestampValid = false;
        blockStatus.errors.push(`⚠️ ANOMALY: Timestamp not strictly increasing`);
        timestampAnomalies.push(`Block ${i}: Timestamp goes backward or repeats`);
        isFullyValid = false;
      }
      previousTimestamp = currentTimestamp;

      // 🔍 TAMPER CHECK 8: Timestamp format validation
      if (isNaN(currentTimestamp.getTime())) {
        blockStatus.timestampValid = false;
        blockStatus.errors.push(`⚠️ INVALID: Timestamp format invalid`);
        formatViolations.push(`Block ${i}: Invalid timestamp format`);
        isFullyValid = false;
      }

    } catch (blockError) {
      blockStatus.hashValid = false;
      blockStatus.linkValid = false;
      blockStatus.errors.push(`Block validation error: ${blockError instanceof Error ? blockError.message : String(blockError)}`);
      isFullyValid = false;
      console.error(`Block ${i} validation failed:`, blockError);
    }

    allBlocksStatus.push(blockStatus);

    // Collect invalid blocks
    if (!blockStatus.hashValid || !blockStatus.linkValid || !blockStatus.nonceValid || !blockStatus.timestampValid || !blockStatus.formatValid) {
      invalidBlocks.push(blockStatus);
    }
  }

  // Generate summary
  let summary = '';
  if (isFullyValid) {
    summary = `✅ VALID: Blockchain Status: FULLY VALID (${blocks.length} blocks verified)`;
  } else {
    const invalidBlockCount = invalidBlocks.length;
    const hashInvalidCount = invalidBlocks.filter(b => !b.hashValid).length;
    const linkInvalidCount = invalidBlocks.filter(b => !b.linkValid).length;
    const nonceInvalidCount = invalidBlocks.filter(b => !b.nonceValid).length;

    summary = `🚨 TAMPERED: Blockchain Status: INVALID - ${invalidBlockCount} block(s) failed validation`;
    if (hashInvalidCount > 0) {
      summary += `, ${hashInvalidCount} hash mismatch(es)`;
    }
    if (linkInvalidCount > 0) {
      summary += `, ${linkInvalidCount} broken link(s)`;
    }
    if (nonceInvalidCount > 0) {
      summary += `, ${nonceInvalidCount} nonce issue(s)`;
    }
  }

  return {
    isFullyValid,
    totalBlocks: blocks.length,
    invalidBlocks,
    allBlocksStatus,
    timestamp: new Date().toISOString(),
    summary,
    tamperedBlockIndices: tamperedBlockIndices.length > 0 ? tamperedBlockIndices : undefined,
    chainBreakPoints: chainBreakPoints.length > 0 ? chainBreakPoints : undefined,
    nonceAnomalies: nonceAnomalies.length > 0 ? nonceAnomalies : undefined,
    timestampAnomalies: timestampAnomalies.length > 0 ? timestampAnomalies : undefined,
    formatViolations: formatViolations.length > 0 ? formatViolations : undefined,
  };
}

/**
 * Get detailed verification report as string
 * Includes comprehensive tamper detection findings for auditing
 *
 * @param verification - The verification result
 * @returns Formatted report string
 */
export function getVerificationReport(verification: FullBlockchainVerification): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('BLOCKCHAIN INTEGRITY VERIFICATION REPORT - TAMPER DETECTION');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(verification.summary);
  lines.push('');
  lines.push(`Total Blocks: ${verification.totalBlocks}`);
  lines.push(`Timestamp: ${verification.timestamp}`);
  lines.push('');

  if (verification.totalBlocks === 0) {
    lines.push('No blocks to verify.');
    lines.push('');
    lines.push('='.repeat(80));
    return lines.join('\n');
  }

  // Report tampering detection
  if (verification.tamperedBlockIndices && verification.tamperedBlockIndices.length > 0) {
    lines.push('🚨 TAMPERED BLOCKS (data modification detected):');
    lines.push('-'.repeat(80));
    lines.push(`Block indices: ${verification.tamperedBlockIndices.join(', ')}`);
    lines.push('⚠️ WARNING: These blocks show signs of tampering. Data may have been modified.');
    lines.push('');
  }

  // Report chain breaks
  if (verification.chainBreakPoints && verification.chainBreakPoints.length > 0) {
    lines.push('⛓️ CHAIN BREAKS (discontinuity detected):');
    lines.push('-'.repeat(80));
    lines.push(`Break points at positions: ${verification.chainBreakPoints.join(', ')}`);
    lines.push('⚠️ WARNING: Chain integrity violated. Blocks may have been deleted, reordered, or inserted.');
    lines.push('');
  }

  // Report nonce anomalies
  if (verification.nonceAnomalies && verification.nonceAnomalies.length > 0) {
    lines.push('🔐 NONCE ANOMALIES (audit trail compromise):');
    lines.push('-'.repeat(80));
    verification.nonceAnomalies.forEach(anomaly => {
      lines.push(`• ${anomaly}`);
    });
    lines.push('⚠️ WARNING: Nonce integrity compromised. Cannot verify votes independently.');
    lines.push('');
  }

  // Report timestamp anomalies
  if (verification.timestampAnomalies && verification.timestampAnomalies.length > 0) {
    lines.push('⏰ TIMESTAMP ANOMALIES (temporal inconsistency):');
    lines.push('-'.repeat(80));
    verification.timestampAnomalies.forEach(anomaly => {
      lines.push(`• ${anomaly}`);
    });
    lines.push('⚠️ WARNING: Timestamps not monotonically increasing. Blocks may have been reordered.');
    lines.push('');
  }

  // Report format violations
  if (verification.formatViolations && verification.formatViolations.length > 0) {
    lines.push('📋 DATA FORMAT VIOLATIONS:');
    lines.push('-'.repeat(80));
    verification.formatViolations.forEach(violation => {
      lines.push(`• ${violation}`);
    });
    lines.push('⚠️ WARNING: Data format violations indicate corruption or tampering.');
    lines.push('');
  }

  if (verification.invalidBlocks.length > 0) {
    lines.push('INVALID BLOCKS DETAILS:');
    lines.push('-'.repeat(80));

    for (const block of verification.invalidBlocks) {
      lines.push(`Block #${block.index} (ID: ${block.blockId})`);
      lines.push(`  Hash Valid: ${block.hashValid ? '✓ YES' : '✗ NO'}`);
      lines.push(`  Link Valid: ${block.linkValid ? '✓ YES' : '✗ NO'}`);
      lines.push(`  Nonce Valid: ${block.nonceValid ? '✓ YES' : '✗ NO'}`);
      lines.push(`  Timestamp Valid: ${block.timestampValid ? '✓ YES' : '✗ NO'}`);
      lines.push(`  Format Valid: ${block.formatValid ? '✓ YES' : '✗ NO'}`);

      if (block.tamperedFields && block.tamperedFields.length > 0) {
        lines.push(`  Tampered Fields: ${block.tamperedFields.join(', ')}`);
      }

      if (block.errors.length > 0) {
        lines.push(`  Errors:`);
        block.errors.forEach((error) => {
          lines.push(`    • ${error}`);
        });
      }

      if (block.recalculatedHash && !block.hashValid) {
        lines.push(`  Stored Hash:       ${block.currentHash}`);
        lines.push(`  Recalculated Hash: ${block.recalculatedHash}`);
      }

      lines.push('');
    }
  } else {
    lines.push('✓ All blocks passed validation');
    lines.push('');
  }

  lines.push('BLOCK VERIFICATION SUMMARY:');
  lines.push('-'.repeat(80));

  for (const block of verification.allBlocksStatus) {
    const status = (block.hashValid && block.linkValid && block.nonceValid && block.timestampValid) ? '✓' : '✗';
    lines.push(`${status} Block #${block.index}: Hash ${block.hashValid ? '✓' : '✗'} | Link ${block.linkValid ? '✓' : '✗'} | Nonce ${block.nonceValid ? '✓' : '✗'} | Time ${block.timestampValid ? '✓' : '✗'}`);
  }

  lines.push('');
  lines.push('='.repeat(80));

  if (!verification.isFullyValid) {
    lines.push('🚨 RECOMMENDATION: DO NOT TRUST RESULTS - TAMPERING DETECTED');
    lines.push('Actions: 1. Stop election certification');
    lines.push('         2. Investigate compromised blocks');
    lines.push('         3. Review audit logs for unauthorized access');
    lines.push('         4. Consider re-running the election');
    lines.push('='.repeat(80));
  } else {
    lines.push('✅ BLOCKCHAIN VERIFIED - RESULTS CAN BE TRUSTED');
    lines.push('='.repeat(80));
  }

  return lines.join('\n');
}
