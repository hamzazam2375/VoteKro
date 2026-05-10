-- Face Embeddings Table
-- Stores 128-dimensional face embedding vectors for biometric authentication
-- Used by the VoteKro face recognition system

CREATE TABLE IF NOT EXISTS voter_face_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  embedding float8[] NOT NULL,           -- 128-dimensional face descriptor
  face_image_base64 text,                -- optional stored face image for reference
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast email lookups during login
CREATE INDEX IF NOT EXISTS idx_voter_face_embeddings_email
  ON voter_face_embeddings(email);

-- RLS policies
ALTER TABLE voter_face_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own embedding
CREATE POLICY "Users can read own embedding"
  ON voter_face_embeddings
  FOR SELECT
  USING (auth.uid() = voter_id);

-- Allow service role to insert/update (used during registration)
CREATE POLICY "Service role can manage embeddings"
  ON voter_face_embeddings
  FOR ALL
  USING (true)
  WITH CHECK (true);
