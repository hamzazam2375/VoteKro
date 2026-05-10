import type { AuditLogRow, ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { AuditLogsViewer } from '@/components/audit-logs-viewer';
import { AuditorSidebar } from '@/components/auditor-sidebar';
import { MetricCard, StatCard } from '@/components/dashboard-cards';
import { Navbar } from '@/components/navbar';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export default function AuditorDashboard() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 760;
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [auditLogs, setAuditLogs] = useState<(AuditLogRow & { displayType: string })[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const userProfile = await serviceFactory.authService.getRequiredProfile('auditor');
                setProfile(userProfile);
                
                // Load audit logs after profile is loaded
                await loadAuditLogs();
            } catch (error) {
                Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to load profile'));
                router.replace('/AuditorSignup');
            } finally {
                setIsLoading(false);
            }
        };

        void loadProfile();
    }, [router]);

    const loadAuditLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const logs = await serviceFactory.auditorService.getAuditLogs(100);
            const formattedLogs = serviceFactory.auditorService.getFormattedAuditLogs(logs);
            setAuditLogs(formattedLogs);
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1a73e8" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Navbar 
              auditorName={`Auditor ${profile?.full_name || ''}`}
              actions={[
                { label: 'Back', onPress: () => router.back(), variant: 'outline' },
              ]}
            />
            
            <View style={styles.mainContent}>
                {!isMobile && <AuditorSidebar profileName={profile?.full_name} />}
                
                <ScrollView 
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.innerWrapper}>
                        {/* Dashboard Header */}
                        <View style={styles.headerSection}>
                            <Text style={styles.pageTitle}>Overview</Text>
                            <Text style={styles.pageSubtitle}>Audit dashboard and election integrity monitoring</Text>
                        </View>

                        {/* Quick Stats Grid */}
                        <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
                            <StatCard
                                label="Total Blocks"
                                value="3"
                                icon="⛓️"
                                color="#1a73e8"
                                accentColor="#1a73e8"
                                subtext="Verified"
                            />
                            <StatCard
                                label="Elections"
                                value="1"
                                icon="🗳️"
                                color="#4caf50"
                                accentColor="#4caf50"
                                subtext="Active"
                            />
                            <StatCard
                                label="Verification Rate"
                                value="98.5%"
                                icon="✓"
                                color="#1a73e8"
                                accentColor="#1a73e8"
                                subtext="Accurate"
                            />
                            <StatCard
                                label="Anomalies"
                                value="0"
                                icon="⚠️"
                                color="#ff9800"
                                accentColor="#ff9800"
                                subtext="Detected"
                            />
                        </View>

                        {/* Key Metrics Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>📊 Key Metrics</Text>
                            <View style={[styles.metricsGrid, isMobile && styles.metricsGridMobile]}>
                                <MetricCard
                                    title="Verified Votes"
                                    metric={5842}
                                    unit="votes"
                                    icon="✓"
                                    color="#4caf50"
                                    progress={98}
                                />
                                <MetricCard
                                    title="Blockchain Records"
                                    metric={3}
                                    unit="blocks"
                                    icon="⛓️"
                                    color="#1a73e8"
                                    progress={100}
                                />
                            </View>
                        </View>

                        {/* Recent Audit and System Health */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>🔍 Audit Status</Text>
                            <View style={[styles.statusCardsGrid, isMobile && styles.statusCardsGridMobile]}>
                                {/* Recent Audit Card */}
                                <View style={styles.statusCard}>
                                    <View style={styles.statusCardHeader}>
                                        <Text style={styles.statusCardIcon}>📋</Text>
                                        <Text style={styles.statusCardTitle}>Recent Audit</Text>
                                    </View>
                                    <Text style={styles.statusCardValue}>Election Audit #1</Text>
                                    <Text style={styles.statusCardSubtext}>Completed 2 hours ago</Text>
                                    <Text style={styles.statusCardStatus}>✓ Verified</Text>
                                </View>

                                {/* System Health Card */}
                                <View style={styles.statusCard}>
                                    <View style={styles.statusCardHeader}>
                                        <Text style={styles.statusCardIcon}>❤️</Text>
                                        <Text style={styles.statusCardTitle}>System Health</Text>
                                    </View>
                                    <Text style={styles.statusCardValue}>100%</Text>
                                    <Text style={styles.statusCardSubtext}>All systems operational</Text>
                                    <Text style={styles.statusCardStatus}>● Healthy</Text>
                                </View>
                            </View>
                        </View>

                        {/* Review Anomalies Section */}
                        <View style={styles.section}>
                            <View style={styles.anomaliesHeader}>
                                <Text style={styles.sectionTitle}>⚠️ Review Anomalies</Text>
                                <Text style={styles.anomaliesCount}>0 Issues Found</Text>
                            </View>
                            <View style={styles.anomaliesContainer}>
                                <Text style={styles.noAnomaliesText}>No vote anomalies detected in the current election</Text>
                            </View>
                        </View>

                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    // Header Section
    headerSection: {
        marginBottom: 24,
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 6,
    },
    pageSubtitle: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    // Stats Grid
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 28,
    },
    statsGridMobile: {
        flexDirection: 'column',
    },
    // Sections
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 14,
    },
    // Metrics Grid
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    metricsGridMobile: {
        flexDirection: 'column',
    },
    // Audit Logs
    auditLogsContainer: {
        borderRadius: 14,
        overflow: 'hidden',
        maxHeight: 600,
    },
    // Status Cards Grid
    statusCardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    statusCardsGridMobile: {
        flexDirection: 'column',
    },
    statusCard: {
        flex: 1,
        minWidth: '48%',
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e0e7ff',
    },
    statusCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusCardIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    statusCardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    statusCardValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a73e8',
        marginBottom: 6,
    },
    statusCardSubtext: {
        fontSize: 12,
        color: '#666',
        marginBottom: 8,
    },
    statusCardStatus: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4caf50',
    },
    // Anomalies
    anomaliesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    anomaliesCount: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4caf50',
        backgroundColor: '#e8f5e9',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    anomaliesContainer: {
        padding: 20,
        borderRadius: 12,
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 80,
    },
    noAnomaliesText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    backButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 20,
    },
    backButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    backButtonPressed: {
        opacity: 0.7,
        backgroundColor: '#e8e8e8',
    },
    backButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333333',
    },
});
