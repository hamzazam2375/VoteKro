import type { ElectionRow, ProfileRow } from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { Navbar } from "@/components/navbar";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AdminCreateElection from "./AdminCreateElection";
import AdminEditProfile from "./AdminEditProfile";
import AdminManageCandidates from "./AdminManageCandidates";
import AdminManageElections from "./AdminManageElections";
import AdminViewResults from "./AdminViewResults";
import AuditorSignup from "./AuditorSignup";
import VoterSignup from "./VoterSignup";

export default function AdminDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 600;
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [registeredVotersCount, setRegisteredVotersCount] = useState(0);
  const [elections, setElections] = useState<ElectionRow[]>([]);
  const [totalVotesCast, setTotalVotesCast] = useState(0);
  const [candidateCounts, setCandidateCounts] = useState<
    Record<string, number>
  >({});
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState<
    | "overview"
    | "create-election"
    | "edit-profile"
    | "manage-elections"
    | "manage-candidates"
    | "view-results"
    | "register-voter"
    | "register-auditor"
  >("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadDashboardOverview = useCallback(async () => {
    try {
      const overview = await serviceFactory.adminService.getDashboardOverview();
      setProfile(overview.profile);
      setRegisteredVotersCount(overview.registeredVotersCount);

      const electionRows = await serviceFactory.adminService.listElections();
      setElections(electionRows);

      const countEntries = await Promise.all(
        electionRows.map(async (election) => {
          const candidates =
            await serviceFactory.adminService.getElectionCandidates(
              election.id,
            );
          return [election.id, candidates.length] as const;
        }),
      );

      setCandidateCounts(Object.fromEntries(countEntries));

      const voteEntries = await Promise.all(
        electionRows.map(async (election) => {
          try {
            const ledger = await serviceFactory.auditorService.getLedger(
              election.id,
            );
            return [election.id, ledger.length] as const;
          } catch {
            return [election.id, 0] as const;
          }
        }),
      );

      const votesByElection = Object.fromEntries(voteEntries);
      setVoteCounts(votesByElection);
      setTotalVotesCast(
        Object.values(votesByElection).reduce((sum, count) => sum + count, 0),
      );
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
      setIsLoading(false);
    }
  }, [router]);

  const reloadOnFocus = useCallback(() => {
    void loadDashboardOverview();
    return () => undefined;
  }, [loadDashboardOverview]);

  useFocusEffect(reloadOnFocus);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void loadDashboardOverview();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [loadDashboardOverview]);

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

  const now = Date.now();
  const activeElections = elections.filter((election) => {
    const startsAt = new Date(election.starts_at).getTime();
    const endsAt = new Date(election.ends_at).getTime();
    return now >= startsAt && now <= endsAt;
  });
  const upcomingElectionsCount = elections.filter(
    (election) => new Date(election.starts_at).getTime() > now,
  ).length;

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
      {/* Custom Header for Mobile with Hamburger */}
      {isMobile ? (
        <View style={[styles.mobileHeader, { paddingTop: insets.top + 10 }]}>
          <Pressable
            style={styles.mobileHamburger}
            onPress={() => setSidebarOpen(!sidebarOpen)}
          >
            <Text style={styles.mobileHamburgerIcon}>☰</Text>
          </Pressable>
          <Pressable
            style={styles.mobileLogoButton}
            onPress={() => router.replace("/AdminDashboard")}
          >
            <Text style={styles.mobileLogo}>VoteKro</Text>
          </Pressable>
          <Pressable style={styles.mobileLogoutButton} onPress={handleLogout}>
            <Text style={styles.mobileLogoutText}>Logout</Text>
          </Pressable>
        </View>
      ) : (
        <Navbar
          homeRoute="/AdminDashboard"
          actions={[
            { label: "Logout", onPress: handleLogout, variant: "outline" },
          ]}
        />
      )}

      {/* Main Layout - Sidebar + Content */}
      <View style={[styles.mainLayout, isMobile && styles.mainLayoutMobile]}>
        {/* Overlay Backdrop - Mobile Only */}
        {isMobile && sidebarOpen && (
          <Pressable
            style={styles.sidebarOverlay}
            onPress={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        {(!isMobile || sidebarOpen) && (
          <View style={[styles.sidebar, isMobile && styles.sidebarMobile]}>
            <View style={styles.sidebarMenu}>
              {/* Overview */}
              <Pressable
                style={[
                  styles.sidebarButton,
                  currentPage === "overview" && styles.sidebarButtonActive,
                ]}
                onPress={() => {
                  setCurrentPage("overview");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.sidebarButtonText,
                    currentPage === "overview" &&
                      styles.sidebarButtonTextActive,
                  ]}
                >
                  📊 Dashboard
                </Text>
              </Pressable>

              {/* Create Election */}
              <Pressable
                style={[
                  styles.sidebarButton,
                  currentPage === "create-election" &&
                    styles.sidebarButtonActive,
                ]}
                onPress={() => {
                  setCurrentPage("create-election");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.sidebarButtonText,
                    currentPage === "create-election" &&
                      styles.sidebarButtonTextActive,
                  ]}
                >
                  📋 Create Election
                </Text>
              </Pressable>

              {/* Manage Elections */}
              <Pressable
                style={[
                  styles.sidebarButton,
                  currentPage === "manage-elections" &&
                    styles.sidebarButtonActive,
                ]}
                onPress={() => {
                  setCurrentPage("manage-elections");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.sidebarButtonText,
                    currentPage === "manage-elections" &&
                      styles.sidebarButtonTextActive,
                  ]}
                >
                  ✏️ Manage Elections
                </Text>
              </Pressable>

              {/* Manage Candidates */}
              <Pressable
                style={[
                  styles.sidebarButton,
                  currentPage === "manage-candidates" &&
                    styles.sidebarButtonActive,
                ]}
                onPress={() => {
                  setCurrentPage("manage-candidates");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.sidebarButtonText,
                    currentPage === "manage-candidates" &&
                      styles.sidebarButtonTextActive,
                  ]}
                >
                  👤 Manage Candidates
                </Text>
              </Pressable>

              {/* View Results */}
              <Pressable
                style={[
                  styles.sidebarButton,
                  currentPage === "view-results" && styles.sidebarButtonActive,
                ]}
                onPress={() => {
                  setCurrentPage("view-results");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.sidebarButtonText,
                    currentPage === "view-results" &&
                      styles.sidebarButtonTextActive,
                  ]}
                >
                  📈 View Results
                </Text>
              </Pressable>

              {/* Register Voter */}
              <Pressable
                style={[
                  styles.sidebarButton,
                  currentPage === "register-voter" &&
                    styles.sidebarButtonActive,
                ]}
                onPress={() => {
                  setCurrentPage("register-voter");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.sidebarButtonText,
                    currentPage === "register-voter" &&
                      styles.sidebarButtonTextActive,
                  ]}
                >
                  ✅ Register Voter
                </Text>
              </Pressable>

              {/* Register Auditor - Admin Only */}
              {profile?.role === "admin" && (
                <Pressable
                  style={[
                    styles.sidebarButton,
                    currentPage === "register-auditor" &&
                      styles.sidebarButtonActive,
                  ]}
                  onPress={() => {
                    setCurrentPage("register-auditor");
                    if (isMobile) setSidebarOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sidebarButtonText,
                      currentPage === "register-auditor" &&
                        styles.sidebarButtonTextActive,
                    ]}
                  >
                    🔍 Register Auditor
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={[
                  styles.sidebarButton,
                  currentPage === "edit-profile" &&
                    styles.sidebarButtonActive,
                ]}
                onPress={() => {
                  setCurrentPage("edit-profile");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.sidebarButtonText,
                    currentPage === "edit-profile" &&
                      styles.sidebarButtonTextActive,
                  ]}
                >
                  👤 Edit Profile
                </Text>
              </Pressable>
            </View>

            <View style={styles.sidebarFooter}>
              <View style={styles.userProfileCard}>
                <Text numberOfLines={1} style={styles.userProfileName}>
                  {profile?.full_name?.trim() || "Administrator"}
                </Text>
                <Text style={styles.userProfileRole}>
                  {profile?.role || "admin"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Content Area */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            currentPage === "create-election" ||
            currentPage === "register-voter" ||
            currentPage === "register-auditor"
              ? styles.contentContainerCentered
              : null,
          ]}
        >
          <View
            style={[
              styles.innerWrapper,
              currentPage === "create-election" ||
              currentPage === "register-voter" ||
              currentPage === "register-auditor"
                ? styles.innerWrapperCentered
                : null,
            ]}
          >
            {/* Page Content Based on Selection */}
            {currentPage === "overview" && (
              <>
                {/* Dashboard Title */}
                <View style={styles.titleSection}>
                  <Text style={styles.dashboardTitle}>Admin Dashboard</Text>
                  <Text style={styles.dashboardSubtitle}>
                    Manage elections and monitor voting activity
                  </Text>
                </View>

                {/* Stats Cards */}
                <View
                  style={[
                    styles.statsContainer,
                    isMobile && styles.statsContainerMobile,
                  ]}
                >
                  <View
                    style={[
                      styles.statCard,
                      isMobile ? styles.cardFullWidth : styles.cardThirdWidth,
                    ]}
                  >
                    <Text style={styles.statLabel}>Total Elections</Text>
                    <Text style={styles.statNumber}>{elections.length}</Text>
                  </View>
                  <View
                    style={[
                      styles.statCard,
                      isMobile ? styles.cardFullWidth : styles.cardThirdWidth,
                    ]}
                  >
                    <Text style={styles.statLabel}>Registered Voters</Text>
                    <Text style={styles.statNumber}>
                      {registeredVotersCount}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statCard,
                      isMobile ? styles.cardFullWidth : styles.cardThirdWidth,
                    ]}
                  >
                    <Text style={styles.statLabel}>Total Votes Cast</Text>
                    <Text style={styles.statNumber}>{totalVotesCast}</Text>
                  </View>
                </View>

                {/* Active Elections Table */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📊 Active Elections</Text>
                  {isMobile ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <View style={[styles.tableContainer, { minWidth: 600 }]}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                          <Text
                            style={[
                              styles.tableHeaderCell,
                              { flex: 2, minWidth: 140 },
                            ]}
                          >
                            Election Name
                          </Text>
                          <View style={styles.headerDivider} />
                          <Text
                            style={[
                              styles.tableHeaderCell,
                              { flex: 1, minWidth: 70 },
                            ]}
                          >
                            Status
                          </Text>
                          <View style={styles.headerDivider} />
                          <Text
                            style={[
                              styles.tableHeaderCell,
                              { flex: 1, minWidth: 90 },
                            ]}
                          >
                            Start Date
                          </Text>
                          <View style={styles.headerDivider} />
                          <Text
                            style={[
                              styles.tableHeaderCell,
                              { flex: 1, minWidth: 90 },
                            ]}
                          >
                            End Date
                          </Text>
                          <View style={styles.headerDivider} />
                          <Text
                            style={[
                              styles.tableHeaderCell,
                              { flex: 1, minWidth: 80 },
                            ]}
                          >
                            Candidates
                          </Text>
                          <View style={styles.headerDivider} />
                          <Text
                            style={[
                              styles.tableHeaderCell,
                              { flex: 1, minWidth: 80 },
                            ]}
                          >
                            Results
                          </Text>
                        </View>
                        {activeElections.length === 0 ? (
                          <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>
                              No active elections
                            </Text>
                            {upcomingElectionsCount > 0 ? (
                              <Text style={styles.emptyHintText}>
                                {upcomingElectionsCount} election(s) are
                                scheduled and will appear here once the start
                                date is reached.
                              </Text>
                            ) : null}
                          </View>
                        ) : (
                          activeElections.map((election) => (
                            <View key={election.id} style={styles.tableRow}>
                              <Text
                                style={[
                                  styles.tableRowCell,
                                  { flex: 2, minWidth: 140 },
                                ]}
                                numberOfLines={1}
                              >
                                {election.title}
                              </Text>
                              <Text
                                style={[
                                  styles.tableRowCell,
                                  { flex: 1, minWidth: 70 },
                                ]}
                              >
                                active
                              </Text>
                              <Text
                                style={[
                                  styles.tableRowCell,
                                  { flex: 1, minWidth: 90 },
                                ]}
                              >
                                {new Date(
                                  election.starts_at,
                                ).toLocaleDateString()}
                              </Text>
                              <Text
                                style={[
                                  styles.tableRowCell,
                                  { flex: 1, minWidth: 90 },
                                ]}
                              >
                                {new Date(
                                  election.ends_at,
                                ).toLocaleDateString()}
                              </Text>
                              <Text
                                style={[
                                  styles.tableRowCell,
                                  { flex: 1, minWidth: 80 },
                                ]}
                              >
                                {candidateCounts[election.id] ?? 0}
                              </Text>
                              <Text
                                style={[
                                  styles.tableRowCell,
                                  { flex: 1, minWidth: 80 },
                                ]}
                              >
                                {voteCounts[election.id] ?? 0} votes
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    </ScrollView>
                  ) : (
                    <View style={styles.tableContainer}>
                      {/* Table Header */}
                      <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>
                          Election Name
                        </Text>
                        <View style={styles.headerDivider} />
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>
                          Status
                        </Text>
                        <View style={styles.headerDivider} />
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>
                          Start Date
                        </Text>
                        <View style={styles.headerDivider} />
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>
                          End Date
                        </Text>
                        <View style={styles.headerDivider} />
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>
                          Candidates
                        </Text>
                        <View style={styles.headerDivider} />
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>
                          Results
                        </Text>
                      </View>
                      {activeElections.length === 0 ? (
                        <View style={styles.emptyState}>
                          <Text style={styles.emptyText}>
                            No active elections
                          </Text>
                          {upcomingElectionsCount > 0 ? (
                            <Text style={styles.emptyHintText}>
                              {upcomingElectionsCount} election(s) are scheduled
                              and will appear here once the start date is
                              reached.
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        activeElections.map((election) => (
                          <View key={election.id} style={styles.tableRow}>
                            <Text
                              style={[styles.tableRowCell, { flex: 2 }]}
                              numberOfLines={1}
                            >
                              {election.title}
                            </Text>
                            <Text style={[styles.tableRowCell, { flex: 1 }]}>
                              active
                            </Text>
                            <Text style={[styles.tableRowCell, { flex: 1 }]}>
                              {new Date(
                                election.starts_at,
                              ).toLocaleDateString()}
                            </Text>
                            <Text style={[styles.tableRowCell, { flex: 1 }]}>
                              {new Date(election.ends_at).toLocaleDateString()}
                            </Text>
                            <Text style={[styles.tableRowCell, { flex: 1 }]}>
                              {candidateCounts[election.id] ?? 0}
                            </Text>
                            <Text style={[styles.tableRowCell, { flex: 1 }]}>
                              {voteCounts[election.id] ?? 0} votes
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Other Pages - Display Components */}
            {currentPage === "create-election" && (
              <View style={styles.embeddedPageCenter}>
                <AdminCreateElection isEmbedded={true} />
              </View>
            )}
            {currentPage === "manage-elections" && (
              <AdminManageElections isEmbedded={true} />
            )}
            {currentPage === "manage-candidates" && (
              <AdminManageCandidates isEmbedded={true} />
            )}
            {currentPage === "view-results" && (
              <AdminViewResults isEmbedded={true} />
            )}
            {currentPage === "register-voter" && (
              <View style={styles.embeddedPageCenter}>
                <VoterSignup isEmbedded={true} />
              </View>
            )}
            {currentPage === "register-auditor" && (
              <View style={styles.embeddedPageCenter}>
                <AuditorSignup isEmbedded={true} />
              </View>
            )}
            {currentPage === "edit-profile" && <AdminEditProfile isEmbedded={true} />}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    position: "relative",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  // Logout confirmation modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 28,
    width: 320,
    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.18)",
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 15,
    color: "#444",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#ccc",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
  },
  modalLogoutBtn: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#d32f2f",
  },
  modalLogoutText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 32,
    alignItems: "stretch",
  },
  contentContainerCentered: {
    flexGrow: 1,
    justifyContent: "center",
  },
  innerWrapper: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
  },
  innerWrapperCentered: {
    flex: 1,
    justifyContent: "center",
  },
  embeddedPageCenter: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 420,
  },
  titleSection: {
    marginBottom: 20,
  },
  dashboardTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  dashboardSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  // Stats cards
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 28,
  },
  statsContainerMobile: {
    flexDirection: "column",
  },
  cardThirdWidth: {
    width: "31.5%",
  },
  cardFullWidth: {
    width: "100%",
  },
  statCard: {
    backgroundColor: "#e3f2fd",
    padding: 28,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#90caf9",
    boxShadow: "0px 3px 8px rgba(26, 115, 232, 0.12)",
    elevation: 4,
  },
  statLabel: {
    fontSize: 13,
    color: "#1a73e8",
    marginBottom: 14,
    fontWeight: "600",
  },
  statNumber: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#1a73e8",
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  sectionUnderline: {
    height: 3,
    width: 55,
    backgroundColor: "#1a73e8",
    borderRadius: 2,
    marginBottom: 16,
  },
  // 3-per-row action cards
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  actionsGridMobile: {
    flexDirection: "column",
  },
  actionCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    boxShadow: "0px 3px 8px rgba(0, 0, 0, 0.08)",
    elevation: 3,
  },
  actionCardPressed: {
    opacity: 0.85,
  },
  cardInner: {
    borderRadius: 16,
    overflow: "hidden",
  },
  cardStripe: {
    height: 5,
  },
  cardBody: {
    padding: 22,
  },
  actionIcon: {
    fontSize: 30,
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  actionDesc: {
    fontSize: 12,
    color: "#666",
    lineHeight: 17,
    marginBottom: 18,
    flex: 1,
  },
  actionBtn: {
    backgroundColor: "#1a73e8",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  // Elections table
  tableContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#bbdefb",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#90caf9",
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0d47a1",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  tableRowCell: {
    fontSize: 12,
    color: "#1f2937",
    fontWeight: "500",
  },
  headerDivider: {
    width: 1,
    backgroundColor: "#90caf9",
    marginVertical: 2,
    marginHorizontal: 8,
  },
  emptyState: {
    paddingVertical: 36,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    fontWeight: "500",
  },
  emptyHintText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    maxWidth: 460,
    lineHeight: 18,
  },
  // Main Layout
  mainLayout: {
    flex: 1,
    flexDirection: "row",
    position: "relative",
  },
  mainLayoutMobile: {
    flexDirection: "column",
  },
  // Sidebar Styles
  sidebar: {
    width: 240,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e0e0e0",
    paddingVertical: 20,
    paddingHorizontal: 12,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  sidebarMobile: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 999,
    width: 240,
    maxWidth: "80%",
    height: "100%",
    borderRightWidth: 1,
    boxShadow: "2px 0px 8px rgba(0, 0, 0, 0.2)",
    elevation: 10,
  },
  sidebarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 500,
  },
  sidebarMenu: {
    gap: 8,
    flex: 1,
  },
  sidebarButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  sidebarButtonActive: {
    backgroundColor: "#1a73e8",
  },
  sidebarButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4a4a4a",
  },
  sidebarButtonTextActive: {
    color: "#ffffff",
  },
  // Mobile Header
  mobileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  mobileHamburger: {
    padding: 6,
    marginRight: 8,
  },
  mobileHamburgerIcon: {
    fontSize: 26,
    color: "#1a73e8",
    fontWeight: "700",
  },
  mobileLogoButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    flex: 1,
    alignItems: "center",
  },
  mobileLogo: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a73e8",
  },
  mobileLogoutButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#1a73e8",
  },
  mobileLogoutText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a73e8",
  },
  // Sidebar Footer
  sidebarFooter: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  welcomeCard: {
    backgroundColor: "#f0f4ff",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#1a73e8",
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a73e8",
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 12,
    color: "#677b94",
    fontWeight: "500",
  },
  userProfileCard: {
    backgroundColor: "#f6f8fc",
    borderWidth: 1,
    borderColor: "#e1e7f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userProfileName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2e4a",
  },
  userProfileRole: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#5d6d86",
    textTransform: "capitalize",
  },
});
