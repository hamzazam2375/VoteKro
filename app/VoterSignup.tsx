import type { ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { PasswordField } from '@/components/password-field';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function VoterSignupScreen() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [registeredPassword, setRegisteredPassword] = useState('');
    const [isSigningInRegisteredVoter, setIsSigningInRegisteredVoter] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const userProfile = await serviceFactory.authService.getRequiredProfile('admin');
                setProfile(userProfile);
            } catch (error) {
                Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to load profile'));
                router.replace('/AdminLogin');
            }
        };

        void loadProfile();
    }, [router]);

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: doLogout },
            ]
        );
    };

    const doLogout = async () => {
        try {
            await serviceFactory.authService.signOut();
            router.replace('/');
        } catch (error) {
            Alert.alert('Error', serviceFactory.authService.getErrorMessage(error, 'Failed to logout'));
        }
    };

    const handleRegister = async () => {
        setIsLoading(true);
        try {
            const normalizedEmail = email.trim();
            const selectedPassword = password;
            const createdProfile = await serviceFactory.adminService.registerVoter({
                fullName,
                email: normalizedEmail,
                password,
                confirmPassword,
            });

            if (createdProfile.role !== 'voter') {
                throw new Error('Account was created, but role is not voter. Please contact support.');
            }

            setRegisteredEmail(normalizedEmail);
            setRegisteredPassword(selectedPassword);
            setFullName('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setShowSuccessModal(true);
        } catch (error) {
            const alertContent = serviceFactory.authService.getRegistrationErrorAlert(error);
            Alert.alert(alertContent.title, alertContent.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignInRegisteredVoter = async () => {
        setIsSigningInRegisteredVoter(true);
        try {
            try {
                await serviceFactory.authService.signOut();
            } catch {
                // Ignore if there is no active session.
            }

            const signedInProfile = await serviceFactory.authService.loginForRole(
                registeredEmail,
                registeredPassword,
                'voter'
            );

            setShowSuccessModal(false);
            router.replace(serviceFactory.authService.getDashboardRoute(signedInProfile.role));
        } catch (error) {
            const alertContent = serviceFactory.authService.getLoginErrorAlert(error);
            Alert.alert('Voter Sign In Failed', alertContent.message);
        } finally {
            setIsSigningInRegisteredVoter(false);
        }
    };

    return (
        <View style={styles.container}>
            <Modal
                transparent
                visible={showSuccessModal}
                animationType="fade"
                onRequestClose={() => setShowSuccessModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Voter Registered</Text>
                        <Text style={styles.modalMessage}>
                            Account created successfully.
                        </Text>
                        <Text style={styles.modalCredentials}>Email: {registeredEmail}</Text>
                        <Text style={styles.modalCredentials}>Password: {registeredPassword}</Text>
                        <Text style={styles.modalHint}>
                            If login says Email Not Verified, ask the voter to verify email from inbox first.
                        </Text>

                        <View style={styles.modalActions}>
                            <Pressable style={styles.modalSecondaryBtn} onPress={() => setShowSuccessModal(false)}>
                                <Text style={styles.modalSecondaryText}>Register Another</Text>
                            </Pressable>
                            <Pressable
                                style={styles.modalPrimaryBtn}
                                onPress={handleSignInRegisteredVoter}
                                disabled={isSigningInRegisteredVoter}
                            >
                                {isSigningInRegisteredVoter ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.modalPrimaryText}>Sign In as Voter</Text>
                                )}
                            </Pressable>
                        </View>

                        <Pressable
                            style={styles.modalSecondaryLinkBtn}
                            onPress={() => {
                                setShowSuccessModal(false);
                                router.replace('/VoterLogin');
                            }}
                        >
                            <Text style={styles.modalSecondaryLinkText}>Go to Voter Login Page</Text>
                        </Pressable>

                        <Pressable
                            style={styles.modalLinkBtn}
                            onPress={() => {
                                setShowSuccessModal(false);
                                router.replace('/AdminDashboard');
                            }}
                        >
                            <Text style={styles.modalLinkText}>Back to Dashboard</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

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
                            placeholder="Set voter password (min 8 characters)"
                            placeholderTextColor="#999"
                            value={password}
                            onChangeText={setPassword}
                            editable={!isLoading}
                        />

                        <PasswordField
                            label="Confirm Password"
                            placeholder="Re-enter voter password"
                            placeholderTextColor="#999"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
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
                            <Text style={styles.backButtonText}>Back</Text>
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalBox: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e7edf7',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0d1b3f',
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 14,
        color: '#4a607f',
        marginBottom: 10,
    },
    modalCredentials: {
        fontSize: 14,
        color: '#1a2438',
        marginBottom: 4,
        fontWeight: '600',
    },
    modalHint: {
        fontSize: 12,
        color: '#667a96',
        marginTop: 10,
        lineHeight: 18,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    modalSecondaryBtn: {
        flex: 1,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#c7d2e2',
        paddingVertical: 10,
        alignItems: 'center',
    },
    modalSecondaryText: {
        color: '#32527c',
        fontSize: 13,
        fontWeight: '600',
    },
    modalPrimaryBtn: {
        flex: 1,
        borderRadius: 8,
        backgroundColor: '#2f64e6',
        paddingVertical: 10,
        alignItems: 'center',
    },
    modalPrimaryText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    modalSecondaryLinkBtn: {
        alignSelf: 'center',
        marginTop: 10,
    },
    modalSecondaryLinkText: {
        color: '#32527c',
        fontSize: 13,
        fontWeight: '600',
    },
    modalLinkBtn: {
        alignSelf: 'center',
        marginTop: 12,
    },
    modalLinkText: {
        color: '#2f64e6',
        fontSize: 13,
        fontWeight: '600',
    },
});
