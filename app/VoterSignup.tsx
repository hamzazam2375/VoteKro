import type { ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { PasswordField } from '@/components/password-field';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { toast } from 'react-toastify';

export default function VoterSignupScreen() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

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
        setIsLoading(true);

        const normalizedFullName = fullName.trim();
        const normalizedEmail = email.trim().toLowerCase();
        const trimmedPassword = password.trim();
        const trimmedConfirmPassword = confirmPassword.trim();

        if (!normalizedFullName || !normalizedEmail || !trimmedPassword || !trimmedConfirmPassword) {
            setError('Please fill in all fields.');
            setIsLoading(false);
            return;
        }

        if (trimmedPassword.length < 8) {
            setError('Password must be at least 8 characters.');
            setIsLoading(false);
            return;
        }

        if (trimmedPassword !== trimmedConfirmPassword) {
            setError('Password and confirm password do not match.');
            setIsLoading(false);
            return;
        }

        try {
            const createdProfile = await serviceFactory.adminService.registerVoter({
                fullName: normalizedFullName,
                email: normalizedEmail,
                password: trimmedPassword,
            });

            if (createdProfile.role !== 'voter') {
                throw new Error('Account was created, but role is not voter. Please contact support.');
            }

            setFullName('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setCreatedCredentials({
                email: normalizedEmail,
                password: trimmedPassword,
            });
            setIsSuccessModalVisible(true);
            toast.success('Voter registered successfully.', {
                position: 'top-right',
                autoClose: 1800,
            });
        } catch (error) {
            const errorMessage = serviceFactory.authService.getErrorMessage(
                error,
                'Registration failed. Please try again.'
            );
            setError(errorMessage);
            toast.error(errorMessage, {
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
                            Create a voter account using Gmail and set the password directly.
                        </Text>

                        {/* Error Message */}
                        {error && (
                            <View style={styles.errorMessage}>
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

                        <PasswordField
                            label="Password"
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Set voter password (min 8 characters)"
                            editable={!isLoading}
                        />

                        <PasswordField
                            label="Confirm Password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Re-enter voter password"
                            editable={!isLoading}
                        />

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

            <Modal
                transparent
                visible={isSuccessModalVisible}
                animationType="fade"
                onRequestClose={() => setIsSuccessModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Voter Registered</Text>
                        <Text style={styles.modalSubtitle}>Account created successfully.</Text>

                        <Text style={styles.modalCredentialText}>
                            <Text style={styles.modalCredentialLabel}>Email:</Text> {createdCredentials?.email}
                        </Text>
                        <Text style={styles.modalCredentialText}>
                            <Text style={styles.modalCredentialLabel}>Password:</Text> {createdCredentials?.password}
                        </Text>

                        <Text style={styles.modalHint}>
                            If login says Email Not Verified, ask the voter to verify email from inbox first.
                        </Text>

                        <View style={styles.modalButtonRow}>
                            <Pressable
                                style={({ pressed }) => [styles.modalSecondaryButton, pressed && styles.modalSecondaryPressed]}
                                onPress={() => setIsSuccessModalVisible(false)}
                            >
                                <Text style={styles.modalSecondaryButtonText}>Register Another</Text>
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [styles.modalPrimaryButton, pressed && styles.modalPrimaryPressed]}
                                onPress={() => {
                                    setIsSuccessModalVisible(false);
                                    router.replace('/VoterLogin');
                                }}
                            >
                                <Text style={styles.modalPrimaryButtonText}>Sign In as Voter</Text>
                            </Pressable>
                        </View>

                        <Pressable
                            style={styles.modalLinkWrap}
                            onPress={() => {
                                setIsSuccessModalVisible(false);
                                router.replace('/VoterLogin');
                            }}
                        >
                            <Text style={styles.modalLinkText}>Go to Voter Login Page</Text>
                        </Pressable>

                        <Pressable
                            style={styles.modalLinkWrap}
                            onPress={() => {
                                setIsSuccessModalVisible(false);
                                router.replace('/AdminDashboard');
                            }}
                        >
                            <Text style={styles.modalLinkText}>Back to Dashboard</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
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
        backgroundColor: '#fee2e2',
        borderColor: '#dc2626',
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 20,
    },
    errorText: {
        fontSize: 14,
        color: '#991b1b',
        fontWeight: '500',
        lineHeight: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 14,
    },
    modalCard: {
        width: '100%',
        maxWidth: 560,
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingVertical: 24,
        paddingHorizontal: 24,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    modalTitle: {
        fontSize: 42,
        fontWeight: '800',
        color: '#0f2342',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 29,
        color: '#4d6485',
        marginBottom: 16,
    },
    modalCredentialText: {
        fontSize: 15,
        color: '#21334f',
        marginBottom: 6,
    },
    modalCredentialLabel: {
        fontWeight: '700',
        color: '#112745',
    },
    modalHint: {
        marginTop: 12,
        marginBottom: 16,
        color: '#6b7f99',
        fontSize: 14,
        lineHeight: 21,
    },
    modalButtonRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
    },
    modalSecondaryButton: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d1d7e0',
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    modalSecondaryPressed: {
        backgroundColor: '#f6f8fb',
    },
    modalSecondaryButtonText: {
        color: '#4a5f7f',
        fontWeight: '700',
        fontSize: 14,
    },
    modalPrimaryButton: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: '#2f63d5',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    modalPrimaryPressed: {
        backgroundColor: '#1f52c2',
    },
    modalPrimaryButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    modalLinkWrap: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    modalLinkText: {
        color: '#4268b5',
        fontSize: 15,
        fontWeight: '600',
    },
});
