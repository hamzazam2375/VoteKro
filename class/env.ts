const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.trim().length === 0) {
  throw new Error(
    "Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL",
  );
}

if (!supabaseAnonKey || supabaseAnonKey.trim().length === 0) {
  throw new Error(
    "Missing required environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  castVoteEdgeFunctionUrl: process.env.EXPO_PUBLIC_CAST_VOTE_EDGE_URL ?? "",
  rocksDbLedgerUrl: process.env.EXPO_PUBLIC_ROCKSDB_LEDGER_URL ?? "",
  voteEncryptionKey: process.env.EXPO_PUBLIC_VOTE_ENCRYPTION_KEY ?? "",
};
