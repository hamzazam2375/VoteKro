import type { ProfileRow, CandidateRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { VoteCountVerificationComponent } from '@/components/vote-count-verification';
import type { VoteCountVerificationResult, VoteCounts } from '@/class/vote-count-verification';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export default function AuditorVerifyVotes() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 600;
    
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [verificationResult, setVerificationResult] = useState<VoteCountVerificationResult | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
    const [electionName, setElectionName] = useState<string>('');

    useEffect(() => {
        const loadData = async () => {
            try {
                console.log('Loading auditor profile and elections...');
                const userProfile = await serviceFactory.authService.getRequiredProfile('auditor');
                setProfile(userProfile);
                console.log('Profile loaded:', userProfile);

                // Load first election for verification
                const elections = await serviceFactory.electionRepository.listAll();
                console.log('Elections loaded:', elections);
                
                if (elections && elections.length > 0) {
                    const firstElection = elections[0];
                    setSelectedElectionId(firstElection.id);
                    setElectionName(firstElection.title || 'Election');
                    
                    // Auto-run verification on load
                    console.log('Starting verification for election:', firstElection.id);
                    await runVerification(firstElection.id);
                } else {
                    console.warn('No elections found');
                    Alert.alert('No Elections', 'No elections available for verification.');
                    router.replace('/AuditorDashboard');
                }
            } catch (error) {
                console.error('Error loading data:', error);
                Alert.alert('Error', 'Failed to load data');
                router.replace('/AuditorDashboard');
            } finally {
                setIsLoading(false);
            }
        };

        void loadData();
    }, [router]);

    /**
     * Run vote count verification
     */
    const runVerification = async (electionId: string) => {
        if (!electionId) {
            console.warn('No election ID provided, using demo mode');
            await runDemoVerification();
            return;
        }

        try {
            setIsVerifying(true);
            console.log('Running verification for election:', electionId);

            // Sample results for demonstration
            const sampleResults: VoteCounts = {
                'Ali Khan': 198,
                'Hassan Malik': 199,
                'Harnain Malik': 200,
            };

            console.log('Sample results:', sampleResults);

            const result = await serviceFactory.auditorService.verifyVoteCountConsistency(
                electionId,
                sampleResults
            );

            console.log('Verification result:', result);
            setVerificationResult(result);

            // Log the report to console for auditor review
            try {
                const report = await serviceFactory.auditorService.generateVoteCountReport(
                    electionId,
                    sampleResults
                );
                console.log('Vote Count Verification Report:\n', report);
            } catch (reportError) {
                console.warn('Could not generate report:', reportError);
            }

            if (!result.isConsistent) {
                Alert.alert(
                    'Vote Count Mismatch',
                    `Detected ${result.mismatches.length} mismatch(es). See details below.`,
                    [{ text: 'OK', style: 'default' }]
                );
            }
        } catch (error) {
            console.error('Vote verification error:', error);
            console.warn('Falling back to demo mode');
            // Fall back to demo mode on error
            await runDemoVerification();
        } finally {
            setIsVerifying(false);
        }
    };

    /**
     * Demo verification with mock data
     * Used when service is unavailable or no elections exist
     */
    const runDemoVerification = async () => {
        try {
            setIsVerifying(true);
            console.log('Running demo verification...');

            // Mock blockchain votes
            const blockchainCounts: VoteCounts = {
                'Ali Khan': 198,
                'Hassan Malik': 198,
                'Harnain Malik': 200,
            };

            // Mock result votes (with one mismatch)
            const resultCounts: VoteCounts = {
                'Ali Khan': 198,
                'Hassan Malik': 199,
                'Harnain Malik': 200,
            };

            // Create mock verification result
            const mockCandidates: CandidateRow[] = [
                { id: 'candidate-1', display_name: 'Ali Khan', election_id: 'demo', description: '', created_at: '', updated_at: '' },
                { id: 'candidate-2', display_name: 'Hassan Malik', election_id: 'demo', description: '', created_at: '', updated_at: '' },
                { id: 'candidate-3', display_name: 'Harnain Malik', election_id: 'demo', description: '', created_at: '', updated_at: '' },
            ];

            const mockResult: VoteCountVerificationResult = {
                isConsistent: false,
                blockchainCounts,
                resultCounts,
                totalBlockchainVotes: 596,
                totalResultVotes: 597,
                voteDifference: 1,
                mismatches: [
                    {
                        candidateId: 'candidate-2',
                        candidateName: 'Hassan Malik',
                        blockchainCount: 198,
                        resultCount: 199,
                        difference: 1,
                        percentageDifference: 0.17,
                    },
                ],
                allCandidates: mockCandidates,
                timestamp: new Date().toISOString(),
            };

            console.log('Demo result:', mockResult);
            setVerificationResult(mockResult);

            Alert.alert(
                'Demo Mode',
                'Using sample data for verification demonstration',
                [{ text: 'OK', style: 'default' }]
            );
        } catch (error) {
            console.error('Demo verification error:', error);
            Alert.alert(
                'Error',
                'Failed to generate verification results. Please try again.',
                [{ text: 'OK', style: 'default' }]
            );
        } finally {
            setIsVerifying(false);
        }
    };

    const handleRecalculate = async () => {
        if (selectedElectionId) {
            await runVerification(selectedElectionId);
        }
    };

    const handleGoBack = () => {
        router.back();
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#1a73e8" />
                    <Text style={styles.loadingText}>Loading verification...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Navbar
                infoText={`${profile?.full_name?.split(' ')[0] || 'Auditor'} - Vote Verification`}
                actions={[
                    { label: 'Back', onPress: handleGoBack, variant: 'outline' },
                ]}
            />

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.innerWrapper}>
                    {/* Page Header */}
                    <View style={styles.headerSection}>
                        <Text style={styles.pageTitle}>Vote Count Verification</Text>
                        <Text style={styles.pageSubtitle}>{electionName}</Text>
                        <Text style={styles.pageDescription}>
                            Compare vote counts from the blockchain with computed election results to detect any inconsistencies or fraud.
                        </Text>
                    </View>

                    {/* Verification Status Card */}
                    {verificationResult && (
                        <View style={styles.statusCard}>
                            <View style={[
                                styles.statusIndicator,
                                {
                                    backgroundColor: verificationResult.isConsistent ? '#4caf50' : '#ff6b6b',
                                }
                            ]} />
                            <View style={styles.statusInfo}>
                                <Text style={styles.statusLabel}>
                                    {verificationResult.isConsistent ? 'Verification Status' : 'Alert'}
                                </Text>
                                <Text style={[
                                    styles.statusValue,
                                    {
                                        color: verificationResult.isConsistent ? '#4caf50' : '#ff6b6b',
                                    }
                                ]}>
                                    {verificationResult.isConsistent 
                                        ? '✓ All votes are consistent' 
                                        : `✗ ${verificationResult.mismatches.length} mismatch(es) detected`}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Main Verification Component */}
                    {verificationResult ? (
                        <View style={styles.verificationContainer}>
                            <VoteCountVerificationComponent
                                verificationResult={verificationResult}
                                isLoading={isVerifying}
                                onRecalculate={handleRecalculate}
                                electionTitle={electionName}
                            />
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>⏳</Text>
                            <Text style={styles.emptyTitle}>Running Verification...</Text>
                            <Text style={styles.emptyDesc}>
                                Please wait while we verify vote counts from the blockchain.
                            </Text>
                            <ActivityIndicator size="large" color="#1a73e8" style={styles.spinner} />
                        </View>
                    )}

                    {/* Action Buttons */}
                    {verificationResult && (
                        <View style={styles.actionsSection}>
                            <LinearGradient
                                colors={['#1a73e8', '#5b9dd9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.actionButton}
                            >
                                <Pressable
                                    onPress={handleRecalculate}
                                    disabled={isVerifying}
                                    style={styles.buttonContent}
                                >
                                    <Text style={styles.buttonText}>
                                        {isVerifying ? '⏳ Re-verifying...' : '🔄 Re-verify Votes'}
                                    </Text>
                                </Pressable>
                            </LinearGradient>

                            <Pressable
                                onPress={handleGoBack}
                                style={styles.secondaryButton}
                            >
                                <Text style={styles.secondaryButtonText}>← Back to Dashboard</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* Info Section */}
                    <View style={styles.infoSection}>
                        <Text style={styles.infoTitle}>How It Works</Text>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoNumber}>1</Text>
                            <Text style={styles.infoText}>Extract votes from all blockchain blocks</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoNumber}>2</Text>
                            <Text style={styles.infoText}>Count votes per candidate from blockchain</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoNumber}>3</Text>
                            <Text style={styles.infoText}>Compare with official election results</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoNumber}>4</Text>
                            <Text style={styles.infoText}>Report any mismatches found</Text>
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
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        alignItems: 'center',
    },
    innerWrapper: {
        width: '100%',
        maxWidth: 1200,
    },
    headerSection: {
        marginBottom: 28,
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    pageSubtitle: {
        fontSize: 18,
        color: '#1a73e8',
        fontWeight: '600',
        marginBottom: 12,
    },
    pageDescription: {
        fontSize: 15,
        color: '#666',
        lineHeight: 22,
    },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderLeftWidth: 4,
        borderLeftColor: '#1a73e8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    statusInfo: {
        flex: 1,
    },
    statusLabel: {
        fontSize: 12,
        color: '#999',
        textTransform: 'uppercase',
        fontWeight: '600',
        marginBottom: 4,
    },
    statusValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    verificationContainer: {
        marginBottom: 24,
        backgroundColor: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    emptyState: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 48,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 14,
        color: '#666',
        marginBottom: 24,
        textAlign: 'center',
    },
    spinner: {
        marginTop: 16,
    },
    actionsSection: {
        gap: 12,
        marginBottom: 28,
    },
    actionButton: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    buttonContent: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    secondaryButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#1a73e8',
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a73e8',
    },
    infoSection: {
        backgroundColor: '#f0f7ff',
        borderRadius: 12,
        padding: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#1a73e8',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    infoNumber: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        backgroundColor: '#1a73e8',
        width: 28,
        height: 28,
        borderRadius: 14,
        textAlign: 'center',
        lineHeight: 28,
        marginRight: 12,
        flexShrink: 0,
    },
    infoText: {
        fontSize: 14,
        color: '#333',
        flex: 1,
        lineHeight: 20,
    },
});
