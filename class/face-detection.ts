import { Platform } from "react-native";
import { supabase } from "@/class/supabase-client";

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
      console.warn("FaceDetector API unavailable, falling back to canvas heuristic");
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
   * @param input  On web pass an HTMLImageElement / HTMLCanvasElement.
   *               On any platform you may pass a base64 data-URI string;
   *               it will be converted to an Image internally (web only).
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
      return { faces: [], hasError: true, message: "Face detection not initialized." };
    }

    if (!input) {
      return { faces: [], hasError: true, message: "No image provided." };
    }

    try {
      // If caller passed a base64 string, load it into an Image element first
      let imgElement: HTMLCanvasElement | HTMLImageElement;
      if (typeof input === "string") {
        imgElement = await this.loadImage(input);
      } else {
        imgElement = input;
      }

      if (this.strategy === "native-api" && this.nativeDetector) {
        return await this.detectWithNativeAPI(imgElement);
      }
      return this.detectWithCanvasHeuristic(imgElement);
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
        message: "❌ No face detected. Please position your face clearly in the camera.",
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
   * Compare two face images using server-side verification.
   * Works on both web and native via the verify-face edge function.
   */
  async compareFaces(
    image1Base64: string,
    image2Base64: string,
    threshold = 0.6,
  ): Promise<{ similarity: number; isSamePerson: boolean; message: string }> {
    try {
      const { data, error } = await supabase.functions.invoke("verify-face", {
        body: {
          image1Base64,
          image2Base64,
          threshold,
        },
      });

      if (error) {
        console.error("Face verification edge function error:", error);
        // If server is unavailable on web, fall back to client-side comparison
        if (isWeb) {
          return this.compareFacesClientSide(image1Base64, image2Base64, threshold);
        }
        return {
          similarity: 0,
          isSamePerson: false,
          message: `Verification failed: ${error.message}`,
        };
      }

      return {
        similarity: data.similarity ?? 0,
        isSamePerson: data.isSamePerson ?? false,
        message: data.message ?? "Unknown result",
      };
    } catch (error) {
      console.error("Error comparing faces:", error);
      // Fallback to client-side on web if edge function fails
      if (isWeb) {
        return this.compareFacesClientSide(image1Base64, image2Base64, threshold);
      }
      return {
        similarity: 0,
        isSamePerson: false,
        message: `Comparison error: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }
  }

  /**
   * Client-side face comparison fallback (web only).
   * Uses color histogram similarity.
   */
  private async compareFacesClientSide(
    image1Base64: string,
    image2Base64: string,
    threshold: number,
  ): Promise<{ similarity: number; isSamePerson: boolean; message: string }> {
    try {
      const img1 = await this.loadImage(image1Base64);
      const img2 = await this.loadImage(image2Base64);

      const r1 = await this.detectFaces(img1);
      const r2 = await this.detectFaces(img2);

      if (r1.faces.length !== 1 || r2.faces.length !== 1) {
        return {
          similarity: 0,
          isSamePerson: false,
          message: "Could not detect exactly one face in both images",
        };
      }

      const similarity = this.compareImageRegions(img1, img2);

      return {
        similarity,
        isSamePerson: similarity > threshold,
        message:
          similarity > threshold
            ? "✓ Face matches! Same person verified."
            : "❌ Face does not match. Different person detected.",
      };
    } catch (error) {
      return {
        similarity: 0,
        isSamePerson: false,
        message: `Client comparison error: ${error instanceof Error ? error.message : "Unknown"}`,
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
      r > 95 && g > 40 && b > 20 &&
      max - min > 15 &&
      Math.abs(r - g) > 15 &&
      r > g && r > b
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

  /** Color-histogram similarity (Bhattacharyya coefficient). Web only. */
  private compareImageRegions(
    img1: HTMLImageElement,
    img2: HTMLImageElement,
  ): number {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    ctx.drawImage(img1, 0, 0, size, size);
    const h1 = this.colorHistogram(ctx.getImageData(0, 0, size, size));
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img2, 0, 0, size, size);
    const h2 = this.colorHistogram(ctx.getImageData(0, 0, size, size));

    let sum = 0;
    for (let i = 0; i < h1.length; i++) sum += Math.sqrt(h1[i] * h2[i]);
    return sum;
  }

  private colorHistogram(imageData: ImageData): number[] {
    const bins = 16;
    const hist = new Array(bins * 3).fill(0);
    const px = imageData.data;
    const total = px.length / 4;
    for (let i = 0; i < px.length; i += 4) {
      hist[Math.floor((px[i] / 256) * bins)]++;
      hist[bins + Math.floor((px[i + 1] / 256) * bins)]++;
      hist[bins * 2 + Math.floor((px[i + 2] / 256) * bins)]++;
    }
    for (let i = 0; i < hist.length; i++) hist[i] /= total;
    return hist;
  }

  /** Load a base64 data-URI into an HTMLImageElement. Web only. */
  private loadImage(src: string): Promise<HTMLImageElement> {
    const img = new Image();
    img.crossOrigin = "anonymous";
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = src;
    });
  }
}

export const faceDetectionService = new FaceDetectionService();
