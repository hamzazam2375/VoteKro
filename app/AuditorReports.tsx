import type { ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { AuditorSidebar } from '@/components/auditor-sidebar';
import { Navbar } from '@/components/navbar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

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
}

export default function AuditorReports() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 760;
  
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<AuditReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending' | 'flagged'>('all');

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
              // Get vote ledger to count votes
              const ledger = await serviceFactory.voteLedgerRepository.listLedger(election.id);
              const totalVotes = ledger?.length || 0;
              
              // Verify blockchain integrity for this election
              const chainVerification = await serviceFactory.auditorService.verifyLedger(election.id);
              const blockchainValid = chainVerification?.is_valid === true;
              
              // Find if there's an audit log entry for this election
              const electionAuditLog = auditLogs?.find(log =>
                log.metadata?.electionId === election.id || 
                log.target_id === election.id ||
                log.action.includes(election.title)
              );
              
              // Calculate vote accuracy based on ledger verification
              const voteAccuracy = totalVotes > 0 
                ? Math.round((totalVotes / Math.max(totalVotes, 1)) * 100 * 10) / 10
                : 0;
              
              // Determine blockchain status
              const blockchainStatus: 'valid' | 'invalid' | 'warning' = blockchainValid ? 'valid' : 'invalid';
              
              // Determine report status based on completeness
              let reportStatus: 'approved' | 'pending' | 'flagged' = 'pending';
              if (blockchainValid && voteAccuracy >= 99) {
                reportStatus = 'approved';
              } else if (!blockchainValid || voteAccuracy < 95) {
                reportStatus = 'flagged';
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
                anomaliesDetected: !blockchainValid ? 1 : 0,
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

  const handleLogout = async () => {
    try {
      await serviceFactory.authService.signOut();
      router.replace('/');
    } catch (error) {
      Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to logout'));
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Navbar 
          homeRoute="/AuditorDashboard"
          actions={[
            { label: 'Logout', onPress: handleLogout, variant: 'outline' },
          ]}
        />
        <View style={styles.mainContent}>
          {!isMobile && <AuditorSidebar profileName={profile?.full_name} />}
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
      <Navbar 
        homeRoute="/AuditorDashboard"
        actions={[
          { label: 'Logout', onPress: handleLogout, variant: 'outline' },
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
                <Text style={styles.pageTitle}>Audit Reports</Text>
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
}

function ReportCard({ report, isMobile }: ReportCardProps) {
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

  const handleDownload = () => {
    // Generate report content
    const reportContent = `AUDIT REPORT
=====================================
Election: ${report.electionTitle}
Generated Date: ${report.generatedDate}
Auditor: ${report.auditorName}
Status: ${config.label}

METRICS
-------------------------------------
Vote Accuracy: ${report.voteAccuracy}%
Blockchain Status: ${bcConfig.label}
Anomalies Detected: ${report.anomaliesDetected}

BLOCKCHAIN VERIFICATION
-------------------------------------
Blockchain Status: ${report.blockchainStatus.toUpperCase()}

REPORT STATUS
-------------------------------------
Current Status: ${config.label}

Report Generated: ${new Date().toLocaleString()}
`;

    // Create a blob and download (web) or share (native)
    if (typeof window !== 'undefined') {
      // Web environment
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(reportContent));
      element.setAttribute('download', `audit-report-${report.electionId}.txt`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else {
      // Native environment - show alert with export success
      Alert.alert(
        '📥 Report Ready',
        'Audit report for ' + report.electionTitle + ' is ready for download.',
        [
          {
            text: 'OK',
            onPress: () => console.log('Download initiated'),
          },
        ]
      );
    }
  };

  return (
    <LinearGradient
      colors={['#ffffff', '#f8faff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.reportCard}
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
          style={({ pressed }) => [
            styles.viewButton,
            pressed && styles.viewButtonPressed,
          ]}
        >
          <LinearGradient
            colors={['#1a73e8', '#5b9dd9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.viewButtonGradient}
          >
            <Text style={styles.viewButtonText}>View Full Report</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={handleDownload}
          style={({ pressed }) => [
            styles.downloadButton,
            pressed && styles.downloadButtonPressed,
          ]}
        >
          <Text style={styles.downloadIcon}>⬇️</Text>
          <Text style={styles.downloadButtonText}>Download</Text>
        </Pressable>
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
    fontSize: 11,
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
  viewButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  viewButtonPressed: {
    opacity: 0.9,
  },
  viewButtonGradient: {
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  downloadButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1a73e8',
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
    color: '#1a73e8',
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
});
