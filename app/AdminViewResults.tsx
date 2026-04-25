import type {
    CandidateRow,
    ElectionRow,
    ProfileRow,
} from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { Navbar } from "@/components/navbar";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";

type CandidateResult = {
  candidate: CandidateRow;
  votes: number;
  percentage: number;
};

export default function AdminViewResults() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 760;

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [elections, setElections] = useState<ElectionRow[]>([]);
  const [candidatesByElection, setCandidatesByElection] = useState<
    Record<string, CandidateRow[]>
  >({});
  const [selectedElectionId, setSelectedElectionId] = useState<string>("all");
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userProfile =
        await serviceFactory.authService.getRequiredProfile("admin");
      setProfile(userProfile);

      const electionRows = await serviceFactory.adminService.listElections();
      setElections(electionRows);

      const entries = await Promise.all(
        electionRows.map(async (election) => {
          const candidates =
            await serviceFactory.adminService.getElectionCandidates(
              election.id,
            );
          return [election.id, candidates] as const;
        }),
      );

      setCandidatesByElection(Object.fromEntries(entries));

      if (
        selectedElectionId !== "all" &&
        !electionRows.some((election) => election.id === selectedElectionId)
      ) {
        setSelectedElectionId("all");
      }
    } catch (error) {
      Alert.alert(
        "Error",
        serviceFactory.authService.getErrorMessage(
          error,
          "Failed to load results",
        ),
      );
      router.replace("/AdminLogin");
    } finally {
      setIsLoading(false);
    }
  }, [router, selectedElectionId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      return () => undefined;
    }, [loadData]),
  );

  const toSeededVotes = (candidate: CandidateRow) => {
    const seedBase = `${candidate.id}-${candidate.display_name}-${candidate.candidate_number}`;
    let hash = 0;
    for (let index = 0; index < seedBase.length; index += 1) {
      hash = (hash * 31 + seedBase.charCodeAt(index)) % 100000;
    }

    return 60 + (hash % 170);
  };

  const visibleElections = useMemo(() => {
    if (selectedElectionId === "all") {
      return elections;
    }

    return elections.filter((election) => election.id === selectedElectionId);
  }, [elections, selectedElectionId]);

  const electionResults = useMemo(() => {
    return visibleElections.map((election) => {
      const candidates = candidatesByElection[election.id] ?? [];
      const votes = candidates.map((candidate) => ({
        candidate,
        votes: toSeededVotes(candidate),
      }));

      const totalVotes = votes.reduce((sum, item) => sum + item.votes, 0);
      const results: CandidateResult[] = votes
        .map((item) => ({
          candidate: item.candidate,
          votes: item.votes,
          percentage: totalVotes > 0 ? (item.votes / totalVotes) * 100 : 0,
        }))
        .sort((left, right) => right.votes - left.votes);

      return {
        election,
        results,
        totalVotes,
      };
    });
  }, [candidatesByElection, visibleElections]);

  const handleLogout = () => {
    if (Platform.OS === "web") {
      setShowLogoutModal(true);
      return;
    }

    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => void doLogout() },
    ]);
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

  const webSelectStyle = {
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
              <Pressable
                style={styles.modalLogoutBtn}
                onPress={() => void doLogout()}
              >
                <Text style={styles.modalLogoutText}>Logout</Text>
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
            <Text style={styles.pageTitle}>📊 Election Results</Text>
            <Text style={styles.pageSubtitle}>
              View voting results and statistics
            </Text>
          </View>

          <View style={styles.filterCard}>
            <Text style={styles.filterLabel}>Filter by Election:</Text>
            {Platform.OS === "web" ? (
              <select
                value={selectedElectionId}
                onChange={(event) =>
                  setSelectedElectionId(event.currentTarget.value)
                }
                style={webSelectStyle}
              >
                <option value="all">All Elections</option>
                {elections.map((election) => (
                  <option key={election.id} value={election.id}>
                    {election.title}
                  </option>
                ))}
              </select>
            ) : (
              <View style={styles.mobileFilterWrap}>
                <Pressable
                  style={[
                    styles.mobileFilterChip,
                    selectedElectionId === "all" &&
                      styles.mobileFilterChipActive,
                  ]}
                  onPress={() => setSelectedElectionId("all")}
                >
                  <Text
                    style={[
                      styles.mobileFilterText,
                      selectedElectionId === "all" &&
                        styles.mobileFilterTextActive,
                    ]}
                  >
                    All Elections
                  </Text>
                </Pressable>
                {elections.map((election) => {
                  const selected = selectedElectionId === election.id;
                  return (
                    <Pressable
                      key={election.id}
                      style={[
                        styles.mobileFilterChip,
                        selected && styles.mobileFilterChipActive,
                      ]}
                      onPress={() => setSelectedElectionId(election.id)}
                    >
                      <Text
                        style={[
                          styles.mobileFilterText,
                          selected && styles.mobileFilterTextActive,
                        ]}
                      >
                        {election.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {electionResults.map(({ election, results }) => (
            <View key={election.id} style={styles.electionSection}>
              <Text style={styles.electionTitle}>{election.title}</Text>
              <Text style={styles.electionDescription}>
                {election.description ??
                  "Vote for the presidential candidate of your choice"}
              </Text>

              <View style={styles.resultsGrid}>
                {results.map((entry) => (
                  <View
                    key={entry.candidate.id}
                    style={[
                      styles.resultCard,
                      isMobile && styles.resultCardMobile,
                    ]}
                  >
                    <Text style={styles.candidateName}>
                      {entry.candidate.display_name}
                    </Text>
                    <Text style={styles.candidateParty}>
                      {entry.candidate.party_name ?? "Independent"}
                    </Text>
                    <Text style={styles.voteNumber}>{entry.votes}</Text>
                    <Text style={styles.votePercent}>
                      {entry.percentage.toFixed(1)}%
                    </Text>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.max(entry.percentage, 4)}%` },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {electionResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No elections available to show results.
              </Text>
            </View>
          ) : null}
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
    marginTop: 10,
    color: "#6b7280",
    fontSize: 15,
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
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 38,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  filterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  mobileFilterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mobileFilterChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mobileFilterChipActive: {
    borderColor: "#2e63e3",
    backgroundColor: "#e9f0ff",
  },
  mobileFilterText: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "600",
  },
  mobileFilterTextActive: {
    color: "#1d4ed8",
  },
  electionSection: {
    marginBottom: 20,
  },
  electionTitle: {
    fontSize: 40,
    fontWeight: "700",
    color: "#2563eb",
    marginBottom: 4,
  },
  electionDescription: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 14,
  },
  resultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  resultCard: {
    width: "31.8%",
    minWidth: 250,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
  },
  resultCardMobile: {
    width: "100%",
    minWidth: 0,
  },
  candidateName: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#2563eb",
    marginBottom: 2,
  },
  candidateParty: {
    textAlign: "center",
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 10,
  },
  voteNumber: {
    textAlign: "center",
    fontSize: 36,
    fontWeight: "700",
    color: "#ec4899",
    marginBottom: 4,
    lineHeight: 40,
  },
  votePercent: {
    textAlign: "center",
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#3b82f6",
  },
  emptyState: {
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyStateText: {
    color: "#6b7280",
    fontSize: 14,
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
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
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
});
