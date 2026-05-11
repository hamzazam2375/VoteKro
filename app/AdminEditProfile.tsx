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
      router.replace("/AdminDashboard");
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading...</Text>
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

      {!isEmbedded && (
        <Pressable style={styles.backButton} onPress={() => router.replace("/AdminDashboard")}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.innerWrapper}>
          <View style={styles.titleSection}>
            <Text style={styles.pageTitle}>Edit Profile</Text>
            <Text style={styles.pageSubtitle}>
              Update your account information
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g., John Doe"
                placeholderTextColor="#a3a3a3"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@example.com"
                placeholderTextColor="#a3a3a3"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Leave blank to keep current password"
                placeholderTextColor="#a3a3a3"
                secureTextEntry
                editable={!isLoading}
              />
            </View>

            <Text style={styles.helperText}>
              Updating email or password will use your current authenticated
              session.
            </Text>

            <View style={styles.buttonRow}>
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
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.cancelButtonPressed,
                ]}
                onPress={handleCancel}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  centerContainer: {
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
  contentContainer: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 32,
    alignItems: "stretch",
  },
  innerWrapper: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: "#2e63e3",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
    marginBottom: 0,
    marginLeft: 16,
    marginTop: 12,
    marginRight: 16,
  },
  backButtonText: {
    color: "#2e63e3",
    fontSize: 14,
    fontWeight: "600",
  },
  titleSection: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 15,
    color: "#6b7280",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4e7ec",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 24,
    boxShadow: "0px 1px 3px rgba(15, 23, 42, 0.06)",
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#d9dee7",
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#f8fafc",
    color: "#111827",
    fontSize: 14,
  },
  helperText: {
    marginBottom: 20,
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  saveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#0ea66c",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonPressed: {
    opacity: 0.88,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#d9dee7",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonPressed: {
    backgroundColor: "#f8fafc",
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
  },
});
