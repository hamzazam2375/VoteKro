import type { CandidateRow, ElectionRow, ProfileRow, VoteBlockRow, VoterRegistryRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export default function VoterDashboard() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [elections, setElections] = useState<ElectionRow[]>([]);
    const [selectedElection, setSelectedElection] = useState<ElectionRow | null>(null);
    const [candidates, setCandidates] = useState<CandidateRow[]>([]);
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
    const [registryStatus, setRegistryStatus] = useState<VoterRegistryRow | null>(null);
    const [latestVoteBlock, setLatestVoteBlock] = useState<VoteBlockRow | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmittingVote, setIsSubmittingVote] = useState(false);

    const displayName = profile?.full_name?.trim() || 'Voter';
    const electionCardWidth = Math.min(330, Math.max(250, width - 48));
    const getStatusStyle = (status: ElectionRow['status']) => {
        switch (status) {
            case 'open':
                return styles.statusOpen;
            case 'draft':
                return styles.statusDraft;
            case 'closed':
                return styles.statusClosed;
            case 'published':
                return styles.statusPublished;
            default:
                return styles.statusDraft;
        }
    };

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const userProfile = await serviceFactory.authService.getRequiredProfile('voter');
                setProfile(userProfile);

                const electionRows = await serviceFactory.votingService.listAllElections();
                setElections(electionRows);

                const defaultElection = electionRows.find((election) => election.status === 'open') ?? electionRows[0] ?? null;
                setSelectedElection(defaultElection);

                if (!defaultElection) {
                    setCandidates([]);
                    setRegistryStatus(null);
                    setSelectedCandidateId(null);
                }
            } catch (error) {
                Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to load profile'));
                router.replace('/VoterLogin');
            } finally {
                setIsLoading(false);
            }
        };

        void loadProfile();
    }, [router]);

    useEffect(() => {
        const loadSelectedElection = async () => {
            if (!selectedElection) {
                setCandidates([]);
                setRegistryStatus(null);
                setSelectedCandidateId(null);
                return;
            }

            try {
                const candidateRows = await serviceFactory.votingService.getElectionCandidates(selectedElection.id);
                const voterRegistry = selectedElection.status === 'open'
                    ? await serviceFactory.votingService.getMyRegistryStatus(selectedElection.id)
                    : null;

                setCandidates(candidateRows);
                setRegistryStatus(voterRegistry);
                setSelectedCandidateId(candidateRows[0]?.id ?? null);
            } catch (error) {
                Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to load election details'));
            }
        };

        void loadSelectedElection();
    }, [selectedElection]);

    const handleLogout = async () => {
        try {
            await serviceFactory.authService.signOut();
            router.replace('/');
        } catch (error) {
            Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to logout'));
        }
    };

    const handleVote = async () => {
        if (!selectedElection) {
            Alert.alert('No election', 'There is no active election available right now.');
            return;
        }

        if (selectedElection.status !== 'open') {
            Alert.alert('Election closed', 'Only open elections can accept votes.');
            return;
        }

        if (!selectedCandidateId) {
            Alert.alert('Select candidate', 'Please select a candidate before voting.');
            return;
        }

        if (!registryStatus?.is_eligible) {
            Alert.alert('Not eligible', 'You are not registered as eligible for this election.');
            return;
        }

        if (registryStatus.has_voted) {
            Alert.alert('Already voted', 'Your vote has already been recorded for this election.');
            return;
        }

        setIsSubmittingVote(true);

        try {
            const block = await serviceFactory.votingService.castVote({
                electionId: selectedElection.id,
                candidateId: selectedCandidateId,
            });

            setLatestVoteBlock(block);
            setRegistryStatus((prev) => (prev ? { ...prev, has_voted: true, voted_at: new Date().toISOString() } : prev));

            Alert.alert(
                'Vote Added To Blockchain',
                `Vote stored in block #${block.block_index} with hash ${block.current_hash.slice(0, 12)}...`
            );
        } catch (error) {
            Alert.alert('Vote failed', serviceFactory.authService.getErrorMessage(error, 'Failed to cast vote'));
        } finally {
            setIsSubmittingVote(false);
        }
    };

    const formatDate = (iso: string): string => {
        return new Date(iso).toLocaleDateString();
    };

    if (isLoading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#2f64e6" />
                <Text style={styles.loadingText}>Loading your voter space...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Navbar
                compact
                infoText={`Welcome, ${displayName}!`}
                actions={[{ label: 'Logout', onPress: handleLogout, variant: 'outline' }]}
            />

            <ScrollView contentContainerStyle={styles.contentContainer}>
                <View style={styles.contentWrap}>
                    <Text style={styles.pageTitle}>Welcome, {displayName}!</Text>
                    <Text style={styles.pageSubtitle}>Cast your vote securely using our blockchain-based system</Text>

                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionIcon}>🗳️</Text>
                        <Text style={styles.sectionTitle}>Available Elections</Text>
                    </View>

                    {elections.length > 0 ? (
                        <View style={styles.electionsList}>
                            {elections.map((election) => {
                                const isSelected = election.id === selectedElection?.id;
                                return (
                                    <Pressable
                                        key={election.id}
                                        style={[styles.electionSummaryCard, isSelected && styles.electionSummaryCardSelected]}
                                        onPress={() => setSelectedElection(election)}
                                    >
                                        <View style={styles.electionSummaryHeader}>
                                            <Text style={styles.electionSummaryTitle}>{election.title}</Text>
                                            <View style={[styles.statusPill, getStatusStyle(election.status)]}>
                                                <Text style={styles.statusPillText}>{election.status.toUpperCase()}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.electionSummaryDescription} numberOfLines={2}>
                                            {election.description ?? 'No description provided.'}
                                        </Text>
                                        <Text style={styles.electionSummaryMeta}>
                                            📅 {formatDate(election.starts_at)} - {formatDate(election.ends_at)}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={[styles.electionCard, { width: electionCardWidth }]}>
                            <Text style={styles.electionTitle}>No Elections Yet</Text>
                            <Text style={styles.electionDescription}>There are no elections created by the admin yet.</Text>
                        </View>
                    )}

                    {selectedElection ? (
                        <View style={[styles.electionCard, { width: electionCardWidth }]}>
                            <LinearGradient
                                colors={['#2f64e6', '#d154a7']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.cardTopAccent}
                            />

                            <View style={styles.electionHeadingRow}>
                                <Text style={styles.electionTitle}>{selectedElection.title}</Text>
                                <View style={[styles.statusPill, getStatusStyle(selectedElection.status)]}>
                                    <Text style={styles.statusPillText}>{selectedElection.status.toUpperCase()}</Text>
                                </View>
                            </View>

                            <Text style={styles.electionDescription}>{selectedElection.description ?? 'Vote for the candidate of your choice'}</Text>

                            <View style={styles.dateBlock}>
                                <Text style={styles.dateText}>📅 Start: {formatDate(selectedElection.starts_at)}</Text>
                                <Text style={styles.dateText}>📅 End: {formatDate(selectedElection.ends_at)}</Text>
                            </View>

                            <Text style={styles.candidateCount}>Candidates: {candidates.length}</Text>

                            <View style={styles.candidateList}>
                                {candidates.length > 0 ? (
                                    candidates.map((candidate) => {
                                        const isSelected = candidate.id === selectedCandidateId;
                                        return (
                                            <Pressable
                                                key={candidate.id}
                                                style={[styles.candidateItem, isSelected && styles.candidateItemSelected]}
                                                onPress={() => setSelectedCandidateId(candidate.id)}
                                            >
                                                <Text style={styles.candidateLabel}>
                                                    {candidate.candidate_number}. {candidate.display_name}
                                                </Text>
                                                {candidate.party_name ? <Text style={styles.candidateParty}>{candidate.party_name}</Text> : null}
                                            </Pressable>
                                        );
                                    })
                                ) : (
                                    <Text style={styles.infoText}>No candidates have been added for this election yet.</Text>
                                )}
                            </View>

                            {selectedElection.status === 'open' ? (
                                <>
                                    <Pressable
                                        style={({ pressed }) => [styles.voteAction, pressed && styles.voteActionPressed]}
                                        onPress={handleVote}
                                        disabled={isSubmittingVote || !registryStatus?.is_eligible || !!registryStatus?.has_voted || !selectedCandidateId}
                                    >
                                        <LinearGradient
                                            colors={['#2f64e6', '#2a58d0']}
                                            start={{ x: 0, y: 0.5 }}
                                            end={{ x: 1, y: 0.5 }}
                                            style={styles.voteButtonGradient}
                                        >
                                            <Text style={styles.voteActionText}>{isSubmittingVote ? 'Submitting Vote...' : 'Vote Now'}</Text>
                                        </LinearGradient>
                                    </Pressable>

                                    {!registryStatus?.is_eligible ? <Text style={styles.infoText}>You are not yet registered for this election.</Text> : null}
                                    {registryStatus?.has_voted ? <Text style={styles.infoText}>Your vote has already been recorded on-chain.</Text> : null}
                                    {latestVoteBlock ? (
                                        <Text style={styles.infoText}>
                                            Last block: #{latestVoteBlock.block_index} ({latestVoteBlock.current_hash.slice(0, 12)}...)
                                        </Text>
                                    ) : null}
                                </>
                            ) : (
                                <Text style={styles.infoText}>This election is visible to voters, but only open elections accept votes.</Text>
                            )}
                        </View>
                    ) : null}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#eceff3',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#eceff3',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 15,
        color: '#5c6f89',
    },
    contentContainer: {
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 60,
        alignItems: 'center',
    },
    contentWrap: {
        width: '100%',
        maxWidth: 980,
    },
    pageTitle: {
        fontSize: 48,
        fontWeight: '800',
        color: '#131f38',
        marginBottom: 12,
    },
    pageSubtitle: {
        fontSize: 21,
        lineHeight: 30,
        color: '#677b94',
        marginBottom: 46,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 18,
    },
    sectionIcon: {
        fontSize: 17,
    },
    sectionTitle: {
        fontSize: 30,
        fontWeight: '800',
        color: '#2f64e6',
    },
    electionsList: {
        gap: 12,
        marginBottom: 18,
    },
    electionSummaryCard: {
        borderRadius: 16,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#d9e0ec',
        paddingHorizontal: 18,
        paddingVertical: 16,
        shadowColor: '#243b63',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
    },
    electionSummaryCardSelected: {
        borderColor: '#2f64e6',
        backgroundColor: '#eef4ff',
    },
    electionSummaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 8,
    },
    electionSummaryTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '800',
        color: '#1b2a47',
    },
    electionSummaryDescription: {
        fontSize: 14,
        lineHeight: 20,
        color: '#60728b',
        marginBottom: 8,
    },
    electionSummaryMeta: {
        fontSize: 13,
        color: '#6a7a90',
    },
    electionHeadingRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 10,
    },
    statusPill: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
        color: '#ffffff',
    },
    statusOpen: {
        backgroundColor: '#1f9d55',
    },
    statusDraft: {
        backgroundColor: '#6b7280',
    },
    statusClosed: {
        backgroundColor: '#b45309',
    },
    statusPublished: {
        backgroundColor: '#2563eb',
    },
    electionCard: {
        borderRadius: 18,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#d9e0ec',
        paddingHorizontal: 22,
        paddingTop: 24,
        paddingBottom: 20,
        overflow: 'hidden',
        shadowColor: '#243b63',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
    },
    cardTopAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
    },
    electionTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#2f64e6',
        marginBottom: 10,
    },
    electionDescription: {
        fontSize: 18,
        lineHeight: 26,
        color: '#5f6f83',
        marginBottom: 16,
    },
    dateBlock: {
        marginBottom: 14,
        gap: 4,
    },
    dateText: {
        fontSize: 15,
        color: '#6a7a90',
        lineHeight: 23,
    },
    candidateCount: {
        fontSize: 21,
        fontWeight: '700',
        color: '#3c4e69',
        marginBottom: 20,
    },
    candidateList: {
        gap: 10,
        marginBottom: 18,
    },
    candidateItem: {
        borderWidth: 1,
        borderColor: '#d5dbe8',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#f8faff',
    },
    candidateItemSelected: {
        borderColor: '#2f64e6',
        backgroundColor: '#e8efff',
    },
    candidateLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#233a67',
    },
    candidateParty: {
        marginTop: 4,
        fontSize: 13,
        color: '#5f6f83',
    },
    voteAction: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    voteActionPressed: {
        opacity: 0.93,
        transform: [{ scale: 0.985 }],
    },
    voteButtonGradient: {
        width: '100%',
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#2f64e6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
    },
    voteActionText: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '700',
    },
    infoText: {
        marginTop: 12,
        fontSize: 14,
        color: '#4f5d72',
        lineHeight: 20,
    },
});
