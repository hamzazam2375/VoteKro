import type { CandidateRow, ElectionRow, ProfileRow, VoterRegistryRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { DashboardShell } from '@/components/dashboard-shell';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export default function VoterDashboard() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [elections, setElections] = useState<ElectionRow[]>([]);
    const [selectedElection, setSelectedElection] = useState<ElectionRow | null>(null);
    const [candidates, setCandidates] = useState<CandidateRow[]>([]);
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
    const [registryStatus, setRegistryStatus] = useState<VoterRegistryRow | null>(null);
    const [voteModalTitle, setVoteModalTitle] = useState<string>('');
    const [voteModalMessage, setVoteModalMessage] = useState<string>('');
    const [showVoteModal, setShowVoteModal] = useState(false);
    const [showElectionDialog, setShowElectionDialog] = useState(false);
    const dialogCloseRef = useRef<any>(null);
    const prevActiveElementRef = useRef<HTMLElement | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmittingVote, setIsSubmittingVote] = useState(false);
    const [votedElectionIds, setVotedElectionIds] = useState<Set<string>>(new Set());
    const [currentView, setCurrentView] = useState<'home' | 'history'>('home');
    const [voteDetails, setVoteDetails] = useState<Map<string, { hash: string; date: string; candidate: string }>>(new Map());

    const displayName = profile?.full_name?.trim() || 'Voter';
    const electionCardWidth = Math.min(330, Math.max(250, width - 48));
    const getEffectiveElectionStatus = (election: ElectionRow): ElectionRow['status'] => {
        if (election.status !== 'open') {
            return election.status;
        }

        const now = Date.now();
        const startsAt = new Date(election.starts_at).getTime();
        const endsAt = new Date(election.ends_at).getTime();

        return now >= startsAt && now <= endsAt ? 'open' : 'closed';
    };

    const getStatusStyle = (status: ElectionRow['status']) => {
        switch (status) {
            case 'active':
                return styles.statusActive;
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

                const defaultElection = electionRows.find((election) => getEffectiveElectionStatus(election) === 'active') ?? electionRows[0] ?? null;
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
                setShowVoteModal(false);
                return;
            }

            try {
                const candidateRows = await serviceFactory.votingService.getElectionCandidates(selectedElection.id);
                const voterRegistry = getEffectiveElectionStatus(selectedElection) === 'active'
                    ? await serviceFactory.votingService.getMyRegistryStatus(selectedElection.id)
                    : null;

                setCandidates(candidateRows);
                setRegistryStatus(voterRegistry);
                if (voterRegistry?.has_voted) {
                    setVotedElectionIds(prev => new Set(prev).add(selectedElection.id));
                }
                setSelectedCandidateId(candidateRows[0]?.id ?? null);
                setShowVoteModal(false);
            } catch (error) {
                Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to load election details'));
            }
        };

        void loadSelectedElection();
    }, [selectedElection]);

    // Manage focus when dialog opens/closes to avoid aria-hidden focus issues on web
    useEffect(() => {
        if (showElectionDialog) {
            try {
                if (typeof document !== 'undefined') {
                    const active = document.activeElement as HTMLElement | null;
                    prevActiveElementRef.current = active && active !== document.body ? active : null;
                }
            } catch (err) {
                // ignore
            }

            // focus the close button inside the dialog after it renders
            setTimeout(() => {
                try {
                    dialogCloseRef.current?.focus?.();
                } catch (err) {
                    // no-op
                }
            }, 50);
        } else {
            // restore focus to previously focused element
            setTimeout(() => {
                try {
                    prevActiveElementRef.current?.focus?.();
                } catch (err) {
                    // no-op
                }
                prevActiveElementRef.current = null;
            }, 50);
        }
    }, [showElectionDialog]);

    const handleLogout = async () => {
        try {
            await serviceFactory.authService.signOut();
            router.replace('/');
        } catch (error) {
            Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to logout'));
        }
    };

    const handleVote = async () => {
        console.log('[Vote] handleVote started');
        // prevent double-submits
        if (isSubmittingVote) {
            console.log('[Vote] Already submitting, ignoring');
            return;
        }

        // Validation checks that should show in modal
        let validationError: { title: string; message: string } | null = null;

        if (!selectedElection) {
            validationError = { title: 'No Election', message: 'There is no active election available right now.' };
        } else if (getEffectiveElectionStatus(selectedElection) !== 'active') {
            validationError = { title: 'Election Closed', message: 'Only open elections can accept votes.' };
        } else if (!selectedCandidateId) {
            validationError = { title: 'Select Candidate', message: 'Please select a candidate before voting.' };
        } else if (registryStatus && !registryStatus.is_eligible) {
            validationError = { title: 'Not Eligible', message: 'You are not registered as eligible for this election.' };
        } else if (registryStatus?.has_voted) {
            validationError = { title: 'Already Voted', message: 'Your vote has already been recorded for this election.' };
        }

        if (validationError) {
            console.log('[Vote] Validation error:', validationError);
            setVoteModalTitle(validationError.title);
            setVoteModalMessage(validationError.message);
            setShowVoteModal(true);
            return;
        }

        // After validation, we know these are not null
        if (!selectedElection || !selectedCandidateId) {
            console.error('[Vote] Unexpected: selectedElection or selectedCandidateId is null after validation');
            return;
        }

        console.log('[Vote] Validation passed, starting submission');
        setIsSubmittingVote(true);
        setShowVoteModal(false);

        try {
            console.log('[Vote] Calling castVote for election:', selectedElection.id, 'candidate:', selectedCandidateId);
            await serviceFactory.votingService.castVote({
                electionId: selectedElection.id,
                candidateId: selectedCandidateId,
            });

            console.log('[Vote] castVote succeeded');
            // Optimistically update registry so UI reflects the vote immediately
            setRegistryStatus((prev) => {
                if (!prev) {
                    return {
                        is_eligible: true,
                        has_voted: true,
                        // keep other optional fields if present
                    } as any;
                }

                return {
                    ...prev,
                    has_voted: true,
                };
            });

            setVotedElectionIds(prev => new Set(prev).add(selectedElection.id));

            const successMessage = 'Your vote has been cast successfully.';
            console.log('[Vote] Showing success modal');
            setVoteModalTitle('Vote Cast Successfully');
            setVoteModalMessage(successMessage);
            setShowVoteModal(true);

            try {
                const refreshedRegistry = await serviceFactory.votingService.getMyRegistryStatus(selectedElection.id);
                setRegistryStatus(refreshedRegistry);
                console.log('[Vote] Registry refreshed');
            } catch (refreshError) {
                console.warn('Vote succeeded but registry refresh failed:', refreshError);
            }
        } catch (error) {
            console.error('[Vote] Vote failed with error:', error);
            const message = serviceFactory.authService.getErrorMessage(error, 'Failed to cast vote');
            const isAlreadyVoted = /already\s+has\s+a\s+recorded\s+vote|already\s+voted/i.test(message);

            if (isAlreadyVoted) {
                console.log('[Vote] Already voted error detected');
                setRegistryStatus((prev) => {
                    if (!prev) {
                        return prev;
                    }

                    return {
                        ...prev,
                        has_voted: true,
                    };
                });
                setVotedElectionIds(prev => new Set(prev).add(selectedElection.id));
                setVoteModalTitle('Already Voted');
                setVoteModalMessage('Voter has already casted vote for this election.');
                setShowVoteModal(true);
            } else {
                // Show error in modal instead of Alert (better for web)
                console.log('[Vote] Showing error modal with message:', message);
                setVoteModalTitle('Vote Failed');
                setVoteModalMessage(message);
                setShowVoteModal(true);
            }
        } finally {
            console.log('[Vote] Finally block, setting isSubmittingVote to false');
            setIsSubmittingVote(false);
        }
    };

    const formatDate = (iso: string): string => {
        return new Date(iso).toLocaleDateString();
    };

    const getActiveElections = () => {
        const now = Date.now();
        return elections.filter((election) => {
            const startsAt = new Date(election.starts_at).getTime();
            const endsAt = new Date(election.ends_at).getTime();
            return now >= startsAt && now <= endsAt;
        });
    };

    const getHistoryElections = () => {
        const now = Date.now();
        return elections.filter((election) => {
            const endsAt = new Date(election.ends_at).getTime();
            const isClosed = now > endsAt;
            const isVoted = votedElectionIds.has(election.id);
            return isClosed || isVoted;
        });
    };

    const fetchVoteDetails = async (electionId: string) => {
        if (voteDetails.has(electionId)) return;
        
        try {
            const ledger = await serviceFactory.auditorService.getLedger(electionId);
            const candidates = await serviceFactory.votingService.getElectionCandidates(electionId);
            
            // Find user's vote in the ledger
            const userVote = ledger.find(vote => vote.voter_id === profile?.user_id);
            if (userVote) {
                const candidate = candidates.find(c => c.id === userVote.encrypted_vote);
                if (candidate) {
                    setVoteDetails(prev => new Map(prev).set(electionId, {
                        hash: userVote.current_hash,
                        date: userVote.created_at,
                        candidate: candidate.display_name
                    }));
                }
            }
        } catch (error) {
            console.error('Failed to fetch vote details:', error);
        }
    };

    const displayedElections = currentView === 'home' ? getActiveElections() : getHistoryElections();

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
            <Modal
                visible={showVoteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowVoteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>{voteModalTitle}</Text>
                        <Text style={styles.modalMessage}>{voteModalMessage}</Text>
                        <Pressable
                            style={styles.modalButton}
                            accessibilityRole="button"
                            onPress={() => {
                                setShowVoteModal(false);
                                // also close election dialog when user dismisses success/error modal
                                if (voteModalTitle === 'Vote Cast Successfully' || voteModalTitle === 'Already Voted') {
                                    setShowElectionDialog(false);
                                }
                            }}
                        >
                            <Text style={styles.modalButtonText}>OK</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showElectionDialog}
                transparent
                animationType="slide"
                onRequestClose={() => setShowElectionDialog(false)}
            >
                <View style={styles.dialogOverlay}>
                    <View style={[styles.dialogBox, { maxWidth: Math.min(720, width - 32) }]}>
                        <View style={styles.dialogHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.dialogTitle}>{selectedElection?.title ?? 'Election'}</Text>
                                <Text style={styles.dialogSubtitle}>{selectedElection?.description ?? ''}</Text>
                            </View>
                            <Pressable
                                accessibilityLabel="Close election dialog"
                                accessibilityRole="button"
                                style={styles.dialogClose}
                                onPress={() => setShowElectionDialog(false)}
                            >
                                <Text style={styles.dialogCloseText}>✕</Text>
                            </Pressable>
                        </View>

                        <ScrollView style={styles.dialogContent} contentContainerStyle={{ paddingBottom: 18 }}>
                            <View style={styles.dialogMetaRow}>
                                <View style={[styles.statusPill, getStatusStyle(selectedElection ? getEffectiveElectionStatus(selectedElection) : 'draft')]}>
                                    <Text style={styles.statusPillText}>{(selectedElection ? getEffectiveElectionStatus(selectedElection) : 'DRAFT').toString().toUpperCase()}</Text>
                                </View>
                                <Text style={styles.dialogDates}>📅 {selectedElection ? `${formatDate(selectedElection.starts_at)} — ${formatDate(selectedElection.ends_at)}` : ''}</Text>
                            </View>

                            {currentView === 'history' && selectedElection && voteDetails.has(selectedElection.id) ? (
                                <View style={styles.voteDetailsContainer}>
                                    <Text style={styles.sectionHeading}>Vote Details</Text>
                                    <View style={styles.voteDetailRow}>
                                        <Text style={styles.voteDetailLabel}>Hash ID:</Text>
                                        <Text style={styles.voteDetailValue}>{selectedElection ? voteDetails.get(selectedElection.id)?.hash || 'N/A' : 'N/A'}</Text>
                                    </View>
                                    <View style={styles.voteDetailRow}>
                                        <Text style={styles.voteDetailLabel}>Vote Date:</Text>
                                        <Text style={styles.voteDetailValue}>{selectedElection && voteDetails.get(selectedElection.id) ? new Date(voteDetails.get(selectedElection.id).date).toLocaleDateString() : 'N/A'}</Text>
                                    </View>
                                    <View style={styles.voteDetailRow}>
                                        <Text style={styles.voteDetailLabel}>Voted For:</Text>
                                        <Text style={styles.voteDetailValue}>{selectedElection && voteDetails.get(selectedElection.id) ? voteDetails.get(selectedElection.id).candidate : 'N/A'}</Text>
                                    </View>
                                </View>
                            ) : getEffectiveElectionStatus(selectedElection || { id: '', title: '', description: '', starts_at: '', ends_at: '', status: 'draft', created_by: '', created_at: '', updated_at: '' }) === 'active' ? (
                                <>
                                    <Text style={styles.sectionHeading}>Candidates</Text>
                                    {candidates.length > 0 ? (
                                        candidates.map((candidate) => {
                                            const isSelected = candidate.id === selectedCandidateId;
                                            return (
                                                <Pressable
                                                    key={candidate.id}
                                                    style={({ pressed }) => [styles.dialogCandidate, isSelected && styles.candidateItemSelected, pressed && styles.candidatePressed]}
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: isSelected }}
                                                    onPress={() => setSelectedCandidateId(candidate.id)}
                                                >
                                                    <Text style={styles.candidateLabel}>{candidate.candidate_number}. {candidate.display_name}</Text>
                                                    {candidate.party_name ? <Text style={styles.candidateParty}>{candidate.party_name}</Text> : null}
                                                </Pressable>
                                            );
                                        })
                                    ) : (
                                        <Text style={styles.infoText}>No candidates available for this election.</Text>
                                    )}
                                </>
                            ) : (
                                <View style={styles.voteDetailsContainer}>
                                    <Text style={styles.sectionHeading}>Election Details</Text>
                                    <Text style={styles.infoText}>This election is {getEffectiveElectionStatus(selectedElection || { id: '', title: '', description: '', starts_at: '', ends_at: '', status: 'draft', created_by: '', created_at: '', updated_at: '' })?.toUpperCase()}. Voting is not available.</Text>
                                </View>
                            )}

                            <View style={styles.dialogActionsRow}>
                                <Pressable
                                    style={({ pressed }) => [styles.dialogPrimaryButton, pressed && styles.buttonPressed]}
                                    accessibilityRole="button"
                                    onPress={async () => {
                                        if (isSubmittingVote) return;
                                        // handleVote will show a modal; modal dismissal will close the dialog
                                        await handleVote();
                                    }}
                                    disabled={!selectedElection || getEffectiveElectionStatus(selectedElection) !== 'active' || isSubmittingVote || !!registryStatus?.has_voted || (registryStatus ? !registryStatus.is_eligible : false) || votedElectionIds.has(selectedElection.id)}
                                >
                                    <Text style={styles.dialogPrimaryText}>{selectedElection && getEffectiveElectionStatus(selectedElection) === 'active' ? (isSubmittingVote ? 'Submitting...' : 'Vote Now') : 'Not Open'}</Text>
                                </Pressable>

                                <Pressable
                                    style={({ pressed }) => [styles.dialogSecondaryButton, pressed && styles.buttonPressed]}
                                    accessibilityRole="button"
                                    onPress={() => setShowElectionDialog(false)}
                                >
                                    <Text style={styles.dialogSecondaryText}>Close</Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <DashboardShell
                compactNavbar
                userName={displayName}
                userRole="Voter"
                onLogout={handleLogout}
                sidebarItems={[
                    {
                        key: 'home',
                        label: 'Home',
                        icon: '🏠',
                        active: currentView === 'home',
                        onPress: () => setCurrentView('home'),
                    },
                    {
                        key: 'history',
                        label: 'History',
                        icon: '📜',
                        active: currentView === 'history',
                        onPress: () => setCurrentView('history'),
                    },
                ]}
            >
                <Modal
                    visible={showVoteModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowVoteModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalBox}>
                            <Text style={styles.modalTitle}>{voteModalTitle}</Text>
                            <Text style={styles.modalMessage}>{voteModalMessage}</Text>
                            <Pressable
                                style={styles.modalButton}
                                accessibilityRole="button"
                                onPress={() => {
                                    setShowVoteModal(false);
                                    if (voteModalTitle === 'Vote Cast Successfully' || voteModalTitle === 'Already Voted') {
                                        setShowElectionDialog(false);
                                    }
                                }}
                            >
                                <Text style={styles.modalButtonText}>OK</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>

                <Modal
                    visible={showElectionDialog}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowElectionDialog(false)}
                >
                    <View style={styles.dialogOverlay}>
                        <View style={[styles.dialogBox, { maxWidth: Math.min(720, width - 32) }]}>
                            <View style={styles.dialogHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.dialogTitle}>{selectedElection?.title ?? 'Election'}</Text>
                                    <Text style={styles.dialogSubtitle}>{selectedElection?.description ?? ''}</Text>
                                </View>
                                <Pressable
                                    accessibilityLabel="Close election dialog"
                                    accessibilityRole="button"
                                    style={styles.dialogClose}
                                    onPress={() => setShowElectionDialog(false)}
                                >
                                    <Text style={styles.dialogCloseText}>✕</Text>
                                </Pressable>
                            </View>

                            <ScrollView style={styles.dialogContent} contentContainerStyle={{ paddingBottom: 18 }}>
                                <View style={styles.dialogMetaRow}>
                                    <View style={[styles.statusPill, getStatusStyle(selectedElection ? getEffectiveElectionStatus(selectedElection) : 'draft')]}>
                                        <Text style={styles.statusPillText}>{(selectedElection ? getEffectiveElectionStatus(selectedElection) : 'DRAFT').toString().toUpperCase()}</Text>
                                    </View>
                                    <Text style={styles.dialogDates}>📅 {selectedElection ? `${formatDate(selectedElection.starts_at)} — ${formatDate(selectedElection.ends_at)}` : ''}</Text>
                                </View>

                                <Text style={styles.sectionHeading}>Candidates</Text>
                                {candidates.length > 0 ? (
                                    candidates.map((candidate) => {
                                        const isSelected = candidate.id === selectedCandidateId;
                                        return (
                                            <Pressable
                                                key={candidate.id}
                                                style={({ pressed }) => [styles.dialogCandidate, isSelected && styles.candidateItemSelected, pressed && styles.candidatePressed]}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected: isSelected }}
                                                onPress={() => setSelectedCandidateId(candidate.id)}
                                            >
                                                <Text style={styles.candidateLabel}>{candidate.candidate_number}. {candidate.display_name}</Text>
                                                {candidate.party_name ? <Text style={styles.candidateParty}>{candidate.party_name}</Text> : null}
                                            </Pressable>
                                        );
                                    })
                                ) : (
                                    <Text style={styles.infoText}>No candidates available for this election.</Text>
                                )}

                                <View style={styles.dialogActionsRow}>
                                    <Pressable
                                        style={({ pressed }) => [styles.dialogPrimaryButton, pressed && styles.buttonPressed]}
                                        accessibilityRole="button"
                                        onPress={async () => {
                                            if (isSubmittingVote) return;
                                            await handleVote();
                                        }}
                                        disabled={!selectedElection || getEffectiveElectionStatus(selectedElection) !== 'active' || isSubmittingVote || !!registryStatus?.has_voted || (registryStatus ? !registryStatus.is_eligible : false) || votedElectionIds.has(selectedElection.id)}
                                    >
                                        <Text style={styles.dialogPrimaryText}>{selectedElection && getEffectiveElectionStatus(selectedElection) === 'active' ? (isSubmittingVote ? 'Submitting...' : 'Vote Now') : 'Not Open'}</Text>
                                    </Pressable>

                                    <Pressable
                                        style={({ pressed }) => [styles.dialogSecondaryButton, pressed && styles.buttonPressed]}
                                        accessibilityRole="button"
                                        onPress={() => setShowElectionDialog(false)}
                                    >
                                        <Text style={styles.dialogSecondaryText}>Close</Text>
                                    </Pressable>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                <ScrollView contentContainerStyle={styles.contentContainer}>
                    <View style={styles.contentWrap}>
                        {currentView === 'home' ? (
                            <>
                                <Text style={styles.pageSubtitle}>Cast your vote securely using our blockchain-based system</Text>
                            </>
                        ) : (
                            <Text style={styles.pageSubtitle}>View your voting history and closed elections</Text>
                        )}

                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionIcon}>{currentView === 'home' ? '🗳️' : '📚'}</Text>
                            <Text style={styles.sectionTitle}>
                                {currentView === 'home' ? 'Active Elections' : 'Voting History'}
                            </Text>
                        </View>

                        {displayedElections.length > 0 ? (
                            <View style={styles.electionsList}>
                                {displayedElections.map((election) => {
                                    const isSelected = election.id === selectedElection?.id;
                                    const effectiveStatus = getEffectiveElectionStatus(election);
                                    return (
                                        <Pressable
                                            key={election.id}
                                            style={[styles.electionSummaryCard, isSelected && styles.electionSummaryCardSelected]}
                                            onPress={async () => { 
    setSelectedElection(election); 
    if (currentView === 'history') {
        await fetchVoteDetails(election.id);
    }
    setShowElectionDialog(true); 
}}
                                        >
                                            <View style={styles.electionSummaryHeader}>
                                                <Text style={styles.electionSummaryTitle}>{election.title}</Text>
                                                <View style={[styles.statusPill, getStatusStyle(effectiveStatus)]}>
                                                    <Text style={styles.statusPillText}>{effectiveStatus.toUpperCase()}</Text>
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
                                <Text style={styles.electionTitle}>
                                    {currentView === 'home' ? 'No Active Elections' : 'No Voting History'}
                                </Text>
                                <Text style={styles.electionDescription}>
                                    {currentView === 'home'
                                        ? 'There are no active elections right now. Check back soon!'
                                        : 'You have not voted in any closed elections yet.'}
                                </Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </DashboardShell>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#eceff3',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    modalBox: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 22,
        borderWidth: 1,
        borderColor: '#d9e0ec',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1b2a47',
        marginBottom: 10,
    },
    modalMessage: {
        fontSize: 15,
        lineHeight: 22,
        color: '#4f5d72',
        marginBottom: 16,
    },
    modalButton: {
        alignSelf: 'flex-end',
        backgroundColor: '#2f64e6',
        borderRadius: 10,
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    modalButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
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
    tabBar: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
        borderBottomWidth: 2,
        borderBottomColor: '#e6ecf8',
    },
    tabButton: {
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabButtonActive: {
        borderBottomColor: '#2f64e6',
    },
    tabButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#677b94',
    },
    tabButtonTextActive: {
        color: '#2f64e6',
    },
    blockchainBanner: {
        flexDirection: 'row',
        backgroundColor: '#eef4ff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#2f64e6',
        gap: 12,
    },
    blockchainBannerIcon: {
        fontSize: 28,
        marginTop: 4,
    },
    blockchainBannerContent: {
        flex: 1,
    },
    blockchainBannerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#2f64e6',
        marginBottom: 6,
    },
    blockchainBannerText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#4f5d72',
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
        boxShadow: '0px 6px 12px rgba(36, 59, 99, 0.06)',
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
    statusActive: {
        backgroundColor: '#1f9d55',
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
        boxShadow: '0px 8px 16px rgba(36, 59, 99, 0.08)',
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
        boxShadow: '0px 6px 10px rgba(47, 100, 230, 0.2)',
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
    voteDetailsContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
    },
    voteDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e8eaf6',
    },
    voteDetailLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    voteDetailValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1f2937',
        flex: 1,
        textAlign: 'right',
    },
    errorText: {
        marginTop: 12,
        fontSize: 14,
        color: '#b42318',
        lineHeight: 20,
        fontWeight: '600',
    },
    dialogOverlay: {
        flex: 1,
        backgroundColor: 'rgba(8,12,20,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    dialogBox: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e6ecf8',
        maxHeight: '90%'
    },
    dialogHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f2f6fb',
    },
    dialogTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#14203a',
    },
    dialogSubtitle: {
        fontSize: 14,
        color: '#57677e',
        marginTop: 6,
    },
    dialogClose: {
        marginLeft: 12,
        padding: 8,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    dialogCloseText: {
        fontSize: 18,
        color: '#677b94',
    },
    dialogContent: {
        paddingHorizontal: 18,
        paddingTop: 14,
    },
    dialogMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    dialogDates: {
        fontSize: 13,
        color: '#6a7a90'
    },
    sectionHeading: {
        fontSize: 16,
        fontWeight: '800',
        color: '#233a67',
        marginBottom: 10,
        marginTop: 6,
    },
    dialogCandidate: {
        borderWidth: 1,
        borderColor: '#e6ecf8',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 10,
        backgroundColor: '#fbfdff',
    },
    candidatePressed: {
        opacity: 0.95,
        transform: [{ scale: 0.997 }],
    },
    dialogActionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
        paddingHorizontal: 2,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'flex-end'
    },
    dialogPrimaryButton: {
        backgroundColor: '#2f64e6',
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 10,
        minWidth: 140,
        alignItems: 'center',
        justifyContent: 'center'
    },
    dialogPrimaryText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15,
    },
    dialogSecondaryButton: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#d9e0ec',
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center'
    },
    dialogSecondaryText: {
        color: '#233a67',
        fontWeight: '700',
    },
    buttonPressed: {
        opacity: 0.92,
        transform: [{ scale: 0.995 }],
    },
});
