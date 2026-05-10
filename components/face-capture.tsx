import { faceRecognitionService } from "@/class/face-recognition";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

export interface FaceCaptureResult {
  imageData: string; // base64 data URI or blob URL
  embedding: number[]; // 128-d face embedding (empty on native)
  faceCount: number;
}

export interface FaceCaptureProps {
  onFaceCapture: (result: FaceCaptureResult) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

const isWeb = Platform.OS === "web";

export function FaceCapture({
  onFaceCapture,
  onCancel,
  title = "Capture Your Face",
  subtitle = "Position your face in the frame",
}: FaceCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isInitializing, setIsInitializing] = useState(true);
  const [statusMessage, setStatusMessage] = useState(
    "Loading face recognition models...",
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const cameraRef = useRef<any>(null);

  // Initialize face recognition models
  useEffect(() => {
    const init = async () => {
      try {
        await faceRecognitionService.initialize();
        setModelsReady(true);
        setStatusMessage("✓ Models loaded. Position your face and capture.");
        setIsInitializing(false);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("Face recognition init error:", msg);
        setStatusMessage(`❌ ${msg}`);
        setIsInitializing(false);
      }
    };

    void init();

    return () => {
      faceRecognitionService.dispose();
    };
  }, []);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const captureAndProcess = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    setStatusMessage("📸 Capturing face...");

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: true,
      });

      // Debug: log what the camera returns
      console.log("Photo keys:", Object.keys(photo));
      console.log("Photo URI type:", photo.uri?.substring(0, 30));
      console.log("Photo base64 exists:", !!photo.base64);
      console.log("Photo base64 prefix:", photo.base64?.substring(0, 30));

      // Use base64 first so native mobile does not hand a file:// URI to the detector.
      let imageData: string;
      if (photo.base64) {
        imageData = photo.base64.startsWith("data:")
          ? photo.base64
          : `data:image/jpeg;base64,${photo.base64}`;
      } else if (photo.uri) {
        imageData = photo.uri;
      } else {
        Alert.alert("Error", "Failed to capture photo.");
        setStatusMessage("❌ Capture failed. Try again.");
        return;
      }

      console.log("Using imageData type:", imageData.substring(0, 30));

      setStatusMessage("🔍 Analyzing face...");

      // Generate face embedding
      const result = await faceRecognitionService.generateEmbedding(imageData);

      if (!result.detected) {
        setStatusMessage(result.message);
        Alert.alert("Face Detection Failed", result.message);
        return;
      }

      setStatusMessage("✓ Face Processing!");

      onFaceCapture({
        imageData,
        embedding: result.embedding,
        faceCount: result.faceCount,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Capture failed";
      Alert.alert("Capture Error", msg);
      console.error("Capture error:", error);
      setStatusMessage(`❌ ${msg}`);
    } finally {
      setIsCapturing(false);
    }
  };

  // Permission screens
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission is required</Text>
        <Pressable style={styles.button} onPress={() => requestPermission()}>
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

      <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={() => {
            if (modelsReady) {
              setStatusMessage(
                "✓ Ready! Position your face and press Capture.",
              );
            }
          }}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.faceFrame} />
        </View>
      </View>

      <View style={styles.footer}>
        <Text
          style={[
            styles.statusMessage,
            modelsReady && !isCapturing
              ? styles.statusSuccess
              : styles.statusWarning,
          ]}
        >
          {statusMessage}
        </Text>

        {isInitializing ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#2e63e3" />
            <Text style={styles.loaderText}>
              Loading face recognition models...
            </Text>
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            <Pressable
              style={[
                styles.button,
                styles.captureButton,
                (!modelsReady || isCapturing) && styles.buttonDisabled,
              ]}
              onPress={captureAndProcess}
              disabled={!modelsReady || isCapturing}
            >
              <Text style={styles.buttonText}>
                {isCapturing ? "Analyzing..." : "Capture Face"}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isWeb ? "#f5f7fb" : "#000",
    ...(isWeb
      ? {
          height: "100vh" as any,
          width: "100%" as any,
          overflow: "hidden" as any,
        }
      : {}),
  },
  header: {
    paddingTop: isWeb ? 16 : 20,
    paddingBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: isWeb ? "#fff" : "rgba(0,0,0,0.7)",
    borderBottomWidth: isWeb ? 1 : 0,
    borderBottomColor: "#e0e4ec",
    zIndex: 10,
    alignItems: isWeb ? "center" : ("flex-start" as const),
  },
  title: {
    fontSize: isWeb ? 20 : 24,
    fontWeight: "bold",
    color: isWeb ? "#0d1b3f" : "#fff",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: isWeb ? "#4a607f" : "#ccc",
    marginBottom: 2,
  },
  camera: {
    ...(isWeb
      ? { width: "100%" as any, height: 380 }
      : { width: "100%" as any, height: "100%" as any }),
  },
  cameraWrapper: {
    ...(isWeb
      ? {
          width: "100%" as any,
          maxWidth: 640,
          height: 380,
          alignSelf: "center" as const,
          borderRadius: 12,
          overflow: "hidden" as const,
          marginVertical: 10,
          backgroundColor: "#000",
        }
      : {
          flex: 1,
          width: "100%" as any,
          minHeight: 400,
          position: "relative" as const,
          overflow: "hidden" as const,
          backgroundColor: "#000",
        }),
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  faceFrame: {
    width: isWeb ? 200 : 220,
    height: isWeb ? 260 : 280,
    borderWidth: 3,
    borderColor: "#2e63e3",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  footer: {
    backgroundColor: "#f5f7fb",
    padding: isWeb ? 16 : 20,
    paddingBottom: isWeb ? 20 : 30,
    zIndex: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e4ec",
    alignItems: "center",
  },
  statusMessage: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  statusSuccess: {
    color: "#2e7d32",
  },
  statusWarning: {
    color: "#e65100",
  },
  loaderContainer: {
    alignItems: "center",
    gap: 10,
    marginVertical: 10,
  },
  loaderText: {
    fontSize: 13,
    color: "#4a607f",
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
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#c7d2e2",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#ff4444",
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
});
