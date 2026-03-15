import { serviceFactory } from '@/class/service-factory';
import { Navbar } from '@/components/navbar';
import { PasswordField } from '@/components/password-field';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function VoterLoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        setIsLoading(true);
        try {
            const profile = await serviceFactory.authService.loginForRole(email, password, 'voter');
            router.push(serviceFactory.authService.getDashboardRoute(profile.role));
        } catch (error) {
            const alertContent = serviceFactory.authService.getLoginErrorAlert(error);
            Alert.alert(alertContent.title, alertContent.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Navbar />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.voteIcon}>🗳️</Text>
                        <Text style={styles.title}>Voter Login</Text>
                    </View>

                    <Text style={styles.subtitle}>Sign in securely to access your ballot and election activity.</Text>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Voter Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your registered email"
                            placeholderTextColor="#9aa6b6"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            editable={!isLoading}
                        />
                    </View>

                    <PasswordField
                        label="Password"
                        placeholder="Enter your password"
                        placeholderTextColor="#9aa6b6"
                        value={password}
                        onChangeText={setPassword}
                        editable={!isLoading}
                    />

                    <Pressable
                        style={({ pressed }) => [
                            styles.loginButton,
                            pressed && styles.loginButtonPressed,
                            isLoading && styles.loginButtonDisabled,
                        ]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginButtonText}>Continue to Voting</Text>
                        )}
                    </Pressable>

                    <View style={styles.footerRow}>
                        <Text style={styles.footerText}>Admin or auditor account? </Text>
                        <Pressable onPress={() => router.push('/AdminLogin')}>
                            <Text style={styles.footerLink}>Go to login</Text>
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
        backgroundColor: '#f5f7fb',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    card: {
        backgroundColor: '#fbfdff',
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
    voteIcon: {
        fontSize: 28,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0d1b3f',
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 22,
        color: '#4a607f',
        textAlign: 'center',
        marginBottom: 18,
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
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 14,
    },
    footerText: {
        fontSize: 13,
        color: '#5c6f89',
    },
    footerLink: {
        fontSize: 13,
        color: '#2f64e6',
        fontWeight: '600',
    },
});
