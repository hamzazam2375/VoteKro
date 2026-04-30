/**
 * Vote Count Verification Utilities
 * Compares blockchain vote counts with computed election results
 * Detects mismatches and inconsistencies in voting data
 */

import type { VoteBlockRow, CandidateRow } from '@/class/database-types';

/**
 * Represents vote counts per candidate
 */
export interface VoteCounts {
  [candidateName: string]: number;
}

/**
 * Represents a mismatch between blockchain and results
 */
export interface VoteMismatch {
  candidateId: string;
  candidateName: string;
  blockchainCount: number;
  resultCount: number;
  difference: number;
  percentageDifference: number;
}

/**
 * Result of vote count verification
 */
export interface VoteCountVerificationResult {
  isConsistent: boolean;
  blockchainCounts: VoteCounts;
  resultCounts: VoteCounts;
  totalBlockchainVotes: number;
  totalResultVotes: number;
  voteDifference: number;
  mismatches: VoteMismatch[];
  allCandidates: CandidateRow[];
  timestamp: string;
}

/**
 * Step 1: Extract and count votes from blockchain blocks
 * Loop through all blocks and count votes per candidate
 * 
 * @param blocks - Array of vote blocks from blockchain
 * @param candidates - Array of candidates for mapping IDs to names
 * @returns Vote counts keyed by candidate name
 */
export function countVotesFromBlockchain(
  blocks: VoteBlockRow[],
  candidates: CandidateRow[]
): VoteCounts {
  const counts: VoteCounts = {};

  // Initialize candidate counts
  candidates.forEach((candidate) => {
    counts[candidate.display_name] = 0;
  });

  // Create candidate ID to name mapping
  const candidateMap = new Map(candidates.map((c) => [c.id, c.display_name]));

  // Count votes from encrypted_vote field (which contains candidate ID)
  blocks.forEach((block) => {
    // The encrypted_vote field contains the candidate ID
    const candidateId = block.encrypted_vote;
    const candidateName = candidateMap.get(candidateId);

    if (candidateName) {
      counts[candidateName] = (counts[candidateName] || 0) + 1;
    }
  });

  return counts;
}

/**
 * Step 2: Compare blockchain counts with computed results
 * Check if each candidate's votes match between blockchain and results
 * 
 * @param blockchainCounts - Vote counts from blockchain
 * @param resultCounts - Vote counts from results
 * @param candidates - Array of candidates for detailed info
 * @returns Verification result with mismatches
 */
export function verifyVoteCounts(
  blockchainCounts: VoteCounts,
  resultCounts: VoteCounts,
  candidates: CandidateRow[] = []
): VoteCountVerificationResult {
  let isConsistent = true;
  const mismatches: VoteMismatch[] = [];

  // Calculate total votes
  const totalBlockchainVotes = Object.values(blockchainCounts).reduce((sum, count) => sum + count, 0);
  const totalResultVotes = Object.values(resultCounts).reduce((sum, count) => sum + count, 0);

  // Check each candidate in results
  const allCandidateNames = new Set([
    ...Object.keys(blockchainCounts),
    ...Object.keys(resultCounts),
  ]);

  allCandidateNames.forEach((candidateName) => {
    const blockchainCount = blockchainCounts[candidateName] || 0;
    const resultCount = resultCounts[candidateName] || 0;

    if (blockchainCount !== resultCount) {
      isConsistent = false;
      const difference = resultCount - blockchainCount;
      const percentageDifference = totalResultVotes > 0 
        ? ((difference / totalResultVotes) * 100).toFixed(2) 
        : '0.00';

      const candidate = candidates.find((c) => c.display_name === candidateName);

      mismatches.push({
        candidateId: candidate?.id || '',
        candidateName,
        blockchainCount,
        resultCount,
        difference,
        percentageDifference: parseFloat(percentageDifference),
      });
    }
  });

  // Sort mismatches by difference (largest first)
  mismatches.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return {
    isConsistent,
    blockchainCounts,
    resultCounts,
    totalBlockchainVotes,
    totalResultVotes,
    voteDifference: totalResultVotes - totalBlockchainVotes,
    mismatches,
    allCandidates: candidates,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate a detailed verification report
 * 
 * @param result - Verification result
 * @returns Human-readable report
 */
export function generateVerificationReport(result: VoteCountVerificationResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('VOTE COUNT VERIFICATION REPORT');
  lines.push('='.repeat(60));
  lines.push('');

  // Overall Status
  lines.push(`Status: ${result.isConsistent ? '✅ CONSISTENT' : '❌ MISMATCH DETECTED'}`);
  lines.push(`Timestamp: ${new Date(result.timestamp).toLocaleString()}`);
  lines.push('');

  // Total Votes
  lines.push('TOTAL VOTES:');
  lines.push(`  Blockchain: ${result.totalBlockchainVotes}`);
  lines.push(`  Results:    ${result.totalResultVotes}`);
  lines.push(`  Difference: ${result.voteDifference > 0 ? '+' : ''}${result.voteDifference}`);
  lines.push('');

  // Detailed comparison
  lines.push('CANDIDATE-BY-CANDIDATE COMPARISON:');
  lines.push('-'.repeat(60));

  // Build table
  const candidates = Array.from(
    new Set([
      ...Object.keys(result.blockchainCounts),
      ...Object.keys(result.resultCounts),
    ])
  ).sort();

  candidates.forEach((candidateName) => {
    const blockchain = result.blockchainCounts[candidateName] || 0;
    const resultCount = result.resultCounts[candidateName] || 0;
    const status = blockchain === resultCount ? '✓' : '✗';
    const difference = resultCount - blockchain;

    lines.push(
      `${status} ${candidateName.padEnd(20)} | Blockchain: ${String(blockchain).padStart(5)} | Results: ${String(resultCount).padStart(5)} | Diff: ${difference > 0 ? '+' : ''}${String(difference).padStart(3)}`
    );
  });

  lines.push('-'.repeat(60));
  lines.push('');

  // Mismatches
  if (result.mismatches.length > 0) {
    lines.push(`MISMATCHES DETECTED (${result.mismatches.length}):`);
    result.mismatches.forEach((mismatch) => {
      lines.push(
        `  ⚠️ ${mismatch.candidateName}: Blockchain=${mismatch.blockchainCount}, Results=${mismatch.resultCount} (Diff=${mismatch.difference}, ${mismatch.percentageDifference}%)`
      );
    });
  } else {
    lines.push('✅ No mismatches detected. All vote counts are consistent.');
  }

  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}
