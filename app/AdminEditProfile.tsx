import { serviceFactory } from "@/class/service-factory";
import { Navbar } from "@/components/navbar";
import { PageBackground } from "@/constants/theme";
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

type AdminEditProfileProps = {
  isEmbedded?: boolean;
};

export default function AdminEditProfile({
  isEmbedded = false,
}: AdminEditProfileProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profile = await serviceFactory.authService.getCurrentProfile();
        if (!profile) {
          Alert.alert("Not authenticated", "Please login");
          router.replace("/AdminLogin");
          return;
        }
        if (mounted) {
          setFullName(profile.full_name || "");
          const currentEmail =
            await serviceFactory.authService.getCurrentUserEmail();
          if (currentEmail) {
            setEmail(currentEmail);
          }
        }
      } catch (error) {
        Alert.alert(
          "Error",
          serviceFactory.authService.getErrorMessage(
            error,
            "Failed to load profile",
          ),
        );
        router.replace("/AdminLogin");
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const userId = await serviceFactory.authService.requireCurrentUserId();
      await serviceFactory.profileRepository.update(userId, {
        full_name: fullName,
      });
      await serviceFactory.authService.updateCurrentUser({
        email: email.trim() || undefined,
        password: newPassword.trim() || undefined,
      });
      Alert.alert("Success", "Profile updated successfully");
        if (Platform.OS === "web") {
          try {
            const { toast } = require("react-toastify");
            toast.success("Profile updated successfully");
          } catch (err) {
            // fallback to Alert if toast isn't available
            Alert.alert("Success", "Profile updated successfully");
          }
        } else {
          Alert.alert("Success", "Profile updated successfully");
        }

        // Stay on the same page after successful save (no navigation)
    } catch (error) {
      Alert.alert(
        "Error",
        serviceFactory.authService.getErrorMessage(
          error,
          "Failed to update profile",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.replace("/AdminDashboard");
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => void doLogout() },
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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isEmbedded && (
        <Navbar
          actions={[
            { label: "Logout", onPress: handleLogout, variant: "outline" },
          ]}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerContainer}>
          <View style={styles.card}>
            <View style={styles.titleContainer}>
              <Text style={styles.icon}>👤</Text>
              <Text style={styles.title}>Edit Profile</Text>
            </View>

            <Text style={styles.description}>
              Update your account information
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your name"
                placeholderTextColor="#999"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Leave blank to keep current password"
                placeholderTextColor="#999"
                secureTextEntry
                editable={!isLoading}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
                isLoading && styles.saveButtonDisabled,
              ]}
              disabled={isLoading}
              onPress={() => void handleSave()}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </Pressable>
          </View>

          {!isEmbedded && (
            <Pressable style={styles.backButton} onPress={handleCancel}>
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PageBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 14,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    width: "100%",
    backgroundColor: PageBackground,
  },
  centerContainer: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: 0,
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
  icon: {
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
  helperText: {
    marginBottom: 20,
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
  },
  saveButton: {
    backgroundColor: "#0f8a3d",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  saveButtonPressed: {
    backgroundColor: "#0a6630",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
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
});
