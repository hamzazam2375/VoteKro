import type { ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export default function AdminDashboard() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 600;
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [auditorExists, setAuditorExists] = useState(false);

    useEffect(() => {
        const loadDashboardOverview = async () => {
            try {
                const overview = await serviceFactory.adminService.getDashboardOverview();
                setProfile(overview.profile);
                setAuditorExists(overview.auditorExists);
            } catch (error) {
                Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to load profile'));
                router.replace('/AdminLogin');
            } finally {
                setIsLoading(false);
            }
        };

        void loadDashboardOverview();
    }, [router]);

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
            <Navbar
                infoText={`Welcome, ${profile?.full_name ?? 'Administrator'}!`}
                actions={[
                    { label: 'Logout', onPress: handleLogout, variant: 'outline' },
                ]}
            />

            {/* Main Content */}
            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.innerWrapper}>
                    {/* Dashboard Title */}
                    <View style={styles.titleSection}>
                        <Text style={styles.dashboardTitle}>Admin Dashboard</Text>
                        <Text style={styles.dashboardSubtitle}>Manage elections and monitor voting activity</Text>
                    </View>

                    {/* Stats Cards */}
                    <View style={[styles.statsContainer, isMobile && styles.statsContainerMobile]}>
                        <View style={[styles.statCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth]}>
                            <Text style={styles.statLabel}>Total Elections</Text>
                            <Text style={styles.statNumber}>1</Text>
                        </View>
                        <View style={[styles.statCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth]}>
                            <Text style={styles.statLabel}>Registered Voters</Text>
                            <Text style={styles.statNumber}>0</Text>
                        </View>
                        <View style={[styles.statCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth]}>
                            <Text style={styles.statLabel}>Total Votes Cast</Text>
                            <Text style={styles.statNumber}>2</Text>
                        </View>
                    </View>

                    {/* Quick Actions */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
                        <View style={[styles.actionsGrid, isMobile && styles.actionsGridMobile]}>
                            <Pressable style={[styles.actionCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth] as any}>
                                <View style={styles.cardInner}>
                                    <LinearGradient colors={['#1a73e8', '#7c3aed', '#e91e8c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
                                    <View style={styles.cardBody}>
                                        <Text style={styles.actionIcon}>📋</Text>
                                        <Text style={styles.actionTitle}>Create New Election</Text>
                                        <Text style={styles.actionDesc}>Create and configure a new election event</Text>
                                        <View style={styles.actionBtn}>
                                            <Text style={styles.actionBtnText}>Create Election +</Text>
                                        </View>
                                    </View>
                                </View>
                            </Pressable>

                            <Pressable style={[styles.actionCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth] as any}>
                                <View style={styles.cardInner}>
                                    <LinearGradient colors={['#1a73e8', '#7c3aed', '#e91e8c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
                                    <View style={styles.cardBody}>
                                        <Text style={styles.actionIcon}>✏️</Text>
                                        <Text style={styles.actionTitle}>Manage Elections</Text>
                                        <Text style={styles.actionDesc}>Edit, delete, or update election details</Text>
                                        <View style={styles.actionBtn}>
                                            <Text style={styles.actionBtnText}>Manage Elections →</Text>
                                        </View>
                                    </View>
                                </View>
                            </Pressable>

                            <Pressable style={[styles.actionCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth] as any}>
                                <View style={styles.cardInner}>
                                    <LinearGradient colors={['#1a73e8', '#7c3aed', '#e91e8c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
                                    <View style={styles.cardBody}>
                                        <Text style={styles.actionIcon}>👤</Text>
                                        <Text style={styles.actionTitle}>Manage Candidates</Text>
                                        <Text style={styles.actionDesc}>Add, edit, or delete candidates</Text>
                                        <View style={styles.actionBtn}>
                                            <Text style={styles.actionBtnText}>Add Candidates +</Text>
                                        </View>
                                    </View>
                                </View>
                            </Pressable>

                            <Pressable style={[styles.actionCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth] as any}>
                                <View style={styles.cardInner}>
                                    <LinearGradient colors={['#1a73e8', '#7c3aed', '#e91e8c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
                                    <View style={styles.cardBody}>
                                        <Text style={styles.actionIcon}>📊</Text>
                                        <Text style={styles.actionTitle}>View Results</Text>
                                        <Text style={styles.actionDesc}>See voting results and statistics</Text>
                                        <View style={styles.actionBtn}>
                                            <Text style={styles.actionBtnText}>View Results →</Text>
                                        </View>
                                    </View>
                                </View>
                            </Pressable>

                            <Pressable style={[styles.actionCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth] as any}>
                                <View style={styles.cardInner}>
                                    <LinearGradient colors={['#1a73e8', '#7c3aed', '#e91e8c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
                                    <View style={styles.cardBody}>
                                        <Text style={styles.actionIcon}>✅</Text>
                                        <Text style={styles.actionTitle}>Register Voter</Text>
                                        <Text style={styles.actionDesc}>Create voter account with Gmail and random password</Text>
                                        <View style={styles.actionBtn}>
                                            <Text style={styles.actionBtnText}>Register Voter +</Text>
                                        </View>
                                    </View>
                                </View>
                            </Pressable>

                            {profile?.role === 'admin' && !auditorExists && (
                                <Pressable 
                                    style={[styles.actionCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth] as any}
                                    onPress={() => router.push('/AuditorSignup')}
                                >
                                    <View style={styles.cardInner}>
                                        <LinearGradient colors={['#1a73e8', '#7c3aed', '#e91e8c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
                                        <View style={styles.cardBody}>
                                            <Text style={styles.actionIcon}>🔍</Text>
                                            <Text style={styles.actionTitle}>Register Auditor</Text>
                                            <Text style={styles.actionDesc}>Create auditor account with Gmail and random password</Text>
                                            <View style={styles.actionBtn}>
                                                <Text style={styles.actionBtnText}>Register Auditor +</Text>
                                            </View>
                                        </View>
                                    </View>
                                </Pressable>
                            )}
                        </View>
                    </View>

                    {/* Active Elections Table */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📊 Active Elections</Text>
                        {isMobile ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={[styles.tableContainer, { minWidth: 600 }]}>
                                    {/* Table Header */}
                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.tableHeaderCell, { flex: 2, minWidth: 140 }]}>Election Name</Text>
                                        <View style={styles.headerDivider} />
                                        <Text style={[styles.tableHeaderCell, { flex: 1, minWidth: 70 }]}>Status</Text>
                                        <View style={styles.headerDivider} />
                                        <Text style={[styles.tableHeaderCell, { flex: 1, minWidth: 90 }]}>Start Date</Text>
                                        <View style={styles.headerDivider} />
                                        <Text style={[styles.tableHeaderCell, { flex: 1, minWidth: 90 }]}>End Date</Text>
                                        <View style={styles.headerDivider} />
                                        <Text style={[styles.tableHeaderCell, { flex: 1, minWidth: 80 }]}>Candidates</Text>
                                        <View style={styles.headerDivider} />
                                        <Text style={[styles.tableHeaderCell, { flex: 1, minWidth: 80 }]}>Results</Text>
                                    </View>
                                    {/* Empty State */}
                                    <View style={styles.emptyState}>
                                        <Text style={styles.emptyText}>No active elections</Text>
                                    </View>
                                </View>
                            </ScrollView>
                        ) : (
                            <View style={styles.tableContainer}>
                                {/* Table Header */}
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Election Name</Text>
                                    <View style={styles.headerDivider} />
                                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                                    <View style={styles.headerDivider} />
                                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Start Date</Text>
                                    <View style={styles.headerDivider} />
                                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>End Date</Text>
                                    <View style={styles.headerDivider} />
                                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Candidates</Text>
                                    <View style={styles.headerDivider} />
                                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Results</Text>
                                </View>
                                {/* Empty State */}
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>No active elections</Text>
                                </View>
                            </View>
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
        backgroundColor: '#f5f5f5',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    // Logout confirmation modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBox: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 28,
        width: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 10,
    },
    modalMessage: {
        fontSize: 15,
        color: '#444',
        marginBottom: 24,
        lineHeight: 22,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    modalCancelBtn: {
        paddingVertical: 9,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#ccc',
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
    },
    modalLogoutBtn: {
        paddingVertical: 9,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: '#d32f2f',
    },
    modalLogoutText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
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
        maxWidth: 1100,
    },
    titleSection: {
        marginBottom: 20,
    },
    dashboardTitle: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    dashboardSubtitle: {
        fontSize: 14,
        color: '#666',
    },
    // Stats cards
    statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 28,
    },
    statsContainerMobile: {
        flexDirection: 'column',
    },
    cardThirdWidth: {
        width: '31.5%',
    },
    cardFullWidth: {
        width: '100%',
    },
    statCard: {
        backgroundColor: '#e3f2fd',
        padding: 28,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#90caf9',
        shadowColor: '#1a73e8',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    statLabel: {
        fontSize: 13,
        color: '#1a73e8',
        marginBottom: 14,
        fontWeight: '600',
    },
    statNumber: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#1a73e8',
    },
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    sectionUnderline: {
        height: 3,
        width: 55,
        backgroundColor: '#1a73e8',
        borderRadius: 2,
        marginBottom: 16,
    },
    // 3-per-row action cards
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    actionsGridMobile: {
        flexDirection: 'column',
    },
    actionCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    actionCardPressed: {
        opacity: 0.85,
    },
    cardInner: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    cardStripe: {
        height: 5,
    },
    cardBody: {
        padding: 22,
    },
    actionIcon: {
        fontSize: 30,
        marginBottom: 12,
    },
    actionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 6,
    },
    actionDesc: {
        fontSize: 12,
        color: '#666',
        lineHeight: 17,
        marginBottom: 18,
        flex: 1,
    },
    actionBtn: {
        backgroundColor: '#1a73e8',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    // Elections table
    tableContainer: {
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#bbdefb',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#90caf9',
    },
    tableHeaderCell: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0d47a1',
    },
    headerDivider: {
        width: 1,
        backgroundColor: '#90caf9',
        marginVertical: 2,
        marginHorizontal: 8,
    },
    emptyState: {
        paddingVertical: 36,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 15,
        color: '#999',
        fontWeight: '500',
    },
});
