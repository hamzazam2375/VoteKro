import { BaseService } from "@/class/base-service";
import type { FaceImage } from "@/class/face-detection";
import { supabase } from "@/class/supabase-client";

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
      // If this is primary, set other faces to non-primary
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
        // PGRST116 means no rows found, which is acceptable
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
}

export const faceRepository = new FaceRepository();
