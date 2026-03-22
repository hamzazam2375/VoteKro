import type { ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { toast } from 'react-toastify';

export default function VoterSignupScreen() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [profile, setProfile] = useState<ProfileRow | null>(null);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const userProfile = await serviceFactory.authService.getRequiredProfile('admin');
                setProfile(userProfile);
            } catch (error) {
                const errorMsg = serviceFactory.authService.getErrorMessage(error, 'Failed to load profile');
                toast.error(errorMsg);
                router.replace('/AdminLogin');
            }
        };

        void loadProfile();
    }, [router]);

    const handleLogout = () => {
        toast.info('Logging out...');
        doLogout();
    };

    const doLogout = async () => {
        try {
            await serviceFactory.authService.signOut();
            toast.success('Logged out successfully');
            router.replace('/');
        } catch (error) {
            const errorMsg = serviceFactory.authService.getErrorMessage(error, 'Failed to logout');
            toast.error(errorMsg);
        }
    };

    const handleRegister = async () => {
        setError(null);
        setIsSuccess(false);
        setIsLoading(true);
        try {
            const normalizedEmail = email.trim();
            const createdProfile = await serviceFactory.adminService.registerVoter({
                fullName,
                email: normalizedEmail,
            });

            if (createdProfile.role !== 'voter') {
                throw new Error('Account was created, but role is not voter. Please contact support.');
            }

            setFullName('');
            setEmail('');
            setIsSuccess(true);
            toast.success('✓ Voter registered. Credentials sent by email.', {
                position: 'top-right',
                autoClose: 2000,
            });
        } catch (error) {
            const errorMessage = serviceFactory.authService.getErrorMessage(
                error,
                'Registration failed. Please try again.'
            );
            setError(errorMessage);
            toast.error('✗ ' + errorMessage, {
                position: 'top-right',
                autoClose: 3000,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Navbar
                infoText={`Welcome, ${profile?.full_name ?? 'Administrator'}!`}
                actions={[
                    { label: 'Logout', onPress: handleLogout, variant: 'outline' },
                ]}
            />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.centerContainer}>
                    <View style={styles.card}>
                        <View style={styles.titleContainer}>
                            <Text style={styles.title}>Register Voter</Text>
                        </View>

                        <Text style={styles.description}>
                            Create a voter account using Gmail. A random password is generated.
                        </Text>

                        {/* Success Message */}
                        {isSuccess && (
                            <View style={styles.successMessage}>
                                <Text style={styles.successIcon}>✓</Text>
                                <View>
                                    <Text style={styles.successTitle}>Registration Successful!</Text>
                                    <Text style={styles.successText}>Voter account created. Credentials were emailed to the voter.</Text>
                                </View>
                            </View>
                        )}

                        {/* Error Message */}
                        {error && !isSuccess && (
                            <View style={styles.errorMessage}>
                                <Text style={styles.errorIcon}>⚠</Text>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Voter Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter voter name"
                                placeholderTextColor="#999"
                                value={fullName}
                                onChangeText={setFullName}
                                editable={!isLoading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Voter Gmail</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="voter@gmail.com"
                                placeholderTextColor="#999"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                        </View>

                        <Pressable
                            style={({ pressed }) => [
                                styles.registerButton,
                                pressed && styles.registerButtonPressed,
                                isLoading && styles.registerButtonDisabled,
                            ]}
                            onPress={handleRegister}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.registerButtonText}>Register Voter</Text>
                            )}
                        </Pressable>

                        <Pressable style={styles.backButton} onPress={() => router.replace('/AdminDashboard')}>
                            <Text style={styles.backButtonText}>← Back</Text>
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
        backgroundColor: '#fff',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
    },
    centerContainer: {
        width: '100%',
        maxWidth: 500,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
        width: '100%',
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 12,
        justifyContent: 'center',
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#1a1a1a',
        textAlign: 'center',
    },
    description: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 19,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 13,
        backgroundColor: '#fafafa',
        color: '#1a1a1a',
    },
    registerButton: {
        backgroundColor: '#0f8a3d',
        borderRadius: 6,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    registerButtonPressed: {
        backgroundColor: '#0a6630',
    },
    registerButtonDisabled: {
        opacity: 0.6,
    },
    registerButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    backButton: {
        marginTop: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#ddd',
        alignSelf: 'center',
    },
    backButtonText: {
        color: '#1a73e8',
        fontSize: 14,
        fontWeight: '500',
    },
    errorMessage: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#fee2e2',
        borderColor: '#dc2626',
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 20,
    },
    errorIcon: {
        fontSize: 18,
        marginRight: 10,
        marginTop: 2,
    },
    errorText: {
        flex: 1,
        fontSize: 14,
        color: '#991b1b',
        fontWeight: '500',
        lineHeight: 20,
    },
    successMessage: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#dcfce7',
        borderColor: '#16a34a',
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 20,
    },
    successIcon: {
        fontSize: 20,
        marginRight: 10,
        marginTop: 1,
        color: '#16a34a',
    },
    successTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#166534',
        marginBottom: 4,
    },
    successText: {
        fontSize: 14,
        color: '#166534',
        fontWeight: '500',
    },
});
