import { faceRecognitionService } from "@/class/face-recognition";
import { faceRepository } from "@/class/face-repository";
import { serviceFactory } from "@/class/service-factory";
import { supabase } from "@/class/supabase-client";
import { FaceCapture, type FaceCaptureResult } from "@/components/face-capture";
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

  const [storedEmbedding, setStoredEmbedding] = useState<number[]>([]);
  const [userIdForVerification, setUserIdForVerification] = useState<
    string | null
  >(null);

  const [faceAttempts, setFaceAttempts] = useState(0);

  const maxFaceAttempts = 3;

  // STRICT SECURITY SETTINGS
  const FACE_DISTANCE_THRESHOLD = 0.45;
  const MIN_SIMILARITY_PERCENT = 70;

  const resetVerificationState = () => {
    setStep("login");
    setStoredEmbedding([]);
    setUserIdForVerification(null);
    setFaceAttempts(0);
  };

  // Proper Euclidean distance calculation
  const compareEmbeddingsSecurely = (
    embedding1: number[],
    embedding2: number[],
  ) => {
    if (embedding1.length !== embedding2.length) {
      throw new Error("Embedding dimensions do not match");
    }

    let sum = 0;

    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      sum += diff * diff;
    }

    const distance = Math.sqrt(sum);

    // Convert to similarity %
    // Lower distance = higher similarity
    const similarity = Math.max(
      0,
      Math.min(100, Math.round((1 - distance) * 100)),
    );

    const isMatch =
      distance < FACE_DISTANCE_THRESHOLD &&
      similarity >= MIN_SIMILARITY_PERCENT;

    return {
      isMatch,
      distance,
      similarity,
      message: isMatch
        ? `Face verified (${similarity}% match)`
        : `Face mismatch (${similarity}% similarity)`,
    };
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      // Clear previous session
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData?.session) {
        await serviceFactory.authService.signOut();
      }

      // Login with password first
      const profile = await serviceFactory.authService.loginForRole(
        email,
        password,
        "voter",
      );

      // Fetch stored embedding
      const embeddingRow = await faceRepository.getEmbeddingByEmail(email);

      if (embeddingRow && embeddingRow.embedding.length > 0) {
        setStoredEmbedding(embeddingRow.embedding);
        setUserIdForVerification(profile.user_id);
        setFaceAttempts(0);
        setStep("face-verification");
        setIsLoading(false);
        return;
      }

      // Legacy support
      const hasFace = await faceRepository.hasFaceRegistered(profile.user_id);

      if (hasFace) {
        setStoredEmbedding([]);
        setUserIdForVerification(profile.user_id);
        setFaceAttempts(0);
        setStep("face-verification");
        setIsLoading(false);
        return;
      }

      // No face registered
      router.push(serviceFactory.authService.getDashboardRoute(profile.role));
    } catch (error) {
      const alertContent = serviceFactory.authService.getLoginErrorAlert(error);

      setErrorMessage(alertContent.message);

      Alert.alert(alertContent.title, alertContent.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceVerification = async (result: FaceCaptureResult) => {
    try {
      const newAttempts = faceAttempts + 1;
      setFaceAttempts(newAttempts);

      // Ensure embedding exists
      if (!result.embedding || result.embedding.length === 0) {
        Alert.alert(
          "Face Detection Failed",
          "Could not detect a valid face. Please try again.",
        );
        return;
      }

      let referenceEmbedding = storedEmbedding;

      // Legacy embedding generation
      if (referenceEmbedding.length === 0 && userIdForVerification) {
        try {
          const storedFace = await faceRepository.getPrimaryFace(
            userIdForVerification,
          );

          if (storedFace?.face_image_base64) {
            const imageData = storedFace.face_image_base64.startsWith("data:")
              ? storedFace.face_image_base64
              : `data:image/jpeg;base64,${storedFace.face_image_base64}`;

            const embResult =
              await faceRecognitionService.generateEmbedding(imageData);

            if (embResult.detected && embResult.embedding.length > 0) {
              referenceEmbedding = embResult.embedding;

              setStoredEmbedding(referenceEmbedding);

              // Save generated embedding
              await faceRepository.storeEmbedding(
                email,
                referenceEmbedding,
                storedFace.face_image_base64,
                userIdForVerification,
              );
            }
          }
        } catch (legacyError) {
          console.error("Legacy embedding generation failed:", legacyError);
        }
      }

      if (referenceEmbedding.length === 0) {
        await serviceFactory.authService.signOut();

        Alert.alert(
          "Verification Error",
          "Stored face data could not be loaded.",
        );

        resetVerificationState();

        return;
      }

      // SECURE COMPARISON
      const comparison = compareEmbeddingsSecurely(
        referenceEmbedding,
        result.embedding,
      );

      console.log("Face Distance:", comparison.distance);
      console.log("Similarity:", comparison.similarity);

      if (comparison.isMatch) {
        Alert.alert("✓ Verified", comparison.message);

        resetVerificationState();

        router.push(serviceFactory.authService.getDashboardRoute("voter"));

        return;
      }

      // Face mismatch
      const remainingAttempts = maxFaceAttempts - newAttempts;

      // Immediately sign out mismatched session
      await serviceFactory.authService.signOut();

      if (remainingAttempts <= 0) {
        Alert.alert(
          "Verification Failed",
          "Maximum face verification attempts exceeded. Login cancelled.",
        );

        resetVerificationState();

        return;
      }

      Alert.alert(
        "Face Mismatch",
        `${comparison.message}

Distance: ${comparison.distance.toFixed(4)}

${remainingAttempts} attempt(s) remaining.`,
      );
    } catch (error) {
      console.error("Face verification error:", error);

      await serviceFactory.authService.signOut();

      Alert.alert(
        "Verification Error",
        "An error occurred during face verification.",
      );

      resetVerificationState();
    }
  };

  return (
    <View style={styles.container}>
      <Navbar />

      {step === "face-verification" && (
        <FaceCapture
          onFaceCapture={(captureResult) => {
            void handleFaceVerification(captureResult);
          }}
          onCancel={async () => {
            await serviceFactory.authService.signOut();
            resetVerificationState();
          }}
          title="Face Verification Required"
          subtitle="Position your face clearly in front of the camera"
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
