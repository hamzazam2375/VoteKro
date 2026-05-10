import { faceDetectionService } from "@/class/face-detection";
import { faceRepository } from "@/class/face-repository";
import { serviceFactory } from "@/class/service-factory";
import { supabase } from "@/class/supabase-client";
import { FaceCapture } from "@/components/face-capture";
import { Navbar } from "@/components/navbar";
import { PasswordField } from "@/components/password-field";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function VoterLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [step, setStep] = useState<"login" | "face-verification">("login");
  const [storedFaceBase64, setStoredFaceBase64] = useState<string | null>(null);
  const [userIdForVerification, setUserIdForVerification] = useState<
    string | null
  >(null);
  const [faceAttempts, setFaceAttempts] = useState(0);
  const maxFaceAttempts = 3;

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      // Only sign out if there's an existing session to avoid AuthSessionMissingError
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        await serviceFactory.authService.signOut();
      }

      const profile = await serviceFactory.authService.loginForRole(
        email,
        password,
        "voter",
      );

      // Check if voter has registered face
      const hasFace = await faceRepository.hasFaceRegistered(profile.user_id);

      if (hasFace) {
        // Load the stored face and move to verification step
        const storedFace = await faceRepository.getPrimaryFace(profile.user_id);
        if (storedFace) {
          setStoredFaceBase64(storedFace.face_image_base64);
          setUserIdForVerification(profile.user_id);
          setFaceAttempts(0);
          setStep("face-verification");
          setIsLoading(false);
          return;
        }
      }

      // No face required, proceed to dashboard
      router.push(serviceFactory.authService.getDashboardRoute(profile.role));
    } catch (error) {
      const alertContent = serviceFactory.authService.getLoginErrorAlert(error);
      setErrorMessage(alertContent.message);
      Alert.alert(alertContent.title, alertContent.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceVerification = async (capturedBase64: string) => {
    if (!storedFaceBase64) return;

    setFaceAttempts((prev) => prev + 1);

    try {
      // Initialize face detection if not already
      await faceDetectionService.initialize();

      // Compare captured face with stored face
      const comparison = await faceDetectionService.compareFaces(
        storedFaceBase64,
        capturedBase64,
        0.6, // threshold
      );

      if (comparison.isSamePerson) {
        Alert.alert("✓ Verified", "Face verification successful!");
        router.push(serviceFactory.authService.getDashboardRoute("voter"));
      } else {
        const remaining = maxFaceAttempts - faceAttempts;
        if (remaining <= 0) {
          Alert.alert(
            "Verification Failed",
            "Maximum face verification attempts exceeded. Please try logging in again.",
          );
          // Reset to login
          setStep("login");
          setStoredFaceBase64(null);
          setUserIdForVerification(null);
          setFaceAttempts(0);
        } else {
          Alert.alert(
            "Face Mismatch",
            `Face does not match the registered photo. ${remaining} attempt(s) remaining. Please try again.`,
          );
        }
      }
    } catch (error) {
      console.error("Face verification error:", error);
      Alert.alert(
        "Verification Error",
        "An error occurred during face verification. Please try again.",
      );
    }
  };

  return (
    <View style={styles.container}>
      <Navbar />

      {step === "face-verification" && storedFaceBase64 && (
        <FaceCapture
          onFaceCapture={(base64Image) => {
            void handleFaceVerification(base64Image);
          }}
          onCancel={() => {
            setStep("login");
            setStoredFaceBase64(null);
            setUserIdForVerification(null);
            setFaceAttempts(0);
          }}
          title="Face Verification Required"
          subtitle="Position your face to verify your identity for voting"
        />
      )}

      {step === "login" && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.titleContainer}>
              <Text style={styles.voteIcon}>🗳️</Text>
              <Text style={styles.title}>Voter Login</Text>
            </View>

            <Text style={styles.subtitle}>
              Sign in securely to access your ballot and election activity.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Voter Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your registered email"
                placeholderTextColor="#9aa6b6"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <PasswordField
              label="Password"
              placeholder="Enter your password"
              placeholderTextColor="#9aa6b6"
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
            />

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
                isLoading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Continue to Voting</Text>
              )}
            </Pressable>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Admin or auditor account? </Text>
              <Pressable onPress={() => router.push("/AdminLogin")}>
                <Text style={styles.footerLink}>Go to login</Text>
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
    backgroundColor: "#f5f7fb",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  card: {
    backgroundColor: "#fbfdff",
    borderRadius: 18,
    padding: 22,
    width: "100%",
    maxWidth: 460,
    borderWidth: 1,
    borderColor: "#d8e2f0",
    boxShadow: "0px 6px 12px rgba(27, 43, 74, 0.08)",
    elevation: 4,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  voteIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0d1b3f",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4a607f",
    textAlign: "center",
    marginBottom: 18,
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f1f3f",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c7d2e2",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1a2438",
  },
  loginButton: {
    backgroundColor: "#2f64e6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    boxShadow: "0px 4px 8px rgba(47, 100, 230, 0.16)",
    elevation: 3,
  },
  loginButtonPressed: {
    opacity: 0.9,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  errorBox: {
    marginTop: 12,
    backgroundColor: "#fdecec",
    borderColor: "#f3b8b8",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: "#8f2222",
    fontSize: 13,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
  },
  footerText: {
    fontSize: 13,
    color: "#5c6f89",
  },
  footerLink: {
    fontSize: 13,
    color: "#2f64e6",
    fontWeight: "600",
  },
});
