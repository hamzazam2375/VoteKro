import type { ProfileRow } from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { FaceCapture, type FaceCaptureResult } from "@/components/face-capture";
import { Navbar } from "@/components/navbar";
import { PageBackground } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function VoterSignupScreen({
  isEmbedded,
}: { isEmbedded?: boolean } = {}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [capturedFaceBase64, setCapturedFaceBase64] = useState<string | null>(null);
  const [faceEmbedding, setFaceEmbedding] = useState<number[]>([]);
  const [isFaceVerified, setIsFaceVerified] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userProfile = await serviceFactory.authService.getRequiredProfile("admin");
        setProfile(userProfile);
      } catch (loadError) {
        const errorMsg = serviceFactory.authService.getErrorMessage(
          loadError,
          "Failed to load profile",
        );
        Alert.alert("Error", errorMsg);
        router.replace("/AdminLogin");
      }
    };

    void loadProfile();
  }, [router]);

  const handleLogout = () => {
    void doLogout();
  };

  const doLogout = async () => {
    try {
      await serviceFactory.authService.signOut();
      router.replace("/");
    } catch (logoutError) {
      const errorMsg = serviceFactory.authService.getErrorMessage(
        logoutError,
        "Failed to logout",
      );
      Alert.alert("Error", errorMsg);
    }
  };

  const handleRegister = async () => {
    setError(null);
    setIsLoading(true);

    const normalizedFullName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedFullName || !normalizedEmail) {
      setError("Please enter voter name and Gmail.");
      setIsLoading(false);
      return;
    }

    if (!capturedFaceBase64) {
      setError("Please capture face before registering.");
      setIsLoading(false);
      return;
    }

    try {
      const faceData = {
        imageData: capturedFaceBase64,
        timestamp: Date.now(),
        numFaces: 1,
      };

      await serviceFactory.adminService.initiateVoterRegistrationWithFace({
        fullName: normalizedFullName,
        email: normalizedEmail,
        faceData,
        faceEmbedding,
      });

      setFullName("");
      setEmail("");
      setCapturedFaceBase64(null);
      setFaceEmbedding([]);
      setIsFaceVerified(false);
      setShowFaceCapture(false);

      setTimeout(() => {
        Alert.alert(
          "Success",
          "Face captured and saved! Authorization email sent. Ask voter to click the button in email to complete registration.",
        );
      }, 0);
    } catch (registerError) {
      const errorMessage = serviceFactory.authService.getErrorMessage(
        registerError,
        "Failed to send authorization email. Please try again.",
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceCapture = (result: FaceCaptureResult) => {
    setCapturedFaceBase64(result.imageData);
    setFaceEmbedding(result.embedding);
    setIsFaceVerified(true);
    setShowFaceCapture(false);
    setTimeout(() => {
      Alert.alert("Face Captured", "Face detected and processed!");
    }, 0);
  };

  const handleCancelFaceCapture = () => {
    setShowFaceCapture(false);
  };

  const handleRetakeFace = () => {
    setCapturedFaceBase64(null);
    setFaceEmbedding([]);
    setIsFaceVerified(false);
    setShowFaceCapture(true);
  };

  return (
    <View style={styles.container}>
      {!isEmbedded && (
        <Navbar
          infoText={`Welcome, ${profile?.full_name ?? "Administrator"}!`}
          actions={[
            { label: "Logout", onPress: handleLogout, variant: "outline" },
          ]}
        />
      )}

      <Modal
        visible={showFaceCapture}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCancelFaceCapture}
      >
        <FaceCapture
          onFaceCapture={handleFaceCapture}
          onCancel={handleCancelFaceCapture}
          title="Capture Voter Face"
          subtitle="Position the voter's face in the frame for registration"
        />
      </Modal>

      {!showFaceCapture && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!isEmbedded && (
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/AdminDashboard")}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
          )}

          <View style={styles.centerContainer}>
            <View style={styles.card}>
              <View style={styles.titleContainer}>
                <Text style={styles.auditIcon}>👤</Text>
                <Text style={styles.title}>Register Voter</Text>
              </View>

              <Text style={styles.description}>
                Capture the voter face, enter the details, and send the authorization email.
              </Text>

              {isFaceVerified && capturedFaceBase64 ? (
                <View style={styles.facePreviewContainer}>
                  <Text style={styles.facePreviewLabel}>✓ Face Captured</Text>
                  <Image source={{ uri: capturedFaceBase64 }} style={styles.facePreview} />
                  <Pressable style={styles.retakeFaceButton} onPress={handleRetakeFace}>
                    <Text style={styles.retakeFaceButtonText}>Retake Photo</Text>
                  </Pressable>
                </View>
              ) : null}

              {!isFaceVerified ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.captureFaceButton,
                    pressed && styles.captureFaceButtonPressed,
                  ]}
                  onPress={() => setShowFaceCapture(true)}
                  disabled={isLoading}
                >
                  <Text style={styles.captureFaceButtonText}>📸 Start Face Capture</Text>
                </Pressable>
              ) : null}

              {error ? (
                <View style={styles.errorBanner}>
                  <View style={styles.errorBannerHeader}>
                    <View style={styles.errorIconWrap}>
                      <Text style={styles.errorIcon}>⚠️</Text>
                    </View>
                    <Text style={styles.errorTitle}>Registration Error</Text>
                    <Pressable
                      style={styles.errorDismiss}
                      onPress={() => setError(null)}
                      hitSlop={8}
                    >
                      <Text style={styles.errorDismissText}>✕</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.errorBody}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Voter Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter voter name"
                  placeholderTextColor="#999"
                  value={fullName}
                  onChangeText={setFullName}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Voter Gmail</Text>
                <TextInput
                  style={styles.input}
                  placeholder="voter@gmail.com"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.registerButton,
                  pressed && styles.registerButtonPressed,
                  isLoading && styles.registerButtonDisabled,
                ]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>✉ Send Authorization Email</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PageBackground,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: PageBackground,
  },
  backButton: {
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    alignSelf: "center",
  },
  backButtonText: {
    color: "#1a73e8",
    fontSize: 14,
    fontWeight: "500",
  },
  centerContainer: {
    width: "100%",
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 32,
    boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.08)",
    elevation: 2,
    width: "100%",
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 12,
    justifyContent: "center",
  },
  auditIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 19,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    backgroundColor: "#fafafa",
    color: "#1a1a1a",
  },
  registerButton: {
    marginTop: 6,
    height: 42,
    borderRadius: 6,
    backgroundColor: "#0f8a3d",
    alignItems: "center",
    justifyContent: "center",
  },
  registerButtonPressed: {
    backgroundColor: "#0a6630",
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  errorBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  errorIconWrap: {
    marginRight: 8,
  },
  errorIcon: {
    fontSize: 18,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#991b1b",
    flex: 1,
  },
  errorDismiss: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fecaca",
    alignItems: "center",
    justifyContent: "center",
  },
  errorDismissText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#991b1b",
  },
  errorBody: {
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: "500",
    lineHeight: 19,
    paddingLeft: 26,
  },
  captureFaceButton: {
    marginBottom: 16,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 3px 6px rgba(37, 99, 235, 0.2)",
    elevation: 3,
  },
  captureFaceButtonPressed: {
    backgroundColor: "#1d4ed8",
  },
  captureFaceButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  facePreviewContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#86efac",
    alignItems: "center",
  },
  facePreviewLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#166534",
    marginBottom: 12,
  },
  facePreview: {
    width: 180,
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  retakeFaceButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: "#fbbf24",
    alignItems: "center",
  },
  retakeFaceButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#78350f",
  },
});
