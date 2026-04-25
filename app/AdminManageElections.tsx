import type { ElectionRow, ProfileRow } from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { Navbar } from "@/components/navbar";
import DateTimePicker, {
    type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { toast } from "react-toastify";

export default function AdminManageElections() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [elections, setElections] = useState<ElectionRow[]>([]);
  const [candidateCounts, setCandidateCounts] = useState<
    Record<string, number>
  >({});
  const [selectedElection, setSelectedElection] = useState<ElectionRow | null>(
    null,
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [showEditStartDatePicker, setShowEditStartDatePicker] = useState(false);
  const [showEditEndDatePicker, setShowEditEndDatePicker] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userProfile =
        await serviceFactory.authService.getRequiredProfile("admin");
      setProfile(userProfile);

      const electionRows = await serviceFactory.adminService.listElections();
      setElections(electionRows);

      const counts = await Promise.all(
        electionRows.map(async (election) => {
          const candidates =
            await serviceFactory.adminService.getElectionCandidates(
              election.id,
            );
          return [election.id, candidates.length] as const;
        }),
      );
      setCandidateCounts(Object.fromEntries(counts));
    } catch (error) {
      const message = serviceFactory.authService.getErrorMessage(
        error,
        "Failed to load data",
      );
      toast.error(message);
      router.replace("/AdminLogin");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      return () => undefined;
    }, [loadData]),
  );

  const handleLogout = () => {
    if (Platform.OS === "web") {
      setShowLogoutModal(true);
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: doLogout },
      ]);
    }
  };

  const doLogout = async () => {
    setShowLogoutModal(false);
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

  const openEditModal = (election: ElectionRow) => {
    setSelectedElection(election);
    setEditTitle(election.title);
    setEditDescription(election.description || "");
    setEditStartDate(toDateInputValue(election.starts_at));
    setEditEndDate(toDateInputValue(election.ends_at));
    setShowEditModal(true);
  };

  const openDeleteModal = (election: ElectionRow) => {
    setSelectedElection(election);
    setShowDeleteModal(true);
  };

  const handleUpdateElection = async () => {
    if (!selectedElection) return;

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      Alert.alert("Error", "Election title is required");
      return;
    }

    const startsAtIso = toIsoDate(editStartDate, false);
    const endsAtIso = toIsoDate(editEndDate, true);

    if (!startsAtIso || !endsAtIso) {
      Alert.alert("Error", "Invalid date format. Use YYYY-MM-DD.");
      return;
    }

    if (new Date(endsAtIso).getTime() <= new Date(startsAtIso).getTime()) {
      Alert.alert("Error", "End date must be after start date.");
      return;
    }

    const status = getStatusFromDates(startsAtIso, endsAtIso);

    try {
      await serviceFactory.adminService.updateElection({
        electionId: selectedElection.id,
        title: trimmedTitle,
        description: editDescription.trim() || undefined,
        startsAtIso,
        endsAtIso,
        status,
      });
      toast.success("Election updated successfully");
      setShowEditModal(false);
      void loadData();
    } catch (error) {
      Alert.alert(
        "Error",
        serviceFactory.authService.getErrorMessage(
          error,
          "Failed to update election",
        ),
      );
    }
  };

  const handleDeleteElection = async () => {
    if (!selectedElection) return;

    try {
      await serviceFactory.adminService.deleteElection(selectedElection.id);
      toast.success("Election deleted successfully");
      setShowDeleteModal(false);
      void loadData();
    } catch (error) {
      Alert.alert(
        "Error",
        serviceFactory.authService.getErrorMessage(
          error,
          "Failed to delete election",
        ),
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const toDateInputValue = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toISOString().slice(0, 10);
  };

  const toDateFromInput = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date();
    }

    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const onEditStartDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowEditStartDatePicker(false);
    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setEditStartDate(toDateInputValue(selectedDate.toISOString()));
  };

  const onEditEndDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowEditEndDatePicker(false);
    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setEditEndDate(toDateInputValue(selectedDate.toISOString()));
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

  const getStatusFromDates = (
    startsAtIso: string,
    endsAtIso: string,
  ): ElectionRow["status"] => {
    const now = Date.now();
    const startsAt = new Date(startsAtIso).getTime();
    const endsAt = new Date(endsAtIso).getTime();

    if (startsAt > now) {
      return "draft";
    }

    if (endsAt < now) {
      return "closed";
    }

    return "open";
  };

  const webDateInputStyle = {
    height: 42,
    borderWidth: 1,
    borderColor: "#d9dee7",
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 12,
    backgroundColor: "#f8fafc",
    color: "#111827",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  } as const;

  const getElectionStatus = (election: ElectionRow) => {
    const now = Date.now();
    const startsAt = new Date(election.starts_at).getTime();
    const endsAt = new Date(election.ends_at).getTime();

    if (now < startsAt) {
      return { label: "Upcoming", color: "#f59e0b" };
    } else if (now > endsAt) {
      return { label: "Ended", color: "#6b7280" };
    } else {
      return { label: "Active", color: "#10b981" };
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
      {/* Logout confirmation modal (web) */}
      <Modal
        transparent
        visible={showLogoutModal}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to logout?
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalLogoutBtn} onPress={doLogout}>
                <Text style={styles.modalLogoutText}>Logout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Election Modal */}
      <Modal
        transparent
        visible={showEditModal}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✏️ Edit Election</Text>
              <Pressable
                style={styles.closeModalBtn}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.closeModalText}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.inputLabel}>Election Name</Text>
            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Election name"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Election description"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
            />
            <Text style={styles.inputLabel}>Start Date</Text>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={editStartDate}
                onChange={(event) =>
                  setEditStartDate(event.currentTarget.value)
                }
                style={webDateInputStyle}
              />
            ) : (
              <>
                <Pressable
                  style={styles.datePickerButton}
                  onPress={() => setShowEditStartDatePicker(true)}
                >
                  <Text
                    style={[
                      styles.datePickerButtonText,
                      !editStartDate && styles.datePickerPlaceholder,
                    ]}
                  >
                    {editStartDate || "Select start date"}
                  </Text>
                </Pressable>
                {showEditStartDatePicker ? (
                  <DateTimePicker
                    value={toDateFromInput(editStartDate)}
                    mode="date"
                    display="default"
                    onChange={onEditStartDateChange}
                  />
                ) : null}
              </>
            )}
            <Text style={styles.inputLabel}>End Date</Text>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={editEndDate}
                onChange={(event) => setEditEndDate(event.currentTarget.value)}
                style={webDateInputStyle}
              />
            ) : (
              <>
                <Pressable
                  style={styles.datePickerButton}
                  onPress={() => setShowEditEndDatePicker(true)}
                >
                  <Text
                    style={[
                      styles.datePickerButtonText,
                      !editEndDate && styles.datePickerPlaceholder,
                    ]}
                  >
                    {editEndDate || "Select end date"}
                  </Text>
                </Pressable>
                {showEditEndDatePicker ? (
                  <DateTimePicker
                    value={toDateFromInput(editEndDate)}
                    mode="date"
                    display="default"
                    onChange={onEditEndDateChange}
                  />
                ) : null}
              </>
            )}

            <View style={styles.updateButtonWrap}>
              <Pressable
                style={styles.modalSaveBtn}
                onPress={() => void handleUpdateElection()}
              >
                <Text style={styles.modalSaveText}>✓ Update Election</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        transparent
        visible={showDeleteModal}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Delete Election</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete "{selectedElection?.title}"? This
              action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalDeleteBtn}
                onPress={handleDeleteElection}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Navbar
        infoText={`Welcome, ${profile?.full_name ?? "Administrator"}!`}
        actions={[
          { label: "Logout", onPress: handleLogout, variant: "outline" },
        ]}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {Platform.OS === "web" ? (
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/AdminDashboard")}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
        ) : null}

        <View style={styles.innerWrapper}>
          <View style={styles.titleSection}>
            <Text style={styles.dashboardTitle}>📋 Manage Elections</Text>
            <Text style={styles.dashboardSubtitle}>
              Edit, delete, or manage election details
            </Text>
          </View>

          {elections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No Elections Yet</Text>
              <Text style={styles.emptyDesc}>
                Create your first election to get started
              </Text>
              <Pressable
                style={styles.createBtn}
                onPress={() => router.push("/AdminCreateElection")}
              >
                <Text style={styles.createBtnText}>Create Election</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.electionsList}>
              {elections.map((election) => {
                const status = getElectionStatus(election);
                return (
                  <View key={election.id} style={styles.electionCard}>
                    <View style={styles.electionHeader}>
                      <Text style={styles.electionTitle}>{election.title}</Text>
                      <View style={styles.electionActions}>
                        <Pressable
                          style={styles.editBtn}
                          onPress={() => openEditModal(election)}
                        >
                          <Text style={styles.editBtnText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          style={styles.deleteBtn}
                          onPress={() => openDeleteModal(election)}
                        >
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                    {election.description && (
                      <Text style={styles.electionDescription}>
                        {election.description}
                      </Text>
                    )}
                    <View style={styles.electionDates}>
                      <Text style={styles.dateLabel}>
                        Dates: {formatDate(election.starts_at)} to{" "}
                        {formatDate(election.ends_at)}
                      </Text>
                      <Text style={styles.dateLabel}>
                        Candidates: {candidateCounts[election.id] ?? 0}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: status.color + "1f" },
                      ]}
                    >
                      <Text
                        style={[styles.statusText, { color: status.color }]}
                      >
                        {status.label.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 32,
    alignItems: "stretch",
  },
  innerWrapper: {
    width: "100%",
    maxWidth: 980,
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
    marginBottom: 26,
    marginLeft: 10,
  },
  backButtonText: {
    color: "#2e63e3",
    fontSize: 13,
    fontWeight: "600",
  },
  titleSection: {
    marginBottom: 24,
  },
  dashboardTitle: {
    fontSize: 38,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  dashboardSubtitle: {
    fontSize: 16,
    color: "#6b7280",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 24,
  },
  createBtn: {
    backgroundColor: "#1a73e8",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  electionsList: {
    gap: 16,
  },
  electionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#2e63e3",
    shadowColor: "#2e63e3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  electionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 12,
  },
  electionTitle: {
    fontSize: 26,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  statusBadge: {
    marginTop: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  electionDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },
  electionDates: {
    gap: 6,
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 13,
    color: "#4b5563",
  },
  electionActions: {
    flexDirection: "row",
    gap: 8,
  },
  editBtn: {
    backgroundColor: "#e11d8d",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  editBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  deleteBtnText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "90%",
    maxWidth: 400,
  },
  editModalBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    width: "92%",
    maxWidth: 430,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  closeModalBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  closeModalText: {
    fontSize: 20,
    lineHeight: 20,
    color: "#4b5563",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111827",
  },
  modalMessage: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cfd7e3",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    height: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
    marginBottom: 4,
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: "#cfd7e3",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    height: 42,
    paddingHorizontal: 12,
    justifyContent: "center",
    marginBottom: 4,
  },
  datePickerButtonText: {
    color: "#111827",
    fontSize: 13,
  },
  datePickerPlaceholder: {
    color: "#9ca3af",
  },
  textArea: {
    minHeight: 68,
    height: 68,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  modalCancelText: {
    fontSize: 14,
    color: "#374151",
  },
  modalSaveBtn: {
    backgroundColor: "#2e63e3",
    width: "100%",
    paddingVertical: 12,
    borderRadius: 7,
    alignItems: "center",
  },
  modalSaveText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  updateButtonWrap: {
    marginTop: 14,
  },
  modalLogoutBtn: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  modalLogoutText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  modalDeleteBtn: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  modalDeleteText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});
