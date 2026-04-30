import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  FlatList,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { FullBlockchainVerification, BlockVerificationStatus } from '@/class/blockchain-verification';

interface BlockchainIntegrityViewerProps {
  verification: FullBlockchainVerification;
  isLoading?: boolean;
}

interface ExpandedBlock {
  [key: number]: boolean;
}

/**
 * Blockchain Integrity Viewer Component
 * Displays full blockchain verification results including:
 * - Overall status (FULLY VALID or TAMPERED)
 * - Block-by-block hash and link validation
 * - Detailed error messages for invalid blocks
 */
export const BlockchainIntegrityViewer: React.FC<BlockchainIntegrityViewerProps> = ({
  verification,
  isLoading = false,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 600;
  const [expandedBlocks, setExpandedBlocks] = useState<ExpandedBlock>({});

  const toggleBlockExpansion = (index: number) => {
    setExpandedBlocks((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Render overall status header
  const renderStatusHeader = () => {
    // ✅ NEW: Check for error status in summary
    const isError = verification.summary?.includes('VERIFICATION FAILED') || verification.summary?.includes('⚠️');
    const statusColor = isError ? '#ff9800' : verification.isFullyValid ? '#4caf50' : '#ff6b6b';
    const statusIcon = isError ? '⚠️' : verification.isFullyValid ? '✓' : '✗';
    const statusText = isError ? 'VERIFICATION ERROR' : verification.isFullyValid ? 'FULLY VALID' : 'TAMPERED';
    const gradientColors = isError ? ['#e65100', '#ff6f00'] : verification.isFullyValid ? ['#1b5e20', '#388e3c'] : ['#b71c1c', '#d32f2f'];

    return (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.statusHeaderGradient}
      >
        <View style={styles.statusHeader}>
          <Text style={[styles.statusIcon, { fontSize: 32 }]}>{statusIcon}</Text>
          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>Blockchain Status</Text>
            <Text style={styles.statusValue}>{statusText}</Text>
          </View>
          <View style={styles.statusStats}>
            <Text style={styles.statLabel}>Blocks:</Text>
            <Text style={styles.statValue}>{verification.totalBlocks}</Text>
            {!verification.isFullyValid && !isError && (
              <>
                <Text style={styles.statLabel}>Invalid:</Text>
                <Text style={[styles.statValue, { color: '#ffcdd2' }]}>
                  {verification.invalidBlocks.length}
                </Text>
              </>
            )}
          </View>
        </View>
      </LinearGradient>
    );
  };

  // Render summary message
  const renderSummary = () => {
    // ✅ NEW: Handle error status messages
    const isError = verification.summary?.includes('VERIFICATION FAILED') || verification.summary?.includes('⚠️');
    const summaryColor = isError ? '#d32f2f' : verification.isFullyValid ? '#1b5e20' : '#ff6f00';
    
    return (
      <View style={[
        styles.summaryCard,
        isError && { borderLeftColor: '#d32f2f', borderLeftWidth: 4, backgroundColor: '#ffebee' }
      ]}>
        <Text style={styles.summaryTitle}>
          {isError ? '⚠️ Verification Error' : 'Verification Summary'}
        </Text>
        <Text style={[
          styles.summaryText,
          isError && { color: '#d32f2f', fontWeight: 'bold' }
        ]}>
          {verification.summary}
        </Text>
        <Text style={styles.summaryTime}>
          Verified: {new Date(verification.timestamp).toLocaleString()}
        </Text>
        {isError && (
          <Text style={{ color: '#d32f2f', marginTop: 8, fontSize: 12 }}>
            ℹ️ Please try again or contact support if the issue persists.
          </Text>
        )}
      </View>
    );
  };

  // Render a single block status
  const renderBlockStatus = (block: BlockVerificationStatus, index: number) => {
    const isInvalid = !block.hashValid || !block.linkValid;
    const isExpanded = expandedBlocks[index];

    return (
      <Pressable
        key={block.blockId}
        onPress={() => toggleBlockExpansion(index)}
        style={[
          styles.blockCard,
          isInvalid && styles.blockCardInvalid,
        ]}
      >
        {isInvalid && <View style={styles.invalidBlockBorder} />}

        <View style={styles.blockHeader}>
          <View style={styles.blockNumber}>
            <Text style={styles.blockNumberText}>#{block.index}</Text>
          </View>

          <View style={styles.blockValidation}>
            {/* Hash Valid Indicator */}
            <View style={styles.validationItem}>
              <Text style={[
                styles.validationIcon,
                { color: block.hashValid ? '#4caf50' : '#ff6b6b' }
              ]}>
                {block.hashValid ? '✔' : '✗'}
              </Text>
              <Text style={styles.validationLabel}>Hash</Text>
            </View>

            {/* Link Valid Indicator */}
            {block.index > 0 && (
              <View style={styles.validationItem}>
                <Text style={[
                  styles.validationIcon,
                  { color: block.linkValid ? '#4caf50' : '#ff6b6b' }
                ]}>
                  {block.linkValid ? '✔' : '✗'}
                </Text>
                <Text style={styles.validationLabel}>Link</Text>
              </View>
            )}

            {/* Expand Icon */}
            {isInvalid && (
              <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
            )}
          </View>
        </View>

        {/* Expanded Details */}
        {isExpanded && isInvalid && (
          <View style={styles.blockDetails}>
            {!block.hashValid && (
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>❌ Hash Validation Failed</Text>
                <View style={styles.hashComparison}>
                  <View style={styles.hashItem}>
                    <Text style={styles.hashLabel}>Stored Hash:</Text>
                    <Text style={styles.hashValue} numberOfLines={2}>
                      {block.currentHash}
                    </Text>
                  </View>
                  <View style={styles.hashItem}>
                    <Text style={styles.hashLabel}>Recalculated Hash:</Text>
                    <Text style={styles.hashValue} numberOfLines={2}>
                      {block.recalculatedHash}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {!block.linkValid && block.index > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>❌ Chain Link Broken</Text>
                <Text style={styles.detailDescription}>
                  Previous hash does not match the actual previous block's hash.
                </Text>
                <View style={styles.hashItem}>
                  <Text style={styles.hashLabel}>Expected Previous Hash:</Text>
                  <Text style={styles.hashValue} numberOfLines={2}>
                    {block.previousHash}
                  </Text>
                </View>
              </View>
            )}

            {block.error && (
              <View style={styles.errorSection}>
                <Text style={styles.errorText}>{block.error}</Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  // Render invalid blocks section
  const renderInvalidBlocksSection = () => {
    if (verification.invalidBlocks.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>❌ Invalid Blocks Detected</Text>
          <View style={styles.invalidBadge}>
            <Text style={styles.invalidBadgeText}>{verification.invalidBlocks.length}</Text>
          </View>
        </View>

        <View style={styles.invalidBlocksContainer}>
          {verification.invalidBlocks.map((block) => renderBlockStatus(block, block.index))}
        </View>
      </View>
    );
  };

  // Render all blocks section
  const renderAllBlocksSection = () => {
    if (verification.totalBlocks === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚪</Text>
          <Text style={styles.emptyTitle}>No Blocks</Text>
          <Text style={styles.emptyDesc}>No vote blocks found in this election's blockchain.</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📋 All Blocks</Text>
          <View style={[styles.validBadge, { backgroundColor: '#e8f5e9' }]}>
            <Text style={[styles.validBadgeText, { color: '#2e7d32' }]}>
              {verification.totalBlocks}
            </Text>
          </View>
        </View>

        <View style={styles.allBlocksContainer}>
          {verification.allBlocksStatus.map((block) => (
            <View key={block.blockId} style={styles.blockStatusRow}>
              <Text style={styles.blockStatusIndex}>Block #{block.index}</Text>
              <View style={styles.blockStatusIndicators}>
                <View style={[
                  styles.indicator,
                  { backgroundColor: block.hashValid ? '#4caf50' : '#ff6b6b' }
                ]} />
                {block.index > 0 && (
                  <View style={[
                    styles.indicator,
                    { backgroundColor: block.linkValid ? '#4caf50' : '#ff6b6b' }
                  ]} />
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render legend
  const renderLegend = () => {
    return (
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Legend:</Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: '#4caf50' }]} />
          <Text style={styles.legendText}>Valid/Correct</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: '#ff6b6b' }]} />
          <Text style={styles.legendText}>Invalid/Mismatch</Text>
        </View>
      </View>
    );
  };

  if (verification.totalBlocks === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {renderStatusHeader()}
        {renderSummary()}
        {renderAllBlocksSection()}
        {renderLegend()}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {renderStatusHeader()}
      {renderSummary()}

      {/* Show invalid blocks first if any */}
      {renderInvalidBlocksSection()}

      {/* Show all blocks summary */}
      {renderAllBlocksSection()}

      {/* Legend */}
      {renderLegend()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 24,
  },

  // Status Header
  statusHeaderGradient: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  statusIcon: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  statusStats: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1a73e8',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: '#424242',
    lineHeight: 18,
    marginBottom: 8,
  },
  summaryTime: {
    fontSize: 11,
    color: '#9e9e9e',
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  invalidBadge: {
    backgroundColor: '#ffcdd2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  invalidBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#c62828',
  },
  validBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  validBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2e7d32',
  },

  // Invalid Blocks Container
  invalidBlocksContainer: {
    gap: 8,
  },

  // Block Card
  blockCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  blockCardInvalid: {
    borderColor: '#ff6b6b',
    backgroundColor: '#fff5f5',
  },
  invalidBlockBorder: {
    height: 3,
    backgroundColor: '#ff6b6b',
  },

  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  blockNumber: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  blockNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a73e8',
  },

  blockValidation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  validationIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  validationLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  expandIcon: {
    fontSize: 12,
    color: '#999',
    marginLeft: 'auto',
  },

  // Block Details
  blockDetails: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 12,
    gap: 12,
  },
  detailSection: {
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b6b',
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c62828',
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 16,
  },
  hashComparison: {
    gap: 8,
  },
  hashItem: {
    backgroundColor: '#fafafa',
    borderRadius: 4,
    padding: 8,
  },
  hashLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  hashValue: {
    fontSize: 10,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    color: '#333',
    backgroundColor: '#f5f5f5',
    padding: 6,
    borderRadius: 2,
  },

  errorSection: {
    backgroundColor: '#ffe0e0',
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b6b',
  },
  errorText: {
    fontSize: 12,
    color: '#c62828',
    lineHeight: 16,
  },

  // All Blocks Container
  allBlocksContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
  },
  blockStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  blockStatusIndex: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a73e8',
    flex: 1,
  },
  blockStatusIndicators: {
    flexDirection: 'row',
    gap: 6,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Legend
  legend: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  legendIndicator: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
});
