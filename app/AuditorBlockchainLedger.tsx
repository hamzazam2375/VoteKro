import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { serviceFactory } from "@/class/service-factory";
import type { ElectionRow } from "@/class/database-types";

interface VoteBlock {
  id: string;
  election_id: string;
  voter_id: string | null;
  block_index: number;
  encrypted_vote: string;
  vote_commitment: string;
  previous_hash: string;
  current_hash: string;
  created_at: string;
  isValid?: boolean;
  validationError?: string;
}

interface BlockChainMetrics {
  totalBlocks: number;
  isValid: boolean;
  invalidAt: number | null;
  reason: string | null;
  tamperedCount: number;
}

// 🔐 Blockchain Integrity Verification Function
const verifyBlockchain = (blocks: VoteBlock[]): { isValid: boolean; blocks: VoteBlock[] } => {
  const verifiedBlocks = blocks.map((block, index) => {
    // First block is always valid (no previous to compare)
    if (index === 0) {
      return {
        ...block,
        isValid: true,
        validationError: undefined,
      };
    }

    // Check if current block's previousHash matches previous block's currentHash
    const previousBlock = blocks[index - 1];
    const isValid = block.previous_hash === previousBlock.current_hash;

    return {
      ...block,
      isValid,
      validationError: isValid ? undefined : `Hash mismatch detected - Previous hash doesn't match block ${index - 1}'s current hash`,
    };
  });

  // Check if all blocks are valid
  const allValid = verifiedBlocks.every((block) => block.isValid !== false);

  return {
    isValid: allValid,
    blocks: verifiedBlocks,
  };
};

const AuditorBlockchainLedger: React.FC = () => {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const [blocks, setBlocks] = useState<VoteBlock[]>([]);
  const [elections, setElections] = useState<ElectionRow[]>([]);
  const [selectedElection, setSelectedElection] = useState<string>(
    (searchParams?.electionId as string) || ""
  );
  const [selectedBlock, setSelectedBlock] = useState<VoteBlock | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [electionsLoading, setElectionsLoading] = useState(true);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voterNameMap, setVoterNameMap] = useState<Record<string, string>>({});
  const [searchBlockId, setSearchBlockId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "chain">("chain");
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [showElectionPicker, setShowElectionPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<BlockChainMetrics>({
    totalBlocks: 0,
    isValid: false,
    invalidAt: null,
    reason: null,
    tamperedCount: 0,
  });
  const rocksDbUrl = process.env.EXPO_PUBLIC_ROCKSDB_LEDGER_URL || "http://localhost:8787";

  // Fetch elections from database
  useEffect(() => {
    const fetchElections = async () => {
      try {
        setElectionsLoading(true);
        const allElections = await serviceFactory.electionRepository.listAll();
        
        if (allElections && allElections.length > 0) {
          setElections(allElections);
          
          if (!selectedElection) {
            setSelectedElection(allElections[0].id);
          }
        } else {
          setError("No elections found in the system.");
        }
      } catch (err) {
        console.error("Failed to fetch elections:", err);
        setError(`Failed to load elections: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setElectionsLoading(false);
      }
    };

    fetchElections();
  }, []);

  // Fetch voter names for the current blocks
  useEffect(() => {
    if (!selectedElection || blocks.length === 0) return;

    const fetchVoterNames = async () => {
      try {
        const nameMap: Record<string, string> = {};
        const voterIds = Array.from(new Set(blocks.map(b => b.voter_id).filter(Boolean))) as string[];
        
        for (const voterId of voterIds) {
          try {
            const profile = await serviceFactory.profileRepository.getByUserId(voterId);
            if (profile) {
              nameMap[voterId] = profile.full_name;
            } else {
              nameMap[voterId] = voterId.substring(0, 8);
            }
          } catch (err) {
            console.error(`Failed to fetch profile for voter ${voterId}:`, err);
            nameMap[voterId] = voterId.substring(0, 8);
          }
        }
        
        setVoterNameMap(nameMap);
      } catch (err) {
        console.error("Failed to fetch voter names:", err);
      }
    };

    fetchVoterNames();
  }, [selectedElection, blocks]);

  // Fetch blockchain ledger for selected election
  useEffect(() => {
    if (!selectedElection) return;

    const fetchBlockchain = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`Fetching ledger for election: ${selectedElection}`);
        
        const response = await fetch(
          `${rocksDbUrl}/ledger/${encodeURIComponent(selectedElection)}`
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch ledger (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data?.length || 0} blocks`);
        
        // 🔐 Verify blockchain integrity
        const { isValid: blockchainValid, blocks: verifiedBlocks } = verifyBlockchain(data || []);
        
        // Count tampered blocks
        const tamperedCount = verifiedBlocks.filter((b) => b.isValid === false).length;
        
        setBlocks(verifiedBlocks);

        // Update metrics
        setMetrics({
          totalBlocks: verifiedBlocks.length,
          isValid: blockchainValid,
          invalidAt: verifiedBlocks.findIndex((b) => b.isValid === false),
          reason: blockchainValid ? null : "Hash chain integrity failed",
          tamperedCount,
        });

        // Show error if blockchain is invalid
        if (!blockchainValid) {
          const tamperedBlock = verifiedBlocks.find((b) => b.isValid === false);
          if (tamperedBlock) {
            setError(`⚠️ Blockchain Tampered - Block #${tamperedBlock.block_index}: ${tamperedBlock.validationError}`);
          }
        }
      } catch (err) {
        console.error("Failed to fetch blockchain:", err);
        const errorMsg = err instanceof Error 
          ? err.message 
          : typeof err === 'object' && err !== null && 'message' in err 
            ? String(err.message)
            : "Failed to fetch blockchain ledger";
        setError(errorMsg);
        setBlocks([]);
        setChainValid(false);
        setMetrics({
          totalBlocks: 0,
          isValid: false,
          invalidAt: null,
          reason: null,
          tamperedCount: 0,
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    fetchBlockchain();
  }, [selectedElection, rocksDbUrl]);

  const handleViewDetails = (block: VoteBlock) => {
    setSelectedBlock(block);
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setSelectedBlock(null);
  };

  const copyToClipboard = async (text: string) => {
    Alert.alert("Hash Value", text);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedElection) {
      // Re-trigger the fetch
      setSelectedElection(selectedElection);
    }
  };

  // Filter blocks based on search
  const filteredBlocks = blocks.filter((block) => {
    if (!searchBlockId) return true;
    return (
      block.block_index.toString().includes(searchBlockId) ||
      block.current_hash.includes(searchBlockId) ||
      block.previous_hash.includes(searchBlockId)
    );
  });

  // Render election dropdown item
  const renderElectionItem = (election: ElectionRow) => (
    <TouchableOpacity
      key={election.id}
      style={styles.electionItem}
      onPress={() => {
        setSelectedElection(election.id);
        setShowElectionPicker(false);
      }}
    >
      <Text style={styles.electionItemText}>
        {election.title} ({election.status})
      </Text>
    </TouchableOpacity>
  );

  // Render block item for table view
  const renderBlockItem = ({ item, index }: { item: VoteBlock; index: number }) => {
    const isLinked =
      index < filteredBlocks.length - 1
        ? filteredBlocks[index + 1].previous_hash === item.current_hash
        : true;

    return (
      <View style={styles.tableRow}>
        <Text style={styles.tableCell}># {item.block_index}</Text>
        <View style={styles.tableCell}>
          <View style={[styles.tag, item.isValid === false ? styles.tagRed : styles.tagGreen]}>
            <Text style={styles.tagText}>
              {item.isValid === false ? "⚠️ Tampered" : "✓ Valid"}
            </Text>
          </View>
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.tagText} numberOfLines={1}>
            {voterNameMap[item.voter_id || ""] || item.voter_id?.substring(0, 12) || "Unknown"}
          </Text>
        </View>
        <Text style={[styles.tableCell, styles.smallText]}>
          {new Date(item.created_at).toLocaleTimeString()}
        </Text>
        <View style={styles.tableCell}>
          <Text style={[styles.detailsBtn, isLinked ? { color: "#52c41a" } : { color: "#ff4d4f" }]}>
            {isLinked ? "↓" : "✗"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => handleViewDetails(item)}
        >
          <Text style={styles.detailsButtonText}>Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Chain visualization component
  const ChainVisualization = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={true}
      style={styles.chainContainer}
    >
      <View style={styles.chainContent}>
        {filteredBlocks.map((block, index) => (
          <React.Fragment key={block.id}>
            <TouchableOpacity
              style={[
                styles.chainCard,
                block.isValid === false
                  ? styles.chainCardInvalid
                  : styles.chainCardValid,
              ]}
              onPress={() => handleViewDetails(block)}
            >
              <Text style={styles.chainCardTitle}>
                {block.isValid === false ? "⚠️" : "✓"} Block #{block.block_index}
              </Text>
              <View style={styles.divider} />
              <Text style={styles.chainCardStatus}>Status:</Text>
              <View
                style={[
                  styles.chainCardTag,
                  block.isValid === false ? styles.tagRed : styles.tagGreen,
                ]}
              >
                <Text style={styles.tagText}>
                  {block.isValid === false ? "Tampered" : "Valid"}
                </Text>
              </View>
              <Text style={styles.chainCardMeta}>Voter:</Text>
              <Text style={styles.chainCardSmallText} numberOfLines={1}>
                {voterNameMap[block.voter_id || ""] ||
                  block.voter_id?.substring(0, 8) ||
                  "Unknown"}
              </Text>
              <Text style={styles.chainCardMeta}>Hash:</Text>
              <Text style={styles.chainCardHash}>
                {block.current_hash.substring(0, 8)}...
              </Text>
              <Text style={styles.chainCardTime}>
                {new Date(block.created_at).toLocaleTimeString()}
              </Text>
              {block.isValid === false && (
                <View style={styles.chainCardError}>
                  <Text style={styles.chainCardErrorText}>
                    ⚠️ Hash mismatch
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {index < filteredBlocks.length - 1 && (
              <View
                style={[
                  styles.chainArrow,
                  filteredBlocks[index + 1].isValid === false
                    ? { borderColor: "#ff4d4f" }
                    : { borderColor: "#52c41a" },
                ]}
              >
                <Text style={styles.arrowText}>→</Text>
              </View>
            )}
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔗 Blockchain Ledger</Text>
          <Text style={styles.headerSubtitle}>Auditor View</Text>
        </View>

        {/* Election Selection */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Select Election:</Text>
          {electionsLoading ? (
            <ActivityIndicator size="large" color="#1890ff" />
          ) : (
            <View>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowElectionPicker(!showElectionPicker)}
              >
                <Text style={styles.pickerButtonText}>
                  {elections.find((e) => e.id === selectedElection)?.title ||
                    "Select election..."}
                </Text>
              </TouchableOpacity>
              {showElectionPicker && (
                <View style={styles.pickerDropdown}>
                  {elections.map((election) => renderElectionItem(election))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Blockchain Status Metrics */}
        {selectedElection && blocks.length > 0 && (
          <View
            style={[
              styles.card,
              metrics.isValid ? styles.cardSuccess : styles.cardError,
            ]}
          >
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Total Blocks</Text>
                <Text style={styles.metricValue}>{metrics.totalBlocks}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Blockchain Status</Text>
                <Text
                  style={[
                    styles.metricValue,
                    metrics.isValid ? { color: "#52c41a" } : { color: "#ff4d4f" },
                  ]}
                >
                  {metrics.isValid ? "✓ VALID" : "✗ TAMPERED"}
                </Text>
              </View>
              {metrics.tamperedCount > 0 && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Tampered Blocks</Text>
                  <Text style={[styles.metricValue, { color: "#ff4d4f" }]}>
                    {metrics.tamperedCount}
                  </Text>
                </View>
              )}
              {metrics.invalidAt !== null && metrics.invalidAt !== -1 && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>First Tampered At</Text>
                  <Text style={[styles.metricValue, { color: "#ff4d4f" }]}>
                    Block #{metrics.invalidAt}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Error Alert */}
        {error && (
          <View
            style={[
              styles.alert,
              error.includes("Tampered")
                ? styles.alertError
                : styles.alertWarning,
            ]}
          >
            <Text style={styles.alertText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Text style={styles.alertClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Chain Validity Alert */}
        {selectedElection && metrics.isValid === true && !error && (
          <View style={[styles.alert, styles.alertSuccess]}>
            <Text style={styles.alertText}>
              ✓ Blockchain is Valid and Tamper-Proof
            </Text>
            <Text style={styles.alertSmallText}>
              All blocks are properly linked with correct hash validation. No tampering detected.
            </Text>
          </View>
        )}

        {selectedElection && metrics.isValid === false && (
          <View style={[styles.alert, styles.alertError]}>
            <Text style={styles.alertText}>✗ Blockchain Integrity Check Failed</Text>
            <Text style={styles.alertSmallText}>
              Detected {metrics.tamperedCount} tampered block(s). First tampering at Block #
              {metrics.invalidAt}. Hash chain validation failed.
            </Text>
          </View>
        )}

        {/* Search and View Mode */}
        {selectedElection && blocks.length > 0 && (
          <View style={styles.card}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by block #, hash..."
              value={searchBlockId}
              onChangeText={setSearchBlockId}
            />
            <View style={styles.viewModeContainer}>
              <TouchableOpacity
                style={[
                  styles.viewModeButton,
                  viewMode === "chain" && styles.viewModeActive,
                ]}
                onPress={() => setViewMode("chain")}
              >
                <Text
                  style={[
                    styles.viewModeText,
                    viewMode === "chain" && styles.viewModeActiveText,
                  ]}
                >
                  Chain View
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.viewModeButton,
                  viewMode === "table" && styles.viewModeActive,
                ]}
                onPress={() => setViewMode("table")}
              >
                <Text
                  style={[
                    styles.viewModeText,
                    viewMode === "table" && styles.viewModeActiveText,
                  ]}
                >
                  Table View
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Ledger Display */}
        {selectedElection && (
          <View style={styles.card}>
            {loading ? (
              <ActivityIndicator size="large" color="#1890ff" />
            ) : blocks.length > 0 ? (
              filteredBlocks.length === 0 ? (
                <Text style={styles.emptyText}>
                  No blocks match your search
                </Text>
              ) : viewMode === "chain" ? (
                <ChainVisualization />
              ) : (
                <FlatList
                  data={filteredBlocks}
                  renderItem={renderBlockItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              )
            ) : !loading ? (
              <Text style={styles.emptyText}>
                No votes recorded for this election yet.
              </Text>
            ) : null}
          </View>
        )}

        {/* Spacer */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Block Detail Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Block #{selectedBlock?.block_index}{" "}
                {selectedBlock?.isValid === false ? "⚠️ TAMPERED" : "✓ VALID"}
              </Text>
              <TouchableOpacity onPress={handleModalClose}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedBlock && (
                <View>
                  {selectedBlock.isValid === false && (
                    <View style={[styles.alert, styles.alertError]}>
                      <Text style={styles.alertText}>
                        ⚠️ Blockchain Tampering Detected
                      </Text>
                      <Text style={styles.alertSmallText}>
                        {selectedBlock.validationError ||
                          "Hash mismatch detected in this block"}
                      </Text>
                    </View>
                  )}

                  {/* Basic Information */}
                  <View style={styles.expandableSection}>
                    <Text style={styles.expandableTitle}>Basic Information</Text>
                    <View style={styles.expandableContent}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Block Index:</Text>
                        <Text style={styles.infoValue}>
                          #{selectedBlock.block_index}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Timestamp:</Text>
                        <Text style={styles.infoValue}>
                          {new Date(selectedBlock.created_at).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Voter:</Text>
                        <Text style={styles.infoValue}>
                          {selectedBlock.voter_id
                            ? voterNameMap[selectedBlock.voter_id] ||
                              selectedBlock.voter_id
                            : "Unknown"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Blockchain Hashes */}
                  <View style={styles.expandableSection}>
                    <Text style={styles.expandableTitle}>Blockchain Hashes</Text>
                    <View style={styles.expandableContent}>
                      <View style={styles.hashContainer}>
                        <Text style={styles.hashLabel}>
                          Vote Commitment (SHA256):
                        </Text>
                        <View style={styles.hashBox}>
                          <Text style={styles.hashText} selectable>
                            {selectedBlock.vote_commitment}
                          </Text>
                          <TouchableOpacity
                            style={styles.copyButton}
                            onPress={() =>
                              copyToClipboard(selectedBlock.vote_commitment)
                            }
                          >
                            <Text style={styles.copyButtonText}>Copy</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.hashContainer}>
                        <Text style={styles.hashLabel}>Previous Block Hash:</Text>
                        <View style={styles.hashBox}>
                          <Text style={styles.hashText} selectable>
                            {selectedBlock.previous_hash}
                          </Text>
                          <TouchableOpacity
                            style={styles.copyButton}
                            onPress={() =>
                              copyToClipboard(selectedBlock.previous_hash)
                            }
                          >
                            <Text style={styles.copyButtonText}>Copy</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.hashContainer}>
                        <Text style={styles.hashLabel}>Current Block Hash:</Text>
                        <View style={[styles.hashBox, styles.hashBoxHighlight]}>
                          <Text style={styles.hashText} selectable>
                            {selectedBlock.current_hash}
                          </Text>
                          <TouchableOpacity
                            style={styles.copyButton}
                            onPress={() =>
                              copyToClipboard(selectedBlock.current_hash)
                            }
                          >
                            <Text style={styles.copyButtonText}>Copy</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Encrypted Vote Data */}
                  <View style={styles.expandableSection}>
                    <Text style={styles.expandableTitle}>Encrypted Vote Data</Text>
                    <View style={styles.expandableContent}>
                      <View style={styles.encryptedBox}>
                        <Text style={styles.encryptedText} selectable>
                          {selectedBlock.encrypted_vote}
                        </Text>
                        <TouchableOpacity
                          style={styles.copyButton}
                          onPress={() =>
                            copyToClipboard(selectedBlock.encrypted_vote)
                          }
                        >
                          <Text style={styles.copyButtonText}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Metadata */}
                  <View style={styles.expandableSection}>
                    <Text style={styles.expandableTitle}>Metadata</Text>
                    <View style={styles.expandableContent}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Block ID:</Text>
                        <Text style={styles.infoValue} numberOfLines={1}>
                          {selectedBlock.id}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Election ID:</Text>
                        <Text style={styles.infoValue} numberOfLines={1}>
                          {selectedBlock.election_id}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={handleModalClose}
                  >
                    <Text style={styles.modalCloseButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AuditorBlockchainLedger;

// StyleSheet for all styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#000",
  },
  cardSuccess: {
    backgroundColor: "#f6ffed",
    borderLeftWidth: 6,
    borderLeftColor: "#52c41a",
  },
  cardError: {
    backgroundColor: "#fff7e6",
    borderLeftWidth: 6,
    borderLeftColor: "#ff4d4f",
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 6,
    padding: 12,
    backgroundColor: "#fff",
  },
  pickerButtonText: {
    fontSize: 14,
    color: "#000",
  },
  pickerDropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 6,
    overflow: "hidden",
  },
  electionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  electionItemText: {
    fontSize: 14,
    color: "#000",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricItem: {
    flex: 1,
    minWidth: 120,
  },
  metricLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },
  alert: {
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  alertSuccess: {
    backgroundColor: "#f6ffed",
    borderLeftWidth: 4,
    borderLeftColor: "#52c41a",
  },
  alertWarning: {
    backgroundColor: "#fffbe6",
    borderLeftWidth: 4,
    borderLeftColor: "#faad14",
  },
  alertError: {
    backgroundColor: "#fff1f0",
    borderLeftWidth: 4,
    borderLeftColor: "#ff4d4f",
  },
  alertText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    flex: 1,
  },
  alertSmallText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  alertClose: {
    fontSize: 18,
    color: "#666",
    marginLeft: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    marginBottom: 12,
    color: "#000",
  },
  viewModeContainer: {
    flexDirection: "row",
    gap: 8,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d9d9d9",
    alignItems: "center",
  },
  viewModeActive: {
    backgroundColor: "#1890ff",
    borderColor: "#1890ff",
  },
  viewModeText: {
    fontSize: 14,
    color: "#666",
  },
  viewModeActiveText: {
    color: "#fff",
    fontWeight: "600",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    alignItems: "center",
    gap: 8,
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
  },
  smallText: {
    fontSize: 11,
    color: "#999",
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  tagGreen: {
    backgroundColor: "#f6ffed",
    borderColor: "#52c41a",
  },
  tagRed: {
    backgroundColor: "#fff1f0",
    borderColor: "#ff4d4f",
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000",
  },
  detailsButton: {
    backgroundColor: "#1890ff",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  detailsButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  detailsBtn: {
    fontSize: 16,
    fontWeight: "bold",
  },
  chainContainer: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  chainContent: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 4,
  },
  chainCard: {
    minWidth: 150,
    padding: 12,
    borderRadius: 8,
    borderWidth: 3,
    backgroundColor: "#fff",
  },
  chainCardValid: {
    borderColor: "#52c41a",
    backgroundColor: "#f6ffed",
  },
  chainCardInvalid: {
    borderColor: "#ff4d4f",
    backgroundColor: "#fff1f0",
    shadowColor: "#ff4d4f",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  chainCardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#000",
  },
  divider: {
    height: 1,
    backgroundColor: "#d9d9d9",
    marginVertical: 8,
  },
  chainCardStatus: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    color: "#666",
  },
  chainCardTag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  chainCardMeta: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 2,
    color: "#666",
  },
  chainCardSmallText: {
    fontSize: 11,
    marginBottom: 8,
    color: "#000",
  },
  chainCardHash: {
    fontSize: 10,
    fontFamily: "monospace",
    marginBottom: 4,
    color: "#666",
  },
  chainCardTime: {
    fontSize: 10,
    color: "#999",
    marginBottom: 8,
  },
  chainCardError: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "#ffebee",
    borderRadius: 4,
  },
  chainCardErrorText: {
    fontSize: 10,
    color: "#ff4d4f",
  },
  chainArrow: {
    justifyContent: "center",
    alignItems: "center",
    minWidth: 30,
    borderWidth: 2,
  },
  arrowText: {
    fontSize: 20,
    color: "#52c41a",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "90%",
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    flex: 1,
  },
  modalClose: {
    fontSize: 24,
    color: "#666",
    fontWeight: "300",
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  expandableSection: {
    marginBottom: 16,
  },
  expandableTitle: {
    fontSize: 14,
    fontWeight: "600",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#d9d9d9",
    marginBottom: 12,
    color: "#000",
  },
  expandableContent: {
    paddingLeft: 0,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    color: "#000",
    fontWeight: "600",
    maxWidth: "50%",
  },
  hashContainer: {
    marginBottom: 16,
  },
  hashLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000",
  },
  hashBox: {
    backgroundColor: "#f0f7ff",
    padding: 10,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  hashBoxHighlight: {
    borderLeftWidth: 4,
    borderLeftColor: "#1890ff",
  },
  hashText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#000",
    flex: 1,
  },
  copyButton: {
    marginLeft: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#1890ff",
    borderRadius: 4,
  },
  copyButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  encryptedBox: {
    backgroundColor: "#faf8f3",
    padding: 12,
    borderRadius: 6,
    maxHeight: 300,
  },
  encryptedText: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#999",
    marginBottom: 8,
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#1890ff",
    borderRadius: 6,
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});