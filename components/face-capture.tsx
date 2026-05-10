import {
    faceDetectionService,
    type FaceDetectionResult,
} from "@/class/face-detection";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
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
  const [permission, requestPermission] = useCameraPermissions();
  const [isInitializing, setIsInitializing] = useState(true);
  const [detectionMessage, setDetectionMessage] = useState(
    "Initializing face detection...",
  );
  const [lastDetectionResult, setLastDetectionResult] =
    useState<FaceDetectionResult | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<any>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isNative = Platform.OS !== "web";

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
    setDetectionMessage("📸 Capturing and analyzing...");

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: true,
      });

      // Build a usable data URI from the photo
      const base64Data = photo.base64
        ? `data:image/jpeg;base64,${photo.base64}`
        : photo.uri; // web CameraView may return data URI in uri

      if (!base64Data) {
        Alert.alert("Error", "Failed to capture photo. Please try again.");
        return;
      }

      // detectFaces handles both web (canvas/FaceDetector) and native (visual confirm)
      const result = await faceDetectionService.detectFaces(base64Data);
      const validation = faceDetectionService.validateDetection(result);

      if (validation.isValid) {
        setDetectionMessage("✓ Face verified! Saving...");
        onFaceCapture(base64Data, result.faces.length);
      } else {
        setDetectionMessage(validation.message);
        Alert.alert(
          "Face Not Detected",
          "No face was found in the captured photo. Please position your face clearly in the frame and try again.",
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

      <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={async () => {
            if (isNative) {
              // On native, TF.js face detection is not available.
              // Set a placeholder result so the admin can visually confirm
              // the face and proceed to capture.
              setLastDetectionResult({
                faces: [{ bbox: [0, 0, 100, 100], confidence: 1.0 }],
                hasError: false,
                message: "✓ Camera ready — visually confirm face and capture",
              });
              setDetectionMessage(
                "✓ Camera ready — visually confirm face and capture",
              );
              return;
            }

            // Web: Start periodic face detection by taking low-res snapshots
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

                // Create an Image element for detection (web only)
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

      <View style={styles.overlay} pointerEvents="none">
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
              disabled={isCapturing || isInitializing}
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
