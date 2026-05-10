import { Platform } from "react-native";

export interface FaceEmbeddingResult {
  embedding: number[];
  faceCount: number;
  detected: boolean;
  message: string;
}

export interface FaceComparisonResult {
  similarity: number;
  isMatch: boolean;
  message: string;
}

const isWeb = Platform.OS === "web";

// CDN for face-api.js model files
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

// Max image dimension for face detection (larger = slower)
const MAX_IMAGE_SIZE = 640;

/**
 * Real biometric face recognition service using face-api.js.
 *
 * Web: Loads models and runs inference directly in the browser.
 * Native: Returns empty embedding (requires WebView or server).
 */
class FaceRecognitionService {
  private faceapi: any = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize face-api.js models.
   * Loads TinyFaceDetector (fast detection), Face Landmarks (alignment),
   * and Face Recognition (128-d embedding) models from CDN.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    if (!isWeb) {
      this.isInitialized = true;
      console.log("FaceRecognition: Native platform — limited mode");
      return;
    }

    try {
      // Import browser build explicitly (Node build requires tfjs-node)
      const faceapi = await import("@vladmandic/face-api/dist/face-api.esm.js");
      this.faceapi = faceapi;

      console.log("FaceRecognition: Loading models from CDN...");

      // Use TinyFaceDetector instead of SSD MobileNet — much faster
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      this.isInitialized = true;
      console.log("FaceRecognition: All models loaded ✓");
    } catch (error) {
      this.initPromise = null;
      console.error("FaceRecognition: Model loading failed:", error);
      throw new Error(
        `Failed to load face recognition models: ${error instanceof Error ? error.message : "Unknown"}`,
      );
    }
  }

  /**
   * Generate a 128-dimensional face embedding from an image.
   *
   * @param imageSource  Data URI (data:image/jpeg;base64,...) or blob URL
   * @returns            Embedding vector, face count, and detection status
   */
  async generateEmbedding(
    imageSource: string,
  ): Promise<FaceEmbeddingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!isWeb || !this.faceapi) {
      // Native: use hidden WebView to run face-api.js
      try {
        const { generateEmbeddingViaWebView } = require("@/components/face-recognition-webview");
        const embedding = await generateEmbeddingViaWebView(imageSource);
        if (embedding.length === 0) {
          return {
            embedding: [],
            faceCount: 0,
            detected: false,
            message: "❌ No face detected on native. Position your face clearly.",
          };
        }
        return {
          embedding,
          faceCount: 1,
          detected: true,
          message: "✓ Face detected (native WebView)",
        };
      } catch (error) {
        console.error("Native face recognition error:", error);
        return {
          embedding: [],
          faceCount: 0,
          detected: false,
          message: `Native face error: ${error instanceof Error ? error.message : "Unknown"}`,
        };
      }
    }

    try {
      console.log("FaceRecognition: Loading image...", imageSource.substring(0, 30));

      // Load and resize image to canvas
      const canvas = await this.loadAndResizeImage(imageSource);
      console.log(`FaceRecognition: Image loaded (${canvas.width}x${canvas.height})`);

      // Use TinyFaceDetector — much faster than SSD MobileNet
      const options = new this.faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.5,
      });

      console.log("FaceRecognition: Detecting faces...");

      // Detect ALL faces to validate single-face requirement
      const allDetections = await this.faceapi
        .detectAllFaces(canvas, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

      console.log(`FaceRecognition: Found ${allDetections.length} face(s)`);

      if (allDetections.length === 0) {
        return {
          embedding: [],
          faceCount: 0,
          detected: false,
          message: "❌ No face detected. Position your face clearly in the camera.",
        };
      }

      if (allDetections.length > 1) {
        return {
          embedding: [],
          faceCount: allDetections.length,
          detected: false,
          message: `❌ ${allDetections.length} faces detected. Only one person should be in the frame.`,
        };
      }

      // Extract the 128-dimensional descriptor
      const descriptor = allDetections[0].descriptor;
      const embedding = Array.from(descriptor) as number[];

      console.log(
        `FaceRecognition: Embedding generated (${embedding.length}-d), confidence: ${allDetections[0].detection.score.toFixed(3)}`,
      );

      return {
        embedding,
        faceCount: 1,
        detected: true,
        message: "✓ Face detected and embedding generated",
      };
    } catch (error) {
      console.error("FaceRecognition: Embedding generation failed:", error);
      return {
        embedding: [],
        faceCount: 0,
        detected: false,
        message: `Detection error: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }
  }

  /**
   * Compare two face embeddings using cosine similarity.
   */
  compareEmbeddings(
    embedding1: number[],
    embedding2: number[],
    threshold = 0.6,
  ): FaceComparisonResult {
    if (embedding1.length === 0 || embedding2.length === 0) {
      return {
        similarity: 0,
        isMatch: false,
        message: "❌ Missing embedding data for comparison",
      };
    }

    if (embedding1.length !== embedding2.length) {
      return {
        similarity: 0,
        isMatch: false,
        message: "❌ Embedding dimensions do not match",
      };
    }

    const similarity = this.cosineSimilarity(embedding1, embedding2);
    const isMatch = similarity >= threshold;

    console.log(
      `FaceRecognition: Cosine similarity = ${similarity.toFixed(4)}, threshold = ${threshold}, match = ${isMatch}`,
    );

    return {
      similarity,
      isMatch,
      message: isMatch
        ? `✓ Face matches! (similarity: ${(similarity * 100).toFixed(1)}%)`
        : `❌ Face does not match (similarity: ${(similarity * 100).toFixed(1)}%)`,
    };
  }

  /**
   * Cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Load an image and resize to max MAX_IMAGE_SIZE px.
   * Returns an HTMLCanvasElement that face-api.js can process directly.
   */
  private async loadAndResizeImage(src: string): Promise<HTMLCanvasElement> {
    // Create an Image element and wait for it to load
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      // No crossOrigin for blob/data URIs (it causes failures)
      el.onload = () => resolve(el);
      el.onerror = (e) => {
        console.error("Image load error:", e, "src starts with:", src.substring(0, 50));
        reject(new Error("Failed to load image"));
      };
      el.src = src;
    });

    // Resize to max dimension
    let { naturalWidth: w, naturalHeight: h } = img;
    if (w === 0 || h === 0) {
      // Fallback for some browsers
      w = img.width;
      h = img.height;
    }

    const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(w, h));
    const newW = Math.round(w * scale);
    const newH = Math.round(h * scale);

    const canvas = document.createElement("canvas");
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, newW, newH);

    console.log(`FaceRecognition: Resized ${w}x${h} → ${newW}x${newH}`);
    return canvas;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.faceapi = null;
    this.isInitialized = false;
    this.initPromise = null;
  }
}

export { FaceRecognitionService };
export const faceRecognitionService = new FaceRecognitionService();
