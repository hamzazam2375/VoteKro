import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { PasswordField } from '@/components/password-field';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function LoginScreen() {
    const router = useRouter();
    const [selectedRole, setSelectedRole] = useState<'admin' | 'auditor'>('admin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setIsLoading(true);
        try {
            console.log('Attempting login for:', email);

            // Sign in using the auth service
            await serviceFactory.authService.signIn(email, password);

            console.log('Login successful, fetching profile...');

            // Get the user profile to check their role
            const profile = await serviceFactory.authService.getCurrentProfile();

            console.log('Profile fetched:', profile);

            if (!profile) {
                Alert.alert('Error', 'Profile not found. Please contact support.');
                await serviceFactory.authService.signOut();
                return;
            }

            // Check if the account matches the selected role
            if (profile.role !== selectedRole) {
                Alert.alert(
                    'Role Mismatch',
                    `This account is not registered as ${selectedRole}. Please select the correct role.`
                );
                await serviceFactory.authService.signOut();
                return;
            }

            // Navigate to the appropriate dashboard based on role
            console.log('Navigating to dashboard...');
            if (profile.role === 'auditor') {
                router.push('/AuditorDashboard');
            } else {
                router.push('/AdminDashboard');
            }
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An error occurred during login';

            // Check for common error messages
            if (errorMessage.includes('Email not confirmed')) {
                Alert.alert(
                    'Email Not Verified',
                    'Please check your email and click the verification link before logging in.'
                );
            } else if (errorMessage.includes('Invalid login credentials')) {
                Alert.alert('Login Failed', 'Invalid email or password. Please try again.');
            } else {
                Alert.alert('Login Failed', errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Navbar />

            {/* Main Content */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.lockIcon}>🔐</Text>
                        <Text style={styles.title}>Login</Text>
                    </View>

                    <Text style={styles.subtitle}>Choose role and login</Text>

                    <View style={styles.roleSwitchWrap}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.roleButton,
                                selectedRole === 'admin' && styles.roleButtonActive,
                                pressed && styles.roleButtonPressed,
                            ]}
                            onPress={() => setSelectedRole('admin')}
                            disabled={isLoading}
                        >
                            <Text style={[styles.roleButtonText, selectedRole === 'admin' && styles.roleButtonTextActive]}>
                                Admin
                            </Text>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.roleButton,
                                selectedRole === 'auditor' && styles.roleButtonActive,
                                pressed && styles.roleButtonPressed,
                            ]}
                            onPress={() => setSelectedRole('auditor')}
                            disabled={isLoading}
                        >
                            <Text style={[styles.roleButtonText, selectedRole === 'auditor' && styles.roleButtonTextActive]}>
                                Auditor
                            </Text>
                        </Pressable>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>{selectedRole === 'admin' ? 'Admin ID / Email' : 'Auditor ID / Email'}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={selectedRole === 'admin' ? 'Type: ADMIN001 or email' : 'Type: AUDITOR001 or email'}
                            placeholderTextColor="#999"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="default"
                            autoCapitalize="none"
                            editable={!isLoading}
                        />
                    </View>

                    <PasswordField
                        label="Password"
                        placeholder="Enter password"
                        placeholderTextColor="#999"
                        value={password}
                        onChangeText={setPassword}
                        editable={!isLoading}
                    />

                    <Pressable
                        style={({ pressed }) => [
                            styles.loginButton,
                            pressed && styles.loginButtonPressed,
                            isLoading && styles.loginButtonDisabled
                        ]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginButtonText}>Login</Text>
                        )}
                    </Pressable>

                    {selectedRole === 'admin' ? (
                        <View style={styles.registerLinkContainer}>
                            <Text style={styles.registerText}>Don't have an account? </Text>
                            <Pressable onPress={() => router.push('/AdminSignup')}>
                                <Text style={styles.registerLink}>Register here</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <Text style={styles.auditorNote}>Auditor accounts are created by admin.</Text>
                    )}
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
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 22,
        width: '100%',
        maxWidth: 460,
        borderWidth: 1,
        borderColor: '#d8e2f0',
        shadowColor: '#1b2b4a',
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 10,
    },
    lockIcon: {
        fontSize: 28,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0d1b3f',
    },
    subtitle: {
        fontSize: 14,
        color: '#395173',
        textAlign: 'center',
        marginBottom: 16,
    },
    roleSwitchWrap: {
        flexDirection: 'row',
        backgroundColor: '#eaf0f8',
        borderRadius: 10,
        padding: 4,
        marginBottom: 18,
    },
    roleButton: {
        flex: 1,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    roleButtonActive: {
        backgroundColor: '#2f64e6',
        shadowColor: '#2f64e6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 3,
    },
    roleButtonPressed: {
        opacity: 0.9,
    },
    roleButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#304761',
    },
    roleButtonTextActive: {
        color: '#ffffff',
    },
    inputContainer: {
        marginBottom: 14,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f1f3f',
        marginBottom: 7,
    },
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#c7d2e2',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1a2438',
    },
    loginButton: {
        backgroundColor: '#2f64e6',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#2f64e6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 8,
        elevation: 3,
    },
    loginButtonPressed: {
        opacity: 0.9,
    },
    loginButtonDisabled: {
        opacity: 0.6,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    registerLinkContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 14,
    },
    registerText: {
        fontSize: 13,
        color: '#5c6f89',
    },
    registerLink: {
        fontSize: 13,
        color: '#2f64e6',
        fontWeight: '600',
    },
    auditorNote: {
        marginTop: 14,
        textAlign: 'center',
        fontSize: 12,
        color: '#5c6f89',
    },
});
