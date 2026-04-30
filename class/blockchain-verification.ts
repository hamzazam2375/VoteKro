import { sha256 } from '@/class/sha256-util';
import type { VoteBlockRow } from '@/class/database-types';

/**
 * Represents the validation status of a single block
 */
export interface BlockVerificationStatus {
  index: number;
  blockId: string;
  hashValid: boolean;
  linkValid: boolean;
  recalculatedHash?: string;
  currentHash: string;
  previousHash: string;
  error?: string;
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
 * Perform full blockchain integrity verification
 * Checks both hash correctness and hash linkage for all blocks
 * 
 * IMPORTANT: This function validates all input and throws descriptive errors
 * instead of silently failing
 *
 * @param blocks - Array of blocks to verify
 * @returns FullBlockchainVerification result with detailed status
 * @throws Error if blocks are invalid, null, or malformed
 */
export function verifyFullBlockchain(blocks: VoteBlockRow[]): FullBlockchainVerification {
  const allBlocksStatus: BlockVerificationStatus[] = [];
  const invalidBlocks: BlockVerificationStatus[] = [];
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

  // Verify each block
  for (let i = 0; i < blocks.length; i++) {
    const currentBlock = blocks[i];
    const blockStatus: BlockVerificationStatus = {
      index: i,
      blockId: currentBlock.id || 'unknown',
      hashValid: false,
      linkValid: i === 0, // Genesis block has no previous link
      currentHash: currentBlock.current_hash || '',
      previousHash: currentBlock.previous_hash || '',
    };

    try {
      // ✅ Check 1: Verify hash correctness
      const recalculatedHash = calculateBlockHash(currentBlock);
      blockStatus.recalculatedHash = recalculatedHash;
      blockStatus.hashValid = recalculatedHash === currentBlock.current_hash;

      if (!blockStatus.hashValid) {
        blockStatus.error = `Hash mismatch - Recalculated: ${recalculatedHash}, Stored: ${currentBlock.current_hash}`;
        isFullyValid = false;
        console.warn(`Block ${i} hash mismatch:`, blockStatus.error);
      }

      // ✅ Check 2: Verify hash linkage (skip genesis block)
      if (i > 0) {
        const previousBlock = blocks[i - 1];
        blockStatus.linkValid = verifyHashLink(currentBlock, previousBlock);

        if (!blockStatus.linkValid) {
          blockStatus.error = `Chain broken - Previous hash mismatch. Current previousHash: ${currentBlock.previous_hash}, Expected: ${previousBlock.current_hash}`;
          isFullyValid = false;
          console.warn(`Block ${i} link broken:`, blockStatus.error);
        }
      }
    } catch (blockError) {
      // ✅ Catch validation errors and mark block as invalid
      blockStatus.hashValid = false;
      blockStatus.linkValid = false;
      blockStatus.error = `Block validation error: ${blockError instanceof Error ? blockError.message : String(blockError)}`;
      isFullyValid = false;
      console.error(`Block ${i} validation failed:`, blockStatus.error);
    }

    allBlocksStatus.push(blockStatus);

    // Collect invalid blocks
    if (!blockStatus.hashValid || !blockStatus.linkValid) {
      invalidBlocks.push(blockStatus);
    }
  }

  // Generate summary
  let summary = '';
  if (isFullyValid) {
    summary = `✓ Blockchain Status: FULLY VALID (${blocks.length} blocks verified)`;
  } else {
    const invalidBlockCount = invalidBlocks.length;
    const hashInvalidCount = invalidBlocks.filter(b => !b.hashValid).length;
    const linkInvalidCount = invalidBlocks.filter(b => !b.linkValid).length;

    summary = `✗ Blockchain Status: TAMPERED - ${invalidBlockCount} block(s) invalid`;
    if (hashInvalidCount > 0) {
      summary += `, ${hashInvalidCount} hash mismatch(es)`;
    }
    if (linkInvalidCount > 0) {
      summary += `, ${linkInvalidCount} broken link(s)`;
    }
  }

  return {
    isFullyValid,
    totalBlocks: blocks.length,
    invalidBlocks,
    allBlocksStatus,
    timestamp: new Date().toISOString(),
    summary,
  };
}

/**
 * Get detailed verification report as string
 * Useful for logging and auditing
 *
 * @param verification - The verification result
 * @returns Formatted report string
 */
export function getVerificationReport(verification: FullBlockchainVerification): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('BLOCKCHAIN INTEGRITY VERIFICATION REPORT');
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

  if (verification.invalidBlocks.length > 0) {
    lines.push('INVALID BLOCKS:');
    lines.push('-'.repeat(80));

    for (const block of verification.invalidBlocks) {
      lines.push(`Block #${block.index} (ID: ${block.blockId})`);
      lines.push(`  Hash Valid: ${block.hashValid ? '✓ YES' : '✗ NO'}`);
      lines.push(`  Link Valid: ${block.linkValid ? '✓ YES' : '✗ NO'}`);

      if (block.error) {
        lines.push(`  Error: ${block.error}`);
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

  lines.push('BLOCK VERIFICATION DETAILS:');
  lines.push('-'.repeat(80));

  for (const block of verification.allBlocksStatus) {
    const status = (block.hashValid && block.linkValid) ? '✓' : '✗';
    lines.push(`${status} Block #${block.index}: Hash ${block.hashValid ? '✓' : '✗'} | Link ${block.linkValid ? '✓' : '✗'}`);
  }

  lines.push('');
  lines.push('='.repeat(80));

  return lines.join('\n');
}
