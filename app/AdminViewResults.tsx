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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";

type CandidateResult = {
  candidate: CandidateRow;
  votes: number;
  percentage: number;
};

const palette = [
  "#3b82f6",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
];

function ElectionChart({
  results,
}: {
  results: CandidateResult[];
}) {
  const total = results.reduce((s, r) => s + r.votes, 0) || 1;

  return (
    <View style={styles.chartContainer}>
      <View style={styles.stackedBar}>
        {results.map((r, idx) => (
          <View
            key={r.candidate.id}
            style={[
              styles.barSegment,
              { flex: r.votes / total, backgroundColor: palette[idx % palette.length] },
            ]}
          />
        ))}
      </View>

      <View style={styles.legendWrap}>
        {results.map((r, idx) => (
          <View key={r.candidate.id} style={styles.legendItem}>
            <View
              style={[styles.legendColor, { backgroundColor: palette[idx % palette.length] }]}
            />
            <Text style={styles.legendText} numberOfLines={1}>
              {r.candidate.display_name} • {r.percentage.toFixed(1)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AdminViewResults({ isEmbedded }: { isEmbedded?: boolean } = {}) {
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

  const getElectionStatus = (election: ElectionRow) => {
    const now = new Date().getTime();
    const startTime = new Date(election.starts_at).getTime();
    const endTime = new Date(election.ends_at).getTime();

    if (endTime < now) return { label: "Closed", color: "#9ca3af" };
    if (startTime > now) return { label: "Upcoming", color: "#f59e0b" };
    return { label: "Live", color: "#10b981" };
  };

  const getCandidatePosition = (index: number) => {
    if (index === 0) return { label: "👑 Winner", color: "#3b82f6" };
    if (index === 1) return { label: "🥈 Runner-up", color: "#ec4899" };
    if (index === 2) return { label: "🥉 3rd Place", color: "#10b981" };
    return null;
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
          infoText={`Welcome, ${profile?.full_name ?? "Administrator"}!`}
          actions={[
            { label: "Logout", onPress: handleLogout, variant: "outline" },
          ]}
        />
      )}

      {!isEmbedded && (
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace("/AdminDashboard")}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.innerWrapper}>
          <View style={styles.titleSection}>
            <Text style={styles.pageTitle}>📊 Election Results</Text>
            <Text style={styles.pageSubtitle}>
              View voting results and statistics
            </Text>
          </View>

          <View style={styles.filterCard}>
            <Text style={styles.filterLabel}>Filter by Election:</Text>
            <View style={styles.mobileFilterWrap}>
              <Pressable
                style={[
                  styles.mobileFilterChip,
                  selectedElectionId === "all" && styles.mobileFilterChipActive,
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
          </View>

          {electionResults.map(({ election, results }) => {
            const totalVotes = results.reduce((s, r) => s + r.votes, 0);
            const statusInfo = getElectionStatus(election);
            const winner = results[0];
            const runnerUp = results[1];
            const margin = winner && runnerUp ? 
              (((winner.votes - runnerUp.votes) / totalVotes) * 100).toFixed(1) : "0";

            return (
              <View key={election.id} style={styles.electionCard}>
                {/* Header with status badge */}
                <View style={styles.electionHeader}>
                  <View>
                    <Text style={styles.electionTitle}>{election.title}</Text>
                    <Text style={styles.electionMeta}>
                      ID: {election.id} • {election.description || "Election"}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                    <Text style={styles.statusBadgeText}>{statusInfo.label}</Text>
                  </View>
                </View>

                {/* Stat cards */}
                <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>TOTAL VOTES</Text>
                    <Text style={styles.statValue}>{totalVotes}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>CANDIDATES</Text>
                    <Text style={styles.statValue}>{results.length}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>LEADING</Text>
                    <Text style={styles.statValueBlue}>{winner?.candidate.display_name || "—"}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>MARGIN</Text>
                    <Text style={styles.statValueGreen}>+{margin}%</Text>
                  </View>
                </View>

                {/* Stacked bar chart */}
                <ElectionChart results={results} />

                {/* Candidate cards */}
                <View style={[styles.resultsGrid, isMobile && styles.resultsGridMobile]}>
                  {results.map((entry, idx) => {
                    const position = getCandidatePosition(idx);
                    const initials = entry.candidate.display_name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <View
                        key={entry.candidate.id}
                        style={[
                          styles.resultCard,
                          isMobile && styles.resultCardMobile,
                          position && { borderTopColor: position.color, borderTopWidth: 3 },
                        ]}
                      >
                        {position && (
                          <View style={[styles.positionBadge, { backgroundColor: position.color }]}>
                            <Text style={styles.positionBadgeText}>{position.label}</Text>
                          </View>
                        )}

                        <Text style={styles.candidateInitials}>{initials}</Text>

                        <Text style={styles.candidateName}>
                          {entry.candidate.display_name}
                        </Text>
                        <Text style={styles.candidateParty}>
                          {entry.candidate.party_name ?? "Independent"}
                        </Text>
                        <Text style={styles.voteNumber}>{entry.votes}</Text>
                        <Text style={styles.votePercent}>
                          {entry.percentage.toFixed(1)}% of total votes
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
                    );
                  })}
                </View>
              </View>
            );
          })}

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
  electionCard: {
    marginBottom: 24,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
  },
  electionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  electionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  electionMeta: {
    fontSize: 12,
    color: "#6b7280",
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    minWidth: 70,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  statsGridMobile: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 12,
    minWidth: 120,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9ca3af",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  statValueBlue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
  statValueGreen: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10b981",
  },
  chartContainer: {
    marginBottom: 14,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
  },
  stackedBar: {
    height: 20,
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: "#e5e7eb",
  },
  barSegment: {
    height: "100%",
  },
  legendWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 120,
    maxWidth: 240,
    marginRight: 12,
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: "#374151",
  },
  resultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  resultsGridMobile: {
    gap: 12,
  },
  resultCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  resultCardMobile: {
    flex: 1,
    minWidth: 0,
  },
  positionBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  positionBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
  },
  candidateInitials: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2563eb",
    marginBottom: 6,
  },
  candidateName: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  candidateParty: {
    textAlign: "center",
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 10,
  },
  voteNumber: {
    textAlign: "center",
    fontSize: 32,
    fontWeight: "700",
    color: "#ec4899",
    marginBottom: 4,
    lineHeight: 36,
  },
  votePercent: {
    textAlign: "center",
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 8,
  },
  progressTrack: {
    width: "100%",
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
  electionSection: {
    marginBottom: 20,
  },
  electionTitleMobile: {
    fontSize: 28,
  },
  electionDescriptionMobile: {
    fontSize: 13,
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
