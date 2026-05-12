import * as Crypto from 'expo-crypto';

const toHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const sha256 = async (input: string): Promise<string> => {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
};

export const randomNonce = async (size = 32): Promise<string> => {
  const bytes = Crypto.getRandomBytes(size);
  return toHex(bytes);
};

export const buildVoteCommitment = async (
  electionId: string,
  candidateId: string,
  nonce: string
): Promise<string> => {
  return sha256(`${electionId}|${candidateId}|${nonce}`);
};

export const verifyHash = async (payload: string, expectedHash: string): Promise<boolean> => {
  const actual = await sha256(payload);
  return actual === expectedHash;
};

/**
 * Normalize ISO timestamp to consistent format for hashing
 * Ensures timestamps from database (with varying precision) match calculation format
 * 
 * @param timestamp - ISO timestamp string (e.g., "2024-01-15T10:30:45.123Z" or "2024-01-15T10:30:45Z")
 * @returns Normalized timestamp with milliseconds: "YYYY-MM-DDTHH:mm:ss.SSSZ"
 */
export const normalizeTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid timestamp');
    }
    // Format to ISO string with milliseconds: YYYY-MM-DDTHH:mm:ss.SSSZ
    return date.toISOString();
  } catch (error) {
    console.warn(`Failed to normalize timestamp "${timestamp}":`, error);
    // Return as-is if normalization fails
    return timestamp;
  }
};
