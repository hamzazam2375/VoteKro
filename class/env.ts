const requiredPublicVars = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;

type RequiredPublicVar = (typeof requiredPublicVars)[number];

const readPublicVar = (key: RequiredPublicVar): string => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const env = {
  supabaseUrl: readPublicVar('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: readPublicVar('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  castVoteEdgeFunctionUrl: process.env.EXPO_PUBLIC_CAST_VOTE_EDGE_URL ?? '',
  rocksDbLedgerUrl: process.env.EXPO_PUBLIC_ROCKSDB_LEDGER_URL ?? '',
};
