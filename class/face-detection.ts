import * as blazeface from "@tensorflow-models/blazeface";
import * as tf from "@tensorflow/tfjs";

export interface DetectedFace {
  bbox: [number, number, number, number]; // [x, y, width, height]
  confidence: number;
  keypoints?: Array<{ x: number; y: number; z?: number }>;
}

export interface FaceDetectionResult {
  faces: DetectedFace[];
  hasError: boolean;
  message: string;
}

export interface FaceImage {
  imageData: string; // base64 encoded
  timestamp: number;
  numFaces: number;
}

export class FaceDetectionService {
  private detector: any | null = null;
  private isInitialized = false;

  /**
   * Initialize the face detection model (Mediapipe Selfie Segmentation)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await tf.ready();

      // Load BlazeFace model for face detection
      this.detector = await blazeface.load();

      this.isInitialized = true;
      console.log("Face detection model initialized successfully");
    } catch (error) {
      console.error("Failed to initialize face detection model:", error);
      throw new Error(
        `Failed to initialize face detection: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Detect faces in an image (from canvas or image element)
   */
  async detectFaces(
    imageElement: HTMLCanvasElement | HTMLImageElement,
  ): Promise<FaceDetectionResult> {
    if (!this.isInitialized || !this.detector) {
      return {
        faces: [],
        hasError: true,
        message:
          "Face detection model not initialized. Please initialize first.",
      };
    }

    try {
      const predictions = await this.detector.estimateFaces(
        imageElement,
        false,
      );

      const faces: DetectedFace[] = predictions
        .map((prediction: any) => {
          // BlazeFace prediction -> topLeft, bottomRight, landmarks, probability
          let bbox: [number, number, number, number];
          let confidence = 0.0;

          if (prediction.topLeft && prediction.bottomRight) {
            const [x1, y1] = prediction.topLeft;
            const [x2, y2] = prediction.bottomRight;
            bbox = [x1, y1, x2 - x1, y2 - y1];
          } else if (prediction.boundingBox) {
            const bb = prediction.boundingBox;
            bbox = [bb.x, bb.y, bb.width, bb.height];
          } else if (prediction.box) {
            // fallback
            bbox = [
              prediction.box.xMin,
              prediction.box.yMin,
              prediction.box.width,
              prediction.box.height,
            ];
          } else if (prediction.bbox) {
            bbox = prediction.bbox;
          } else {
            return null;
          }

          if (prediction.probability != null) {
            confidence = Array.isArray(prediction.probability)
              ? prediction.probability[0]
              : prediction.probability;
          }

          const keypoints = (prediction.landmarks || []).map((kp: any) => {
            if (Array.isArray(kp)) return { x: kp[0], y: kp[1] };
            return { x: kp.x ?? 0, y: kp.y ?? 0 };
          });

          return {
            bbox,
            confidence,
            keypoints,
          };
        })
        .filter((f): f is DetectedFace => f !== null);

      return {
        faces,
        hasError: false,
        message:
          faces.length === 0
            ? "No faces detected"
            : `Detected ${faces.length} face(s)`,
      };
    } catch (error) {
      console.error("Error during face detection:", error);
      return {
        faces: [],
        hasError: true,
        message: `Face detection error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Validate face detection (check for single face with good quality)
   */
  validateDetection(result: FaceDetectionResult): {
    isValid: boolean;
    message: string;
  } {
    if (result.hasError) {
      return { isValid: false, message: result.message };
    }

    if (result.faces.length === 0) {
      return {
        isValid: false,
        message:
          "❌ No face detected. Please position your face clearly in the camera.",
      };
    }

    if (result.faces.length > 1) {
      return {
        isValid: false,
        message: `❌ Multiple faces detected (${result.faces.length}). Only one person should be in the frame.`,
      };
    }

    const face = result.faces[0];
    if (!face.bbox || face.bbox[2] < 50 || face.bbox[3] < 50) {
      return {
        isValid: false,
        message: "❌ Face is too small. Please move closer to the camera.",
      };
    }

    return {
      isValid: true,
      message: "✓ Face detected successfully!",
    };
  }

  /**
   * Convert canvas to base64 image
   */
  canvasToBase64(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  /**
   * Create a face image data object
   */
  createFaceImage(base64Data: string, numFaces: number): FaceImage {
    return {
      imageData: base64Data,
      timestamp: Date.now(),
      numFaces,
    };
  }

  /**
   * Compare two face images for similarity (basic pixel-level comparison)
   * For production, use face embeddings or a more sophisticated model
   */
  async compareFaces(
    image1Base64: string,
    image2Base64: string,
    threshold = 0.75,
  ): Promise<{
    similarity: number;
    isSamePerson: boolean;
    message: string;
  }> {
    try {
      // Load images
      const img1 = new Image();
      const img2 = new Image();

      await new Promise<void>((resolve, reject) => {
        img1.onload = () => resolve();
        img1.onerror = () => reject(new Error("Failed to load image 1"));
        img1.src = image1Base64;
      });

      await new Promise<void>((resolve, reject) => {
        img2.onload = () => resolve();
        img2.onerror = () => reject(new Error("Failed to load image 2"));
        img2.src = image2Base64;
      });

      // Detect faces in both images
      const result1 = await this.detectFaces(img1);
      const result2 = await this.detectFaces(img2);

      // Both must have exactly one face
      if (result1.faces.length !== 1 || result2.faces.length !== 1) {
        return {
          similarity: 0,
          isSamePerson: false,
          message: "Could not detect exactly one face in both images",
        };
      }

      // For now, use a simple heuristic: compare face positions and sizes
      const face1 = result1.faces[0].bbox;
      const face2 = result2.faces[0].bbox;

      // Calculate normalized differences
      const positionDiff =
        (Math.abs(face1[0] - face2[0]) + Math.abs(face1[1] - face2[1])) / 200;
      const sizeDiff =
        Math.abs(face1[2] - face2[2]) / 100 +
        Math.abs(face1[3] - face2[3]) / 100;

      // Simple similarity score (in production, use face embeddings)
      const similarity = Math.max(0, 1 - (positionDiff + sizeDiff) / 2);

      return {
        similarity,
        isSamePerson: similarity > threshold,
        message:
          similarity > threshold
            ? "✓ Face matches! Same person verified."
            : "❌ Face does not match. Different person detected.",
      };
    } catch (error) {
      console.error("Error comparing faces:", error);
      return {
        similarity: 0,
        isSamePerson: false,
        message: `Comparison error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
      this.isInitialized = false;
    }
  }
}

export const faceDetectionService = new FaceDetectionService();
