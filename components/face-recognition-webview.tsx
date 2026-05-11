import { useCallback, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";

let webViewResolvers: Map<
  string,
  {
    resolve: (embedding: number[]) => void;
    reject: (error: Error) => void;
  }
> = new Map();

// HTML page that loads face-api.js and processes face images
const FACE_API_HTML = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js"></script>
</head>
<body>
<script>
  let modelsLoaded = false;
  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

  async function loadModels() {
    if (modelsLoaded) return;
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'models_loaded',
      }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: 'Model load failed: ' + e.message,
      }));
    }
  }

  async function processImage(requestId, base64Data) {
    try {
      if (!modelsLoaded) await loadModels();

      const img = new Image();
      const imageSource = base64Data.startsWith('data:')
        ? base64Data
        : 'data:image/jpeg;base64,' + base64Data;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageSource;
      });

      // Resize to 640px max
      const maxSize = 640;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.5,
      });

      const detections = await faceapi
        .detectAllFaces(canvas, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'result',
          requestId,
          embedding: [],
          faceCount: 0,
          detected: false,
          message: 'No face detected',
        }));
        return;
      }

      if (detections.length > 1) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'result',
          requestId,
          embedding: [],
          faceCount: detections.length,
          detected: false,
          message: detections.length + ' faces detected. Only one allowed.',
        }));
        return;
      }

      const embedding = Array.from(detections[0].descriptor);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'result',
        requestId,
        embedding,
        faceCount: 1,
        detected: true,
        message: 'Face detected',
      }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'result',
        requestId,
        embedding: [],
        faceCount: 0,
        detected: false,
        message: 'Error: ' + e.message,
      }));
    }
  }

  window.__voteKroProcessFaceImage = processImage;

  // Listen for messages from React Native
  window.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'process') {
        processImage(data.requestId, data.imageData);
      }
    } catch (e) {}
  });

  // Also handle document message (some RN versions)
  document.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'process') {
        processImage(data.requestId, data.imageData);
      }
    } catch (e) {}
  });

  // Auto-load models on startup
  loadModels();
</script>
</body>
</html>
`;

/**
 * Hidden WebView component that runs face-api.js on native platforms.
 * Must be mounted in the component tree for native face recognition to work.
 */
export function FaceRecognitionWebView() {
  const webViewRef = useRef<any>(null);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "models_loaded") {
        console.log("FaceRecognitionWebView: Models loaded ✓");
        // Store ref globally so face-recognition.ts can access it
        (global as any).__faceRecognitionWebView = webViewRef.current;
        (global as any).__faceRecognitionReady = true;
        return;
      }

      if (data.type === "result" && data.requestId) {
        const resolver = webViewResolvers.get(data.requestId);
        if (resolver) {
          resolver.resolve(data.embedding || []);
          webViewResolvers.delete(data.requestId);
        }
        return;
      }

      if (data.type === "error") {
        console.error("FaceRecognitionWebView error:", data.message);
      }
    } catch (e) {
      console.error("FaceRecognitionWebView: parse error:", e);
    }
  }, []);

  let WebView: any = null;
  if (Platform.OS !== "web") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native dependency
      WebView = require("react-native-webview").default;
    } catch {
      console.warn("FaceRecognitionWebView: react-native-webview not installed");
    }
  }

  if (Platform.OS === "web" || !WebView) {
    return null;
  }

  return (
    <View style={styles.hidden}>
      <WebView
        ref={webViewRef}
        source={{ html: FACE_API_HTML }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        style={styles.webview}
      />
    </View>
  );
}

/**
 * Wait for the hidden WebView to finish loading models.
 * Polls every 500ms for up to 30 seconds.
 */
function waitForReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((global as any).__faceRecognitionReady) {
      resolve();
      return;
    }

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 500;
      if ((global as any).__faceRecognitionReady) {
        clearInterval(interval);
        resolve();
        return;
      }
      if (elapsed >= 30000) {
        clearInterval(interval);
        reject(
          new Error(
            "Face recognition models took too long to load (30s). Check your internet connection.",
          ),
        );
      }
    }, 500);
  });
}

/**
 * Send an image to the hidden WebView for face embedding generation.
 * Returns the 128-d embedding array.
 */
export async function generateEmbeddingViaWebView(
  imageDataUri: string,
): Promise<number[]> {
  // Wait for WebView to be ready (models loaded)
  await waitForReady();

  return new Promise((resolve, reject) => {
    const webView = (global as any).__faceRecognitionWebView;

    if (!webView) {
      reject(new Error("FaceRecognitionWebView not mounted."));
      return;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Set timeout
    const timeout = setTimeout(() => {
      webViewResolvers.delete(requestId);
      reject(new Error("Face processing timed out (30s)"));
    }, 30000);

    webViewResolvers.set(requestId, {
      resolve: (embedding) => {
        clearTimeout(timeout);
        resolve(embedding);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    });

    // Send image to WebView
    const message = JSON.stringify({
      type: "process",
      requestId,
      imageData: imageDataUri,
    });

    webView.injectJavaScript(`
      (function() {
        if (window.__voteKroProcessFaceImage) {
          window.__voteKroProcessFaceImage(${JSON.stringify(requestId)}, ${JSON.stringify(imageDataUri)});
        } else {
          window.postMessage(${JSON.stringify(message)}, '*');
        }
      })();
      true;
    `);
  });
}

const styles = StyleSheet.create({
  hidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
  webview: {
    width: 1,
    height: 1,
  },
});
