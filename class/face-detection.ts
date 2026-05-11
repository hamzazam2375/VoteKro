import { Platform } from "react-native";

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

/**
 * Detection strategy:
 * - "native-api" – Chrome/Edge FaceDetector (Shape Detection API)
 * - "canvas"     – skin-tone heuristic via canvas (web fallback)
 * - "visual"     – admin visually confirms (mobile / unsupported)
 */
type DetectionStrategy = "native-api" | "canvas" | "visual";

const isWeb = Platform.OS === "web";

export class FaceDetectionService {
  private isInitialized = false;
  private nativeDetector: any | null = null;
  private strategy: DetectionStrategy = "visual";

  /**
   * Initialize face detection.
   * Web: tries browser-native FaceDetector, falls back to canvas heuristic.
   * Native: visual-confirmation mode.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!isWeb) {
      this.strategy = "visual";
      this.isInitialized = true;
      console.log("Face detection: native platform — visual confirmation mode");
      return;
    }

    // Web: try the browser's native FaceDetector API (Chrome 93+ / Edge)
    try {
      const g = globalThis as any;
      if (typeof g.FaceDetector !== "undefined") {
        this.nativeDetector = new g.FaceDetector({
          maxDetectedFaces: 5,
          fastMode: true,
        });
        // Smoke-test: some browsers expose the constructor but throw on use
        const c = document.createElement("canvas");
        c.width = 1;
        c.height = 1;
        await this.nativeDetector.detect(c);
        this.strategy = "native-api";
        this.isInitialized = true;
        console.log("Face detection: browser-native FaceDetector API ✓");
        return;
      }
    } catch {
      console.warn(
        "FaceDetector API unavailable, falling back to canvas heuristic",
      );
      this.nativeDetector = null;
    }

    // Web fallback: canvas skin-tone heuristic
    this.strategy = "canvas";
    this.isInitialized = true;
    console.log("Face detection: canvas skin-tone heuristic ✓");
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Detect faces.
   *
   * @param input  On web pass an HTMLImageElement / HTMLCanvasElement / data-URI string / blob URL.
   *               On native this parameter is ignored (visual confirmation).
   */
  async detectFaces(
    input?: HTMLCanvasElement | HTMLImageElement | string,
  ): Promise<FaceDetectionResult> {
    // Native mobile — always return "face present" for visual confirmation
    if (!isWeb) {
      return {
        faces: [{ bbox: [0, 0, 100, 100], confidence: 1.0 }],
        hasError: false,
        message: "✓ Ready to capture (visual confirmation mode)",
      };
    }

    if (!this.isInitialized) {
      return {
        faces: [],
        hasError: true,
        message: "Face detection not initialized.",
      };
    }

    if (!input) {
      return { faces: [], hasError: true, message: "No image provided." };
    }

    try {
      let drawable: HTMLCanvasElement | HTMLImageElement | ImageBitmap;

      if (typeof input === "string") {
        // Convert data URI or blob URL → Blob → ImageBitmap → Canvas
        drawable = await this.stringToCanvas(input);
      } else {
        drawable = input;
      }

      if (this.strategy === "native-api" && this.nativeDetector) {
        return await this.detectWithNativeAPI(drawable as any);
      }
      return this.detectWithCanvasHeuristic(drawable as any);
    } catch (error) {
      console.error("Face detection error:", error);
      return {
        faces: [],
        hasError: true,
        message: `Detection error: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }
  }

  /**
   * Convert a data URI or blob URL string to a canvas element.
   * Uses fetch + createImageBitmap (works reliably on web, unlike new Image()).
   */
  private async stringToCanvas(src: string): Promise<HTMLCanvasElement> {
    const response = await fetch(src);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    return canvas;
  }

  /**
   * Validate that exactly one face is present.
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
    return { isValid: true, message: "✓ Face detected successfully!" };
  }

  /**
   * Compare two face images for similarity.
   * Web: client-side color histogram comparison via canvas.
   * Native: visual confirmation (accepts face, same as mobile app).
   */
  async compareFaces(
    image1Base64: string,
    image2Base64: string,
    threshold = 0.6,
  ): Promise<{ similarity: number; isSamePerson: boolean; message: string }> {
    // Native: try to run real embedding-based comparison via faceRecognitionService.
    if (!isWeb) {
      try {
        // Require at runtime to avoid circular import issues during module init.
        const { faceRecognitionService } = require("@/class/face-recognition");

        const emb1 =
          await faceRecognitionService.generateEmbedding(image1Base64);
        const emb2 =
          await faceRecognitionService.generateEmbedding(image2Base64);

        if (!emb1.detected || !emb2.detected) {
          return {
            similarity: 0,
            isSamePerson: false,
            message:
              "❌ Could not detect face in one or both images on native device.",
          };
        }

        const comparison = faceRecognitionService.compareEmbeddings(
          emb1.embedding,
          emb2.embedding,
          threshold,
        );

        return {
          similarity: comparison.similarity,
          isSamePerson: comparison.isMatch,
          message: comparison.message,
        };
      } catch (error) {
        console.error("Native face comparison error:", error);
        // Do not auto-accept if embedding comparison fails. Return failure so
        // callers can choose fallback authentication or surface an error.
        return {
          similarity: 0,
          isSamePerson: false,
          message: `❌ Native embedding comparison failed: ${
            error instanceof Error ? error.message : "Unknown"
          }`,
        };
      }
    }
    // Web: use real embeddings via faceRecognitionService (no color-histogram fallback)
    try {
      const { faceRecognitionService } = require("@/class/face-recognition");

      const emb1 = await faceRecognitionService.generateEmbedding(image1Base64);
      const emb2 = await faceRecognitionService.generateEmbedding(image2Base64);

      if (!emb1.detected || !emb2.detected) {
        return {
          similarity: 0,
          isSamePerson: false,
          message: "❌ Could not detect face in one or both images (web).",
        };
      }

      const comparison = faceRecognitionService.compareEmbeddings(
        emb1.embedding,
        emb2.embedding,
        threshold,
      );

      return {
        similarity: comparison.similarity,
        isSamePerson: comparison.isMatch,
        message: comparison.message,
      };
    } catch (error) {
      console.error("Face embedding comparison (web) error:", error);
      return {
        similarity: 0,
        isSamePerson: false,
        message: `❌ Face comparison unavailable: ${
          error instanceof Error ? error.message : "Unknown"
        }`,
      };
    }
  }

  createFaceImage(base64Data: string, numFaces: number): FaceImage {
    return { imageData: base64Data, timestamp: Date.now(), numFaces };
  }

  dispose(): void {
    this.nativeDetector = null;
    this.isInitialized = false;
  }

  // ---------------------------------------------------------------------------
  // Private — web-only helpers (only called when isWeb === true)
  // ---------------------------------------------------------------------------

  private async detectWithNativeAPI(
    imageElement: HTMLCanvasElement | HTMLImageElement,
  ): Promise<FaceDetectionResult> {
    const detections = await this.nativeDetector.detect(imageElement);

    const faces: DetectedFace[] = detections.map((d: any) => ({
      bbox: [
        d.boundingBox.x,
        d.boundingBox.y,
        d.boundingBox.width,
        d.boundingBox.height,
      ] as [number, number, number, number],
      confidence: 0.95,
      keypoints: d.landmarks?.map((l: any) => ({
        x: l.locations[0]?.x ?? 0,
        y: l.locations[0]?.y ?? 0,
      })),
    }));

    console.log(`Native FaceDetector: ${faces.length} face(s) found`);

    return {
      faces,
      hasError: false,
      message:
        faces.length === 0
          ? "No faces detected"
          : `Detected ${faces.length} face(s)`,
    };
  }

  private detectWithCanvasHeuristic(
    imageElement: HTMLCanvasElement | HTMLImageElement,
  ): FaceDetectionResult {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { faces: [], hasError: true, message: "Canvas not available" };
    }

    const size = 100;
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(imageElement, 0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Sample the center 50 % of the frame
    const margin = Math.floor(size * 0.25);
    const end = size - margin;
    let skinPixels = 0;
    let totalSampled = 0;

    for (let y = margin; y < end; y += 2) {
      for (let x = margin; x < end; x += 2) {
        const i = (y * size + x) * 4;
        if (this.isSkinTone(pixels[i], pixels[i + 1], pixels[i + 2])) {
          skinPixels++;
        }
        totalSampled++;
      }
    }

    const skinRatio = skinPixels / totalSampled;
    const hasFace = skinRatio > 0.15; // ≥ 15 % skin-tone pixels

    console.log(
      `Canvas heuristic: ${(skinRatio * 100).toFixed(1)}% skin → ${hasFace ? "FACE" : "NO FACE"}`,
    );

    if (hasFace) {
      return {
        faces: [
          {
            bbox: [margin, margin, end - margin, end - margin],
            confidence: Math.min(skinRatio * 2, 1),
          },
        ],
        hasError: false,
        message: "Face detected",
      };
    }

    return {
      faces: [],
      hasError: false,
      message: "No face detected — ensure your face is clearly visible",
    };
  }

  /** Peer et al. RGB skin-tone rules + normalized-RGB for darker tones. */
  private isSkinTone(r: number, g: number, b: number): boolean {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    if (
      r > 95 &&
      g > 40 &&
      b > 20 &&
      max - min > 15 &&
      Math.abs(r - g) > 15 &&
      r > g &&
      r > b
    ) {
      return true;
    }

    const sum = r + g + b;
    if (sum > 0) {
      const rn = r / sum;
      const gn = g / sum;
      if (rn > 0.36 && rn < 0.465 && gn > 0.28 && gn < 0.363) {
        return true;
      }
    }

    return false;
  }
}

export const faceDetectionService = new FaceDetectionService();
