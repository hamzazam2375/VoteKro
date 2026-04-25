import type { ProfileRow } from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { Navbar } from "@/components/navbar";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { toast } from "react-toastify";

export default function VoterSignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

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
        if (Platform.OS === "web") {
          toast.error(errorMsg);
        } else {
          Alert.alert("Error", errorMsg);
        }
        router.replace("/AdminLogin");
      }
    };

    void loadProfile();
  }, [router]);

  const handleLogout = () => {
    if (Platform.OS === "web") {
      toast.info("Logging out...");
    }
    void doLogout();
  };

  const doLogout = async () => {
    try {
      await serviceFactory.authService.signOut();
      if (Platform.OS === "web") {
        toast.success("Logged out successfully");
      }
      router.replace("/");
    } catch (logoutError) {
      const errorMsg = serviceFactory.authService.getErrorMessage(
        logoutError,
        "Failed to logout",
      );
      if (Platform.OS === "web") {
        toast.error(errorMsg);
      } else {
        Alert.alert("Error", errorMsg);
      }
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

    try {
      await serviceFactory.adminService.initiateVoterRegistrationAuthorization({
        fullName: normalizedFullName,
        email: normalizedEmail,
      });

      setFullName("");
      setEmail("");

      const successMessage =
        "Authorization email sent. Ask voter to click the button in email to complete registration.";
      if (Platform.OS === "web") {
        toast.success(successMessage, {
          position: "top-right",
          autoClose: 2200,
        });
      } else {
        Alert.alert("Email Sent", successMessage);
      }
    } catch (registerError) {
      const errorMessage = serviceFactory.authService.getErrorMessage(
        registerError,
        "Failed to send authorization email. Please try again.",
      );
      setError(errorMessage);
      if (Platform.OS === "web") {
        toast.error(errorMessage, {
          position: "top-right",
          autoClose: 3000,
        });
      } else {
        Alert.alert("Error", errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Navbar
        infoText={`Welcome, ${profile?.full_name ?? "Administrator"}!`}
        actions={[
          { label: "Logout", onPress: handleLogout, variant: "outline" },
        ]}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS !== "web" && styles.mobileCenteredContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {Platform.OS === "web" ? (
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/AdminDashboard")}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
        ) : null}

        <View style={styles.centerContainer}>
          <View style={styles.card}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>👤 Register Voter</Text>
            </View>

            <Text style={styles.description}>
              Send voter authorization email. Voter must click the email button
              to complete registration.
            </Text>

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
                editable={!isLoading}
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
                <Text style={styles.registerButtonText}>
                  ✉ Send Authorization Email
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
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
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
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
});
