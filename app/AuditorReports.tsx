import type { ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { AuditorSidebar } from '@/components/auditor-sidebar';
import { Navbar } from '@/components/navbar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AuditReport {
  id: string;
  electionTitle: string;
  electionId: string;
  generatedDate: string;
  status: 'approved' | 'pending' | 'flagged';
  voteAccuracy: number;
  blockchainStatus: 'valid' | 'invalid' | 'warning';
  auditorName: string;
  anomaliesDetected: number;
  flagReason?: string;
  flaggedAt?: string;
  flaggedBy?: string;
}

export default function AuditorReports() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 760;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<AuditReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending' | 'flagged'>('all');
  const [flagModalVisible, setFlagModalVisible] = useState(false);
  const [reportToFlag, setReportToFlag] = useState<AuditReport | null>(null);
  const [selectedFlagReason, setSelectedFlagReason] = useState<'duplicate' | 'mismatch' | 'tampered' | ''>('');
  const [submittingFlag, setSubmittingFlag] = useState(false);
  const [auditingReport, setAuditingReport] = useState<string | null>(null);

  const flagReasons = [
    { id: 'duplicate', label: 'Duplicate voting detected', icon: '👥' },
    { id: 'mismatch', label: 'Vote count mismatch', icon: '🔢' },
    { id: 'tampered', label: 'Tampered election data suspected', icon: '⚠️' },
  ] as const;

  useEffect(() => {
    const loadReports = async () => {
      try {
        const userProfile = await serviceFactory.authService.getRequiredProfile('auditor');
        setProfile(userProfile);
        
        // Load all elections and create reports with real data
        const elections = await serviceFactory.electionRepository.listAll();
        const reportsData: AuditReport[] = [];
        
        if (elections && elections.length > 0) {
          // Get audit logs for reference
          const auditLogs = await serviceFactory.auditorService.getAuditLogs(100);
          
          for (const election of elections) {
            try {
              // Verify blockchain integrity for this election
              const chainVerification = await serviceFactory.auditorService.verifyFullBlockchainIntegrity(election.id);
              const blockchainValid = chainVerification.isFullyValid;
              const anomalies = chainVerification.invalidBlocks.length;

              // Verify vote count consistency (published tallies vs chain; candidates have no stored vote column)
              const candidates = await serviceFactory.candidateRepository.listByElection(election.id);
              const resultCounts: Record<string, number> = {};
              for (const candidate of candidates) {
                resultCounts[candidate.id] = 0;
              }
              
              let voteAccuracy = 0;
              try {
                const consistency = await serviceFactory.auditorService.verifyVoteCountConsistency(election.id, resultCounts);
                voteAccuracy = consistency.isConsistent ? 100 : 0;
              } catch {
                // Ignore if no votes exist yet
                voteAccuracy = 100;
              }
              
              // Find if there's an audit log entry for this election
              const electionAuditLog = auditLogs?.find(log =>
                log.metadata?.electionId === election.id || 
                log.target_id === election.id ||
                log.action.includes(election.title)
              );
              
              // Determine blockchain status
              const blockchainStatus: 'valid' | 'invalid' | 'warning' = blockchainValid ? 'valid' : 'invalid';
              
              // Determine report status based on completeness
              let reportStatus: 'approved' | 'pending' | 'flagged' = 'pending';
              
              // For elections not yet started or with no votes, we can leave as pending unless an explicit audit log says it's approved
              if (blockchainValid && voteAccuracy >= 99) {
                reportStatus = 'approved';
              }
              if (!blockchainValid || voteAccuracy < 95 || anomalies > 0) {
                reportStatus = 'flagged';
              }
              if (candidates?.length === 0) {
                reportStatus = 'pending';
              }
              
              // Get last audit log date or use current date
              const generatedDate = electionAuditLog?.created_at 
                ? new Date(electionAuditLog.created_at).toLocaleDateString()
                : new Date().toLocaleDateString();
              
              reportsData.push({
                id: election.id,
                electionTitle: election.title || 'Unknown Election',
                electionId: election.id,
                generatedDate,
                status: reportStatus,
                voteAccuracy,
                blockchainStatus,
                auditorName: userProfile.full_name || 'Auditor',
                anomaliesDetected: anomalies,
              });
            } catch (error) {
              console.error(`Failed to load report data for election ${election.id}:`, error);
              // Add a report with minimal data in case of error
              reportsData.push({
                id: election.id,
                electionTitle: election.title || 'Unknown Election',
                electionId: election.id,
                generatedDate: new Date().toLocaleDateString(),
                status: 'pending',
                voteAccuracy: 0,
                blockchainStatus: 'invalid',
                auditorName: userProfile.full_name || 'Auditor',
                anomaliesDetected: 0,
              });
            }
          }
        }
        
        setReports(reportsData);
        setFilteredReports(reportsData);
      } catch (error) {
        Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to load reports'));
        router.replace('/AuditorSignup');
      } finally {
        setIsLoading(false);
      }
    };

    void loadReports();
  }, [router]);

  useEffect(() => {
    let filtered = reports;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(report =>
        report.electionTitle.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(report => report.status === filterStatus);
    }

    setFilteredReports(filtered);
  }, [searchQuery, filterStatus, reports]);

  // Prevent back navigation - show logout confirmation instead
  useEffect(() => {
    const backAction = () => {
      handleLogout();
      return true; // Prevent default back behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => void doLogout() },
    ]);
  };

  const doLogout = async () => {
    try {
      await serviceFactory.authService.signOut();
      router.replace('/');
    } catch (error) {
      Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to logout'));
    }
  };

  const handleOpenFlagModal = (report: AuditReport) => {
    setReportToFlag(report);
    setSelectedFlagReason('');
    setFlagModalVisible(true);
  };

  const handleCloseFlagModal = () => {
    setFlagModalVisible(false);
    setReportToFlag(null);
    setSelectedFlagReason('');
  };

  const handleSubmitFlag = () => {
    if (!selectedFlagReason) {
      Alert.alert('Error', 'Please select a reason for flagging this report');
      return;
    }

    if (!reportToFlag) return;

    setSubmittingFlag(true);

    const reasonText = flagReasons.find(r => r.id === selectedFlagReason)?.label || selectedFlagReason;

    // Update the report with flag information
    const updatedReports = reports.map(report =>
      report.id === reportToFlag.id
        ? {
            ...report,
            status: 'flagged' as const,
            flagReason: reasonText,
            flaggedAt: new Date().toLocaleString(),
            flaggedBy: profile?.full_name || 'Auditor',
          }
        : report
    );

    setReports(updatedReports);
    setFilteredReports(updatedReports);

    setTimeout(() => {
      setSubmittingFlag(false);
      handleCloseFlagModal();
      Alert.alert('Success', `Report flagged: ${reasonText}`);
    }, 500);
  };

  const handleStartAudit = async (report: AuditReport) => {
    if (auditingReport) return; // Prevent multiple simultaneous audits
    
    setAuditingReport(report.id);
    
    try {
      // Re-verify the election for this report
      const chainVerification = await serviceFactory.auditorService.verifyFullBlockchainIntegrity(report.electionId);
      const blockchainValid = chainVerification.isFullyValid;
      const anomalies = chainVerification.invalidBlocks.length;

      // Verify vote count consistency
      const candidates = await serviceFactory.candidateRepository.listByElection(report.electionId);
      const resultCounts: Record<string, number> = {};
      for (const candidate of candidates) {
        resultCounts[candidate.id] = 0;
      }
      
      let voteAccuracy = 100;
      try {
        const consistency = await serviceFactory.auditorService.verifyVoteCountConsistency(report.electionId, resultCounts);
        voteAccuracy = consistency.isConsistent ? 100 : 0;
      } catch {
        voteAccuracy = 100;
      }

      // Determine new status based on audit results
      let newStatus: 'approved' | 'pending' | 'flagged' = 'pending';
      if (blockchainValid && voteAccuracy >= 99) {
        newStatus = 'approved';
      } else if (!blockchainValid || voteAccuracy < 95 || anomalies > 0) {
        newStatus = 'flagged';
      }

      // Update the report with new audit results
      const updatedReports = reports.map(r =>
        r.id === report.id
          ? {
              ...r,
              status: newStatus,
              voteAccuracy,
              blockchainStatus: blockchainValid ? 'valid' : 'invalid',
              anomaliesDetected: anomalies,
              flagReason: undefined,
              flaggedAt: undefined,
              flaggedBy: undefined,
            }
          : r
      );

      setReports(updatedReports);
      setFilteredReports(updatedReports);

      const statusMessage = newStatus === 'approved' 
        ? 'Audit passed! Report has been approved.' 
        : newStatus === 'pending'
        ? 'Audit restarted. Report status is now pending.'
        : 'Audit completed but issues were detected. Report remains flagged.';

      Alert.alert('Audit Complete', statusMessage);
    } catch (error) {
      Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to start audit process'));
    } finally {
      setAuditingReport(null);
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
                { label: 'Logout', onPress: handleLogout, variant: 'outline' },
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
            <Text style={styles.loadingText}>Loading Reports...</Text>
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
              { label: 'Logout', onPress: handleLogout, variant: 'outline' },
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
            {/* Header Section */}
            <View style={styles.headerSection}>
              <View>
                <Text style={styles.pageTitle}>📋 Audit Reports</Text>
                <Text style={styles.pageSubtitle}>Generated audit reports and certifications</Text>
              </View>
              <Text style={styles.reportCount}>
                {filteredReports.length} {filteredReports.length === 1 ? 'Report' : 'Reports'}
              </Text>
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryGrid}>
              <SummaryCard
                icon="📋"
                label="Total Reports"
                value={reports.length.toString()}
                color="#1a73e8"
              />
              <SummaryCard
                icon="✓"
                label="Approved"
                value={reports.filter(r => r.status === 'approved').length.toString()}
                color="#4caf50"
              />
              <SummaryCard
                icon="⏳"
                label="Pending"
                value={reports.filter(r => r.status === 'pending').length.toString()}
                color="#ff9800"
              />
              <SummaryCard
                icon="⚠️"
                label="Flagged"
                value={reports.filter(r => r.status === 'flagged').length.toString()}
                color="#d32f2f"
              />
            </View>

            {/* Search & Filter Section */}
            <View style={styles.controlsSection}>
              <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#bbb"
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Text style={styles.clearButton}>✕</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Filter Buttons */}
              <View style={styles.filterButtons}>
                {(['all', 'approved', 'pending', 'flagged'] as const).map(status => (
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
                        filterStatus === status && styles.filterButtonTextActive,
                      ]}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Reports List */}
            {filteredReports.length > 0 ? (
              <View style={styles.reportsList}>
                {filteredReports.map((report, index) => (
                  <ReportCard
                    key={`${report.id}-${index}`}
                    report={report}
                    isMobile={isMobile}
                    onFlag={handleOpenFlagModal}
                    onStartAudit={handleStartAudit}
                    isAuditing={auditingReport === report.id}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>No Reports Found</Text>
                <Text style={styles.emptyDescription}>
                  {searchQuery || filterStatus !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'No audit reports available yet'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Flag Report Modal */}
      {flagModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Flag Report</Text>
            <Text style={styles.modalSubtitle}>
              Report: {reportToFlag?.electionTitle}
            </Text>

            <Text style={styles.inputLabel}>Select Reason for Flag *</Text>
            <View style={styles.reasonsContainer}>
              {flagReasons.map((reason) => (
                <Pressable
                  key={reason.id}
                  onPress={() => setSelectedFlagReason(reason.id)}
                  style={[styles.reasonOption, selectedFlagReason === reason.id && styles.reasonOptionSelected]}
                  disabled={submittingFlag}
                >
                  <View style={[styles.reasonRadio, selectedFlagReason === reason.id && styles.reasonRadioSelected]}>
                    {selectedFlagReason === reason.id && <View style={styles.reasonRadioDot} />}
                  </View>
                  <Text style={styles.reasonIcon}>{reason.icon}</Text>
                  <Text style={[styles.reasonLabel, selectedFlagReason === reason.id && styles.reasonLabelSelected]}>
                    {reason.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                onPress={handleCloseFlagModal}
                disabled={submittingFlag}
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  pressed && styles.modalButtonPressed,
                  submittingFlag && styles.modalButtonDisabled,
                ]}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSubmitFlag}
                disabled={submittingFlag || !selectedFlagReason}
                style={({ pressed }) => [
                  styles.modalFlagButton,
                  pressed && styles.modalButtonPressed,
                  (submittingFlag || !selectedFlagReason) && styles.modalButtonDisabled,
                ]}
              >
                {submittingFlag ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalFlagButtonText}>Flag Report</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

interface SummaryCardProps {
  icon: string;
  label: string;
  value: string;
  color: string;
}

function SummaryCard({ icon, label, value, color }: SummaryCardProps) {
  return (
    <LinearGradient
      colors={['#ffffff', '#f8faff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.summaryCard}
    >
      <Text style={styles.summaryIcon}>{icon}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </LinearGradient>
  );
}

interface ReportCardProps {
  report: AuditReport;
  isMobile: boolean;
  onFlag: (report: AuditReport) => void;
  onStartAudit: (report: AuditReport) => Promise<void>;
  isAuditing: boolean;
}

function ReportCard({ report, isMobile, onFlag, onStartAudit, isAuditing }: ReportCardProps) {
  const statusConfig = {
    approved: { color: '#4caf50', label: '✓ Approved', bg: '#e8f5e9' },
    pending: { color: '#ff9800', label: '⏳ Pending', bg: '#fff3e0' },
    flagged: { color: '#d32f2f', label: '⚠️ Flagged', bg: '#ffebee' },
  };
  
  const blockchainConfig = {
    valid: { label: '✓ Valid', color: '#4caf50' },
    invalid: { label: '✗ Invalid', color: '#d32f2f' },
    warning: { label: '⚠️ Warning', color: '#ff9800' },
  };

  const config = statusConfig[report.status];
  const bcConfig = blockchainConfig[report.blockchainStatus];

  return (
    <LinearGradient
      colors={['#ffffff', '#f8faff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.reportCard, report.status === 'flagged' && styles.reportCardFlagged]}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportTitleSection}>
          <Text style={styles.reportTitle}>{report.electionTitle}</Text>
          <View
            style={[styles.statusBadge, { backgroundColor: config.bg }]}
          >
            <Text style={[styles.statusBadgeText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>
        <Text style={styles.reportIcon}>📄</Text>
      </View>

      {report.status === 'flagged' && report.flagReason && (
        <View style={styles.flagReasonBox}>
          <Text style={styles.flagReasonLabel}>Flag Reason:</Text>
          <Text style={styles.flagReasonText}>{report.flagReason}</Text>
          <View style={styles.flagMetaInfo}>
            <Text style={styles.flagMetaText}>Flagged by: {report.flaggedBy}</Text>
            <Text style={styles.flagMetaText}>on {report.flaggedAt}</Text>
          </View>
        </View>
      )}

      <View style={styles.reportMeta}>
        <MetaItem label="Generated" value={report.generatedDate} />
        <MetaItem label="Auditor" value={report.auditorName} />
      </View>

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        <MetricItem
          label="Vote Accuracy"
          value={`${report.voteAccuracy}%`}
          color="#1a73e8"
        />
        <MetricItem
          label="Blockchain"
          value={bcConfig.label}
          color={bcConfig.color}
        />
        <MetricItem
          label="Anomalies"
          value={report.anomaliesDetected.toString()}
          color={report.anomaliesDetected > 0 ? '#d32f2f' : '#4caf50'}
        />
      </View>

      {/* Action Buttons */}
      <View style={[styles.actionButtons, isMobile && styles.actionButtonsMobile]}>
        <Pressable
          onPress={() => Alert.alert(
            'Audit Report',
            `Election: ${report.electionTitle}\n\nDate: ${report.generatedDate}\nAuditor: ${report.auditorName}\nStatus: ${report.status}\n\nVote Accuracy: ${report.voteAccuracy}%\nBlockchain: ${report.blockchainStatus}\nAnomalies: ${report.anomaliesDetected}${report.flagReason ? `\n\nFlag Reason: ${report.flagReason}` : ''}`,
            [{ text: 'OK', onPress: () => {} }]
          )}
          style={({ pressed }) => [styles.downloadButton, pressed && styles.downloadButtonPressed]}
        >
          <Text style={styles.downloadIcon}>📋</Text>
          <Text style={styles.downloadButtonText}>View Report</Text>
        </Pressable>

        {report.status === 'flagged' ? (
          <Pressable
            onPress={() => onStartAudit(report)}
            disabled={isAuditing}
            style={({ pressed }) => [
              styles.auditButton,
              pressed && styles.auditButtonPressed,
              isAuditing && styles.auditButtonDisabled,
            ]}
          >
            {isAuditing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.auditIcon}>🔄</Text>
                <Text style={styles.auditButtonText}>Start Audit</Text>
              </>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={() => onFlag(report)}
            style={({ pressed }) => [styles.flagButton, pressed && styles.flagButtonPressed]}
          >
            <Text style={styles.flagIcon}>🚩</Text>
            <Text style={styles.flagButtonText}>Flag</Text>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
}

interface MetaItemProps {
  label: string;
  value: string;
}

function MetaItem({ label, value }: MetaItemProps) {
  return (
    <View>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

interface MetricItemProps {
  label: string;
  value: string;
  color: string;
}

function MetricItem({ label, value, color }: MetricItemProps) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
  },
  innerWrapper: {
    width: '100%',
    maxWidth: 1000,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  // Header Section
  headerSection: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  reportCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a73e8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
  },
  // Summary Grid
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    minWidth: '22%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    alignItems: 'center',
  },
  summaryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
  // Controls Section
  controlsSection: {
    marginBottom: 24,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
  },
  clearButton: {
    fontSize: 16,
    color: '#999',
    padding: 4,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
  },
  filterButtonActive: {
    backgroundColor: '#1a73e8',
    borderColor: '#1a73e8',
  },
  filterButtonPressed: {
    opacity: 0.8,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  // Reports List
  reportsList: {
    flexDirection: 'column',
    gap: 16,
  },
  reportCard: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportTitleSection: {
    flex: 1,
    marginRight: 10,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reportIcon: {
    fontSize: 28,
  },
  // Meta Info
  reportMeta: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8faff',
    borderRadius: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButtonsMobile: {
    flexDirection: 'column',
  },
  downloadButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#1a73e8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  downloadButtonPressed: {
    opacity: 0.8,
  },
  downloadIcon: {
    fontSize: 13,
  },
  downloadButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Flag Button Styles
  flagButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#ff9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  flagButtonPressed: {
    opacity: 0.8,
  },
  flagIcon: {
    fontSize: 13,
  },
  flagButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Audit Button Styles
  auditButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#4caf50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  auditButtonPressed: {
    opacity: 0.8,
  },
  auditButtonDisabled: {
    opacity: 0.6,
  },
  auditIcon: {
    fontSize: 13,
  },
  auditButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Flagged Report Styles
  reportCardFlagged: {
    borderWidth: 1.5,
    borderColor: '#ffb74d',
    backgroundColor: '#fffbf0',
  },
  flagReasonBox: {
    backgroundColor: '#fff3e0',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  flagReasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e65100',
    marginBottom: 4,
  },
  flagReasonText: {
    fontSize: 12,
    color: '#1a1a1a',
    marginBottom: 8,
    lineHeight: 18,
  },
  flagMetaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#ffe0b2',
  },
  flagMetaText: {
    fontSize: 10,
    color: '#e65100',
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    fontWeight: '500',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#1a1a1a',
    marginBottom: 16,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalFlagButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
  },
  modalFlagButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalButtonPressed: {
    opacity: 0.8,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  // Flag Reasons Styles
  reasonsContainer: {
    marginBottom: 16,
    gap: 10,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
  },
  reasonOptionSelected: {
    backgroundColor: '#e8f4fd',
    borderColor: '#1a73e8',
  },
  reasonRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  reasonRadioSelected: {
    borderColor: '#1a73e8',
    backgroundColor: '#e8f4fd',
  },
  reasonRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1a73e8',
  },
  reasonIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    flex: 1,
  },
  reasonLabelSelected: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  // Empty State
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    maxWidth: 300,
  },
  backButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  backButtonPressed: {
    opacity: 0.7,
    backgroundColor: '#e8e8e8',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  // Mobile Header Styles
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerStackWeb: {
    zIndex: 2147480000,
    position: 'relative' as const,
  },
  mobileHamburger: {
    padding: 6,
    marginRight: 8,
  },
  mobileHamburgerIcon: {
    fontSize: 26,
    color: '#1a73e8',
    fontWeight: '700',
  },
  mobileLogoButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    flex: 1,
    alignItems: 'center',
  },
  mobileLogo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a73e8',
  },
  mobileLogoutButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1a73e8',
  },
  mobileLogoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a73e8',
  },
  // Sidebar Overlay
  sidebar: {
    width: 240,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    paddingVertical: 20,
    paddingHorizontal: 12,
    flexDirection: 'column',
    justifyContent: 'space-between',
    overflow: 'hidden',
    minHeight: 0,
  },
  sidebarMobile: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 999,
    width: 240,
    maxWidth: '80%',
    borderRightWidth: 1,
    elevation: 10,
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 500,
  },
});
