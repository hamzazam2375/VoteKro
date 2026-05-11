import type { ElectionRow, ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { AuditorSidebar } from '@/components/auditor-sidebar';
import { Navbar } from '@/components/navbar';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';

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
  const [metrics, setMetrics] = useState<BlockChainMetrics>({
    totalBlocks: 0,
    isValid: false,
    tamperedCount: 0,
  });

  const rocksDbUrl = process.env.EXPO_PUBLIC_ROCKSDB_LEDGER_URL || 'http://localhost:8787';

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

  const handleLogout = async () => {
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

    const query = searchBlockId.toLowerCase();
    return blocks.filter((block) => {
      return (
        block.block_index.toString().includes(query) ||
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
    <View style={[styles.blockCard, item.isValid === false && styles.blockCardInvalid]}>
      <Text style={styles.blockTitle}>Block #{item.block_index}</Text>
      <Text style={styles.blockMeta}>Voter: {item.voter_id?.slice(0, 10) || 'Anonymous'}</Text>
      <Text style={styles.blockMeta}>Created: {new Date(item.created_at).toLocaleString()}</Text>
      <Text style={styles.blockHash} numberOfLines={1}>Current: {item.current_hash}</Text>
      <Text style={styles.blockHash} numberOfLines={1}>Previous: {item.previous_hash}</Text>
      <Text style={[styles.blockStatus, item.isValid === false ? styles.blockStatusBad : styles.blockStatusGood]}>
        {item.isValid === false ? 'Tampered' : 'Valid'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Navbar actions={[{ label: 'Logout', onPress: handleLogout, variant: 'outline' }]} />
      <View style={styles.mainContent}>
        {!isMobile && <AuditorSidebar profileName={profile?.full_name || undefined} />}

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerWrapper}>
            <View style={styles.headerSection}>
              <Text style={styles.pageTitle}>Blockchain Ledger</Text>
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
                            {election.title} ({election.status})
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
              <FlatList
                data={filteredBlocks}
                renderItem={renderBlockItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No blocks found for this election.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
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
  blockCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
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
});
