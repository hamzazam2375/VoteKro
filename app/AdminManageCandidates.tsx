import type { CandidateRow, ElectionRow, ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { toast } from 'react-toastify';

function blurActiveElementOnWeb() {
    if (Platform.OS !== 'web') {
        return;
    }

    const activeElement = (globalThis as { document?: { activeElement?: { blur?: () => void } } }).document?.activeElement;
    activeElement?.blur?.();
}

export default function AdminManageCandidates() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 760;

    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [elections, setElections] = useState<ElectionRow[]>([]);
    const [candidatesByElection, setCandidatesByElection] = useState<Record<string, CandidateRow[]>>({});
    const [manualPartiesByElection, setManualPartiesByElection] = useState<Record<string, string[]>>({});

    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const [showAddPartyModal, setShowAddPartyModal] = useState(false);
    const [addPartyElectionId, setAddPartyElectionId] = useState('');
    const [addPartyName, setAddPartyName] = useState('');
    const [addPartyAffiliation, setAddPartyAffiliation] = useState('');

    const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
    const [addCandidateElectionId, setAddCandidateElectionId] = useState('');
    const [addCandidateName, setAddCandidateName] = useState('');
    const [addCandidateParty, setAddCandidateParty] = useState('');

    const [showEditCandidateModal, setShowEditCandidateModal] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null);
    const [editCandidateName, setEditCandidateName] = useState('');
    const [editCandidateParty, setEditCandidateParty] = useState('');

    const [showDeleteCandidateModal, setShowDeleteCandidateModal] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const userProfile = await serviceFactory.authService.getRequiredProfile('admin');
            setProfile(userProfile);

            const electionRows = await serviceFactory.adminService.listElections();
            setElections(electionRows);

            const candidateEntries = await Promise.all(
                electionRows.map(async (election) => {
                    const rows = await serviceFactory.adminService.getElectionCandidates(election.id);
                    return [election.id, rows] as const;
                })
            );

            setCandidatesByElection(Object.fromEntries(candidateEntries));
        } catch (error) {
            const message = serviceFactory.authService.getErrorMessage(error, 'Failed to load candidates');
            toast.error(message);
            router.replace('/AdminLogin');
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useFocusEffect(
        useCallback(() => {
            void loadData();
            return () => undefined;
        }, [loadData])
    );

    const partiesByElection = useMemo(() => {
        const result: Record<string, string[]> = {};

        elections.forEach((election) => {
            const fromCandidates = (candidatesByElection[election.id] ?? [])
                .map((candidate) => candidate.party_name?.trim())
                .filter((party): party is string => !!party);
            const fromManual = manualPartiesByElection[election.id] ?? [];

            result[election.id] = Array.from(new Set([...fromCandidates, ...fromManual]));
        });

        return result;
    }, [candidatesByElection, elections, manualPartiesByElection]);

    const getElectionName = (electionId: string) => {
        return elections.find((election) => election.id === electionId)?.title ?? 'Unknown election';
    };

    const getNextCandidateNumber = (electionId: string) => {
        const currentCandidates = candidatesByElection[electionId] ?? [];
        if (currentCandidates.length === 0) {
            return 1;
        }

        const maxNumber = currentCandidates.reduce((maxValue, candidate) => {
            return candidate.candidate_number > maxValue ? candidate.candidate_number : maxValue;
        }, 0);

        return maxNumber + 1;
    };

    const openAddPartyModal = (electionId: string) => {
        setAddPartyElectionId(electionId);
        setAddPartyName('');
        setAddPartyAffiliation('');
        setShowAddPartyModal(true);
    };

    const openAddCandidateModal = (electionId: string) => {
        const partyOptions = partiesByElection[electionId] ?? [];
        setAddCandidateElectionId(electionId);
        setAddCandidateName('');
        setAddCandidateParty(partyOptions[0] ?? '');
        setShowAddCandidateModal(true);
    };

    const openEditCandidateModal = (candidate: CandidateRow) => {
        setSelectedCandidate(candidate);
        setEditCandidateName(candidate.display_name);
        setEditCandidateParty(candidate.party_name ?? '');
        setShowEditCandidateModal(true);
    };

    const openDeleteCandidateModal = (candidate: CandidateRow) => {
        setSelectedCandidate(candidate);
        setShowDeleteCandidateModal(true);
    };

    const closeAddPartyModal = () => {
        blurActiveElementOnWeb();
        setShowAddPartyModal(false);
    };

    const closeAddCandidateModal = () => {
        blurActiveElementOnWeb();
        setShowAddCandidateModal(false);
    };

    const closeEditCandidateModal = () => {
        blurActiveElementOnWeb();
        setShowEditCandidateModal(false);
    };

    const closeDeleteCandidateModal = () => {
        blurActiveElementOnWeb();
        setShowDeleteCandidateModal(false);
    };

    const handleAddParty = () => {
        const electionId = addPartyElectionId.trim();
        const partyName = addPartyName.trim();
        const affiliation = addPartyAffiliation.trim();

        if (!electionId || !partyName) {
            Alert.alert('Missing information', 'Election and party name are required.');
            return;
        }

        const partyLabel = affiliation ? `${partyName} (${affiliation})` : partyName;

        setManualPartiesByElection((prev) => {
            const current = prev[electionId] ?? [];
            const alreadyExists = current.some((party) => party.toLowerCase() === partyLabel.toLowerCase());
            if (alreadyExists) {
                return prev;
            }

            return {
                ...prev,
                [electionId]: [...current, partyLabel],
            };
        });

        if (addCandidateElectionId === electionId && !addCandidateParty) {
            setAddCandidateParty(partyLabel);
        }

        toast.success('Party added to election list');
        closeAddPartyModal();
    };

    const handleAddCandidate = async () => {
        const electionId = addCandidateElectionId.trim();
        const candidateName = addCandidateName.trim();
        const partyName = addCandidateParty.trim();

        if (!electionId || !candidateName) {
            Alert.alert('Missing information', 'Candidate name and election are required.');
            return;
        }

        try {
            await serviceFactory.adminService.addCandidate({
                electionId,
                displayName: candidateName,
                partyName: partyName || undefined,
                candidateNumber: getNextCandidateNumber(electionId),
            });

            toast.success('Candidate added successfully');
            closeAddCandidateModal();
            void loadData();
        } catch (error) {
            Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to add candidate'));
        }
    };

    const handleEditCandidate = async () => {
        if (!selectedCandidate) {
            return;
        }

        const candidateName = editCandidateName.trim();
        const partyName = editCandidateParty.trim();

        if (!candidateName) {
            Alert.alert('Missing information', 'Candidate name is required.');
            return;
        }

        try {
            await serviceFactory.adminService.updateCandidate({
                candidateId: selectedCandidate.id,
                displayName: candidateName,
                partyName: partyName || undefined,
            });

            toast.success('Candidate updated successfully');
            closeEditCandidateModal();
            void loadData();
        } catch (error) {
            Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to update candidate'));
        }
    };

    const handleDeleteCandidate = async () => {
        if (!selectedCandidate) {
            return;
        }

        try {
            await serviceFactory.adminService.deleteCandidate(selectedCandidate.id);
            toast.success('Candidate deleted successfully');
            closeDeleteCandidateModal();
            void loadData();
        } catch (error) {
            Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to delete candidate'));
        }
    };

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            setShowLogoutModal(true);
            return;
        }

        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: () => void doLogout() },
        ]);
    };

    const doLogout = async () => {
        setShowLogoutModal(false);
        try {
            await serviceFactory.authService.signOut();
            router.replace('/');
        } catch (error) {
            Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to logout'));
        }
    };

    if (isLoading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#1a73e8" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Modal transparent visible={showLogoutModal} animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Logout</Text>
                        <Text style={styles.modalMessage}>Are you sure you want to logout?</Text>
                        <View style={styles.modalButtons}>
                            <Pressable style={styles.modalCancelBtn} onPress={() => setShowLogoutModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.modalDeleteBtn} onPress={() => void doLogout()}>
                                <Text style={styles.modalDeleteText}>Logout</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal transparent visible={showAddPartyModal} animationType="fade" onRequestClose={closeAddPartyModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBoxLarge}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Add Party</Text>
                            <Pressable style={styles.closeModalBtn} onPress={closeAddPartyModal}>
                                <Text style={styles.closeModalText}>x</Text>
                            </Pressable>
                        </View>

                        <Text style={styles.inputLabel}>Election</Text>
                        <Text style={styles.selectionLabel}>{getElectionName(addPartyElectionId)}</Text>

                        <Text style={styles.inputLabel}>Party Name</Text>
                        <TextInput
                            style={styles.input}
                            value={addPartyName}
                            onChangeText={setAddPartyName}
                            placeholder="Enter party name"
                            placeholderTextColor="#9ca3af"
                        />

                        <Text style={styles.inputLabel}>Affiliation Type (optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={addPartyAffiliation}
                            onChangeText={setAddPartyAffiliation}
                            placeholder="National, Regional, Independent"
                            placeholderTextColor="#9ca3af"
                        />

                        <Pressable style={styles.primaryActionBtn} onPress={() => void handleAddParty()}>
                            <Text style={styles.primaryActionText}>Save Party</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            <Modal transparent visible={showAddCandidateModal} animationType="fade" onRequestClose={closeAddCandidateModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBoxLarge}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Add Candidate</Text>
                            <Pressable style={styles.closeModalBtn} onPress={closeAddCandidateModal}>
                                <Text style={styles.closeModalText}>x</Text>
                            </Pressable>
                        </View>

                        <Text style={styles.inputLabel}>Candidate Name</Text>
                        <TextInput
                            style={styles.input}
                            value={addCandidateName}
                            onChangeText={setAddCandidateName}
                            placeholder="Full name of candidate"
                            placeholderTextColor="#9ca3af"
                        />

                        <Text style={styles.inputLabel}>Election List</Text>
                        <View style={styles.optionListWrap}>
                            {elections.map((election) => {
                                const selected = addCandidateElectionId === election.id;
                                return (
                                    <Pressable
                                        key={election.id}
                                        style={[styles.optionChip, selected && styles.optionChipSelected]}
                                        onPress={() => {
                                            setAddCandidateElectionId(election.id);
                                            const firstParty = partiesByElection[election.id]?.[0] ?? '';
                                            setAddCandidateParty(firstParty);
                                        }}
                                    >
                                        <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{election.title}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={styles.inputLabel}>Parties List</Text>
                        <View style={styles.optionListWrap}>
                            {(partiesByElection[addCandidateElectionId] ?? []).length === 0 ? (
                                <Text style={styles.helperText}>No party saved for this election yet. You can still add candidate without party.</Text>
                            ) : (
                                (partiesByElection[addCandidateElectionId] ?? []).map((party) => {
                                    const selected = addCandidateParty === party;
                                    return (
                                        <Pressable
                                            key={party}
                                            style={[styles.optionChip, selected && styles.optionChipSelected]}
                                            onPress={() => setAddCandidateParty(party)}
                                        >
                                            <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{party}</Text>
                                        </Pressable>
                                    );
                                })
                            )}
                        </View>

                        <Text style={styles.inputLabel}>Or Enter Party/Affiliation (optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={addCandidateParty}
                            onChangeText={setAddCandidateParty}
                            placeholder="Type party or leave blank"
                            placeholderTextColor="#9ca3af"
                        />

                        <Pressable style={styles.primaryActionBtn} onPress={() => void handleAddCandidate()}>
                            <Text style={styles.primaryActionText}>Save Candidate</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            <Modal transparent visible={showEditCandidateModal} animationType="fade" onRequestClose={closeEditCandidateModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBoxLarge}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Edit Candidate</Text>
                            <Pressable style={styles.closeModalBtn} onPress={closeEditCandidateModal}>
                                <Text style={styles.closeModalText}>x</Text>
                            </Pressable>
                        </View>

                        <Text style={styles.inputLabel}>Candidate Name</Text>
                        <TextInput
                            style={styles.input}
                            value={editCandidateName}
                            onChangeText={setEditCandidateName}
                            placeholder="Candidate name"
                            placeholderTextColor="#9ca3af"
                        />

                        <Text style={styles.inputLabel}>Party/Affiliation</Text>
                        <TextInput
                            style={styles.input}
                            value={editCandidateParty}
                            onChangeText={setEditCandidateParty}
                            placeholder="Candidate party"
                            placeholderTextColor="#9ca3af"
                        />

                        <Pressable style={styles.primaryActionBtn} onPress={() => void handleEditCandidate()}>
                            <Text style={styles.primaryActionText}>Update Candidate</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            <Modal transparent visible={showDeleteCandidateModal} animationType="fade" onRequestClose={closeDeleteCandidateModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Delete Candidate</Text>
                        <Text style={styles.modalMessage}>Delete {selectedCandidate?.display_name}? This action cannot be undone.</Text>
                        <View style={styles.modalButtons}>
                            <Pressable style={styles.modalCancelBtn} onPress={closeDeleteCandidateModal}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.modalDeleteBtn} onPress={() => void handleDeleteCandidate()}>
                                <Text style={styles.modalDeleteText}>Delete</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Navbar
                infoText={`Welcome, ${profile?.full_name ?? 'Administrator'}!`}
                actions={[{ label: 'Logout', onPress: handleLogout, variant: 'outline' }]}
            />

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <Pressable style={styles.backButton} onPress={() => router.replace('/AdminDashboard')}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </Pressable>

                <View style={styles.innerWrapper}>
                    <View style={styles.titleSection}>
                        <Text style={styles.pageTitle}>👤 Manage Candidates</Text>
                        <Text style={styles.pageSubtitle}>Candidates grouped by election with party and candidate controls.</Text>
                    </View>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Candidates by Election</Text>
                    </View>

                    <View style={styles.electionCardsWrap}>
                        {elections.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateTitle}>No elections available</Text>
                                <Text style={styles.emptyStateText}>Create an election first, then add candidates.</Text>
                            </View>
                        ) : (
                            elections.map((election) => {
                                const candidateRows = candidatesByElection[election.id] ?? [];
                                return (
                                    <View key={election.id} style={styles.electionCard}>
                                        <View style={[styles.electionCardHeader, isMobile && styles.electionCardHeaderMobile]}>
                                            <View style={styles.electionMeta}>
                                                <Text style={styles.electionTitle}>{election.title}</Text>
                                                <Text style={styles.electionSubInfo}>Candidates: {candidateRows.length}</Text>
                                            </View>

                                            <View style={[styles.actionInputCards, isMobile && styles.actionInputCardsMobile]}>
                                                <Pressable style={styles.addCandidateCardBtn} onPress={() => openAddCandidateModal(election.id)}>
                                                    <Text style={styles.addCardBtnTitle}>Add Candidate</Text>
                                                    <Text style={styles.addCardBtnHint}>Name, election, party</Text>
                                                </Pressable>
                                                <Pressable style={styles.addPartyCardBtn} onPress={() => openAddPartyModal(election.id)}>
                                                    <Text style={styles.addCardBtnTitle}>Add Party</Text>
                                                    <Text style={styles.addCardBtnHint}>Party and affiliation</Text>
                                                </Pressable>
                                            </View>
                                        </View>

                                        <View style={styles.candidateListWrap}>
                                            {candidateRows.length === 0 ? (
                                                <Text style={styles.noCandidateText}>No candidates in this election yet.</Text>
                                            ) : (
                                                candidateRows.map((candidate) => (
                                                    <View key={candidate.id} style={[styles.candidateRow, isMobile && styles.candidateRowMobile]}>
                                                        <View style={styles.candidateInfoCol}>
                                                            <Text style={styles.candidateName}>{candidate.display_name}</Text>
                                                            <Text style={styles.candidatePartyText}>{candidate.party_name ?? 'Independent'}</Text>
                                                        </View>

                                                        <View style={styles.rowButtons}>
                                                            <Pressable style={styles.editMiniBtn} onPress={() => openEditCandidateModal(candidate)}>
                                                                <Text style={styles.editMiniBtnText}>Edit</Text>
                                                            </Pressable>
                                                            <Pressable style={styles.deleteMiniBtn} onPress={() => openDeleteCandidateModal(candidate)}>
                                                                <Text style={styles.deleteMiniBtnText}>Delete</Text>
                                                            </Pressable>
                                                        </View>
                                                    </View>
                                                ))
                                            )}
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    loadingText: {
        marginTop: 10,
        color: '#6b7280',
        fontSize: 15,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingTop: 18,
        paddingHorizontal: 16,
        paddingBottom: 32,
        alignItems: 'stretch',
    },
    backButton: {
        alignSelf: 'flex-start',
        borderWidth: 1.5,
        borderColor: '#2e63e3',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 14,
        backgroundColor: '#ffffff',
        marginBottom: 22,
        marginLeft: 10,
    },
    backButtonText: {
        color: '#2e63e3',
        fontSize: 13,
        fontWeight: '600',
    },
    innerWrapper: {
        width: '100%',
        maxWidth: 980,
        alignSelf: 'center',
    },
    titleSection: {
        marginBottom: 18,
    },
    pageTitle: {
        fontSize: 38,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    pageSubtitle: {
        fontSize: 14,
        color: '#64748b',
    },
    sectionHeader: {
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2456d8',
    },
    electionCardsWrap: {
        gap: 14,
    },
    electionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#2e63e3',
        padding: 20,
        shadowColor: '#2e63e3',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
    },
    electionCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    electionCardHeaderMobile: {
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    electionMeta: {
        flex: 1,
        minWidth: 180,
    },
    electionTitle: {
        fontSize: 26,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    electionSubInfo: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '600',
    },
    actionInputCards: {
        flexDirection: 'row',
        gap: 8,
    },
    actionInputCardsMobile: {
        flexDirection: 'column',
        width: '100%',
    },
    addCandidateCardBtn: {
        backgroundColor: '#eaf2ff',
        borderWidth: 1,
        borderColor: '#125aea',
        borderRadius: 10,
        paddingVertical: 9,
        paddingHorizontal: 12,
        minWidth: 150,
    },
    addPartyCardBtn: {
        backgroundColor: '#e9f9ef',
        borderWidth: 1,
        borderColor: '#167532',
        borderRadius: 10,
        paddingVertical: 9,
        paddingHorizontal: 12,
        minWidth: 150,
    },
    addCardBtnTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 2,
    },
    addCardBtnHint: {
        fontSize: 11,
        color: '#64748b',
    },
    candidateListWrap: {
        gap: 8,
    },
    noCandidateText: {
        paddingVertical: 12,
        fontSize: 13,
        color: '#6b7280',
    },
    candidateRow: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#f8fafc',
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    candidateRowMobile: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    candidateInfoCol: {
        flex: 1,
    },
    candidateName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    candidatePartyText: {
        fontSize: 12,
        color: '#6b7280',
    },
    rowButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    editMiniBtn: {
        backgroundColor: '#e11d8d',
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    editMiniBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    deleteMiniBtn: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#ff5a5f',
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    deleteMiniBtnText: {
        color: '#ff5a5f',
        fontSize: 14,
        fontWeight: '700',
    },
    emptyState: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        alignItems: 'center',
        paddingVertical: 28,
        paddingHorizontal: 20,
    },
    emptyStateTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    emptyStateText: {
        fontSize: 13,
        color: '#6b7280',
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.42)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBox: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 20,
        width: '90%',
        maxWidth: 420,
    },
    modalBoxLarge: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 20,
        width: '92%',
        maxWidth: 520,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    closeModalBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeModalText: {
        fontSize: 18,
        lineHeight: 18,
        color: '#475569',
        fontWeight: '700',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1f2937',
    },
    modalMessage: {
        marginTop: 8,
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
        marginBottom: 16,
    },
    inputLabel: {
        marginTop: 10,
        marginBottom: 5,
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    selectionLabel: {
        borderWidth: 1,
        borderColor: '#dbe2ea',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#111827',
        fontSize: 13,
    },
    input: {
        height: 42,
        borderWidth: 1,
        borderColor: '#d9dee7',
        borderRadius: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f8fafc',
        color: '#111827',
        fontSize: 13,
    },
    optionListWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 2,
    },
    optionChip: {
        borderWidth: 1,
        borderColor: '#cfd8e3',
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#ffffff',
    },
    optionChipSelected: {
        borderColor: '#2e63e3',
        backgroundColor: '#e9f0ff',
    },
    optionChipText: {
        color: '#334155',
        fontSize: 12,
        fontWeight: '600',
    },
    optionChipTextSelected: {
        color: '#1d4ed8',
    },
    helperText: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 18,
    },
    primaryActionBtn: {
        marginTop: 16,
        backgroundColor: '#2e63e3',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    primaryActionText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    modalButtons: {
        marginTop: 6,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    modalCancelBtn: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingVertical: 9,
        paddingHorizontal: 14,
    },
    modalCancelText: {
        color: '#374151',
        fontSize: 13,
        fontWeight: '600',
    },
    modalDeleteBtn: {
        backgroundColor: '#dc2626',
        borderRadius: 8,
        paddingVertical: 9,
        paddingHorizontal: 14,
    },
    modalDeleteText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
});