import type { ProfileRow } from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { FaceCapture } from "@/components/face-capture";
import { Navbar } from "@/components/navbar";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function VoterSignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [capturedFaceBase64, setCapturedFaceBase64] = useState<string | null>(
    null,
  );
  const [isFaceVerified, setIsFaceVerified] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userProfile =
          await serviceFactory.authService.getRequiredProfile("admin");
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
      // Create a temporary voter profile for face storage
      // The face will be stored with email as identifier until voter completes email verification
      const faceData = {
        imageData: capturedFaceBase64,
        timestamp: Date.now(),
        numFaces: 1,
      };

      // Store face image temporarily with email metadata
      // This will be linked to the voter after email verification
      await serviceFactory.adminService.initiateVoterRegistrationWithFace({
        fullName: normalizedFullName,
        email: normalizedEmail,
        faceData: faceData,
      });

      setFullName("");
      setEmail("");
      setCapturedFaceBase64(null);
      setIsFaceVerified(false);
      setShowFaceCapture(false);

      const successMessage =
        "✓ Face captured and saved!\n\nAuthorization email sent. Ask voter to click the button in email to complete registration.";
      Alert.alert("Success", successMessage);
    } catch (registerError) {
      const errorMessage = serviceFactory.authService.getErrorMessage(
        registerError,
        "Failed to send authorization email. Please try again.",
      );
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceCapture = (base64Image: string) => {
    setCapturedFaceBase64(base64Image);
    setIsFaceVerified(true);
    setShowFaceCapture(false);
    Alert.alert("✓ Face Captured", "Face successfully captured and verified!");
  };

  const handleCancelFaceCapture = () => {
    setShowFaceCapture(false);
  };

  const handleRetakeFace = () => {
    setCapturedFaceBase64(null);
    setIsFaceVerified(false);
    setShowFaceCapture(true);
  };

  return (
    <View style={styles.container}>
      <Navbar
        infoText={`Welcome, ${profile?.full_name ?? "Administrator"}!`}
        actions={[
          { label: "Logout", onPress: handleLogout, variant: "outline" },
        ]}
      />

      {showFaceCapture && (
        <FaceCapture
          onFaceCapture={handleFaceCapture}
          onCancel={handleCancelFaceCapture}
          title="Capture Voter Face"
          subtitle="Position the voter's face in the frame for registration"
        />
      )}

      {!showFaceCapture && (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            styles.mobileCenteredContent,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/AdminDashboard")}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>

          <View style={styles.centerContainer}>
            <View style={styles.card}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>👤 Register Voter</Text>
              </View>

              <Text style={styles.description}>
                1. Capture voter face • 2. Enter details • 3. Send authorization
                email
              </Text>

              {isFaceVerified && capturedFaceBase64 && (
                <View style={styles.facePreviewContainer}>
                  <Text style={styles.facePreviewLabel}>✓ Face Captured</Text>
                  <Image
                    source={{ uri: capturedFaceBase64 }}
                    style={styles.facePreview}
                  />
                  <Pressable
                    style={styles.retakeFaceButton}
                    onPress={handleRetakeFace}
                  >
                    <Text style={styles.retakeFaceButtonText}>
                      Retake Photo
                    </Text>
                  </Pressable>
                </View>
              )}

              {!isFaceVerified && (
                <Pressable
                  style={({ pressed }) => [
                    styles.captureFaceButton,
                    pressed && styles.captureFaceButtonPressed,
                  ]}
                  onPress={() => setShowFaceCapture(true)}
                  disabled={isLoading}
                >
                  <Text style={styles.captureFaceButtonText}>
                    📸 Start Face Capture
                  </Text>
                </Pressable>
              )}

              {error ? (
                <View style={styles.errorMessage}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Voter Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter voter name"
                  placeholderTextColor="#9aa3ad"
                  value={fullName}
                  onChangeText={setFullName}
                  editable={!isLoading && isFaceVerified}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Voter Gmail</Text>
                <TextInput
                  style={styles.input}
                  placeholder="voter@gmail.com"
                  placeholderTextColor="#9aa3ad"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading && isFaceVerified}
                />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.registerButton,
                  pressed && styles.registerButtonPressed,
                  (!isFaceVerified || isLoading) &&
                    styles.registerButtonDisabled,
                ]}
                onPress={handleRegister}
                disabled={!isFaceVerified || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>
                    ✉ Send Authorization Email
                  </Text>
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
    backgroundColor: "#f4f6f8",
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 10,
    paddingBottom: 24,
  },
  mobileCenteredContent: {
    justifyContent: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    marginLeft: 30,
    marginTop: 6,
    marginBottom: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#2f63d5",
    backgroundColor: "#fff",
  },
  backButtonText: {
    color: "#2f63d5",
    fontSize: 12,
    fontWeight: "600",
  },
  centerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e3e7ec",
    paddingHorizontal: 20,
    paddingVertical: 22,
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.09)",
    elevation: 3,
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 33,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: "#6b7280",
    marginBottom: 18,
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 7,
  },
  input: {
    height: 41,
    borderWidth: 1,
    borderColor: "#d7dce3",
    borderRadius: 8,
    backgroundColor: "#f9fbfc",
    paddingHorizontal: 12,
    color: "#1f2937",
    fontSize: 13,
  },
  registerButton: {
    marginTop: 6,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#0f9962",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 3px 6px rgba(5, 150, 105, 0.2)",
    elevation: 2,
  },
  registerButtonPressed: {
    backgroundColor: "#0b7e51",
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  errorMessage: {
    backgroundColor: "#fee2e2",
    borderColor: "#dc2626",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    color: "#991b1b",
    fontWeight: "600",
    lineHeight: 18,
  },
  captureFaceButton: {
    marginBottom: 16,
    height: 48,
    borderRadius: 8,
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
