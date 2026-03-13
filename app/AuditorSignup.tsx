import type { ProfileRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function AuditorSignupScreen() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const userProfile = await serviceFactory.authService.getCurrentProfile();
            setProfile(userProfile);
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setIsLoadingProfile(false);
        }
    };

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
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout');
        }
    };

    const handleRegister = async () => {
        // Validate inputs
        if (!fullName || !email) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        // Validate email ends with @gmail.com
        if (!email.endsWith('@gmail.com')) {
            Alert.alert('Error', 'Email must end with @gmail.com');
            return;
        }

        // Extract first name and generate password
        const firstName = fullName.split(' ')[0];
        const password = firstName;

        setIsLoading(true);
        try {
            // Sign up using the auth service
            await serviceFactory.authService.signUp({
                email,
                password,
                fullName,
                role: 'auditor',
            });

            // Show success alert and auto-navigate
            Alert.alert(
                'Success! ✓',
                'Auditor registered and added successfully.',
                [
                    {
                        text: 'OK',
                        onPress: () => router.replace('/AdminDashboard'),
                    },
                ]
            );
        } catch (error) {
            console.error('Signup error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An error occurred during registration';
            Alert.alert('Registration Failed', errorMessage);
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

            {/* Main Content */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.centerContainer}>
                    <View style={styles.card}>
                        {/* Title */}
                        <View style={styles.titleContainer}>
                            <Text style={styles.auditIcon}>🔍</Text>
                            <Text style={styles.title}>Register Auditor</Text>
                        </View>

                        {/* Description */}
                        <Text style={styles.description}>
                            Create auditor using Gmail. A random password is generated.
                        </Text>

                        {/* Full Name Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Auditor Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter auditor name"
                                placeholderTextColor="#999"
                                value={fullName}
                                onChangeText={setFullName}
                                editable={!isLoading}
                            />
                        </View>

                        {/* Gmail Address Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Auditor Gmail</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="auditor@gmail.com"
                                placeholderTextColor="#999"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                        </View>

                        {/* Register Button */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.registerButton,
                                pressed && styles.registerButtonPressed,
                                isLoading && styles.registerButtonDisabled
                            ]}
                            onPress={handleRegister}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.registerButtonText}>✓ Register Auditor</Text>
                            )}
                        </Pressable>

                        {/* Back Button */}
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
    auditIcon: {
        fontSize: 36,
        marginBottom: 8,
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
});
