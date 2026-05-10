import { serviceFactory } from "@/class/service-factory";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
    Button,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function AdminEditProfile() {
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
      Alert.alert("Saved", "Profile updated successfully");
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Edit Profile</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full name"
            editable={!isLoading}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />

          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Leave blank to keep current password"
            secureTextEntry
            editable={!isLoading}
          />

          <Text style={styles.helperText}>
            Updating email or password will use your current authenticated
            session.
          </Text>

          <View style={styles.buttonRow}>
            <Button title="Save" onPress={handleSave} disabled={isLoading} />
            <View style={{ width: 12 }} />
            <Button
              title="Cancel"
              onPress={() => router.replace("/AdminDashboard")}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 20, alignItems: "center" },
  card: {
    width: "100%",
    maxWidth: 700,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  label: { fontSize: 13, marginBottom: 6, color: "#444" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    fontSize: 15,
  },
  helperText: {
    marginTop: -6,
    marginBottom: 16,
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 17,
  },
  buttonRow: { flexDirection: "row", justifyContent: "flex-start" },
});
