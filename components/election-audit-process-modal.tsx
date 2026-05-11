import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

interface AuditProcessModalProps {
  visible: boolean;
  election: any | null;
  onClose: () => void;
  onComplete?: () => void;
}

type AuditStep = 'voter' | 'blockchain' | 'count' | 'anomaly' | 'report' | 'submit';

const AUDIT_STEPS = [
  { id: 'voter', number: 1, title: 'Voter Verification', icon: '✓' },
  { id: 'blockchain', number: 2, title: 'Blockchain Check', icon: '⛓️' },
  { id: 'count', number: 3, title: 'Vote Count', icon: '📊' },
  { id: 'anomaly', number: 4, title: 'Anomaly Review', icon: '⚠️' },
  { id: 'report', number: 5, title: 'Report Generation', icon: '📋' },
  { id: 'submit', number: 6, title: 'Submit', icon: '✅' },
];

export function ElectionAuditProcessModal({
  visible,
  election,
  onClose,
  onComplete,
}: AuditProcessModalProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 760;
  const [currentStep, setCurrentStep] = useState<AuditStep>('voter');
  const [completedSteps, setCompletedSteps] = useState<Set<AuditStep>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    wallet: false,
    dates: false,
    duplicate: false,
    identity: false,
  });
  const [notes, setNotes] = useState('');
  const [expandedStats, setExpandedStats] = useState(false);
  const [blockchainData, setBlockchainData] = useState('');
  const [voteCountData, setVoteCountData] = useState('');
  const [anomalyData, setAnomalyData] = useState('');
  const [reportData, setReportData] = useState('');

  // Reset state when modal is opened
  useEffect(() => {
    if (visible) {
      setCurrentStep('voter');
      setCompletedSteps(new Set());
      setCheckedItems({
        wallet: false,
        dates: false,
        duplicate: false,
        identity: false,
      });
      setNotes('');
      setBlockchainData('');
      setVoteCountData('');
      setAnomalyData('');
      setReportData('');
      setExpandedStats(false);
    }
  }, [visible]);

  const toggleCheckbox = (key: string) => {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNext = () => {
    // Mark current step as completed before moving to next
    const stepOrder: AuditStep[] = [
      'voter',
      'blockchain',
      'count',
      'anomaly',
      'report',
      'submit',
    ];
    
    // Validate current step before proceeding
    if (!validateStep(currentStep)) {
      return;
    }
    
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const stepOrder: AuditStep[] = [
      'voter',
      'blockchain',
      'count',
      'anomaly',
      'report',
      'submit',
    ];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const validateStep = (step: AuditStep): boolean => {
    if (step === 'voter') {
      const allChecked = Object.values(checkedItems).every(v => v);
      if (!allChecked) {
        Alert.alert('Incomplete', 'Please check all verification items before proceeding.');
        return false;
      }
      if (!notes.trim()) {
        Alert.alert('Missing Notes', 'Please document your findings before proceeding.');
        return false;
      }
    }
    return true;
  };

  const handleCompleteAudit = () => {
    // Mark submit step as completed
    setCompletedSteps(prev => new Set([...prev, 'submit']));
    
    Alert.alert(
      'Audit Completed',
      'The election audit has been successfully completed and submitted.',
      [
        {
          text: 'OK',
          onPress: () => {
            if (onComplete) {
              onComplete();
            }
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Election Audit Process</Text>
              <Text style={styles.subtitle}>{election?.title}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Progress Steps */}
          <View style={styles.stepsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stepsScroll}
            >
              {AUDIT_STEPS.map((step, index) => (
                <View key={step.id} style={styles.stepWrapper}>
                  <Pressable
                    onPress={() => setCurrentStep(step.id as AuditStep)}
                    style={[
                      styles.stepCircle,
                      currentStep === step.id && styles.stepCircleActive,
                      completedSteps.has(step.id as AuditStep) && styles.stepCircleCompleted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepNumber,
                        (currentStep === step.id || completedSteps.has(step.id as AuditStep)) &&
                          styles.stepNumberActive,
                      ]}
                    >
                      {completedSteps.has(step.id as AuditStep) ? '✓' : step.number}
                    </Text>
                  </Pressable>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  {index < AUDIT_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.stepConnector,
                        completedSteps.has(step.id as AuditStep) && styles.stepConnectorCompleted,
                      ]}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.contentArea}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {currentStep === 'voter' && (
              <VoterVerificationStep
                election={election}
                notes={notes}
                setNotes={setNotes}
                checkedItems={checkedItems}
                toggleCheckbox={toggleCheckbox}
                expandedStats={expandedStats}
                setExpandedStats={setExpandedStats}
              />
            )}
            {currentStep === 'blockchain' && (
              <BlockchainCheckStep
                election={election}
                blockchainData={blockchainData}
                setBlockchainData={setBlockchainData}
              />
            )}
            {currentStep === 'count' && (
              <VoteCountStep
                election={election}
                voteCountData={voteCountData}
                setVoteCountData={setVoteCountData}
              />
            )}
            {currentStep === 'anomaly' && (
              <AnomalyReviewStep
                election={election}
                anomalyData={anomalyData}
                setAnomalyData={setAnomalyData}
              />
            )}
            {currentStep === 'report' && (
              <ReportGenerationStep
                reportData={reportData}
                setReportData={setReportData}
              />
            )}
            {currentStep === 'submit' && <SubmitStep election={election} />}
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footerButtons}>
            <Pressable
              onPress={handlePrevious}
              disabled={currentStep === 'voter'}
              style={({ pressed }) => [
                styles.prevButton,
                currentStep === 'voter' && styles.prevButtonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text
                style={[
                  styles.prevButtonText,
                  currentStep === 'voter' && styles.prevButtonTextDisabled,
                ]}
              >
                ← Previous
              </Text>
            </Pressable>

            {currentStep === 'submit' ? (
              <Pressable
                onPress={handleCompleteAudit}
                style={({ pressed }) => [styles.completeButton, pressed && styles.buttonPressed]}
              >
                <LinearGradient
                  colors={['#1a73e8', '#1557b0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.completeButtonGradient}
                >
                  <Text style={styles.completeButtonText}>✓ Complete Audit</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleNext}
                style={({ pressed }) => [styles.nextButton, pressed && styles.buttonPressed]}
              >
                <LinearGradient
                  colors={['#1a73e8', '#1557b0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.nextButtonGradient}
                >
                  <Text style={styles.nextButtonText}>Next →</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface VoterVerificationStepProps {
  election: any;
  notes: string;
  setNotes: (notes: string) => void;
  checkedItems: Record<string, boolean>;
  toggleCheckbox: (key: string) => void;
  expandedStats: boolean;
  setExpandedStats: (expanded: boolean) => void;
}

function VoterVerificationStep({
  election,
  notes,
  setNotes,
  checkedItems,
  toggleCheckbox,
  expandedStats,
  setExpandedStats,
}: VoterVerificationStepProps) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepHeading}>Step 1: Voter Verification</Text>
      <Text style={styles.stepDescription}>
        Verify that all registered voters meet eligibility requirements and their identities have
        been properly validated.
      </Text>

      {/* Verification Checklist */}
      <View style={styles.checklistSection}>
        <Text style={styles.checklistTitle}>Verification Checklist</Text>
        <View style={styles.checklistItems}>
          <ChecklistItem
            label="All voter wallet addresses are unique and valid"
            checked={checkedItems.wallet}
            onToggle={() => toggleCheckbox('wallet')}
          />
          <ChecklistItem
            label="Voter registration dates fall within allowed period"
            checked={checkedItems.dates}
            onToggle={() => toggleCheckbox('dates')}
          />
          <ChecklistItem
            label="No duplicate voter registrations detected"
            checked={checkedItems.duplicate}
            onToggle={() => toggleCheckbox('duplicate')}
          />
          <ChecklistItem
            label="Identity verification documents reviewed"
            checked={checkedItems.identity}
            onToggle={() => toggleCheckbox('identity')}
          />
        </View>
      </View>

      {/* Show Statistics */}
      <Pressable
        onPress={() => setExpandedStats(!expandedStats)}
        style={styles.expandButton}
      >
        <Text style={styles.expandButtonText}>Show Statistics</Text>
        <Text style={styles.expandButtonIcon}>{expandedStats ? '▲' : '▼'}</Text>
      </Pressable>

      {expandedStats && (
        <View style={styles.statisticsContainer}>
          <StatItem label="Total Registered Voters" value={(election?.totalVotes || 0).toString()} />
          <StatItem label="Verified Voters" value={(election?.verifiedVotes || 0).toString()} />
          <StatItem label="Pending Verification" value={(Math.max((election?.totalVotes || 0) - (election?.verifiedVotes || 0), 0)).toString()} />
          <StatItem label="Verification Rate" value={election?.totalVotes ? (((election.verifiedVotes || 0) / election.totalVotes) * 100).toFixed(1) + "%" : "100%"} />
        </View>
      )}

      {/* Verification Notes */}
      <View style={styles.notesSection}>
        <Text style={styles.notesLabel}>Verification Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Document your findings, observations, and any issues discovered during voter verification..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
          value={notes}
          onChangeText={setNotes}
        />
      </View>
    </View>
  );
}

interface ChecklistItemProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

function ChecklistItem({ label, checked, onToggle }: ChecklistItemProps) {
  return (
    <Pressable onPress={onToggle} style={styles.checklistItem}>
      <View
        style={[
          styles.checkbox,
          checked && styles.checkboxChecked,
        ]}
      >
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={[styles.checklistLabel, checked && styles.checklistLabelChecked]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface StatItemProps {
  label: string;
  value: string;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

interface BlockchainCheckStepProps {
  election: any;
  blockchainData: string;
  setBlockchainData: (data: string) => void;
}

function BlockchainCheckStep({
  election,
  blockchainData,
  setBlockchainData,
}: BlockchainCheckStepProps) {
  const [blockchainChecklist, setBlockchainChecklist] = React.useState<Record<string, boolean>>({
    hashes: false,
    block_numbers: false,
    signatures: false,
    chain_integrity: false,
    timestamps: false,
  });
  const [expandedStats, setExpandedStats] = React.useState(false);

  const toggleBlockchainCheckbox = (key: string) => {
    setBlockchainChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepHeading}>Step 2: Blockchain Check</Text>
      <Text style={styles.stepDescription}>
        Verify blockchain integrity, transaction validity, and cryptographic signatures for all votes.
      </Text>

      <View style={styles.checklistSection}>
        <Text style={styles.checklistTitle}>Blockchain Checklist</Text>
        <View style={styles.checklistItems}>
          <ChecklistItem
            label="All transaction hashes are valid and unique"
            checked={blockchainChecklist.hashes}
            onToggle={() => toggleBlockchainCheckbox('hashes')}
          />
          <ChecklistItem
            label="Block numbers are sequential and unbroken"
            checked={blockchainChecklist.block_numbers}
            onToggle={() => toggleBlockchainCheckbox('block_numbers')}
          />
          <ChecklistItem
            label="Cryptographic signatures verified successfully"
            checked={blockchainChecklist.signatures}
            onToggle={() => toggleBlockchainCheckbox('signatures')}
          />
          <ChecklistItem
            label="Chain integrity maintained (no tampering detected)"
            checked={blockchainChecklist.chain_integrity}
            onToggle={() => toggleBlockchainCheckbox('chain_integrity')}
          />
          <ChecklistItem
            label="Timestamps are within election period"
            checked={blockchainChecklist.timestamps}
            onToggle={() => toggleBlockchainCheckbox('timestamps')}
          />
        </View>
      </View>

      <Pressable
        onPress={() => setExpandedStats(!expandedStats)}
        style={styles.expandButton}
      >
        <Text style={styles.expandButtonText}>Show Statistics</Text>
        <Text style={styles.expandButtonIcon}>{expandedStats ? '▲' : '▼'}</Text>
      </Pressable>

      {expandedStats && (
        <View style={styles.statisticsContainer}>
          <StatItem label="Total Blocks" value={(election?.totalVotes || 0).toString()} />
          <StatItem label="Verified Blocks" value={(election?.verifiedVotes || 0).toString()} />
          <StatItem label="Invalid Hashes" value={(election?.anomalies || 0).toString()} />
          <StatItem label="Chain Integrity" value={election?.totalVotes ? (((election.totalVotes - (election?.anomalies || 0)) / election.totalVotes) * 100).toFixed(1) + "%" : "100%"} />
        </View>
      )}

      <View style={styles.notesSection}>
        <Text style={styles.notesLabel}>Blockchain Verification Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Document blockchain verification results, hash validations, and any integrity concerns..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
          value={blockchainData}
          onChangeText={setBlockchainData}
        />
      </View>
    </View>
  );
}

interface VoteCountStepProps {
  election: any;
  voteCountData: string;
  setVoteCountData: (data: string) => void;
}

function VoteCountStep({
  election,
  voteCountData,
  setVoteCountData,
}: VoteCountStepProps) {
  const [voteCountChecklist, setVoteCountChecklist] = React.useState<Record<string, boolean>>({
    total_match: false,
    no_unregistered: false,
    one_vote: false,
    tallies: false,
    participation: false,
  });
  const [expandedStats, setExpandedStats] = React.useState(false);

  const toggleVoteCountCheckbox = (key: string) => {
    setVoteCountChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepHeading}>Step 3: Vote Count Verification</Text>
      <Text style={styles.stepDescription}>
        Verify that vote counts are accurate, consistent, and match blockchain records.
      </Text>

      <View style={styles.checklistSection}>
        <Text style={styles.checklistTitle}>Vote Count Checklist</Text>
        <View style={styles.checklistItems}>
          <ChecklistItem
            label="Total votes match number of blockchain transactions"
            checked={voteCountChecklist.total_match}
            onToggle={() => toggleVoteCountCheckbox('total_match')}
          />
          <ChecklistItem
            label="No votes cast by unregistered voters"
            checked={voteCountChecklist.no_unregistered}
            onToggle={() => toggleVoteCountCheckbox('no_unregistered')}
          />
          <ChecklistItem
            label="Each voter cast only one vote"
            checked={voteCountChecklist.one_vote}
            onToggle={() => toggleVoteCountCheckbox('one_vote')}
          />
          <ChecklistItem
            label="Vote tallies add up correctly"
            checked={voteCountChecklist.tallies}
            onToggle={() => toggleVoteCountCheckbox('tallies')}
          />
          <ChecklistItem
            label="Participation rate is within expected range"
            checked={voteCountChecklist.participation}
            onToggle={() => toggleVoteCountCheckbox('participation')}
          />
        </View>
      </View>

      <Pressable
        onPress={() => setExpandedStats(!expandedStats)}
        style={styles.expandButton}
      >
        <Text style={styles.expandButtonText}>Show Vote Distribution Analysis</Text>
        <Text style={styles.expandButtonIcon}>{expandedStats ? '▲' : '▼'}</Text>
      </Pressable>

      {expandedStats && (
        <View style={styles.statisticsContainer}>
          <StatItem label="Total Votes Counted" value={(election?.totalVotes || 0).toString()} />
          <StatItem label="Votes Verified" value={(election?.verifiedVotes || 0).toString()} />
          <StatItem label="Discrepancies Found" value={(election?.anomalies || 0).toString()} />
          <StatItem label="Verification Accuracy" value={election?.totalVotes ? (((election.verifiedVotes || 0) / election.totalVotes) * 100).toFixed(1) + "%" : "100%"} />
        </View>
      )}

      <View style={styles.notesSection}>
        <Text style={styles.notesLabel}>Vote Count Verification Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Document vote count verification, discrepancies found, and validation results..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
          value={voteCountData}
          onChangeText={setVoteCountData}
        />
      </View>
    </View>
  );
}

interface AnomalyReviewStepProps {
  election: any;
  anomalyData: string;
  setAnomalyData: (data: string) => void;
}

function AnomalyReviewStep({
  election,
  anomalyData,
  setAnomalyData,
}: AnomalyReviewStepProps) {
  const [anomalyChecklist, setAnomalyChecklist] = React.useState<Record<string, boolean>>({
    patterns: false,
    timestamps: false,
    ips: false,
    gas: false,
    flagged: false,
  });
  const [expandedStats, setExpandedStats] = React.useState(false);

  const toggleAnomalyCheckbox = (key: string) => {
    setAnomalyChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepHeading}>Step 4: Anomaly Review</Text>
      <Text style={styles.stepDescription}>
        Review and investigate any detected anomalies, irregularities, or suspicious patterns detected during the election.
      </Text>

      <View style={styles.anomalyAlertContainer}>
        <View style={styles.anomalyAlertHeader}>
          <Text style={styles.anomalyAlertIcon}>{election?.anomalies > 0 ? "⚠️" : "✅"}</Text>
          <Text style={styles.anomalyAlertTitle}>{election?.anomalies || 0} Anomalies Detected</Text>
        </View>
        <Text style={styles.anomalyAlertMessage}>
          {election?.anomalies > 0 ? "Review each anomaly carefully and document your findings." : "No anomalies detected during the election."}
        </Text>
      </View>

      <View style={styles.checklistSection}>
        <Text style={styles.checklistTitle}>Anomaly Review Checklist</Text>
        <View style={styles.checklistItems}>
          <ChecklistItem
            label="Unusual voting patterns investigated"
            checked={anomalyChecklist.patterns}
            onToggle={() => toggleAnomalyCheckbox('patterns')}
          />
          <ChecklistItem
            label="Timestamp anomalies reviewed"
            checked={anomalyChecklist.timestamps}
            onToggle={() => toggleAnomalyCheckbox('timestamps')}
          />
          <ChecklistItem
            label="Suspicious IP addresses checked"
            checked={anomalyChecklist.ips}
            onToggle={() => toggleAnomalyCheckbox('ips')}
          />
          <ChecklistItem
            label="Gas usage anomalies analyzed"
            checked={anomalyChecklist.gas}
            onToggle={() => toggleAnomalyCheckbox('gas')}
          />
          <ChecklistItem
            label="All flagged transactions resolved"
            checked={anomalyChecklist.flagged}
            onToggle={() => toggleAnomalyCheckbox('flagged')}
          />
        </View>
      </View>

      <Pressable
        onPress={() => setExpandedStats(!expandedStats)}
        style={styles.expandButton}
      >
        <Text style={styles.expandButtonText}>Show Statistics</Text>
        <Text style={styles.expandButtonIcon}>{expandedStats ? '▲' : '▼'}</Text>
      </Pressable>

      {expandedStats && (
        <View style={styles.statisticsContainer}>
          <StatItem label="Total Anomalies Detected" value={(election?.anomalies || 0).toString()} />
          <StatItem label="Critical Issues" value={(election?.anomalies || 0).toString()} />
          <StatItem label="Resolved" value="0" />
          <StatItem label="Pending Review" value={(election?.anomalies || 0).toString()} />
        </View>
      )}

      <View style={styles.notesSection}>
        <Text style={styles.notesLabel}>Anomaly Review Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Document all anomalies investigated, their resolution status, and recommendations..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
          value={anomalyData}
          onChangeText={setAnomalyData}
        />
      </View>
    </View>
  );
}

interface ReportGenerationStepProps {
  reportData: string;
  setReportData: (data: string) => void;
}

function ReportGenerationStep({
  reportData,
  setReportData,
}: ReportGenerationStepProps) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepHeading}>Step 5: Report Generation</Text>
      <Text style={styles.stepDescription}>
        Review all findings and generate a comprehensive audit report for certification.
      </Text>

      <View style={styles.submitSummaryBox}>
        <Text style={styles.summaryTitle}>Audit Summary</Text>
        <SummaryItem label="Voter Verification" status="✓ Completed" />
        <SummaryItem label="Blockchain Verification" status="✓ Completed" />
        <SummaryItem label="Vote Count Verification" status="✓ Completed" />
        <SummaryItem label="Anomaly Review" status="✓ Completed" />
      </View>

      <View style={styles.notesSection}>
        <Text style={styles.notesLabel}>Overall Audit Conclusion</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Provide your overall audit conclusion, certification status, and any recommendations for the election..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={8}
          value={reportData}
          onChangeText={setReportData}
        />
      </View>

      <View style={styles.successMessageBox}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successMessage}>Report Ready for Review</Text>
        <Text style={styles.successSubtext}>
          All audit steps have been completed. Review your findings and proceed to final submission.
        </Text>
      </View>
    </View>
  );
}

function SubmitStep({ election }: { election: any }) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepHeading}>Step 6: Submit Audit Certification</Text>
      <Text style={styles.stepDescription}>
        Your audit is complete and ready for submission. Review the summary below and submit your certification.
      </Text>

      <View style={styles.auditReportBox}>
        <Text style={styles.reportTitle}>Audit Report Summary</Text>
        <View style={styles.reportGrid}>
          <View style={styles.reportCard}>
            <Text style={styles.reportLabel}>Election</Text>
            <Text style={styles.reportValue}>{election?.title || 'Unknown Election'}</Text>
          </View>
          <View style={styles.reportCard}>
            <Text style={styles.reportLabel}>Audit Date</Text>
            <Text style={styles.reportValue}>{new Date().toLocaleDateString()}</Text>
          </View>
          <View style={styles.reportCard}>
            <Text style={styles.reportLabel}>Total Votes</Text>
            <Text style={styles.reportValue}>{(election?.totalVotes || 0).toString()}</Text>
          </View>
          <View style={styles.reportCard}>
            <Text style={styles.reportLabel}>Verified Votes</Text>
            <Text style={styles.reportValueGreen}>{(election?.verifiedVotes || 0).toString()}</Text>
          </View>
          <View style={styles.reportCard}>
            <Text style={styles.reportLabel}>Anomalies</Text>
            <Text style={styles.reportValue}>{(election?.anomalies || 0).toString()}</Text>
          </View>
          <View style={styles.reportCard}>
            <Text style={styles.reportLabel}>Verification Rate</Text>
            <Text style={styles.reportValueGreen}>{election?.totalVotes ? (((election.verifiedVotes || 0) / election.totalVotes) * 100).toFixed(1) + "%" : "100%"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.warningMessageBox}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningTitle}>Important Notice</Text>
        <Text style={styles.warningMessage}>
          By submitting this audit certification, you confirm that all audit steps have been completed thoroughly and all findings are accurate. This action cannot be undone.
        </Text>
      </View>
    </View>
  );
}

interface SummaryItemProps {
  label: string;
  status: string;
}

function SummaryItem({ label, status }: SummaryItemProps) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryStatus}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 800,
    height: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    flexDirection: 'column',
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.3)',
    elevation: 10,
  },
  containerMobile: {
    maxWidth: '100%',
    height: '95%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
  },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  closeBtnText: {
    fontSize: 20,
    color: '#999',
    fontWeight: '600',
  },
  stepsContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  stepsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  stepWrapper: {
    flex: 1,
    alignItems: 'center',
    minWidth: 110,
    position: 'relative',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e7ff',
    marginBottom: 8,
  },
  stepCircleActive: {
    backgroundColor: '#1a73e8',
    borderColor: '#1a73e8',
  },
  stepCircleCompleted: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#999',
  },
  stepNumberActive: {
    color: '#ffffff',
  },
  stepTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  stepConnector: {
    position: 'absolute',
    top: 20,
    left: '50%',
    width: '30%',
    height: 2,
    backgroundColor: '#f0f0f0',
    zIndex: -1,
  },
  stepConnectorCompleted: {
    backgroundColor: '#4caf50',
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  stepContent: {
    paddingBottom: 24,
  },
  stepHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 20,
  },
  checklistSection: {
    marginBottom: 20,
  },
  checklistTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  checklistItems: {
    backgroundColor: '#e8f4fd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.5)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#1a73e8',
    borderColor: '#1a73e8',
  },
  checkmark: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  checklistLabel: {
    fontSize: 12,
    color: '#0d47a1',
    fontWeight: '500',
    flex: 1,
  },
  checklistLabelChecked: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  expandButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginBottom: 12,
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  expandButtonIcon: {
    fontSize: 12,
    color: '#666',
  },
  statisticsContainer: {
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  notesSection: {
    marginBottom: 0,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e0e7ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 12,
    color: '#1a1a1a',
    textAlignVertical: 'top',
  },
  comingSoonBox: {
    paddingVertical: 40,
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
  },
  comingSoonText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  submitSummaryBox: {
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  summaryStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4caf50',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  prevButton: {
    flex: 0.5,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevButtonDisabled: {
    opacity: 0.5,
  },
  prevButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  prevButtonTextDisabled: {
    color: '#ccc',
  },
  nextButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  completeButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  completeButtonGradient: {
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  successMessageBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 28,
    color: '#4caf50',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 4,
  },
  successSubtext: {
    fontSize: 12,
    color: '#558b2f',
    textAlign: 'center',
  },
  auditReportBox: {
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reportCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  reportLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  reportValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  reportValueGreen: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4caf50',
  },
  warningMessageBox: {
    backgroundColor: '#fffde7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#fbc02d',
  },
  warningIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f57f17',
    marginBottom: 4,
  },
  warningMessage: {
    fontSize: 12,
    color: '#f57f17',
    lineHeight: 16,
  },
  anomalyAlertContainer: {
    backgroundColor: '#fff8e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  anomalyAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  anomalyAlertIcon: {
    fontSize: 22,
  },
  anomalyAlertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e65100',
    flex: 1,
  },
  anomalyAlertMessage: {
    fontSize: 13,
    color: '#5d4037',
    lineHeight: 18,
  },
});
