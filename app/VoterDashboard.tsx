import type { ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function VoterDashboard() {
    const router = useRouter();
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const userProfile = await serviceFactory.authService.getRequiredProfile('voter');
                setProfile(userProfile);
            } catch (error) {
                Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to load profile'));
                router.replace('/VoterLogin');
            } finally {
                setIsLoading(false);
            }
        };

        void loadProfile();
    }, [router]);

    const handleLogout = async () => {
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
                <ActivityIndicator size="large" color="#2f64e6" />
                <Text style={styles.loadingText}>Loading your voter space...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Navbar
                infoText={`Welcome, ${profile?.full_name ?? 'Voter'}!`}
                actions={[{ label: 'Logout', onPress: handleLogout, variant: 'outline' }]}
            />

            <ScrollView contentContainerStyle={styles.contentContainer}>
                <View style={styles.contentWrap}>
                    <Text style={styles.pageTitle}>Voter Dashboard</Text>
                    <Text style={styles.pageSubtitle}>Access your upcoming elections and verify your voting status securely.</Text>

                    <View style={styles.featureCard}>
                        <Text style={styles.featureEyebrow}>Account Status</Text>
                        <Text style={styles.featureTitle}>You are signed in and ready to vote</Text>
                        <Text style={styles.featureBody}>
                            Your voter workspace is active. Election-specific ballot views can be connected here next.
                        </Text>
                    </View>

                    <View style={styles.summaryRow}>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryLabel}>Role</Text>
                            <Text style={styles.summaryValue}>Voter</Text>
                        </View>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryLabel}>Verification</Text>
                            <Text style={styles.summaryValue}>{profile?.is_verified ? 'Verified' : 'Pending'}</Text>
                        </View>
                    </View>

                    <Pressable
                        style={({ pressed }) => [styles.primaryAction, pressed && styles.primaryActionPressed]}
                        onPress={() => Alert.alert('Coming Soon', 'Election ballot view will be available in the next update.')}
                    >
                        <Text style={styles.primaryActionText}>View Available Elections</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fb',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f7fb',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 15,
        color: '#5c6f89',
    },
    contentContainer: {
        padding: 24,
        alignItems: 'center',
    },
    contentWrap: {
        width: '100%',
        maxWidth: 900,
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0d1b3f',
        marginBottom: 8,
    },
    pageSubtitle: {
        fontSize: 15,
        lineHeight: 24,
        color: '#51647f',
        marginBottom: 24,
    },
    featureCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#dce5f2',
        borderRadius: 18,
        padding: 22,
        marginBottom: 18,
        shadowColor: '#1b2b4a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 3,
    },
    featureEyebrow: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2f64e6',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    featureTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0d1b3f',
        marginBottom: 8,
    },
    featureBody: {
        fontSize: 14,
        lineHeight: 22,
        color: '#5b6d86',
    },
    summaryRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#edf3fc',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#d7e4f6',
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#5a6d88',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0d1b3f',
    },
    primaryAction: {
        alignSelf: 'flex-start',
        backgroundColor: '#2f64e6',
        borderRadius: 12,
        paddingHorizontal: 18,
        paddingVertical: 12,
    },
    primaryActionPressed: {
        opacity: 0.9,
    },
    primaryActionText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
});
