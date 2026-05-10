import {
    faceDetectionService,
    type FaceDetectionResult,
} from "@/class/face-detection";
import * as ExpoCamera from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

export interface FaceCaptureProps {
  onFaceCapture: (base64Image: string, numFaces: number) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

const { width, height } = Dimensions.get("window");

export function FaceCapture({
  onFaceCapture,
  onCancel,
  title = "Capture Your Face",
  subtitle = "Position your face in the frame",
}: FaceCaptureProps) {
  const useCameraPermissions =
    (ExpoCamera as any).useCameraPermissions ?? (() => [null, async () => {}]);
  const [permission, requestPermission] = useCameraPermissions();
  const [isInitializing, setIsInitializing] = useState(true);
  const [detectionMessage, setDetectionMessage] = useState(
    "Initializing face detection...",
  );
  const [lastDetectionResult, setLastDetectionResult] =
    useState<FaceDetectionResult | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<any>(null);
  // Resolve the actual Camera component safely — handle various module shapes
  let CameraCompCandidate: any =
    (ExpoCamera as any).Camera ?? (ExpoCamera as any).default ?? null;
  if (CameraCompCandidate && typeof CameraCompCandidate !== "function") {
    // If it's a module object with a default export, try that
    if (
      CameraCompCandidate.default &&
      typeof CameraCompCandidate.default === "function"
    ) {
      CameraCompCandidate = CameraCompCandidate.default;
    } else {
      // Not a renderable component
      CameraCompCandidate = null;
    }
  }
  const CameraComp: any = CameraCompCandidate;
  const detectionIntervalRef = useRef<NodeJS.Timeout>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Safe camera type for platforms where Camera.Constants may be undefined (web)
  const cameraConstants: any =
    (CameraComp && CameraComp.Constants) ||
    (ExpoCamera as any).Constants ||
    null;
  const cameraType: any = cameraConstants
    ? cameraConstants.Type.front
    : "front";

  useEffect(() => {
    const initializeFaceDetection = async () => {
      try {
        await faceDetectionService.initialize();
        setDetectionMessage("✓ Ready! Position your face in the frame.");
        setIsInitializing(false);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Face detection initialization error:", errorMsg);
        setDetectionMessage(`❌ ${errorMsg}`);
        Alert.alert("Error", errorMsg);
      }
    };

    void initializeFaceDetection();

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      faceDetectionService.dispose();
    };
  }, []);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const capturePhoto = async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }

    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: true,
      });

      if (
        photo.base64 &&
        lastDetectionResult &&
        lastDetectionResult.faces.length === 1
      ) {
        onFaceCapture(`data:image/jpeg;base64,${photo.base64}`, 1);
      } else {
        Alert.alert(
          "Error",
          "Please ensure exactly one face is detected before capturing.",
        );
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to capture photo";
      Alert.alert("Capture Error", errorMsg);
      console.error("Photo capture error:", error);
    } finally {
      setIsCapturing(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission is required</Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            requestPermission();
          }}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission denied</Text>
        <Pressable style={styles.button} onPress={onCancel}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {CameraComp ? (
        <CameraComp
          ref={cameraRef}
          style={styles.camera}
          type={cameraType}
          zoom={0}
          ratio={"16:9"}
          onCameraReady={async () => {
            // Start periodic face detection by taking low-res snapshots
            if (detectionIntervalRef.current) {
              clearInterval(detectionIntervalRef.current);
            }

            detectionIntervalRef.current = setInterval(async () => {
              try {
                if (!cameraRef.current) return;

                const snapshot = await cameraRef.current.takePictureAsync({
                  quality: 0.2,
                  base64: true,
                  skipProcessing: true,
                });

                if (!snapshot || !snapshot.base64) return;

                // Create an Image element for detection
                const img = new Image();
                img.src = `data:image/jpeg;base64,${snapshot.base64}`;
                img.onload = async () => {
                  const result = await faceDetectionService.detectFaces(img);
                  setLastDetectionResult(result);
                  setDetectionMessage(result.message);
                };
              } catch (err) {
                console.error("Periodic detection error:", err);
              }
            }, 800);
          }}
        />
      ) : (
        <View
          style={[
            styles.camera,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <Text style={{ color: "#fff" }}>
            Camera not available on this platform.
          </Text>
        </View>
      )}

      <View style={styles.overlay}>
        <View style={styles.faceFrame} />
      </View>

      <View style={styles.footer}>
        <Text
          style={[
            styles.statusMessage,
            lastDetectionResult && lastDetectionResult.faces.length === 1
              ? styles.statusSuccess
              : styles.statusWarning,
          ]}
        >
          {detectionMessage}
        </Text>

        {isInitializing ? (
          <ActivityIndicator
            size="large"
            color="#2e63e3"
            style={styles.loader}
          />
        ) : (
          <View style={styles.buttonContainer}>
            <Pressable
              style={[styles.button, styles.captureButton]}
              onPress={capturePhoto}
              disabled={
                isCapturing ||
                isInitializing ||
                !lastDetectionResult ||
                lastDetectionResult.faces.length !== 1
              }
            >
              <Text style={styles.buttonText}>
                {isCapturing ? "Capturing..." : "Capture Face"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isCapturing}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>

      {lastDetectionResult && lastDetectionResult.faces.length !== 1 && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>{lastDetectionResult.message}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#ccc",
    marginBottom: 10,
  },
  camera: {
    width: width,
    height: Math.round(height * 0.6),
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  faceFrame: {
    width: 220,
    height: 280,
    borderWidth: 3,
    borderColor: "#2e63e3",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  footer: {
    backgroundColor: "rgba(0,0,0,0.85)",
    padding: 20,
    paddingBottom: 30,
    zIndex: 10,
  },
  statusMessage: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  statusSuccess: {
    color: "#4caf50",
  },
  statusWarning: {
    color: "#ff9800",
  },
  loader: {
    marginVertical: 20,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 140,
    alignItems: "center",
  },
  captureButton: {
    backgroundColor: "#2e63e3",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#888",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButtonText: {
    color: "#ccc",
    fontSize: 16,
    fontWeight: "600",
  },
  warning: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 152, 0, 0.9)",
    padding: 12,
    borderRadius: 8,
    zIndex: 15,
  },
  warningText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  errorText: {
    color: "#ff4444",
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
});
