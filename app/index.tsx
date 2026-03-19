import { Navbar } from '@/components/navbar';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

const featureHighlights = [
    {
        icon: '🔐',
        title: 'Secure Ballots',
        body: 'Every vote is encrypted and stored in an immutable blockchain-backed ledger.',
    },
    {
        icon: '✅',
        title: 'Verified Access',
        body: 'Only verified voters can participate in election windows configured by admins.',
    },
    {
        icon: '📊',
        title: 'Transparent Audit',
        body: 'Auditors can independently verify chain integrity and monitor election activity.',
    },
    {
        icon: '⚡',
        title: 'Fast Experience',
        body: 'Simple workflows for voters, admins, and auditors with quick authentication flow.',
    },
];

const votingSteps = [
    {
        number: '01',
        title: 'Sign In',
        body: 'Voter logs in with their registered account and opens the voting dashboard.',
    },
    {
        number: '02',
        title: 'Choose Election',
        body: 'Select an active election and review candidates with their details.',
    },
    {
        number: '03',
        title: 'Cast Vote',
        body: 'Submit encrypted vote commitment securely through the vote ledger service.',
    },
    {
        number: '04',
        title: 'Verify Trust',
        body: 'Audit layer validates chain integrity so results remain transparent and tamper-resistant.',
    },
];

const trustStats = [
    { value: '3 Roles', label: 'Admin, Voter, Auditor' },
    { value: 'End-to-End', label: 'Blockchain-based traceability' },
    { value: '24/7', label: 'Election system availability' },
];

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
            <Navbar
                actions={[{ label: 'Sign Up', onPress: handleSignUp, variant: 'solid' }]}
            />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.heroSection, isMobile && styles.heroSectionMobile]}>
                    <View style={styles.backgroundBlobTopRight} />
                    <View style={styles.backgroundBlobBottomLeft} />

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

                <View style={styles.sectionShell}>
                    <Text style={styles.sectionEyebrow}>WHY VOTEKRO</Text>
                    <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
                        Everything You Need in One Place
                    </Text>
                    <View style={[styles.featureGrid, isMobile && styles.featureGridMobile]}>
                        {featureHighlights.map((feature) => (
                            <View key={feature.title} style={styles.featureCard}>
                                <Text style={styles.featureIcon}>{feature.icon}</Text>
                                <Text style={styles.featureTitle}>{feature.title}</Text>
                                <Text style={styles.featureBody}>{feature.body}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={[styles.sectionShell, styles.sectionShellMuted]}>
                    <Text style={styles.sectionEyebrow}>HOW IT WORKS</Text>
                    <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
                        Simple from Start to Finish
                    </Text>
                    <View style={[styles.stepsGrid, isMobile && styles.stepsGridMobile]}>
                        {votingSteps.map((step) => (
                            <View key={step.number} style={styles.stepCard}>
                                <Text style={styles.stepNumber}>{step.number}</Text>
                                <Text style={styles.stepTitle}>{step.title}</Text>
                                <Text style={styles.stepBody}>{step.body}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.sectionShell}>
                    <Text style={styles.sectionEyebrow}>ABOUT</Text>
                    <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
                        Built for Fair, Verifiable, and Trusted Elections
                    </Text>
                    <Text style={styles.aboutBody}>
                        VoteKro is designed to remove uncertainty from digital elections. We combine role-based access,
                        encrypted voting, and transparent auditing so organizations can run elections with confidence.
                    </Text>

                    <View style={[styles.statsRow, isMobile && styles.statsRowMobile]}>
                        {trustStats.map((stat) => (
                            <View key={stat.value} style={styles.statCard}>
                                <Text style={styles.statValue}>{stat.value}</Text>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </View>
                        ))}
                    </View>

                    <Pressable
                        style={({ pressed }) => [styles.aboutButton, pressed && styles.aboutButtonPressed]}
                        onPress={() => Alert.alert('About VoteKro', 'Detailed about page will be added soon.')}
                    >
                        <Text style={styles.aboutButtonText}>Learn More About VoteKro</Text>
                    </Pressable>
                </View>

                <View style={styles.ctaSection}>
                    <Text style={[styles.ctaTitle, isMobile && styles.ctaTitleMobile]}>
                        Ready to Cast Your Vote Securely?
                    </Text>
                    <Text style={styles.ctaSubtitle}>
                        Join the trusted election flow and experience transparent digital voting.
                    </Text>
                    <View style={[styles.ctaButtonsRow, isMobile && styles.ctaButtonsRowMobile]}>
                        <Pressable
                            style={({ pressed }) => [styles.ctaPrimaryButton, pressed && styles.primaryButtonPressed]}
                            onPress={handleVoterContinue}
                        >
                            <Text style={styles.primaryButtonText}>Go to Voter Login</Text>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.ctaSecondaryButton, pressed && styles.secondaryButtonPressed]}
                            onPress={handleAdminAuditorLogin}
                        >
                            <Text style={styles.secondaryButtonText}>Admin / Auditor Login</Text>
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
        backgroundColor: '#d9e4ef',
    },
    scrollContent: {
        paddingBottom: 56,
    },
    heroSection: {
        minHeight: 640,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    heroSectionMobile: {
        minHeight: 560,
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
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 22,
        minHeight: 560,
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
    sectionShell: {
        width: '100%',
        maxWidth: 1120,
        alignSelf: 'center',
        paddingHorizontal: 22,
        paddingVertical: 54,
    },
    sectionShellMuted: {
        backgroundColor: '#e8eff7',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#d2ddec',
    },
    sectionEyebrow: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        color: '#4d6485',
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 36,
        lineHeight: 44,
        fontWeight: '800',
        color: '#0a163d',
        marginBottom: 24,
    },
    sectionTitleMobile: {
        fontSize: 30,
        lineHeight: 37,
    },
    featureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    featureGridMobile: {
        flexDirection: 'column',
    },
    featureCard: {
        flexBasis: '48%',
        minHeight: 170,
        backgroundColor: '#f8fbff',
        borderColor: '#cfddee',
        borderWidth: 1,
        borderRadius: 16,
        padding: 18,
    },
    featureIcon: {
        fontSize: 26,
        marginBottom: 10,
    },
    featureTitle: {
        fontSize: 20,
        color: '#183562',
        fontWeight: '700',
        marginBottom: 8,
    },
    featureBody: {
        fontSize: 15,
        lineHeight: 22,
        color: '#50627b',
    },
    stepsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    stepsGridMobile: {
        flexDirection: 'column',
    },
    stepCard: {
        flexBasis: '48%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#cfddee',
        padding: 18,
    },
    stepNumber: {
        fontSize: 13,
        color: '#2e63e3',
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    stepTitle: {
        fontSize: 21,
        color: '#13284f',
        fontWeight: '700',
        marginBottom: 7,
    },
    stepBody: {
        fontSize: 15,
        lineHeight: 22,
        color: '#52667f',
    },
    aboutBody: {
        fontSize: 16,
        lineHeight: 25,
        color: '#4b5f79',
        maxWidth: 940,
        marginBottom: 22,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statsRowMobile: {
        flexDirection: 'column',
    },
    statCard: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: '#f4f8ff',
        borderWidth: 1,
        borderColor: '#cfddf0',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    statValue: {
        color: '#183562',
        fontWeight: '800',
        fontSize: 18,
        marginBottom: 5,
    },
    statLabel: {
        color: '#546884',
        fontSize: 14,
    },
    aboutButton: {
        alignSelf: 'flex-start',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#2f64e6',
        paddingVertical: 11,
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
    },
    aboutButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.99 }],
    },
    aboutButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#2f64e6',
    },
    ctaSection: {
        width: '100%',
        marginTop: 8,
        alignSelf: 'center',
        maxWidth: 1120,
        borderRadius: 22,
        backgroundColor: '#0f2956',
        paddingVertical: 40,
        paddingHorizontal: 22,
        marginHorizontal: 22,
    },
    ctaTitle: {
        fontSize: 34,
        lineHeight: 41,
        fontWeight: '800',
        color: '#f4f8ff',
        marginBottom: 10,
    },
    ctaTitleMobile: {
        fontSize: 30,
        lineHeight: 36,
    },
    ctaSubtitle: {
        fontSize: 16,
        lineHeight: 24,
        color: '#d3e2fb',
        marginBottom: 22,
        maxWidth: 760,
    },
    ctaButtonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    ctaButtonsRowMobile: {
        flexDirection: 'column',
    },
    ctaPrimaryButton: {
        backgroundColor: '#2f64e6',
        borderRadius: 12,
        minWidth: 260,
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaSecondaryButton: {
        backgroundColor: 'transparent',
        borderColor: '#8fb3ff',
        borderWidth: 2,
        borderRadius: 12,
        minWidth: 260,
        paddingVertical: 11,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
