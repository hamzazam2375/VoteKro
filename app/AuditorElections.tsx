import type { ElectionRow, ProfileRow } from "@/class/database-types";
import { serviceFactory } from "@/class/service-factory";
import { AuditorSidebar } from "@/components/auditor-sidebar";
import { ElectionAuditProcessModal } from "@/components/election-audit-process-modal";
import { Navbar } from "@/components/navbar";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

interface ElectionWithStats extends ElectionRow {
  totalVotes: number;
  verifiedVotes: number;
  anomalies: number;
  lastAuditTime: string | null;
}

export default function AuditorElections() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 760;

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [elections, setElections] = useState<ElectionWithStats[]>([]);
  const [filteredElections, setFilteredElections] = useState<
    ElectionWithStats[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "completed" | "pending"
  >("all");
  const [selectedElection, setSelectedElection] =
    useState<ElectionWithStats | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isAuditProcessModalVisible, setIsAuditProcessModalVisible] =
    useState(false);

  useEffect(() => {
    const loadElections = async () => {
      try {
        const userProfile =
          await serviceFactory.authService.getRequiredProfile("auditor");
        setProfile(userProfile);

        const electionList = await serviceFactory.electionRepository.listAll();

        // Enrich elections with vote statistics
        const enrichedElections: ElectionWithStats[] = await Promise.all(
          (electionList || []).map(async (election) => {
            try {
              const verification =
                await serviceFactory.auditorService.verifyFullBlockchainIntegrity(
                  election.id,
                );
              const totalVotes = verification.totalBlocks;
              const anomalies = verification.invalidBlocks.length;
              const verifiedVotes = totalVotes - anomalies;

              const auditLogs =
                await serviceFactory.auditorService.getAuditLogs(100);
              const electionAudits =
                auditLogs?.filter(
                  (log) =>
                    log.metadata?.electionId === election.id ||
                    log.target_id === election.id,
                ) || [];
              const lastAudit =
                electionAudits.length > 0
                  ? electionAudits[0]?.created_at
                  : null;

              return {
                ...election,
                totalVotes,
                verifiedVotes,
                anomalies,
                lastAuditTime: lastAudit,
              };
            } catch (error) {
              console.error(
                `Failed to load stats for election ${election.id}:`,
                error,
              );
              return {
                ...election,
                totalVotes: 0,
                verifiedVotes: 0,
                anomalies: 0,
                lastAuditTime: null,
              };
            }
          }),
        );

        setElections(enrichedElections);
        setFilteredElections(enrichedElections);
      } catch (error) {
        Alert.alert(
          "Error",
          serviceFactory.authService.getErrorMessage(
            error,
            "Failed to load elections",
          ),
        );
        router.replace("/AuditorSignup");
      } finally {
        setIsLoading(false);
      }
    };

    void loadElections();
  }, [router]);

  useEffect(() => {
    let filtered = elections;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter((election) =>
        election.title?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Filter by status
    const now = new Date();
    if (filterStatus === "active") {
      filtered = filtered.filter((election) => {
        const endDate = election.ends_at ? new Date(election.ends_at) : null;
        const startDate = election.starts_at
          ? new Date(election.starts_at)
          : null;
        return (!endDate || endDate > now) && (!startDate || startDate <= now);
      });
    } else if (filterStatus === "completed") {
      filtered = filtered.filter((election) => {
        const endDate = election.ends_at ? new Date(election.ends_at) : null;
        return endDate && endDate <= now;
      });
    } else if (filterStatus === "pending") {
      filtered = filtered.filter((election) => {
        const startDate = election.starts_at
          ? new Date(election.starts_at)
          : null;
        return startDate && startDate > now;
      });
    }

    setFilteredElections(filtered);
  }, [searchQuery, filterStatus, elections]);

  const handleStartAudit = (electionId: string) => {
    const election = elections.find((e) => e.id === electionId);
    if (election) {
      setSelectedElection(election);
      setIsModalVisible(false);
      setIsAuditProcessModalVisible(true);
    }
  };

  const handleViewDetails = (election: ElectionWithStats) => {
    setSelectedElection(election);
    setIsModalVisible(true);
  };

  const handleStartAuditFromModal = () => {
    if (selectedElection) {
      setIsModalVisible(false);
      setIsAuditProcessModalVisible(true);
    }
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setSelectedElection(null);
  };

  const closeAuditProcessModal = () => {
    setIsAuditProcessModalVisible(false);
    setSelectedElection(null);
  };

  const handleAuditComplete = () => {
    setIsAuditProcessModalVisible(false);
    setSelectedElection(null);
    // Refresh elections list to show updated audit time
    const loadElections = async () => {
      try {
        const userProfile =
          await serviceFactory.authService.getRequiredProfile("auditor");
        setProfile(userProfile);

        const electionList = await serviceFactory.electionRepository.listAll();

        // Enrich elections with vote statistics
        const enrichedElections: ElectionWithStats[] = await Promise.all(
          (electionList || []).map(async (election) => {
            try {
              const verification =
                await serviceFactory.auditorService.verifyFullBlockchainIntegrity(
                  election.id,
                );
              const totalVotes = verification.totalBlocks;
              const anomalies = verification.invalidBlocks.length;
              const verifiedVotes = totalVotes - anomalies;

              const auditLogs =
                await serviceFactory.auditorService.getAuditLogs(100);
              const electionAudits =
                auditLogs?.filter(
                  (log) =>
                    log.metadata?.electionId === election.id ||
                    log.target_id === election.id,
                ) || [];
              const lastAudit =
                electionAudits.length > 0
                  ? electionAudits[0]?.created_at
                  : null;

              return {
                ...election,
                totalVotes,
                verifiedVotes,
                anomalies,
                lastAuditTime: lastAudit,
              } as ElectionWithStats;
            } catch (error) {
              console.error("Error enriching election:", error);
              return {
                ...election,
                totalVotes: 0,
                verifiedVotes: 0,
                anomalies: 0,
                lastAuditTime: null,
              } as ElectionWithStats;
            }
          }),
        );

        setElections(enrichedElections);
      } catch (error) {
        console.error("Error loading elections:", error);
      }
    };

    void loadElections();
  };

  const generateAuditCSV = (election: ElectionWithStats): string => {
    const headers = ['Election Title', 'Status', 'Start Date', 'End Date', 'Total Votes', 'Verified Votes', 'Anomalies Detected', 'Verification Rate', 'Last Audited'];
    
    const status = new Date(election.ends_at) <= new Date() ? 'Completed' : 'Active';
    const verificationRate = election.totalVotes > 0 
      ? ((election.verifiedVotes / election.totalVotes) * 100).toFixed(1) + '%'
      : '100%';
    
    const rows = [
      [
        election.title || '',
        status,
        new Date(election.starts_at).toLocaleDateString('en-US'),
        new Date(election.ends_at).toLocaleDateString('en-US'),
        election.totalVotes.toString(),
        election.verifiedVotes.toString(),
        election.anomalies.toString(),
        verificationRate,
        election.lastAuditTime 
          ? new Date(election.lastAuditTime).toLocaleString('en-US')
          : 'Not yet audited'
      ]
    ];

    const headerRow = headers.map(h => `"${h}"`).join(',');
    const dataRows = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    return headerRow + '\n' + dataRows;
  };

  const downloadCSV = (filename: string, csvContent: string) => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
      element.setAttribute('download', filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else {
      Alert.alert('Error', 'Download is only available in web browsers');
    }
  };

  const handleDownloadCSV = (election: ElectionWithStats) => {
    try {
      const csvContent = generateAuditCSV(election);
      const filename = `audit-report-${election.title}-${new Date().getTime()}.csv`;
      downloadCSV(filename, csvContent);
      Alert.alert('Success', `Audit report for "${election.title}" downloaded successfully!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate CSV file');
      console.error('CSV generation error:', error);
    }
  };

  const handleLogout = async () => {
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
        <Navbar
          homeRoute="/AuditorDashboard"
          actions={[
            { label: "Logout", onPress: handleLogout, variant: "outline" },
          ]}
        />
        <View style={styles.mainContent}>
          {!isMobile && <AuditorSidebar profileName={profile?.full_name} />}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1a73e8" />
            <Text style={styles.loadingText}>Loading Elections...</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Navbar
        homeRoute="/AuditorDashboard"
        actions={[
          { label: "Logout", onPress: handleLogout, variant: "outline" },
        ]}
      />
      <View style={styles.mainContent}>
        {!isMobile && <AuditorSidebar profileName={profile?.full_name} />}

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerWrapper}>
            {/* Header Section */}
            <View style={styles.headerSection}>
              <View>
                <Text style={styles.pageTitle}>Elections</Text>
                <Text style={styles.pageSubtitle}>
                  Audit and verify elections for integrity
                </Text>
              </View>
              <Text style={styles.electionCount}>
                {filteredElections.length}{" "}
                {filteredElections.length === 1 ? "Election" : "Elections"}
              </Text>
            </View>

            {/* Search & Filter Section */}
            <View style={styles.controlsSection}>
              <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search elections..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#bbb"
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery("")}>
                    <Text style={styles.clearButton}>✕</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Filter Buttons */}
              <View style={styles.filterButtons}>
                {(["all", "active", "completed", "pending"] as const).map(
                  (status) => (
                    <Pressable
                      key={status}
                      onPress={() => setFilterStatus(status)}
                      style={({ pressed }) => [
                        styles.filterButton,
                        filterStatus === status && styles.filterButtonActive,
                        pressed && styles.filterButtonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterButtonText,
                          filterStatus === status &&
                            styles.filterButtonTextActive,
                        ]}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            </View>

            {/* Elections List */}
            {filteredElections.length > 0 ? (
              <View style={styles.electionsGrid}>
                {filteredElections.map((election, index) => (
                  <ElectionCard
                    key={`${election.id}-${index}`}
                    election={election}
                    onStartAudit={handleStartAudit}
                    onViewDetails={handleViewDetails}
                    onDownloadCSV={handleDownloadCSV}
                    isMobile={isMobile}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No Elections Found</Text>
                <Text style={styles.emptyDescription}>
                  {searchQuery || filterStatus !== "all"
                    ? "Try adjusting your search or filters"
                    : "No elections available for audit"}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Election Details Modal */}
        <Modal
          visible={isModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {selectedElection && (
                <ScrollView
                  style={{ maxHeight: "90%" }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      Election Audit Details
                    </Text>
                    <Pressable onPress={closeModal} style={styles.closeButton}>
                      <Text style={styles.closeButtonText}>✕</Text>
                    </Pressable>
                  </View>

                  {/* Election Name and Status */}
                  <View style={styles.modalSection}>
                    <View style={styles.electionNameRow}>
                      <Text style={styles.modalElectionName}>
                        {selectedElection.title}
                      </Text>
                      <View
                        style={[
                          styles.modalStatusBadge,
                          {
                            backgroundColor:
                              new Date(selectedElection.ends_at) <= new Date()
                                ? "#e8f5e9"
                                : "#e8f4fd",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalStatusText,
                            {
                              color:
                                new Date(selectedElection.ends_at) <= new Date()
                                  ? "#4caf50"
                                  : "#1a73e8",
                            },
                          ]}
                        >
                          {new Date(selectedElection.ends_at) <= new Date()
                            ? "completed"
                            : "active"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.lastAuditedText}>
                      Last audited:{" "}
                      {selectedElection.lastAuditTime
                        ? new Date(
                            selectedElection.lastAuditTime,
                          ).toLocaleString("en-US", {
                            month: "short",
                            day: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "Not yet audited"}
                    </Text>
                  </View>

                  {/* Dates Section */}
                  <View style={styles.datesGrid}>
                    <View style={styles.dateCard}>
                      <Text style={styles.dateLabel}>📅 Start Date</Text>
                      <Text style={styles.dateValue}>
                        {new Date(
                          selectedElection.starts_at,
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          day: "2-digit",
                          year: "numeric",
                        })}
                      </Text>
                    </View>
                    <View style={styles.dateCard}>
                      <Text style={styles.dateLabel}>📅 End Date</Text>
                      <Text style={styles.dateValue}>
                        {new Date(selectedElection.ends_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "long",
                            day: "2-digit",
                            year: "numeric",
                          },
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Vote Statistics Section */}
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionHeading}>Vote Statistics</Text>
                    <View style={styles.voteStatsGrid}>
                      <View style={styles.voteStatCard}>
                        <Text style={styles.statCardLabel}>Total Votes</Text>
                        <Text style={styles.statCardValue}>
                          {selectedElection.totalVotes}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.voteStatCard,
                          { backgroundColor: "#e8f5e9" },
                        ]}
                      >
                        <Text
                          style={[styles.statCardLabel, { color: "#2e7d32" }]}
                        >
                          Verified
                        </Text>
                        <Text
                          style={[styles.statCardValue, { color: "#4caf50" }]}
                        >
                          {selectedElection.verifiedVotes}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.voteStatCard,
                          {
                            backgroundColor:
                              selectedElection.anomalies > 0
                                ? "#ffebee"
                                : "#e8f5e9",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statCardLabel,
                            {
                              color:
                                selectedElection.anomalies > 0
                                  ? "#c62828"
                                  : "#2e7d32",
                            },
                          ]}
                        >
                          Anomalies
                        </Text>
                        <Text
                          style={[
                            styles.statCardValue,
                            {
                              color:
                                selectedElection.anomalies > 0
                                  ? "#d32f2f"
                                  : "#4caf50",
                            },
                          ]}
                        >
                          {selectedElection.anomalies}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Verification Rate Section */}
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionHeading}>Verification Rate</Text>
                    <View style={styles.verificationContainer}>
                      <View style={styles.verificationLabelRow}>
                        <Text style={styles.verificationLabel}>
                          Verified Votes
                        </Text>
                        <Text style={styles.verificationPercentage}>
                          {selectedElection.totalVotes > 0
                            ? (
                                (selectedElection.verifiedVotes /
                                  selectedElection.totalVotes) *
                                100
                              ).toFixed(1) + "%"
                            : "100%"}
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFillFull,
                            {
                              width: `${selectedElection.totalVotes > 0 ? (selectedElection.verifiedVotes / selectedElection.totalVotes) * 100 : 100}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.verificationSubtext}>
                        {selectedElection.verifiedVotes} of{" "}
                        {selectedElection.totalVotes} votes verified
                      </Text>
                    </View>
                  </View>

                  {/* Anomalies Alert */}
                  {selectedElection.anomalies > 0 && (
                    <View style={styles.anomalyAlertContainer}>
                      <View style={styles.anomalyAlertHeader}>
                        <Text style={styles.anomalyAlertIcon}>⚠️</Text>
                        <Text style={styles.anomalyAlertTitle}>
                          Anomalies Detected
                        </Text>
                      </View>
                      <Text style={styles.anomalyAlertMessage}>
                        {selectedElection.anomalies} anomalies require manual
                        review and investigation.
                      </Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.modalButtonsContainer}>
                    <Pressable
                      onPress={closeModal}
                      style={styles.closeModalButton}
                    >
                      <Text style={styles.closeModalButtonText}>Close</Text>
                    </Pressable>

                    <View style={styles.modalActionButtons}>
                      <Pressable
                        onPress={handleStartAuditFromModal}
                        style={({ pressed }) => [
                          styles.startAuditButton,
                          pressed && styles.startAuditButtonPressed,
                        ]}
                      >
                        <LinearGradient
                          colors={["#1a73e8", "#1557b0"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.startAuditButtonGradient}
                        >
                          <Text style={styles.startAuditIcon}>📋</Text>
                          <Text style={styles.startAuditText}>
                            Start Audit Process
                          </Text>
                        </LinearGradient>
                      </Pressable>
<<<<<<< HEAD

                      <Pressable
                        onPress={() => selectedElection && handleDownloadCSV(selectedElection)}
                        style={({ pressed }) => [
                          styles.exportButton,
                          pressed && styles.exportButtonPressed,
                        ]}
                      >
                        <Text style={styles.exportIcon}>⬇️</Text>
                        <Text style={styles.exportText}>Export Report</Text>
                      </Pressable>
=======
>>>>>>> 92170e94eedc6c2d24890160e8135d6e8a9f89fa
                    </View>
                  </View>

                  {/* Close hint */}
                  <View style={styles.closeHintContainer}>
                    <Text style={styles.closeHintText}>Press ESC to close</Text>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Election Audit Process Modal */}
        <ElectionAuditProcessModal
          visible={isAuditProcessModalVisible}
          election={selectedElection}
          onClose={closeAuditProcessModal}
          onComplete={handleAuditComplete}
        />
      </View>
    </View>
  );
}

interface ElectionCardProps {
  election: ElectionWithStats;
  onStartAudit: (electionId: string) => void;
  onViewDetails: (election: ElectionWithStats) => void;
  onDownloadCSV: (election: ElectionWithStats) => void;
  isMobile: boolean;
}

function ElectionCard({
  election,
  onStartAudit,
  onViewDetails,
  onDownloadCSV,
  isMobile,
}: ElectionCardProps) {
  const endDate = election.ends_at ? new Date(election.ends_at) : null;
  const startDate = election.starts_at ? new Date(election.starts_at) : null;
  const now = new Date();

  const isCompleted = endDate && endDate <= now;
  const isPending = startDate && startDate > now;

  const getStatusInfo = () => {
    if (isCompleted) {
      return { label: "completed", color: "#4caf50", bgColor: "#e8f5e9" };
    }
    if (isPending) {
      return { label: "pending", color: "#ff9800", bgColor: "#fff3e0" };
    }
    return { label: "active", color: "#1a73e8", bgColor: "#e8f4fd" };
  };

  const status = getStatusInfo();
  const lastAuditDate = election.lastAuditTime
    ? new Date(election.lastAuditTime).toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "Not yet audited";

  const formatDatetime = (date: Date | null): string => {
    if (!date) return "N/A";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const electionStartTime = formatDatetime(startDate);
  const electionEndTime = formatDatetime(endDate);

  return (
    <LinearGradient
      colors={["#ffffff", "#fafbfc"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.electionCard}
    >
      {/* Card Header */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleSection}>
          <Text style={styles.electionTitle}>{election.title}</Text>
          <View
            style={[styles.statusBadge, { backgroundColor: status.bgColor }]}
          >
            <Text style={[styles.statusBadgeText, { color: status.color }]}>
              {status.label.charAt(0).toUpperCase() + status.label.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* Election Date and Time */}
      <View style={styles.dateTimeRow}>
        <Text style={styles.dateTimeLabel}>📅 Start: </Text>
        <Text style={styles.dateTimeValue}>{electionStartTime}</Text>
      </View>
      <View style={styles.dateTimeRow}>
        <Text style={styles.dateTimeLabel}>⏱️ End: </Text>
        <Text style={styles.dateTimeValue}>{electionEndTime}</Text>
      </View>

      {/* Stats Grid */}
      <View
        style={[styles.statsGridRow, isMobile && styles.statsGridRowMobile]}
      >
        <View style={styles.statItemCard}>
          <Text style={styles.statLabel}>Total Votes</Text>
          <Text style={styles.statValue}>
            {election.totalVotes.toLocaleString()}
          </Text>
        </View>
        <View style={styles.statItemCard}>
          <Text style={styles.statLabel}>Verified</Text>
          <Text style={[styles.statValue, { color: "#4caf50" }]}>
            {election.verifiedVotes.toLocaleString()}
          </Text>
        </View>
        <View style={styles.statItemCard}>
          <Text style={styles.statLabel}>Anomalies</Text>
          <Text
            style={[
              styles.statValue,
              { color: election.anomalies > 0 ? "#d32f2f" : "#4caf50" },
            ]}
          >
            {election.anomalies}
          </Text>
        </View>
        <View style={styles.statItemCard}>
          <Text style={styles.statLabel}>Last Audit</Text>
          <Text style={styles.statValueSmall}>{lastAuditDate}</Text>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={[styles.buttonRow, isMobile && styles.buttonRowMobile]}>
        <Pressable
          onPress={() => onStartAudit(election.id)}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <LinearGradient
            colors={["#1a73e8", "#1557b0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonIcon}>📋</Text>
            <Text style={styles.primaryButtonText}>Start Audit</Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.secondaryButtonsGroup}>
          <Pressable
            onPress={() => onViewDetails(election)}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonIcon}>👁️</Text>
            <Text style={styles.secondaryButtonText}>Details</Text>
          </Pressable>
<<<<<<< HEAD

          <Pressable
            onPress={() => onDownloadCSV(election)}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonIcon}>⬇️</Text>
            <Text style={styles.secondaryButtonText}>Download CSV</Text>
          </Pressable>
=======
>>>>>>> 92170e94eedc6c2d24890160e8135d6e8a9f89fa
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#f5f7fa",
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    alignItems: "center",
  },
  innerWrapper: {
    width: "100%",
    maxWidth: 1200,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  // Header Section
  headerSection: {
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  electionCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a73e8",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#e8f4fd",
    borderRadius: 12,
  },
  // Controls Section
  controlsSection: {
    marginBottom: 24,
    gap: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e0e7ff",
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: "#999",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1a1a1a",
  },
  clearButton: {
    fontSize: 16,
    color: "#999",
    padding: 4,
  },
  filterButtons: {
    flexDirection: "row",
    gap: 10,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  filterButtonActive: {
    backgroundColor: "#1a73e8",
    borderColor: "#1a73e8",
  },
  filterButtonPressed: {
    opacity: 0.8,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  filterButtonTextActive: {
    color: "#ffffff",
  },
  // Elections Grid
  electionsGrid: {
    flexDirection: "column",
    gap: 16,
  },
  // Election Card
  electionCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e0e7ff",
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)",
    elevation: 2,
  },
  // Card Header
  cardHeaderRow: {
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitleSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  electionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    flex: 1,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  // Date Time Display
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingVertical: 4,
  },
  dateTimeLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
    marginRight: 8,
  },
  dateTimeValue: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
  },
  // Stats Grid
  statsGridRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  statsGridRowMobile: {
    flexDirection: "column",
  },
  statItemCard: {
    flex: 1,
    minWidth: "20%",
  },
  statLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  statValueSmall: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
  },
  // Button Row
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  buttonRowMobile: {
    flexDirection: "column",
  },
  primaryButton: {
    flex: 1.2,
    borderRadius: 10,
    overflow: "hidden",
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonGradient: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryButtonIcon: {
    fontSize: 14,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  // Secondary Buttons Group
  secondaryButtonsGroup: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonIcon: {
    fontSize: 14,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  // Empty State
  emptyState: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    maxWidth: 300,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 700,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 0,
    boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.3)",
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  closeButtonText: {
    fontSize: 20,
    color: "#999",
    fontWeight: "600",
  },
  // Modal Section
  modalSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  electionNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  modalElectionName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    flex: 1,
  },
  modalStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  modalStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  lastAuditedText: {
    fontSize: 12,
    color: "#999",
  },
  // Dates Section
  datesGrid: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  dateCard: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f5f7fa",
    borderRadius: 10,
  },
  dateLabel: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  // Vote Statistics
  sectionHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  voteStatsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  voteStatCard: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#e8f4fd",
    borderRadius: 10,
  },
  statCardLabel: {
    fontSize: 10,
    color: "#0d47a1",
    fontWeight: "500",
    marginBottom: 4,
  },
  statCardValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a73e8",
  },
  // Verification Section
  verificationContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f5f7fa",
    borderRadius: 10,
  },
  verificationLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  verificationLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  verificationPercentage: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a73e8",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e0e7ff",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFillFull: {
    height: "100%",
    width: "100%",
    backgroundColor: "#ffa500",
    borderRadius: 4,
  },
  verificationSubtext: {
    fontSize: 11,
    color: "#666",
  },
  // Anomaly Alert
  anomalyAlertContainer: {
    marginHorizontal: 24,
    marginVertical: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#ffebee",
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#d32f2f",
  },
  anomalyAlertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  anomalyAlertIcon: {
    fontSize: 18,
  },
  anomalyAlertTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#c62828",
  },
  anomalyAlertMessage: {
    fontSize: 12,
    color: "#d32f2f",
    lineHeight: 16,
  },
  // Modal Buttons Container
  modalButtonsContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  closeModalButton: {
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  closeModalButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: 10,
  },
  startAuditButton: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  startAuditButtonPressed: {
    opacity: 0.9,
  },
  startAuditButtonGradient: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  startAuditIcon: {
    fontSize: 14,
  },
  startAuditText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  exportButton: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#1a1a1a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  exportButtonPressed: {
    opacity: 0.8,
  },
  exportIcon: {
    fontSize: 14,
  },
  exportText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  // Close Hint
  closeHintContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: "center",
  },
  closeHintText: {
    fontSize: 10,
    color: "#999",
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
});
