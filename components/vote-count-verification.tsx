import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { VoteCounts } from '@/class/vote-count-verification';
import type { VoteCountVerificationResult } from '@/class/vote-count-verification';

/**
 * Vote Count Verification Component
 * Displays vote count comparison between blockchain and results
 * Highlights mismatches and inconsistencies
 */
interface VoteCountVerificationProps {
  verificationResult: VoteCountVerificationResult;
  isLoading?: boolean;
  onRecalculate?: () => void;
  electionTitle?: string;
}

export const VoteCountVerificationComponent: React.FC<VoteCountVerificationProps> = ({
  verificationResult,
  isLoading = false,
  onRecalculate,
  electionTitle = 'Election',
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Verifying vote counts...</Text>
      </View>
    );
  }

  const getMismatchColor = (isMismatch: boolean) => {
    return isMismatch ? '#ff4444' : '#44bb44';
  };

  // Get all candidates in sorted order
  const allCandidateNames = Array.from(
    new Set([
      ...Object.keys(verificationResult.blockchainCounts),
      ...Object.keys(verificationResult.resultCounts),
    ])
  ).sort();

  return (
    <View style={styles.container}>
      {/* Status Header */}
      <LinearGradient
        colors={
          verificationResult.isConsistent ? ['#d4edda', '#c3e6cb'] : ['#f8d7da', '#f5c6cb']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.statusHeader}
      >
        <View style={styles.statusContent}>
          <Text style={styles.statusIcon}>
            {verificationResult.isConsistent ? '✓' : '⚠'}
          </Text>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>Vote Count Status</Text>
            <Text
              style={[
                styles.statusMessage,
                {
                  color: verificationResult.isConsistent ? '#155724' : '#721c24',
                },
              ]}
            >
              {verificationResult.isConsistent
                ? 'CONSISTENT - All vote counts match'
                : 'MISMATCH DETECTED - Vote count inconsistency found'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Summary Stats */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Summary Statistics</Text>

          <View style={[styles.statsRow, isMobile && styles.statsRowMobile]}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Blockchain Total</Text>
              <Text style={styles.statValue}>{verificationResult.totalBlockchainVotes}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Results Total</Text>
              <Text style={styles.statValue}>{verificationResult.totalResultVotes}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Difference</Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: verificationResult.voteDifference === 0 ? '#44bb44' : '#ff6666',
                  },
                ]}
              >
                {verificationResult.voteDifference > 0 ? '+' : ''}
                {verificationResult.voteDifference}
              </Text>
            </View>
          </View>
        </View>

        {/* Detailed Comparison Table */}
        <View style={styles.tableSection}>
          <Text style={styles.tableTitle}>Candidate-by-Candidate Comparison</Text>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.candidateColumn]}>Candidate</Text>
            <Text style={[styles.tableHeaderCell, styles.numberColumn]}>Blockchain</Text>
            <Text style={[styles.tableHeaderCell, styles.numberColumn]}>Results</Text>
            <Text style={[styles.tableHeaderCell, styles.statusColumn]}>Status</Text>
          </View>

          {/* Table Rows */}
          {allCandidateNames.map((candidateName, index) => {
            const blockchainCount = verificationResult.blockchainCounts[candidateName] || 0;
            const resultCount = verificationResult.resultCounts[candidateName] || 0;
            const isMismatch = blockchainCount !== resultCount;
            const difference = resultCount - blockchainCount;

            return (
              <View
                key={`${candidateName}-${index}`}
                style={[
                  styles.tableRow,
                  isMismatch && styles.tableRowMismatch,
                  index % 2 === 0 && styles.tableRowAlternate,
                ]}
              >
                <Text style={[styles.tableCell, styles.candidateColumn]}>
                  {candidateName}
                </Text>
                <Text style={[styles.tableCell, styles.numberColumn]}>
                  {blockchainCount}
                </Text>
                <Text style={[styles.tableCell, styles.numberColumn]}>
                  {resultCount}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.statusColumn,
                    {
                      color: getMismatchColor(!isMismatch),
                      fontWeight: 'bold',
                    },
                  ]}
                >
                  {isMismatch ? `✗ (${difference > 0 ? '+' : ''}${difference})` : '✓'}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Mismatches Detail Section */}
        {verificationResult.mismatches.length > 0 && (
          <View style={styles.mismatchSection}>
            <Text style={styles.mismatchTitle}>
              ⚠️ Mismatches Detected ({verificationResult.mismatches.length})
            </Text>

            {verificationResult.mismatches.map((mismatch, index) => (
              <View key={`mismatch-${index}`} style={styles.mismatchCard}>
                <View style={styles.mismatchHeader}>
                  <Text style={styles.mismatchCandidateName}>{mismatch.candidateName}</Text>
                  <Text style={styles.mismatchBadge}>
                    {mismatch.difference > 0 ? '+' : ''}
                    {mismatch.difference}
                  </Text>
                </View>

                <View style={styles.mismatchDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Blockchain Count:</Text>
                    <Text style={styles.detailValue}>{mismatch.blockchainCount}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Results Count:</Text>
                    <Text style={styles.detailValue}>{mismatch.resultCount}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Percentage Difference:</Text>
                    <Text style={styles.detailValue}>{mismatch.percentageDifference}%</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recalculate Button */}
        {onRecalculate && (
          <View style={styles.actionSection}>
            <Pressable
              onPress={onRecalculate}
              style={({ pressed }) => [
                styles.recalculateButton,
                pressed && styles.recalculateButtonPressed,
              ]}
            >
              <Text style={styles.recalculateButtonText}>🔄 Recalculate Votes</Text>
            </Pressable>
          </View>
        )}

        {/* Footer Info */}
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>
            Last verified: {new Date(verificationResult.timestamp).toLocaleString()}
          </Text>
          <Text style={styles.footerText}>
            {verificationResult.isConsistent
              ? '✓ All votes are consistent between blockchain and results'
              : '✗ Vote count inconsistency detected. Investigation required.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  statusHeader: {
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#ddd',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusMessage: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summarySection: {
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statsRowMobile: {
    flexDirection: 'column',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  tableSection: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e8f4fd',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#1a73e8',
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    color: '#1a73e8',
    fontSize: 13,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableRowAlternate: {
    backgroundColor: '#fafafa',
  },
  tableRowMismatch: {
    backgroundColor: '#ffe6e6',
    borderLeftWidth: 3,
    borderLeftColor: '#ff4444',
  },
  tableCell: {
    fontSize: 13,
    color: '#333',
  },
  candidateColumn: {
    flex: 2,
  },
  numberColumn: {
    flex: 1,
    textAlign: 'center',
  },
  statusColumn: {
    flex: 1,
    textAlign: 'center',
  },
  mismatchSection: {
    marginBottom: 24,
  },
  mismatchTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 12,
  },
  mismatchCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff4444',
    padding: 12,
    marginBottom: 8,
  },
  mismatchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mismatchCandidateName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  mismatchBadge: {
    backgroundColor: '#ff4444',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  mismatchDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: 'bold',
  },
  actionSection: {
    marginBottom: 24,
  },
  recalculateButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  recalculateButtonPressed: {
    opacity: 0.8,
  },
  recalculateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footerInfo: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
});
