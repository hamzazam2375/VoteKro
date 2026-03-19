import type { ProfileRow } from '@/class/database-types';
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
    const [isLoading, setIsLoading] = useState(true);

    const displayName = profile?.full_name?.trim() || 'Voter';
    const electionCardWidth = Math.min(330, Math.max(250, width - 48));

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

                    <View style={[styles.electionCard, { width: electionCardWidth }]}>
                        <LinearGradient
                            colors={['#2f64e6', '#d154a7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.cardTopAccent}
                        />

                        <Text style={styles.electionTitle}>Presidential Election 2024</Text>
                        <Text style={styles.electionDescription}>Vote for the presidential candidate of your choice</Text>

                        <View style={styles.dateBlock}>
                            <Text style={styles.dateText}>📅 Start: 2026-02-28</Text>
                            <Text style={styles.dateText}>📅 End: 2026-03-05</Text>
                        </View>

                        <Text style={styles.candidateCount}>Candidates: 3</Text>

                        <Pressable
                            style={({ pressed }) => [styles.voteAction, pressed && styles.voteActionPressed]}
                            onPress={() => Alert.alert('Coming Soon', 'Ballot view will be available in the next update.')}
                        >
                            <LinearGradient
                                colors={['#2f64e6', '#2a58d0']}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={styles.voteButtonGradient}
                            >
                                <Text style={styles.voteActionText}>Vote Now</Text>
                            </LinearGradient>
                        </Pressable>
                    </View>
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
});
