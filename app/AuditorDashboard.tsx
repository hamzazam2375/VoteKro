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
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const userProfile = await serviceFactory.authService.getCurrentProfile();
            if (!userProfile) {
                Alert.alert('Error', 'Not authenticated');
                router.replace('/AdminLogin');
                return;
            }
            if (userProfile.role !== 'auditor') {
                Alert.alert('Error', 'Access denied. Auditor role required.');
                router.replace('/AdminLogin');
                return;
            }
            setProfile(userProfile);
        } catch (error) {
            console.error('Error loading profile:', error);
            Alert.alert('Error', 'Failed to load profile');
            router.replace('/AdminLogin');
        } finally {
            setIsLoading(false);
        }
    };

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
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout');
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
                                <Pressable>
                                    <Text style={styles.verifyButtonText}>🔐 Block Verification</Text>
                                </Pressable>
                            </LinearGradient>
                        </View>
                    </View>

                    {/* Election Results Section */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, styles.blockchainLedgerTitle]}>Election Results</Text>
                        <View style={styles.electionCard}>
                            <Text style={styles.electionName}>Presidential Election 2024</Text>
                            <View style={styles.candidatesContainer}>
                                <View style={styles.candidateItem}>
                                    <Text style={styles.candidateName}>Ali Khan</Text>
                                    <Text style={styles.candidateParty}>Democratic Party</Text>
                                    <View style={styles.voteBar}>
                                        <LinearGradient colors={['#1a73e8', '#5b9dd9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.voteBarFill, { width: '60%' }]} />
                                    </View>
                                    <Text style={styles.voteCount}>198 (23.3%)</Text>
                                </View>

                                <View style={styles.candidateItem}>
                                    <Text style={styles.candidateName}>Hassan Malik</Text>
                                    <Text style={styles.candidateParty}>Republican Party</Text>
                                    <View style={styles.voteBar}>
                                        <LinearGradient colors={['#1a73e8', '#5b9dd9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.voteBarFill, { width: '50%' }]} />
                                    </View>
                                    <Text style={styles.voteCount}>199 (23.3%)</Text>
                                </View>

                                <View style={styles.candidateItem}>
                                    <Text style={styles.candidateName}>Harnain Malik</Text>
                                    <Text style={styles.candidateParty}>Independent</Text>
                                    <View style={styles.voteBar}>
                                        <LinearGradient colors={['#1a73e8', '#5b9dd9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.voteBarFill, { width: '70%' }]} />
                                    </View>
                                    <Text style={styles.voteCount}>200 (23.5%)</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Blockchain Ledger Section */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, styles.blockchainLedgerTitle]}>Blockchain Ledger</Text>
                        <View style={styles.blocksList}>
                            {/* Block #0 */}
                            <Pressable style={styles.blockCard}>
                                <LinearGradient colors={['#1a73e8', '#5b9dd9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.blockHeader}>
                                    <Text style={styles.blockTitle}>Block #0</Text>
                                </LinearGradient>
                                <View style={styles.blockBody}>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Hash: </Text>
                                        <Text style={styles.blockValue}>0f8e3a52...</Text>
                                    </View>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Previous: </Text>
                                        <Text style={styles.blockValue}>0 (Genesis)</Text>
                                    </View>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Time: </Text>
                                        <Text style={styles.blockValue}>2/28/2026, 12:33:53 PM</Text>
                                    </View>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Vote #: </Text>
                                        <Text style={styles.blockValue}>0001</Text>
                                    </View>
                                </View>
                            </Pressable>

                            {/* Block #1 */}
                            <Pressable style={styles.blockCard}>
                                <LinearGradient colors={['#1a73e8', '#5b9dd9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.blockHeader}>
                                    <Text style={styles.blockTitle}>Block #1</Text>
                                </LinearGradient>
                                <View style={styles.blockBody}>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Hash: </Text>
                                        <Text style={styles.blockValue}>52d97cd...</Text>
                                    </View>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Previous: </Text>
                                        <Text style={styles.blockValue}>0f8e3a52...</Text>
                                    </View>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Time: </Text>
                                        <Text style={styles.blockValue}>2/28/2026, 12:34:53 PM</Text>
                                    </View>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Vote #: </Text>
                                        <Text style={styles.blockValue}>0002</Text>
                                    </View>
                                </View>
                            </Pressable>

                            {/* Block #2 */}
                            <Pressable style={styles.blockCard}>
                                <LinearGradient colors={['#1a73e8', '#5b9dd9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.blockHeader}>
                                    <Text style={styles.blockTitle}>Block #2</Text>
                                </LinearGradient>
                                <View style={styles.blockBody}>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Hash: </Text>
                                        <Text style={styles.blockValue}>7d7bf5f...</Text>
                                    </View>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Previous: </Text>
                                        <Text style={styles.blockValue}>52d97cd...</Text>
                                    </View>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Time: </Text>
                                        <Text style={styles.blockValue}>2/28/2026, 12:35:53 PM</Text>
                                    </View>
                                    <View style={styles.blockInfo}>
                                        <Text style={styles.blockLabel}>Vote #: </Text>
                                        <Text style={styles.blockValue}>0003</Text>
                                    </View>
                                </View>
                            </Pressable>
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
});
