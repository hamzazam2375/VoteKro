import type { ElectionRow, ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { AuditorSidebar } from '@/components/auditor-sidebar';
import { Navbar } from '@/components/navbar';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
}

interface BlockChainMetrics {
  totalBlocks: number;
  isValid: boolean;
  tamperedCount: number;
}

const verifyBlockchain = (blocks: VoteBlock[]): VoteBlock[] => {
  return blocks.map((block, index) => {
    if (index === 0) {
      return { ...block, isValid: true };
    }

    const previousBlock = blocks[index - 1];
    const isValid = block.previous_hash === previousBlock.current_hash;
    return { ...block, isValid };
  });
};

export default function AuditorBlockchainLedger() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 760;

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [elections, setElections] = useState<ElectionRow[]>([]);
  const [selectedElection, setSelectedElection] = useState<string>('');
  const [blocks, setBlocks] = useState<VoteBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [electionsLoading, setElectionsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchBlockId, setSearchBlockId] = useState('');
  const [showElectionPicker, setShowElectionPicker] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedBlockDetail, setSelectedBlockDetail] = useState<VoteBlock | null>(null);
  const [metrics, setMetrics] = useState<BlockChainMetrics>({
    totalBlocks: 0,
    isValid: false,
    tamperedCount: 0,
  });

  useEffect(() => {
    const loadProfileAndElections = async () => {
      try {
        const userProfile = await serviceFactory.authService.getRequiredProfile('auditor');
        setProfile(userProfile);

        const allElections = await serviceFactory.electionRepository.listAll();
        setElections(allElections || []);
        if (allElections && allElections.length > 0) {
          setSelectedElection((current) => current || allElections[0].id);
        }
      } catch (err) {
        Alert.alert('Error', serviceFactory.authService.getErrorMessage(err, 'Failed to load blockchain ledger'));
        router.replace('/AuditorSignup');
      } finally {
        setElectionsLoading(false);
      }
    };

    void loadProfileAndElections();
  }, [router]);

  useEffect(() => {
    const loadLedger = async () => {
      if (!selectedElection) {
        setBlocks([]);
        setMetrics({ totalBlocks: 0, isValid: false, tamperedCount: 0 });
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = (await serviceFactory.auditorService.getLedger(selectedElection)) as VoteBlock[];
        const verifiedBlocks = verifyBlockchain(data || []);
        const tamperedCount = verifiedBlocks.filter((block) => block.isValid === false).length;

        setBlocks(verifiedBlocks);
        setMetrics({
          totalBlocks: verifiedBlocks.length,
          isValid: tamperedCount === 0,
          tamperedCount,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load blockchain ledger';
        setError(message);
        setBlocks([]);
        setMetrics({ totalBlocks: 0, isValid: false, tamperedCount: 0 });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    void loadLedger();
  }, [selectedElection]);

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
    } catch (err) {
      Alert.alert('Error', serviceFactory.authService.getErrorMessage(err, 'Failed to logout'));
    }
  };

  const filteredBlocks = useMemo(() => {
    if (!searchBlockId.trim()) {
      return blocks;
    }

    const query = searchBlockId.toLowerCase().trim();
    // First try to match exact block index
    const exactMatch = blocks.filter((block) =>
      block.block_index.toString() === query
    );
    
    if (exactMatch.length > 0) {
      return exactMatch;
    }

    // If no exact match, search by hash
    return blocks.filter((block) => {
      return (
        block.current_hash.toLowerCase().includes(query) ||
        block.previous_hash.toLowerCase().includes(query)
      );
    });
  }, [blocks, searchBlockId]);

  const onRefresh = async () => {
    setRefreshing(true);
    setSelectedElection((current) => current);
  };

  const renderBlockItem = ({ item }: { item: VoteBlock }) => (
    <Pressable
      onPress={() => setSelectedBlockDetail(item)}
      style={({ pressed }) => [styles.blockCard, item.isValid === false && styles.blockCardInvalid, pressed && styles.blockCardPressed]}
    >
      <Text style={[styles.blockTitle, { fontSize: 13, marginBottom: 4 }]}>#{item.block_index}</Text>
      <Text style={[styles.blockMeta, { fontSize: 11, marginBottom: 2 }]} numberOfLines={1}>Voter: {item.voter_id?.slice(0, 8) || 'Anon'}</Text>
      <Text style={[styles.blockMeta, { fontSize: 10, marginBottom: 2 }]} numberOfLines={1}>{new Date(item.created_at).toLocaleDateString()}</Text>
      <Text style={[styles.blockHash, { fontSize: 9, marginTop: 2 }]} numberOfLines={1}>{item.current_hash.slice(0, 14)}...</Text>
      <Text style={[styles.blockStatus, item.isValid === false ? styles.blockStatusBad : styles.blockStatusGood, { fontSize: 10, marginTop: 6 }]}>
        {item.isValid === false ? 'Tampered' : 'Valid'}
      </Text>
    </Pressable>
  );

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
            actions={[{ label: 'Logout', onPress: handleLogout, variant: 'outline' }]}
          />
        </View>
      )}
      <View style={styles.mainContent}>
        {!isMobile && <AuditorSidebar profileName={profile?.full_name || undefined} />}
        
        {/* Overlay Backdrop - Mobile Only */}
        {isMobile && sidebarOpen && (
          <Pressable
            style={styles.sidebarOverlay}
            onPress={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        {isMobile && sidebarOpen && (
          <View style={[styles.sidebar, styles.sidebarMobile]}>
            <AuditorSidebar
              profileName={profile?.full_name}
              onNavigate={() => setSidebarOpen(false)}
            />
          </View>
        )}

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerWrapper}>
            <View style={styles.headerSection}>
              <Text style={styles.pageTitle}>⛓️ Blockchain Ledger</Text>
              <Text style={styles.pageSubtitle}>Auditor view for blockchain integrity monitoring</Text>
            </View>

            <View style={styles.controlsCard}>
              <Text style={styles.controlsLabel}>Select Election</Text>
              {electionsLoading ? (
                <ActivityIndicator size="small" color="#1a73e8" />
              ) : (
                <View>
                  <Pressable style={styles.pickerButton} onPress={() => setShowElectionPicker((current) => !current)}>
                    <Text style={styles.pickerButtonText}>
                      {elections.find((election) => election.id === selectedElection)?.title || 'Choose election'}
                    </Text>
                  </Pressable>
                  {showElectionPicker && (
                    <View style={styles.pickerDropdown}>
                      {elections.map((election) => (
                        <Pressable
                          key={election.id}
                          style={styles.pickerItem}
                          onPress={() => {
                            setSelectedElection(election.id);
                            setShowElectionPicker(false);
                          }}
                        >
                          <Text style={styles.pickerItemText}>
                            {election.title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Blocks</Text>
                <Text style={styles.metricValue}>{metrics.totalBlocks}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Blockchain Status</Text>
                <Text style={[styles.metricValue, metrics.isValid ? styles.metricGood : styles.metricBad]}>
                  {metrics.isValid ? 'VALID' : 'TAMPERED'}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Tampered Blocks</Text>
                <Text style={[styles.metricValue, metrics.tamperedCount > 0 && styles.metricBad]}>
                  {metrics.tamperedCount}
                </Text>
              </View>
            </View>

            {error && (
              <View style={styles.alertCard}>
                <Text style={styles.alertText}>{error}</Text>
              </View>
            )}

            <View style={styles.searchCard}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by block # or hash"
                value={searchBlockId}
                onChangeText={setSearchBlockId}
                placeholderTextColor="#8c98a8"
              />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ledger Entries</Text>
              <Text style={styles.sectionCount}>{filteredBlocks.length} found</Text>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#1a73e8" />
                <Text style={styles.loadingText}>Loading ledger...</Text>
              </View>
            ) : filteredBlocks.length > 0 ? (
              <View style={styles.blocksGrid}>
                {filteredBlocks.map((item) => (
                  <View key={item.id}>
                    {renderBlockItem({ item })}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No blocks found for this election.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Block Details Modal */}
      {selectedBlockDetail && (
        <View style={styles.detailsModalOverlay}>
          <View style={styles.detailsModalContent}>
            <Pressable
              onPress={() => setSelectedBlockDetail(null)}
              style={styles.detailsCloseButton}
            >
              <Text style={styles.detailsCloseIcon}>✕</Text>
            </Pressable>

            <Text style={styles.detailsTitle}>Block Details</Text>
            
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Block Index</Text>
                <Text style={styles.detailValue}>#{selectedBlockDetail.block_index}</Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Voter ID</Text>
                <Text style={styles.detailValue}>{selectedBlockDetail.voter_id || 'Anonymous'}</Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={[styles.detailValue, selectedBlockDetail.isValid === false ? styles.detailValueBad : styles.detailValueGood]}>
                  {selectedBlockDetail.isValid === false ? 'Tampered' : 'Valid'}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>{new Date(selectedBlockDetail.created_at).toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.detailsHashSection}>
              <Text style={styles.detailsHashLabel}>Current Hash</Text>
              <Text style={styles.detailsHashValue} selectable={true}>{selectedBlockDetail.current_hash}</Text>
            </View>

            <View style={styles.detailsHashSection}>
              <Text style={styles.detailsHashLabel}>Previous Hash</Text>
              <Text style={styles.detailsHashValue} selectable={true}>{selectedBlockDetail.previous_hash}</Text>
            </View>

            <Pressable
              onPress={() => setSelectedBlockDetail(null)}
              style={({ pressed }) => [styles.detailsCloseActionButton, pressed && styles.detailsCloseActionButtonPressed]}
            >
              <Text style={styles.detailsCloseActionText}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
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
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 500,
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
  mobileSidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
    maxWidth: '84%',
    zIndex: 400,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
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
    maxWidth: 1200,
  },
  headerSection: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  controlsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e6edf7',
    marginBottom: 16,
  },
  controlsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2e4a',
    marginBottom: 10,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#cfd9ea',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f9fbfe',
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2e4a',
  },
  pickerDropdown: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d7e2f1',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eef3f8',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#1f2e4a',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e6edf7',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2e4a',
  },
  metricGood: {
    color: '#4caf50',
  },
  metricBad: {
    color: '#d32f2f',
  },
  alertCard: {
    backgroundColor: '#fff3f3',
    borderColor: '#ffd2d2',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  alertText: {
    color: '#b42318',
    fontSize: 13,
    fontWeight: '600',
  },
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e6edf7',
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d5deea',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#1f2e4a',
    backgroundColor: '#fbfcfe',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5b6b7e',
    backgroundColor: '#eef4ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6edf7',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
  },
  blocksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  blockCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e6edf7',
  },
  blockCardInvalid: {
    borderColor: '#ffd2d2',
    backgroundColor: '#fff8f8',
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2e4a',
    marginBottom: 6,
  },
  blockMeta: {
    fontSize: 13,
    color: '#5b6b7e',
    marginBottom: 4,
  },
  blockHash: {
    fontSize: 12,
    color: '#76869a',
    marginTop: 4,
  },
  blockStatus: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  blockStatusGood: {
    color: '#4caf50',
  },
  blockStatusBad: {
    color: '#d32f2f',
  },
  blockCardPressed: {
    opacity: 0.7,
  },
  // Block Details Modal Styles
  detailsModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  detailsModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  detailsCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 10,
  },
  detailsCloseIcon: {
    fontSize: 24,
    color: '#999',
    fontWeight: '600',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    marginTop: 8,
  },
  detailsGrid: {
    marginBottom: 16,
  },
  detailItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8faff',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1a73e8',
  },
  detailLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  detailValueGood: {
    color: '#4caf50',
  },
  detailValueBad: {
    color: '#d32f2f',
  },
  detailsHashSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  detailsHashLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  detailsHashValue: {
    fontSize: 11,
    color: '#1a1a1a',
    fontFamily: 'monospace',
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  detailsCloseActionButton: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
  },
  detailsCloseActionButtonPressed: {
    opacity: 0.8,
  },
  detailsCloseActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
