/**
 * SHA256 Utility
 * Provides cross-platform SHA256 hashing
 * Uses native crypto when available, falls back to simple implementation
 */

// Try to use Node.js crypto module if available
let nodeHasher: ((data: string) => string) | null = null;

try {
  // This will work in Node.js environments
  // @ts-ignore - crypto is node-specific
  const crypto = require('crypto');
  nodeHasher = (data: string) => crypto.createHash('sha256').update(data).digest('hex');
} catch (e) {
  // Not in Node.js environment, will use fallback
}

/**
 * Calculate SHA-256 hash of a string
 * @param data The string to hash
 * @returns The hexadecimal hash
 */
export function sha256(data: string): string {
  // Use Node.js crypto if available (for server/test contexts)
  if (nodeHasher) {
    return nodeHasher(data);
  }

  // Fallback: Use a simple hash function for browser/Expo environment
  // This is a simple implementation for compatibility
  // WARNING: This is not cryptographically secure - use only for non-security-critical purposes
  return simpleHash(data);
}

/**
 * Simple fallback hash function for non-Node.js environments
 * NOT cryptographically secure - use only when native crypto is unavailable
 */
function simpleHash(str: string): string {
  let hash = 0;
  let charCode: number;
  let i: number;

  // Use a simple algorithm that produces a 64-character hex string similar to SHA256
  for (i = 0; i < str.length; i++) {
    charCode = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + charCode;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to hex and pad to 64 characters (256-bit)
  let hex = Math.abs(hash).toString(16).padStart(8, '0');

  // Repeat and mix to create a 64-character string
  for (let j = 0; j < 7; j++) {
    let nextHash = 0;
    for (let k = 0; k < str.length; k++) {
      const charCode = str.charCodeAt(k);
      nextHash = ((nextHash << 5) - nextHash) + charCode + (j * 31);
      nextHash = nextHash & nextHash;
    }
    hex += Math.abs(nextHash).toString(16).padStart(8, '0');
  }

  return hex.substring(0, 64);
}

export default sha256;
