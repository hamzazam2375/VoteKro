import { Navbar } from '@/components/navbar';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';



export default function HomeScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const handleSignUp = () => {
        router.push('/AdminSignup');
    };

    const handleAdminAuditorLogin = () => {
        router.push('/AdminLogin');
    };

    const handleVoterContinue = () => {
        router.push('/VoterLogin');
    };

    return (
        <View style={styles.container}>
            <View style={styles.backgroundBlobTopRight} />
            <View style={styles.backgroundBlobBottomLeft} />

            <Navbar
                actions={[{ label: 'Sign Up', onPress: handleSignUp, variant: 'solid' }]}
            />

            <View style={[styles.hero, isMobile && styles.heroMobile]}>
                <View style={styles.heroTitleRow}>
                    <Text style={styles.heroIcon}>🗳️</Text>
                    <Text style={[styles.title, isMobile && styles.titleMobile]}>Welcome to</Text>
                </View>
                <Text style={[styles.title, styles.titleSecondLine, isMobile && styles.titleMobile]}>VoteKro</Text>

                <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
                    A secure, transparent, and decentralized voting platform using blockchain technology
                </Text>

                <Pressable
                    style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.primaryButtonPressed,
                    ]}
                    onPress={handleVoterContinue}
                >
                    <Text style={styles.primaryButtonText}>Continue as a Voter</Text>
                </Pressable>

                <Pressable
                    style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.secondaryButtonPressed,
                    ]}
                    onPress={handleAdminAuditorLogin}
                >
                    <Text style={styles.secondaryButtonText}>Login as Admin/Auditor</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#d9e4ef',
    },
    backgroundBlobTopRight: {
        position: 'absolute',
        width: 340,
        height: 240,
        borderBottomLeftRadius: 220,
        borderBottomRightRadius: 80,
        borderTopLeftRadius: 80,
        borderTopRightRadius: 0,
        right: 0,
        top: 96,
        backgroundColor: '#c9d8eb',
        opacity: 0.9,
    },
    backgroundBlobBottomLeft: {
        position: 'absolute',
        width: 340,
        height: 220,
        borderTopRightRadius: 220,
        borderTopLeftRadius: 40,
        borderBottomRightRadius: 0,
        borderBottomLeftRadius: 0,
        left: 0,
        bottom: 0,
        backgroundColor: '#c7d6e7',
        opacity: 0.7,
    },
    hero: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 22,
        zIndex: 1,
    },
    heroMobile: {
        justifyContent: 'flex-start',
        paddingTop: 72,
    },
    heroTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    heroIcon: {
        fontSize: 48,
    },
    title: {
        color: '#0a163d',
        fontSize: 54,
        fontWeight: '800',
        lineHeight: 62,
        textAlign: 'center',
    },
    titleSecondLine: {
        marginTop: 0,
        marginBottom: 18,
    },
    titleMobile: {
        fontSize: 40,
        lineHeight: 48,
    },
    subtitle: {
        color: '#50627a',
        fontSize: 16,
        lineHeight: 24,
        maxWidth: 760,
        textAlign: 'center',
        marginBottom: 30,
    },
    subtitleMobile: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 26,
    },
    primaryButton: {
        backgroundColor: '#2f64e6',
        borderRadius: 12,
        minWidth: 330,
        paddingVertical: 12,
        paddingHorizontal: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: '#2f64e6',
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
    },
    primaryButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.1,
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderColor: '#2f64e6',
        borderWidth: 2,
        borderRadius: 12,
        minWidth: 330,
        paddingVertical: 11,
        paddingHorizontal: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonPressed: {
        opacity: 0.92,
        transform: [{ scale: 0.99 }],
    },
    secondaryButtonText: {
        color: '#2f64e6',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.1,
    },
});
