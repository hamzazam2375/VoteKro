import { BaseService } from "@/class/base-service";
import { supabase } from "@/class/supabase-client";

export interface FaceImage {
  imageData: string;
  timestamp: number;
  numFaces: number;
}

export interface VoterFaceRow {
  id: string;
  voter_id: string;
  face_image_base64: string;
  captured_at: string;
  is_primary: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface VoterFaceEmbeddingRow {
  id: string;
  voter_id: string;
  email: string;
  embedding: number[];
  face_image_base64: string | null;
  created_at: string;
  updated_at: string;
}

export class FaceRepository extends BaseService {
  /**
   * Store a voter's face image
   */
  async storeFace(
    voterId: string,
    faceData: FaceImage,
    isPrimary = true,
  ): Promise<VoterFaceRow> {
    this.requireNonEmpty(voterId, "Voter ID");
    this.requireNonEmpty(faceData.imageData, "Face image data");

    try {
      if (isPrimary) {
        await supabase
          .from("voter_faces")
          .update({ is_primary: false })
          .eq("voter_id", voterId)
          .eq("is_primary", true);
      }

      const { data, error } = await supabase
        .from("voter_faces")
        .insert({
          voter_id: voterId,
          face_image_base64: faceData.imageData,
          is_primary: isPrimary,
          metadata: {
            numFaces: faceData.numFaces,
            capturedAt: new Date(faceData.timestamp).toISOString(),
          },
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to store face: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error storing voter face:", error);
      throw error;
    }
  }

  /**
   * Get primary face image for a voter
   */
  async getPrimaryFace(voterId: string): Promise<VoterFaceRow | null> {
    this.requireNonEmpty(voterId, "Voter ID");

    try {
      const { data, error } = await supabase
        .from("voter_faces")
        .select("*")
        .eq("voter_id", voterId)
        .eq("is_primary", true)
        .order("captured_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to fetch primary face: ${error.message}`);
      }

      return data || null;
    } catch (error) {
      console.error("Error fetching primary voter face:", error);
      throw error;
    }
  }

  /**
   * Get all faces for a voter
   */
  async getVoterFaces(voterId: string): Promise<VoterFaceRow[]> {
    this.requireNonEmpty(voterId, "Voter ID");

    try {
      const { data, error } = await supabase
        .from("voter_faces")
        .select("*")
        .eq("voter_id", voterId)
        .order("captured_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch voter faces: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching voter faces:", error);
      throw error;
    }
  }

  /**
   * Delete a face record
   */
  async deleteFace(faceId: string): Promise<void> {
    this.requireNonEmpty(faceId, "Face ID");

    try {
      const { error } = await supabase
        .from("voter_faces")
        .delete()
        .eq("id", faceId);

      if (error) {
        throw new Error(`Failed to delete face: ${error.message}`);
      }
    } catch (error) {
      console.error("Error deleting face:", error);
      throw error;
    }
  }

  /**
   * Update face metadata
   */
  async updateFaceMetadata(
    faceId: string,
    metadata: Record<string, unknown>,
  ): Promise<VoterFaceRow> {
    this.requireNonEmpty(faceId, "Face ID");

    try {
      const { data, error } = await supabase
        .from("voter_faces")
        .update({ metadata })
        .eq("id", faceId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update face metadata: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error updating face metadata:", error);
      throw error;
    }
  }

  /**
   * Check if voter has registered face
   */
  async hasFaceRegistered(voterId: string): Promise<boolean> {
    this.requireNonEmpty(voterId, "Voter ID");

    try {
      const face = await this.getPrimaryFace(voterId);
      return face !== null;
    } catch (error) {
      console.error("Error checking face registration:", error);
      return false;
    }
  }

  // ─── Face Embedding Methods (128-d vectors) ────────────────────

  /**
   * Store a face embedding for a voter by email.
   */
  async storeEmbedding(
    email: string,
    embedding: number[],
    faceImageBase64?: string,
    voterId?: string,
  ): Promise<void> {
    this.requireNonEmpty(email, "Email");
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Embedding must be a non-empty array");
    }

    try {
      const { error } = await supabase.from("voter_face_embeddings").upsert(
        {
          email: email.toLowerCase(),
          embedding,
          face_image_base64: faceImageBase64 ?? null,
          voter_id: voterId ?? null,
        },
        { onConflict: "email" },
      );

      if (error) {
        throw new Error(`Failed to store embedding: ${error.message}`);
      }

      console.log(`Face embedding stored for ${email} (${embedding.length}-d)`);
    } catch (error) {
      console.error("Error storing face embedding:", error);
      throw error;
    }
  }

  /**
   * Get stored face embedding for a voter by email.
   */
  async getEmbeddingByEmail(
    email: string,
  ): Promise<VoterFaceEmbeddingRow | null> {
    this.requireNonEmpty(email, "Email");

    try {
      const { data, error } = await supabase
        .from("voter_face_embeddings")
        .select("*")
        .eq("email", email.toLowerCase())
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to fetch embedding: ${error.message}`);
      }

      return data || null;
    } catch (error) {
      console.error("Error fetching face embedding:", error);
      return null;
    }
  }

  /**
   * Check if a voter has an embedding stored.
   */
  async hasEmbedding(email: string): Promise<boolean> {
    const row = await this.getEmbeddingByEmail(email);
    return row !== null && row.embedding.length > 0;
  }
}

export const faceRepository = new FaceRepository();
