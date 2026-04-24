import type { ElectionRow, ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { toast } from 'react-toastify';

export default function AdminManageElections() {
    const router = useRouter();
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [elections, setElections] = useState<ElectionRow[]>([]);
    const [selectedElection, setSelectedElection] = useState<ElectionRow | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const userProfile = await serviceFactory.authService.getRequiredProfile('admin');
            setProfile(userProfile);

            const electionRows = await serviceFactory.adminService.listElections();
            setElections(electionRows);
        } catch (error) {
            const message = serviceFactory.authService.getErrorMessage(error, 'Failed to load data');
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

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            setShowLogoutModal(true);
        } else {
            Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Logout', style: 'destructive', onPress: doLogout },
                ]
            );
        }
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

    const openEditModal = (election: ElectionRow) => {
        setSelectedElection(election);
        setEditTitle(election.title);
        setEditDescription(election.description || '');
        setShowEditModal(true);
    };

    const openDeleteModal = (election: ElectionRow) => {
        setSelectedElection(election);
        setShowDeleteModal(true);
    };

    const handleUpdateElection = async () => {
        if (!selectedElection) return;

        const trimmedTitle = editTitle.trim();
        if (!trimmedTitle) {
            Alert.alert('Error', 'Election title is required');
            return;
        }

        const startsAtIso = toIsoDate(selectedElection.starts_at);
        const endsAtIso = toIsoDate(selectedElection.ends_at);

        if (!startsAtIso || !endsAtIso) {
            Alert.alert('Error', 'Invalid date format. Use YYYY-MM-DD.');
            return;
        }

        if (new Date(endsAtIso).getTime() <= new Date(startsAtIso).getTime()) {
            Alert.alert('Error', 'End date must be after start date.');
            return;
        }

        const now = Date.now();
        let status: ElectionRow['status'] = 'draft';
        if (new Date(startsAtIso).getTime() > now) {
            status = 'draft';
        } else if (new Date(endsAtIso).getTime() < now) {
            status = 'closed';
        } else {
            status = 'open';
        }

        try {
            await serviceFactory.adminService.updateElection({
                electionId: selectedElection.id,
                title: trimmedTitle,
                description: editDescription.trim() || undefined,
                startsAtIso,
                endsAtIso,
                status,
            });
            toast.success('Election updated successfully');
            setShowEditModal(false);
            void loadData();
        } catch (error) {
            Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to update election'));
        }
    };

    const handleDeleteElection = async () => {
        if (!selectedElection) return;

        try {
            await serviceFactory.adminService.deleteElection(selectedElection.id);
            toast.success('Election deleted successfully');
            setShowDeleteModal(false);
            void loadData();
        } catch (error) {
            Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to delete election'));
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getElectionStatus = (election: ElectionRow) => {
        const now = Date.now();
        const startsAt = new Date(election.starts_at).getTime();
        const endsAt = new Date(election.ends_at).getTime();

        if (now < startsAt) {
            return { label: 'Upcoming', color: '#f59e0b' };
        } else if (now > endsAt) {
            return { label: 'Ended', color: '#6b7280' };
        } else {
            return { label: 'Active', color: '#10b981' };
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
            {/* Logout confirmation modal (web) */}
            <Modal transparent visible={showLogoutModal} animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Logout</Text>
                        <Text style={styles.modalMessage}>Are you sure you want to logout?</Text>
                        <View style={styles.modalButtons}>
                            <Pressable style={styles.modalCancelBtn} onPress={() => setShowLogoutModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.modalLogoutBtn} onPress={doLogout}>
                                <Text style={styles.modalLogoutText}>Logout</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Election Modal */}
            <Modal transparent visible={showEditModal} animationType="fade" onRequestClose={() => setShowEditModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Edit Election</Text>
                        <Text style={styles.inputLabel}>Title</Text>
                        <TextInput
                            style={styles.input}
                            value={editTitle}
                            onChangeText={setEditTitle}
                            placeholder="Election title"
                            placeholderTextColor="#9ca3af"
                        />
                        <Text style={styles.inputLabel}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={editDescription}
                            onChangeText={setEditDescription}
                            placeholder="Election description"
                            placeholderTextColor="#9ca3af"
                            multiline
                            numberOfLines={4}
                        />
                        <Text style={styles.inputLabel}>Start Date</Text>
                        <TextInput
                            style={styles.input}
                            value={selectedElection?.starts_at}
                            onChangeText={(value) => setSelectedElection((prev) => prev ? { ...prev, starts_at: value } : prev)}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#9ca3af"
                        />
                        <Text style={styles.inputLabel}>End Date</Text>
                        <TextInput
                            style={styles.input}
                            value={selectedElection?.ends_at}
                            onChangeText={(value) => setSelectedElection((prev) => prev ? { ...prev, ends_at: value } : prev)}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#9ca3af"
                        />

                        <View style={styles.modalButtons}>
                            <Pressable style={styles.modalCancelBtn} onPress={() => setShowEditModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={styles.modalSaveBtn}
                                onPress={async () => {
                                    if (!selectedElection) return;

                                    const startsAtIso = toIsoDate(selectedElection.starts_at);
                                    const endsAtIso = toIsoDate(selectedElection.ends_at);

                                    if (!startsAtIso || !endsAtIso) {
                                        Alert.alert('Error', 'Invalid date format. Use YYYY-MM-DD.');
                                        return;
                                    }

                                    if (new Date(endsAtIso).getTime() <= new Date(startsAtIso).getTime()) {
                                        Alert.alert('Error', 'End date must be after start date.');
                                        return;
                                    }

                                    const now = Date.now();
                                    let status: ElectionRow['status'] = 'draft';
                                    if (new Date(startsAtIso).getTime() > now) {
                                        status = 'draft';
                                    } else if (new Date(endsAtIso).getTime() < now) {
                                        status = 'closed';
                                    } else {
                                        status = 'open';
                                    }

                                    try {
                                        await serviceFactory.adminService.updateElection({
                                            electionId: selectedElection.id,
                                            title: editTitle.trim(),
                                            description: editDescription.trim() || undefined,
                                            startsAtIso,
                                            endsAtIso,
                                            status,
                                        });
                                        toast.success('Election updated successfully');
                                        setShowEditModal(false);
                                        void loadData();
                                    } catch (error) {
                                        Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to update election'));
                                    }
                                }}
                            >
                                <Text style={styles.modalSaveText}>Save</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal transparent visible={showDeleteModal} animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Delete Election</Text>
                        <Text style={styles.modalMessage}>
                            Are you sure you want to delete "{selectedElection?.title}"? This action cannot be undone.
                        </Text>
                        <View style={styles.modalButtons}>
                            <Pressable style={styles.modalCancelBtn} onPress={() => setShowDeleteModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.modalDeleteBtn} onPress={handleDeleteElection}>
                                <Text style={styles.modalDeleteText}>Delete</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Navbar
                infoText={`Welcome, ${profile?.full_name ?? 'Administrator'}!`}
                actions={[
                    { label: 'Back', onPress: () => router.replace('/AdminDashboard'), variant: 'outline' },
                    { label: 'Logout', onPress: handleLogout, variant: 'outline' },
                ]}
            />

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.innerWrapper}>
                    <View style={styles.titleSection}>
                        <Text style={styles.dashboardTitle}>Manage Elections</Text>
                        <Text style={styles.dashboardSubtitle}>Edit, delete, or manage election details</Text>
                    </View>

                    {elections.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📋</Text>
                            <Text style={styles.emptyTitle}>No Elections Yet</Text>
                            <Text style={styles.emptyDesc}>Create your first election to get started</Text>
                            <Pressable style={styles.createBtn} onPress={() => router.push('/AdminCreateElection')}>
                                <Text style={styles.createBtnText}>Create Election</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.electionsList}>
                            {elections.map((election) => {
                                const status = getElectionStatus(election);
                                return (
                                    <View key={election.id} style={styles.electionCard}>
                                        <View style={styles.electionHeader}>
                                            <Text style={styles.electionTitle}>{election.title}</Text>
                                            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                                                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                                            </View>
                                        </View>
                                        {election.description && (
                                            <Text style={styles.electionDescription}>{election.description}</Text>
                                        )}
                                        <View style={styles.electionDates}>
                                            <Text style={styles.dateLabel}>Dates: {formatDate(election.starts_at)} to {formatDate(election.ends_at)}</Text>
                                            <Text style={styles.dateLabel}>Candidates: 3</Text>
                                        </View>
                                        <View style={styles.electionActions}>
                                            <Pressable style={styles.editBtn} onPress={() => openEditModal(election)}>
                                                <Text style={styles.editBtnText}>Edit</Text>
                                            </Pressable>
                                            <Pressable style={styles.deleteBtn} onPress={() => openDeleteModal(election)}>
                                                <Text style={styles.deleteBtnText}>Delete</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
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
        marginTop: 12,
        fontSize: 16,
        color: '#6b7280',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    innerWrapper: {
        maxWidth: 800,
        marginHorizontal: 'auto',
        width: '100%',
    },
    titleSection: {
        marginBottom: 24,
    },
    dashboardTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    dashboardSubtitle: {
        fontSize: 16,
        color: '#6b7280',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 24,
    },
    createBtn: {
        backgroundColor: '#1a73e8',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    createBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    electionsList: {
        gap: 16,
    },
    electionCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    electionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    electionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    electionDescription: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 12,
    },
    electionDates: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    dateLabel: {
        fontSize: 13,
        color: '#6b7280',
    },
    electionActions: {
        flexDirection: 'row',
        gap: 12,
    },
    editBtn: {
        backgroundColor: '#1a73e8',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    editBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    deleteBtn: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    deleteBtnText: {
        color: '#dc2626',
        fontSize: 14,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBox: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        width: '90%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    modalMessage: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        marginBottom: 16,
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 8,
    },
    modalCancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#d1d5db',
    },
    modalCancelText: {
        fontSize: 14,
        color: '#374151',
    },
    modalSaveBtn: {
        backgroundColor: '#1a73e8',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
    },
    modalSaveText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    modalLogoutBtn: {
        backgroundColor: '#dc2626',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
    },
    modalLogoutText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    modalDeleteBtn: {
        backgroundColor: '#dc2626',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
    },
    modalDeleteText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
});