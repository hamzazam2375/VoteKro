import type { ProfileRow } from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { Navbar } from "@/components/navbar";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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

export default function AuditorSignupScreen({
  isEmbedded,
}: { isEmbedded?: boolean } = {}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userProfile =
          await serviceFactory.authService.getRequiredProfile("admin");
        setProfile(userProfile);
      } catch (error) {
        Alert.alert(
          "Error",
          serviceFactory.authService.getErrorMessage(
            error,
            "Failed to load profile",
          ),
        );
        router.replace("/AdminLogin");
      }
    };

    void loadProfile();
  }, [router]);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: doLogout },
    ]);
  };

  const doLogout = async () => {
    try {
      await serviceFactory.authService.signOut();
      router.replace("/");
    } catch (error) {
      Alert.alert(
        "Error",
        serviceFactory.authService.getErrorMessage(error, "Failed to logout"),
      );
    }
  };

  const handleRegister = async () => {
    // Validation
    if (!fullName.trim()) {
      Alert.alert("Error", "Please enter auditor name");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Error", "Please enter auditor gmail");
      return;
    }
    setIsLoading(true);
    try {
      await serviceFactory.adminService.initiateAuditorRegistrationAuthorization(
        {
          fullName,
          email,
        },
      );

      Alert.alert(
        "Email Sent",
        "Authorization email sent with password. Auditor must click the authorize button first, then log in using the emailed credentials.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/AdminDashboard"),
          },
        ],
      );
    } catch (error) {
      const alertContent =
        serviceFactory.authService.getRegistrationErrorAlert(error);
      Alert.alert(alertContent.title, alertContent.message);
    } finally {
      setIsLoading(false);
    }
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

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerContainer}>
          <View style={styles.card}>
            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={styles.auditIcon}>🔍</Text>
              <Text style={styles.title}>Register Auditor</Text>
            </View>

            {/* Description */}
            <Text style={styles.description}>
              Send an authorization email with login credentials. Auditor must
              click the authorize button before logging in.
            </Text>

            {/* Full Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Auditor Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter auditor name"
                placeholderTextColor="#999"
                value={fullName}
                onChangeText={setFullName}
                editable={!isLoading}
              />
            </View>

            {/* Gmail Address Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Auditor Gmail</Text>
              <TextInput
                style={styles.input}
                placeholder="auditor@gmail.com"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            {/* Password is generated automatically and sent in email */}

            {/* Register Button */}
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

            {/* Back Button */}
            {!isEmbedded && (
              <Pressable
                style={styles.backButton}
                onPress={() => router.replace("/AdminDashboard")}
              >
                <Text style={styles.backButtonText}>← Back</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  centerContainer: {
    width: "100%",
    maxWidth: 500,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  backButton: {
    marginTop: 20,
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
  passwordInputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingRight: 44,
    paddingVertical: 11,
    fontSize: 13,
    backgroundColor: "#fafafa",
    color: "#1a1a1a",
  },
  toggleButton: {
    position: "absolute",
    right: 12,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  toggleButtonPressed: {
    opacity: 0.6,
  },
  registerButton: {
    backgroundColor: "#0f8a3d",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  registerButtonPressed: {
    backgroundColor: "#0a6630",
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
