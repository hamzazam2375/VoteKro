import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View
} from 'react-native';

interface TamperDetectionReportProps {
  report: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export function TamperDetectionReport({ report, isLoading, onRefresh }: TamperDetectionReportProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 600;
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'blockchain',
    'votes',
    'audit',
    'risk',
  ]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const getRiskColor = (report: string): string => {
    if (report.includes('🚨 HIGH RISK')) {
      return '#d32f2f'; // Red
    } else if (report.includes('⚠️ MEDIUM RISK')) {
      return '#f57c00'; // Orange
    } else if (report.includes('✅ LOW RISK')) {
      return '#388e3c'; // Green
    }
    return '#1976d2'; // Blue (default)
  };

  const extractRiskLevel = (report: string): string => {
    if (report.includes('🚨 HIGH RISK')) {
      return 'HIGH';
    } else if (report.includes('⚠️ MEDIUM RISK')) {
      return 'MEDIUM';
    } else if (report.includes('✅ LOW RISK')) {
      return 'LOW';
    }
    return 'UNKNOWN';
  };

  const extractSection = (report: string, startMarker: string, endMarker?: string): string => {
    const startIndex = report.indexOf(startMarker);
    if (startIndex === -1) return '';

    let endIndex = report.length;
    if (endMarker) {
      const endIdx = report.indexOf(endMarker, startIndex);
      if (endIdx !== -1) {
        endIndex = endIdx;
      }
    }

    return report.substring(startIndex, endIndex).trim();
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Analyzing for tampering...</Text>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No tamper detection report available</Text>
        <Pressable style={styles.runButton} onPress={onRefresh}>
          <Text style={styles.runButtonText}>Run Tamper Detection</Text>
        </Pressable>
      </View>
    );
  }

  const riskLevel = extractRiskLevel(report);
  const riskColor = getRiskColor(report);
  const blockchainSection = extractSection(
    report,
    'BLOCKCHAIN INTEGRITY STATUS',
    'VOTE COUNT ANALYSIS'
  );
  const voteSection = extractSection(report, 'VOTE COUNT ANALYSIS', 'AUDIT LOG ANALYSIS');
  const auditSection = extractSection(report, 'AUDIT LOG ANALYSIS', 'OVERALL RISK');
  const riskSection = extractSection(report, 'OVERALL RISK ASSESSMENT');

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Risk Level Header */}
        <LinearGradient
          colors={[riskColor + '20', riskColor + '10']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.riskHeader, { borderLeftColor: riskColor }]}
        >
          <View style={styles.riskHeaderContent}>
            <Text style={styles.riskLabel}>Risk Level</Text>
            <Text
              style={[
                styles.riskValue,
                {
                  color: riskColor,
                },
              ]}
            >
              {riskLevel}
            </Text>
          </View>
          <Pressable
            style={[styles.refreshButton, { backgroundColor: riskColor + '30' }]}
            onPress={onRefresh}
          >
            <Text style={[styles.refreshButtonText, { color: riskColor }]}>🔄 Re-scan</Text>
          </Pressable>
        </LinearGradient>

        {/* Blockchain Section */}
        <SectionCard
          title="🔐 Blockchain Integrity"
          content={blockchainSection}
          isExpanded={expandedSections.includes('blockchain')}
          onToggle={() => toggleSection('blockchain')}
          isValid={!blockchainSection.includes('TAMPER')}
        />

        {/* Vote Count Section */}
        <SectionCard
          title="📊 Vote Count Analysis"
          content={voteSection}
          isExpanded={expandedSections.includes('votes')}
          onToggle={() => toggleSection('votes')}
          isValid={!voteSection.includes('CRITICAL')}
        />

        {/* Audit Log Section */}
        <SectionCard
          title="📋 Audit Log Analysis"
          content={auditSection}
          isExpanded={expandedSections.includes('audit')}
          onToggle={() => toggleSection('audit')}
          isValid={!auditSection.includes('Suspicious')}
        />

        {/* Risk Assessment Section */}
        <SectionCard
          title="⚠️ Risk Assessment & Recommendations"
          content={riskSection}
          isExpanded={expandedSections.includes('risk')}
          onToggle={() => toggleSection('risk')}
          isPrimary
        />

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {riskLevel === 'HIGH' && (
            <LinearGradient
              colors={['#d32f2f', '#c62828']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.alertButton}
            >
              <Text style={styles.alertButtonText}>🚨 DO NOT CERTIFY - INVESTIGATION REQUIRED</Text>
            </LinearGradient>
          )}
          {riskLevel === 'MEDIUM' && (
            <LinearGradient
              colors={['#f57c00', '#e65100']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.warningButton}
            >
              <Text style={styles.warningButtonText}>⚠️ REVIEW FINDINGS BEFORE CERTIFICATION</Text>
            </LinearGradient>
          )}
          {riskLevel === 'LOW' && (
            <LinearGradient
              colors={['#388e3c', '#2e7d32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.successButton}
            >
              <Text style={styles.successButtonText}>✅ SAFE TO CERTIFY RESULTS</Text>
            </LinearGradient>
          )}
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

interface SectionCardProps {
  title: string;
  content: string;
  isExpanded: boolean;
  onToggle: () => void;
  isValid?: boolean;
  isPrimary?: boolean;
}

function SectionCard({
  title,
  content,
  isExpanded,
  onToggle,
  isValid = true,
  isPrimary = false,
}: SectionCardProps) {
  return (
    <View style={[styles.sectionCard, isPrimary && styles.primarySectionCard]}>
      <Pressable onPress={onToggle} style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, !isValid && styles.sectionTitleWarning]}>
          {title}
        </Text>
        <Text style={[styles.expandIcon, isExpanded && styles.expandIconRotated]}>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </Pressable>

      {isExpanded && (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionText}>{content}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    padding: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginVertical: 32,
  },
  riskHeader: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskHeaderContent: {
    flex: 1,
  },
  riskLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 4,
  },
  riskValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  refreshButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  primarySectionCard: {
    borderColor: '#1976d2',
    borderWidth: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  sectionTitleWarning: {
    color: '#d32f2f',
  },
  expandIcon: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  expandIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  sectionContent: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#555',
    fontFamily: 'monospace',
  },
  actionContainer: {
    marginTop: 20,
    marginBottom: 24,
  },
  alertButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  warningButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  successButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  runButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
  runButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  spacer: {
    height: 20,
  },
});
