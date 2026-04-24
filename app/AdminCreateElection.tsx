import type { ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { toast } from 'react-toastify';

export default function AdminCreateElectionScreen() {
    const router = useRouter();
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const userProfile = await serviceFactory.authService.getRequiredProfile('admin');
                setProfile(userProfile);
            } catch (loadError) {
                const message = serviceFactory.authService.getErrorMessage(loadError, 'Failed to load profile');
                toast.error(message);
                router.replace('/AdminLogin');
            } finally {
                setIsLoadingProfile(false);
            }
        };

        void loadProfile();
    }, [router]);

    const handleLogout = async () => {
        try {
            await serviceFactory.authService.signOut();
            toast.success('Logged out successfully');
            router.replace('/');
        } catch (logoutError) {
            const message = serviceFactory.authService.getErrorMessage(logoutError, 'Failed to logout');
            toast.error(message);
        }
    };

    const toIsoDate = (value: string, endOfDay = false): string | null => {
        const normalized = value.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
            return null;
        }

        const iso = endOfDay ? `${normalized}T23:59:59.000Z` : `${normalized}T00:00:00.000Z`;
        const date = new Date(iso);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date.toISOString();
    };

    const handleCreateElection = async () => {
        setError(null);

        const trimmedTitle = title.trim();
        const trimmedDescription = description.trim();

        if (!trimmedTitle || !startDate.trim() || !endDate.trim()) {
            setError('Election name, start date and end date are required.');
            return;
        }

        const startsAtIso = toIsoDate(startDate, false);
        const endsAtIso = toIsoDate(endDate, true);

        if (!startsAtIso || !endsAtIso) {
            setError('Use valid date format: YYYY-MM-DD');
            return;
        }

        if (new Date(endsAtIso).getTime() <= new Date(startsAtIso).getTime()) {
            setError('End date must be after start date.');
            return;
        }

        setIsSubmitting(true);

        try {
            await serviceFactory.adminService.createElection({
                title: trimmedTitle,
                description: trimmedDescription || undefined,
                startsAtIso,
                endsAtIso,
            });

            toast.success('Election created successfully');
            router.replace('/AdminDashboard');
        } catch (submitError) {
            const message = serviceFactory.authService.getErrorMessage(submitError, 'Failed to create election');
            setError(message);
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const webDateInputStyle = {
        height: 42,
        borderWidth: 1,
        borderColor: '#d9dee7',
        borderRadius: 8,
        paddingLeft: 12,
        paddingRight: 12,
        backgroundColor: '#f8fafc',
        color: '#111827',
        fontSize: 13,
        width: '100%',
        boxSizing: 'border-box',
    } as const;

    if (isLoadingProfile) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#1a73e8" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Navbar
                infoText={`Welcome, ${profile?.full_name ?? 'Administrator'}!`}
                actions={[{ label: 'Logout', onPress: () => void handleLogout(), variant: 'outline' }]}
            />

            <ScrollView contentContainerStyle={styles.contentContainer}>
                <Pressable style={styles.backButton} onPress={() => router.replace('/AdminDashboard')}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </Pressable>

                <View style={styles.formCard}>
                    <Text style={styles.formTitle}>📋 Create New Election</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Election Name</Text>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="e.g., Presidential Election 2024"
                            placeholderTextColor="#a3a3a3"
                            style={styles.input}
                            editable={!isSubmitting}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Brief description of the election"
                            placeholderTextColor="#a3a3a3"
                            style={styles.input}
                            editable={!isSubmitting}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Start Date</Text>
                        {Platform.OS === 'web' ? (
                            <input
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.currentTarget.value)}
                                disabled={isSubmitting}
                                style={webDateInputStyle}
                            />
                        ) : (
                            <TextInput
                                value={startDate}
                                onChangeText={setStartDate}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#a3a3a3"
                                style={styles.input}
                                editable={!isSubmitting}
                            />
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>End Date</Text>
                        {Platform.OS === 'web' ? (
                            <input
                                type="date"
                                value={endDate}
                                onChange={(event) => setEndDate(event.currentTarget.value)}
                                disabled={isSubmitting}
                                style={webDateInputStyle}
                            />
                        ) : (
                            <TextInput
                                value={endDate}
                                onChangeText={setEndDate}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#a3a3a3"
                                style={styles.input}
                                editable={!isSubmitting}
                            />
                        )}
                    </View>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <Pressable
                        style={({ pressed }) => [styles.submitButton, pressed && styles.submitButtonPressed, isSubmitting && styles.submitButtonDisabled]}
                        disabled={isSubmitting}
                        onPress={() => void handleCreateElection()}
                    >
                        {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>✓ Create Election</Text>}
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
    },
    loadingText: {
        marginTop: 12,
        color: '#64748b',
    },
    contentContainer: {
        paddingTop: 18,
        paddingHorizontal: 16,
        paddingBottom: 30,
        alignItems: 'center',
    },
    backButton: {
        alignSelf: 'flex-start',
        borderWidth: 1.5,
        borderColor: '#2e63e3',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 14,
        backgroundColor: '#ffffff',
        marginBottom: 26,
        marginLeft: 10,
    },
    backButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2e63e3',
    },
    formCard: {
        width: '100%',
        maxWidth: 460,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e4e7ec',
        borderRadius: 14,
        paddingHorizontal: 28,
        paddingVertical: 24,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    formTitle: {
        fontSize: 36,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 18,
    },
    inputGroup: {
        marginBottom: 12,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 6,
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
    errorText: {
        marginTop: 4,
        marginBottom: 10,
        fontSize: 12,
        color: '#dc2626',
        fontWeight: '600',
    },
    submitButton: {
        marginTop: 8,
        minHeight: 40,
        borderRadius: 8,
        backgroundColor: '#0ea66c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonPressed: {
        opacity: 0.88,
    },
    submitButtonDisabled: {
        opacity: 0.65,
    },
    submitButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
});
