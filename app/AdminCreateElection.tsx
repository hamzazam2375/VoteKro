import type { ProfileRow } from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { Navbar } from "@/components/navbar";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
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

export default function AdminCreateElectionScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userProfile =
          await serviceFactory.authService.getRequiredProfile("admin");
        setProfile(userProfile);
      } catch (loadError) {
        const message = serviceFactory.authService.getErrorMessage(
          loadError,
          "Failed to load profile",
        );
        Alert.alert("Error", message);
        router.replace("/AdminLogin");
      } finally {
        setIsLoadingProfile(false);
      }
    };

    void loadProfile();
  }, [router]);

  const handleLogout = async () => {
    try {
      await serviceFactory.authService.signOut();
      Alert.alert("Success", "Logged out successfully");
      router.replace("/");
    } catch (logoutError) {
      const message = serviceFactory.authService.getErrorMessage(
        logoutError,
        "Failed to logout",
      );
      Alert.alert("Error", message);
    }
  };

  const toIsoDate = (value: string, endOfDay = false): string | null => {
    const normalized = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return null;
    }

    const iso = endOfDay
      ? `${normalized}T23:59:59.000Z`
      : `${normalized}T00:00:00.000Z`;
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  };

  const toDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const toDateFromInput = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date();
    }

    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const onStartDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowStartDatePicker(false);
    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setStartDate(toDateInputValue(selectedDate));
  };

  const onEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setEndDate(toDateInputValue(selectedDate));
  };

  const handleCreateElection = async () => {
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle || !startDate.trim() || !endDate.trim()) {
      setError("Election name, start date and end date are required.");
      return;
    }

    const startsAtIso = toIsoDate(startDate, false);
    const endsAtIso = toIsoDate(endDate, true);

    if (!startsAtIso || !endsAtIso) {
      setError("Use valid date format: YYYY-MM-DD");
      return;
    }

    if (new Date(endsAtIso).getTime() <= new Date(startsAtIso).getTime()) {
      setError("End date must be after start date.");
      return;
    }

    setIsSubmitting(true);

    try {
      await serviceFactory.adminService.createElection({
        title: trimmedTitle,
        description: trimmedDescription || undefined,
        startsAtIso,
        endsAtIso,
      });

      Alert.alert("Success", "Election created successfully");
      router.replace("/AdminDashboard");
    } catch (submitError) {
      const message = serviceFactory.authService.getErrorMessage(
        submitError,
        "Failed to create election",
      );
      setError(message);
      Alert.alert("Error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Navbar
        infoText={`Welcome, ${profile?.full_name ?? "Administrator"}!`}
        actions={[
          {
            label: "Logout",
            onPress: () => void handleLogout(),
            variant: "outline",
          },
        ]}
      />

      <Pressable
        style={styles.backButton}
        onPress={() => router.replace("/AdminDashboard")}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>📋 Create New Election</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Election Name</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Presidential Election 2024"
              placeholderTextColor="#a3a3a3"
              style={styles.input}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Brief description of the election"
              placeholderTextColor="#a3a3a3"
              style={styles.input}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Date</Text>
            <Pressable
              style={styles.datePickerButton}
              onPress={() => setShowStartDatePicker(true)}
              disabled={isSubmitting}
            >
              <Text
                style={[
                  styles.datePickerButtonText,
                  !startDate && styles.datePickerPlaceholder,
                ]}
              >
                {startDate || "Select start date"}
              </Text>
            </Pressable>
            {showStartDatePicker ? (
              <DateTimePicker
                value={toDateFromInput(startDate)}
                mode="date"
                display="default"
                onChange={onStartDateChange}
              />
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>End Date</Text>
            <Pressable
              style={styles.datePickerButton}
              onPress={() => setShowEndDatePicker(true)}
              disabled={isSubmitting}
            >
              <Text
                style={[
                  styles.datePickerButtonText,
                  !endDate && styles.datePickerPlaceholder,
                ]}
              >
                {endDate || "Select end date"}
              </Text>
            </Pressable>
            {showEndDatePicker ? (
              <DateTimePicker
                value={toDateFromInput(endDate)}
                mode="date"
                display="default"
                onChange={onEndDateChange}
              />
            ) : null}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            disabled={isSubmitting}
            onPress={() => void handleCreateElection()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>✓ Create Election</Text>
            )}
          </Pressable>
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
  },
  contentContainer: {
    flexGrow: 1,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  formCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4e7ec",
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 24,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  formTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 18,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: "#d9dee7",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    color: "#111827",
    fontSize: 13,
  },
  datePickerButton: {
    height: 42,
    borderWidth: 1,
    borderColor: "#d9dee7",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
  },
  datePickerButtonText: {
    color: "#111827",
    fontSize: 13,
  },
  datePickerPlaceholder: {
    color: "#9ca3af",
  },
  errorText: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "600",
  },
  submitButton: {
    marginTop: 8,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#0ea66c",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonPressed: {
    opacity: 0.88,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
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
    fontSize: 13,
    fontWeight: "600",
  },
});
