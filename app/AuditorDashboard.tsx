import type { ProfileRow } from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { AuditorSidebar } from "@/components/auditor-sidebar";
import { MetricCard, StatCard } from "@/components/dashboard-cards";
import { Navbar } from "@/components/navbar";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AuditorDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 760;
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBlocks: 0,
    activeElections: 0,
    verificationRate: 100,
    anomalies: 0,
    verifiedVotes: 0,
    blockchainRecords: 0,
    systemHealth: "100%",
    systemHealthSubtext: "All systems operational",
    systemHealthStatus: "● Healthy",
    anomaliesList: [] as string[],
    electionBlockchainDetails: [] as {
      electionId: string;
      electionTitle: string;
      totalVotes: number;
      totalBlocks: number;
      verificationStatus: string;
      isValid: boolean;
    }[],
  });

  const loadDashboardData = useCallback(async () => {
    try {
      const userProfile =
        await serviceFactory.authService.getRequiredProfile("auditor");
      setProfile(userProfile);

      // Fetch elections
      const elections = await serviceFactory.electionRepository.listAll();
      const now = Date.now();
      const activeElections = elections.filter((election) => {
        const startsAt = new Date(election.starts_at).getTime();
        const endsAt = new Date(election.ends_at).getTime();
        return now >= startsAt && now <= endsAt;
      });

      let totalBlocksCount = 0;
      let totalAnomalies = 0;
      const anomaliesList: string[] = [];
      const electionBlockchainDetails: {
        electionId: string;
        electionTitle: string;
        totalVotes: number;
        totalBlocks: number;
        verificationStatus: string;
        isValid: boolean;
      }[] = [];

      for (const election of elections) {
        try {
          // Get blockchain verification (totalBlocks = total vote records)
          const verification =
            await serviceFactory.auditorService.verifyFullBlockchainIntegrity(
              election.id,
            );
          
          // Total votes = total blocks (each block is one vote record)
          const totalVotes = verification.totalBlocks;
          totalBlocksCount += verification.totalBlocks;

          // Add election details
          electionBlockchainDetails.push({
            electionId: election.id,
            electionTitle: election.title,
            totalVotes,
            totalBlocks: verification.totalBlocks,
            verificationStatus: verification.isFullyValid ? "✓ Valid" : "⚠️ Issues Found",
            isValid: verification.isFullyValid,
          });

          if (!verification.isFullyValid) {
            totalAnomalies += verification.invalidBlocks.length;
            verification.invalidBlocks.forEach((block) => {
              const detail =
                block.errors?.length > 0
                  ? block.errors.join("; ")
                  : "validation failed";
              anomaliesList.push(
                `Election ${election.title}: Block ${block.index} - ${detail}`,
              );
            });
          }
        } catch (error) {
          console.error("Error verifying election:", election.id, error);
        }
      }

      const totalExpected = totalBlocksCount;
      const verificationRate =
        totalExpected === 0
          ? 100
          : Math.round(
              ((totalExpected - totalAnomalies) / totalExpected) * 1000,
            ) / 10;

      setStats({
        totalBlocks: totalBlocksCount,
        activeElections: activeElections.length,
        anomalies: totalAnomalies,
        verifiedVotes: totalExpected - totalAnomalies,
        blockchainRecords: totalExpected,
        verificationRate: verificationRate,
        systemHealth: totalAnomalies === 0 ? "100%" : "Needs Attention",
        systemHealthSubtext:
          totalAnomalies === 0
            ? "All systems operational"
            : "Anomalies detected",
        systemHealthStatus:
          totalAnomalies === 0 ? "● Healthy" : "● Issues Found",
        anomaliesList,
        electionBlockchainDetails,
      });
    } catch (error) {
      Alert.alert(
        "Error",
        serviceFactory.authService.getErrorMessage(
          error,
          "Failed to load profile",
        ),
      );
      router.replace("/AuditorSignup");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  // Prevent back navigation - show logout confirmation instead
  useEffect(() => {
    const backAction = () => {
      handleLogout();
      return true; // Prevent default back behavior
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, []);

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
        {isMobile ? (
          <View
            style={[
              styles.mobileHeader,
              Platform.OS === "web" && styles.headerStackWeb,
              { paddingTop: insets.top + 10 },
            ]}
          >
            <Pressable
              style={styles.mobileHamburger}
              onPress={() => setSidebarOpen(!sidebarOpen)}
            >
              <Text style={styles.mobileHamburgerIcon}>☰</Text>
            </Pressable>
            <Pressable
              style={styles.mobileLogoButton}
              onPress={() => router.replace("/AuditorDashboard")}
            >
              <Text style={styles.mobileLogo}>VoteKro</Text>
            </Pressable>
            <Pressable style={styles.mobileLogoutButton} onPress={handleLogout}>
              <Text style={styles.mobileLogoutText}>Logout</Text>
            </Pressable>
          </View>
        ) : (
          <View style={Platform.OS === "web" ? styles.headerStackWeb : undefined}>
            <Navbar
              homeRoute="/AuditorDashboard"
              actions={[
                { label: "Logout", onPress: handleLogout, variant: "outline" },
              ]}
            />
          </View>
        )}
        <View style={styles.mainContent}>
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
              <AuditorSidebar
                profileName={profile?.full_name}
                onNavigate={() => setSidebarOpen(false)}
              />
            </View>
          )}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1a73e8" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isMobile ? (
        <View
          style={[
            styles.mobileHeader,
            Platform.OS === "web" && styles.headerStackWeb,
            { paddingTop: insets.top + 10 },
          ]}
        >
          <Pressable
            style={styles.mobileHamburger}
            onPress={() => setSidebarOpen(!sidebarOpen)}
          >
            <Text style={styles.mobileHamburgerIcon}>☰</Text>
          </Pressable>
          <Pressable
            style={styles.mobileLogoButton}
            onPress={() => router.replace("/AuditorDashboard")}
          >
            <Text style={styles.mobileLogo}>VoteKro</Text>
          </Pressable>
          <Pressable style={styles.mobileLogoutButton} onPress={handleLogout}>
            <Text style={styles.mobileLogoutText}>Logout</Text>
          </Pressable>
        </View>
      ) : (
        <View style={Platform.OS === "web" ? styles.headerStackWeb : undefined}>
          <Navbar
            homeRoute="/AuditorDashboard"
            actions={[
              { label: "Logout", onPress: handleLogout, variant: "outline" },
            ]}
          />
        </View>
      )}

      <View style={styles.mainContent}>
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
            <AuditorSidebar
              profileName={profile?.full_name}
              onNavigate={() => setSidebarOpen(false)}
            />
          </View>
        )}

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerWrapper}>
            {/* Dashboard Header */}
            <View style={styles.headerSection}>
              <Text style={styles.pageTitle}>📊 Overview</Text>
              <Text style={styles.pageSubtitle}>
                Audit dashboard and election integrity monitoring
              </Text>
            </View>

            {/* Quick Stats Grid */}
            <View
              style={[styles.statsGrid, isMobile && styles.statsGridMobile]}
            >
              <View style={[styles.cardItem, isMobile && styles.cardItemMobile]}>
                <StatCard
                  label="Total Blocks"
                  value={stats.totalBlocks.toString()}
                  icon="⛓️"
                  color="#1a73e8"
                  accentColor="#1a73e8"
                  subtext="Verified"
                />
              </View>
              <View style={[styles.cardItem, isMobile && styles.cardItemMobile]}>
                <StatCard
                  label="Elections"
                  value={stats.activeElections.toString()}
                  icon="🗳️"
                  color="#4caf50"
                  accentColor="#4caf50"
                  subtext="Active"
                />
              </View>
              <View style={[styles.cardItem, isMobile && styles.cardItemMobile]}>
                <StatCard
                  label="Verification Rate"
                  value={`${stats.verificationRate}%`}
                  icon="✓"
                  color="#1a73e8"
                  accentColor="#1a73e8"
                  subtext="Accurate"
                />
              </View>
              <View style={[styles.cardItem, isMobile && styles.cardItemMobile]}>
                <StatCard
                  label="Anomalies"
                  value={stats.anomalies.toString()}
                  icon="⚠️"
                  color={stats.anomalies > 0 ? "#f44336" : "#ff9800"}
                  accentColor={stats.anomalies > 0 ? "#f44336" : "#ff9800"}
                  subtext="Detected"
                />
              </View>
            </View>

            {/* Key Metrics Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Key Metrics</Text>
              <View
                style={[
                  styles.metricsGrid,
                  isMobile && styles.metricsGridMobile,
                ]}
              >
                <View
                  style={[
                    styles.metricItem,
                    isMobile && styles.metricItemMobile,
                  ]}
                >
                  <MetricCard
                    title="Verified Votes"
                    metric={stats.verifiedVotes}
                    unit="votes"
                    icon="✓"
                    color="#4caf50"
                    progress={stats.verificationRate}
                  />
                </View>
                <View
                  style={[
                    styles.metricItem,
                    isMobile && styles.metricItemMobile,
                  ]}
                >
                  <MetricCard
                    title="Blockchain Records"
                    metric={stats.blockchainRecords}
                    unit="blocks"
                    icon="⛓️"
                    color="#1a73e8"
                    progress={100}
                  />
                </View>
              </View>
            </View>

            {/* System Health */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔍 Audit Status</Text>
              <View
                style={[
                  styles.statusCardsGrid,
                  isMobile && styles.statusCardsGridMobile,
                ]}
              >
                <View
                  style={[
                    styles.statusCard,
                    styles.statusCardFullWidth,
                    isMobile && styles.statusCardMobile,
                  ]}
                >
                  <View style={styles.statusCardHeader}>
                    <Text style={styles.statusCardIcon}>❤️</Text>
                    <Text style={styles.statusCardTitle}>System Health</Text>
                  </View>
                  <Text style={styles.statusCardValue}>
                    {stats.systemHealth}
                  </Text>
                  <Text style={styles.statusCardSubtext}>
                    {stats.systemHealthSubtext}
                  </Text>
                  <Text
                    style={[
                      styles.statusCardStatus,
                      stats.anomalies > 0 && { color: "#f44336" },
                    ]}
                  >
                    {stats.systemHealthStatus}
                  </Text>
                </View>
              </View>
            </View>

            {/* Review Anomalies Section */}
            <View style={styles.section}>
              <View style={styles.anomaliesHeader}>
                <Text style={styles.sectionTitle}>⚠️ Review Anomalies</Text>
                <Text
                  style={[
                    styles.anomaliesCount,
                    stats.anomalies > 0 && {
                      backgroundColor: "#ffebee",
                      color: "#f44336",
                    },
                  ]}
                >
                  {stats.anomalies} Issues Found
                </Text>
              </View>
              <View style={styles.anomaliesContainer}>
                {stats.anomaliesList.length === 0 ? (
                  <Text style={styles.noAnomaliesText}>
                    No vote anomalies detected in the current election
                  </Text>
                ) : (
                  stats.anomaliesList.map((anomaly, idx) => (
                    <Text
                      key={idx}
                      style={[
                        styles.noAnomaliesText,
                        { color: "#f44336", marginBottom: 8 },
                      ]}
                    >
                      {anomaly}
                    </Text>
                  ))
                )}
              </View>
            </View>

            {/* Blockchain Details Section - Shows Real Database Votes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⛓️ Blockchain Verification Details</Text>
              <Text style={styles.sectionSubtitle}>
                Real vote counts from database verification
              </Text>
              <View style={styles.blockchainDetailsContainer}>
                {stats.electionBlockchainDetails.length === 0 ? (
                  <Text style={styles.noDetailsText}>
                    No elections available for verification
                  </Text>
                ) : (
                  stats.electionBlockchainDetails.map((detail) => (
                    <View
                      key={detail.electionId}
                      style={[
                        styles.blockchainDetailBlock,
                        !detail.isValid && styles.blockchainDetailBlockWarning,
                      ]}
                    >
                      <View style={styles.blockchainDetailHeader}>
                        <Text style={styles.blockchainDetailTitle}>
                          {detail.electionTitle}
                        </Text>
                        <Text
                          style={[
                            styles.blockchainDetailStatus,
                            !detail.isValid && styles.blockchainDetailStatusWarning,
                          ]}
                        >
                          {detail.verificationStatus}
                        </Text>
                      </View>
                      <View style={styles.blockchainDetailRow}>
                        <Text style={styles.blockchainDetailLabel}>
                          Total Votes:
                        </Text>
                        <Text style={styles.blockchainDetailValue}>
                          {detail.totalVotes}
                        </Text>
                      </View>
                      <View style={styles.blockchainDetailRow}>
                        <Text style={styles.blockchainDetailLabel}>
                          Blockchain Blocks:
                        </Text>
                        <Text style={styles.blockchainDetailValue}>
                          {detail.totalBlocks}
                        </Text>
                      </View>
                      {detail.totalVotes === detail.totalBlocks ? (
                        <Text
                          style={[
                            styles.blockchainDetailLabel,
                            { color: "#4caf50", marginTop: 8 },
                          ]}
                        >
                          ✓ Vote count matches blockchain blocks
                        </Text>
                      ) : (
                        <Text
                          style={[
                            styles.blockchainDetailLabel,
                            { color: "#ff9800", marginTop: 8 },
                          ]}
                        >
                          ⚠️ Vote count: {detail.totalVotes}, Blocks: {detail.totalBlocks}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: "100vh",
    overflow: "hidden",
    backgroundColor: "#f5f5f5",
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
    position: "relative",
    overflow: "visible",
    minHeight: 0,
  },
  sidebar: {
    width: 240,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e0e0e0",
    paddingVertical: 20,
    paddingHorizontal: 12,
    flexDirection: "column",
    justifyContent: "space-between",
    overflow: "hidden",
    minHeight: 0,
  },
  sidebarMobile: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 999,
    width: 240,
    maxWidth: "80%",
    borderRightWidth: 1,
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
  mobileSidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
    zIndex: 1000,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e0e0e0",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  contentContainer: {
    padding: 20,
    alignItems: "center",
  },
  innerWrapper: {
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  // Header Section
  headerSection: {
    marginBottom: 24,
    width: "100%",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 28,
    width: "100%",
  },
  statsGridMobile: {
    flexDirection: "column",
  },
  // Sections
  section: {
    marginBottom: 28,
    width: "100%",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 14,
  },
  // Metrics Grid
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    width: "100%",
  },
  metricsGridMobile: {
    flexDirection: "column",
  },
  // Audit Logs
  auditLogsContainer: {
    borderRadius: 14,
    overflow: "hidden",
    maxHeight: 600,
  },
  // Status Cards Grid
  statusCardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    width: "100%",
  },
  statusCardsGridMobile: {
    flexDirection: "column",
  },
  statusCard: {
    flex: 1,
    minWidth: 250,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  statusCardFullWidth: {
    flex: 1,
    width: "100%",
  },
  statusCardMobile: {
    width: "100%",
    marginBottom: 12,
  },
  // Responsive card item wrappers
  cardItem: {
    padding: 0,
    flex: 1,
    minWidth: "48%",
  },
  cardItemDesktop: {
    width: "48%",
  },
  cardItemMobile: {
    width: "100%",
  },
  metricItem: {
    padding: 0,
    flex: 1,
    minWidth: "48%",
  },
  metricItemDesktop: {
    width: "48%",
  },
  metricItemMobile: {
    width: "100%",
  },
  statusCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statusCardIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  statusCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  statusCardValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a73e8",
    marginBottom: 6,
  },
  statusCardSubtext: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  statusCardStatus: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4caf50",
  },
  // Anomalies
  anomaliesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    width: "100%",
  },
  anomaliesCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4caf50",
    backgroundColor: "#e8f5e9",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  anomaliesContainer: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
    width: "100%",
  },
  noAnomaliesText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  backButtonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  backButtonPressed: {
    opacity: 0.7,
    backgroundColor: "#e8e8e8",
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333333",
  },
  // Blockchain Details Section
  sectionSubtitle: {
    fontSize: 12,
    color: "#999",
    marginBottom: 12,
  },
  blockchainDetailsContainer: {
    gap: 12,
    width: "100%",
  },
  blockchainDetailBlock: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#4caf50",
    elevation: 3,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: "100%",
  },
  blockchainDetailBlockWarning: {
    borderLeftColor: "#ff9800",
  },
  blockchainDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 10,
  },
  blockchainDetailTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  blockchainDetailStatus: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4caf50",
    backgroundColor: "#e8f5e9",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  blockchainDetailStatusWarning: {
    color: "#ff9800",
    backgroundColor: "#fff3e0",
  },
  blockchainDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  blockchainDetailLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  blockchainDetailValue: {
    fontSize: 13,
    color: "#1a73e8",
    fontWeight: "600",
  },
  noDetailsText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 20,
  },
  // Mobile Header Styles
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
  headerStackWeb: {
    zIndex: 2147480000,
    position: "relative" as const,
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
});
