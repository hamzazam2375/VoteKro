import {
    faceRecognitionService
} from "@/class/face-recognition";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

export interface FaceVerificationProps {
  storedFaceBase64: string;
  onVerificationSuccess: () => void;
  onVerificationFailed: (reason: string) => void;
  onCancel: () => void;
}

export function FaceVerification({
  storedFaceBase64,
  onVerificationSuccess,
  onVerificationFailed,
  onCancel,
}: FaceVerificationProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState("Initializing face verification...");
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 3;

  useEffect(() => {
    const initializeFaceDetection = async () => {
      try {
        await faceDetectionService.initialize();
        setMessage("✓ Ready! Position your face in the frame to verify.");
        setIsInitializing(false);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Face detection initialization error:", errorMsg);
        setMessage(`❌ ${errorMsg}`);
        Alert.alert("Error", errorMsg);
      }
    };

    void initializeFaceDetection();

    return () => {
      faceDetectionService.dispose();
    };
  }, []);

  const performVerification = async (capturedFaceBase64: string) => {
    if (isVerifying) {
      return;
    }

    setIsVerifying(true);
    setAttempts((prev) => prev + 1);

    try {
      const comparison = await faceDetectionService.compareFaces(
        storedFaceBase64,
        capturedFaceBase64,
        0.75,
      );

      if (comparison.isSamePerson) {
        setMessage("✓ " + comparison.message);
        setTimeout(() => {
          onVerificationSuccess();
        }, 1000);
      } else {
        const remainingAttempts = maxAttempts - attempts;
        const failureMessage = `${comparison.message}\n\nAttempts remaining: ${remainingAttempts}`;
        setMessage(failureMessage);

        if (remainingAttempts <= 0) {
          setTimeout(() => {
            onVerificationFailed("Maximum verification attempts exceeded");
          }, 2000);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setMessage(`❌ Verification error: ${errorMsg}`);
      console.error("Face verification error:", error);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRetry = () => {
    if (attempts < maxAttempts) {
      setMessage("✓ Ready! Position your face in the frame to verify.");
    }
  };

  const isMaxAttemptsReached = attempts >= maxAttempts;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Verify Your Face</Text>
          <Text style={styles.subtitle}>
            Position your face to verify your identity
          </Text>
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>Instructions:</Text>
            <Text style={styles.instruction}>• Face the camera directly</Text>
            <Text style={styles.instruction}>
              • Ensure good lighting on your face
            </Text>
            <Text style={styles.instruction}>
              • Keep your face centered in the frame
            </Text>
            <Text style={styles.instruction}>
              • Avoid shadows or extreme angles
            </Text>
          </View>

          <View
            style={[
              styles.statusBox,
              isMaxAttemptsReached && styles.statusBoxError,
            ]}
          >
            <Text
              style={[
                styles.statusMessage,
                isMaxAttemptsReached && styles.statusMessageError,
              ]}
            >
              {message}
            </Text>

            {!isInitializing && !isVerifying && (
              <Text style={styles.attemptsText}>
                Attempts: {attempts}/{maxAttempts}
              </Text>
            )}
          </View>

          {isInitializing ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#2e63e3" />
              <Text style={styles.loaderText}>Initializing...</Text>
            </View>
          ) : isVerifying ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#2e63e3" />
              <Text style={styles.loaderText}>Verifying face...</Text>
            </View>
          ) : (
            <View style={styles.buttonContainer}>
              {!isMaxAttemptsReached && (
                <>
                  <Pressable
                    style={[
                      styles.button,
                      styles.verifyButton,
                      isVerifying && styles.buttonDisabled,
                    ]}
                    onPress={handleRetry}
                    disabled={isVerifying}
                  >
                    <Text style={styles.buttonText}>Ready to Verify</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.button, styles.cancelButton]}
                    onPress={onCancel}
                    disabled={isVerifying}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                </>
              )}

              {isMaxAttemptsReached && (
                <>
                  <Pressable
                    style={[styles.button, styles.failureButton]}
                    onPress={() =>
                      onVerificationFailed("Max attempts exceeded")
                    }
                  >
                    <Text style={styles.buttonText}>Try Another Method</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.button, styles.cancelButton]}
                    onPress={onCancel}
                  >
                    <Text style={styles.cancelButtonText}>Go Back</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0d1b3f",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#4a607f",
    textAlign: "center",
  },
  contentContainer: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
  },
  instructionsBox: {
    backgroundColor: "#e3f2fd",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#2e63e3",
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1565c0",
    marginBottom: 8,
  },
  instruction: {
    fontSize: 13,
    color: "#1565c0",
    marginBottom: 4,
    lineHeight: 18,
  },
  statusBox: {
    backgroundColor: "#fbfdff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#d8e2f0",
    minHeight: 100,
    justifyContent: "center",
  },
  statusBoxError: {
    backgroundColor: "#ffebee",
    borderColor: "#ef5350",
  },
  statusMessage: {
    fontSize: 16,
    color: "#2c63dd",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 24,
  },
  statusMessageError: {
    color: "#c62828",
  },
  attemptsText: {
    fontSize: 12,
    color: "#7a8fa3",
    textAlign: "center",
    marginTop: 12,
  },
  loader: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loaderText: {
    fontSize: 14,
    color: "#2e63e3",
    fontWeight: "600",
    marginTop: 12,
  },
  buttonContainer: {
    flexDirection: "column",
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 50,
    justifyContent: "center",
  },
  verifyButton: {
    backgroundColor: "#2e63e3",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#2e63e3",
  },
  failureButton: {
    backgroundColor: "#ef5350",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButtonText: {
    color: "#2e63e3",
    fontSize: 16,
    fontWeight: "700",
  },
});
