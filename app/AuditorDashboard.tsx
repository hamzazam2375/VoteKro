import type { ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export default function AuditorDashboard() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 600;
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const userProfile = await serviceFactory.authService.getRequiredProfile('auditor');
                setProfile(userProfile);
            } catch (error) {
                Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to load profile'));
                router.replace('/AdminLogin');
            } finally {
                setIsLoading(false);
            }
        };

        void loadProfile();
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
                infoText={`Welcome, ${profile?.full_name?.split(' ')[0] || 'Auditor'}!`}
                actions={[
                    { label: 'Logout', onPress: handleLogout, variant: 'outline' },
                ]}
            />

            {/* Main Content */}
            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.innerWrapper}>
                    {/* Dashboard Title */}
                    <View style={styles.titleSection}>
                        <Text style={styles.dashboardTitle}>Auditor Dashboard</Text>
                        <Text style={styles.dashboardSubtitle}>Verify election integrity and blockchain transparency</Text>
                    </View>

                    {/* Stats Cards */}
                    <View style={[styles.statsContainer, isMobile && styles.statsContainerMobile]}>
                        <LinearGradient colors={['#e8f4fd', '#f5fafe']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.statCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth]}>
                            <Text style={styles.statLabel}>Total Blocks</Text>
                            <Text style={styles.statNumber}>3</Text>
                        </LinearGradient>
                        <LinearGradient colors={['#e8f4fd', '#f5fafe']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.statCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth]}>
                            <Text style={styles.statLabel}>Blockchain Status</Text>
                            <View style={styles.statusBadge}>
                                <Text style={styles.statusCheck}>✓</Text>
                                <Text style={styles.statusText}>Valid</Text>
                            </View>
                        </LinearGradient>
                        <LinearGradient colors={['#e8f4fd', '#f5fafe']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.statCard, isMobile ? styles.cardFullWidth : styles.cardThirdWidth]}>
                            <Text style={styles.statLabel}>Elections</Text>
                            <Text style={styles.statNumber}>1</Text>
                        </LinearGradient>
                    </View>

                    {/* Blockchain Verification Section */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, styles.blockchainLedgerTitle]}>Blockchain Verification</Text>
                        <View style={styles.verificationCard}>
                            <Text style={styles.verificationTitle}>Verify Blockchain Integrity</Text>
                            <Text style={styles.verificationDesc}>Check if the blockchain ledger has been tampered with. This will verify all smart contracts and transaction hashes.</Text>
                            <LinearGradient colors={['#1a73e8', '#5b9dd9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.verifyButton}>
                                <Pressable onPress={() => router.push('/AuditorBlockchainLedger')}>
                                    <Text style={styles.verifyButtonText}>🔐 View Blockchain Ledger</Text>
                                </Pressable>
                            </LinearGradient>
                        </View>
                    </View>

                    {/* Vote Count Verification Section */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, styles.blockchainLedgerTitle]}>Vote Count Verification</Text>
                        <View style={styles.verificationCard}>
                            <Text style={styles.verificationTitle}>Compare Blockchain vs Results</Text>
                            <Text style={styles.verificationDesc}>
                                Verify that vote counts in the blockchain match the computed election results. Detects any mismatches or inconsistencies.
                            </Text>
                            <LinearGradient
                                colors={['#4caf50', '#66bb6a']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.verifyButton}
                            >
                                <Pressable
                                    onPress={() => router.push('/AuditorVerifyVotes')}
                                >
                                    <Text style={styles.verifyButtonText}>
                                        ✓ Verify Vote Counts
                                    </Text>
                                </Pressable>
                            </LinearGradient>
                        </View>
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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusCheck: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#4caf50',
    },
    statusText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#4caf50',
    },
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 14,
        paddingBottom: 8,
        borderBottomWidth: 2,
        borderBottomColor: '#e91e63',
    },
    // Verification Section
    verificationCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    verificationTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 10,
    },
    verificationDesc: {
        fontSize: 13,
        color: '#666',
        lineHeight: 20,
        marginBottom: 16,
    },
    verifyButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 6,
        alignItems: 'center',
        alignSelf: 'flex-start',
        overflow: 'hidden',
    },
    verifyButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    // Election Results
    electionCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    electionName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 18,
    },
    candidatesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    candidateItem: {
        width: '31.5%',
        backgroundColor: '#f9f9f9',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    candidateName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    candidateParty: {
        fontSize: 12,
        color: '#666',
        marginBottom: 10,
    },
    voteBar: {
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        marginBottom: 8,
        overflow: 'hidden',
    },
    voteBarFill: {
        height: '100%',
    },
    voteCount: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    // Blockchain Ledger
    blocksList: {
        gap: 14,
    },
    blockCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        overflow: 'hidden',
    },
    blockHeader: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    blockTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    blockBody: {
        padding: 16,
        gap: 10,
    },
    blockInfo: {
        flexDirection: 'row',
    },
    blockLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1a1a1a',
        minWidth: 90,
    },
    blockValue: {
        fontSize: 12,
        color: '#666',
        flex: 1,
    },
    blockchainLedgerTitle: {
        color: '#1a73e8',
    },
    verificationContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        overflow: 'hidden',
    },
});
