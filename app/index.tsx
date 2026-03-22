import { Navbar } from '@/components/navbar';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

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

const electionSetupSteps = [
    {
        number: '01',
        title: 'Create Admin Account',
        body: 'Click Sign Up, choose Admin, and complete your profile to start managing elections.',
    },
    {
        number: '02',
        title: 'Create Election',
        body: 'Set election title, timeline, and status in your dashboard so the event is properly configured.',
    },
    {
        number: '03',
        title: 'Add Candidates',
        body: 'Add each candidate with details and unique number so voters can review options clearly.',
    },
    {
        number: '04',
        title: 'Register Voters',
        body: 'Approve voter eligibility before opening the election to enforce one-person-one-vote rules.',
    },
    {
        number: '05',
        title: 'Open and Monitor',
        body: 'Open election, monitor activity logs, and close when voting ends for verifiable results.',
    },
];

const roleJourneys = [
    {
        icon: '🧑‍💼',
        title: 'Election Organizer',
        body: 'Create elections, publish timelines, manage candidates, and approve eligible voters.',
        actionLabel: 'Start as Organizer',
    },
    {
        icon: '🗳️',
        title: 'Voter',
        body: 'Access active elections, review candidates, and cast your vote securely in one flow.',
        actionLabel: 'Continue as Voter',
    },
    {
        icon: '🛡️',
        title: 'Auditor',
        body: 'Verify election integrity, inspect vote chain checks, and monitor audit activity logs.',
        actionLabel: 'Enter as Auditor',
    },
];

const trustStats = [
    { value: '3 Roles', label: 'Voter, Organizer, Auditor' },
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
                            Professional digital voting for voters, election organizers, and auditors with
                            blockchain-backed integrity.
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

                <View style={[styles.sectionShell, styles.sectionShellMuted]}>
                    <Text style={styles.sectionEyebrow}>NEW ORGANIZER GUIDE</Text>
                    <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
                        First Time Setting Up an Election?
                    </Text>
                    <Text style={styles.aboutBody}>
                        This path is for new users who want to run an election. Start with Admin Sign Up, then follow
                        these setup steps in order.
                    </Text>
                    <View style={[styles.setupGrid, isMobile && styles.setupGridMobile]}>
                        {electionSetupSteps.map((step) => (
                            <View key={step.number} style={styles.setupCard}>
                                <Text style={styles.stepNumber}>{step.number}</Text>
                                <Text style={styles.stepTitle}>{step.title}</Text>
                                <Text style={styles.stepBody}>{step.body}</Text>
                            </View>
                        ))}
                    </View>

                    <Pressable
                        style={({ pressed }) => [styles.aboutButton, pressed && styles.aboutButtonPressed]}
                        onPress={handleSignUp}
                    >
                        <Text style={styles.aboutButtonText}>Start Election Setup</Text>
                    </Pressable>
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
                    <Text style={styles.sectionEyebrow}>CHOOSE YOUR PATH</Text>
                    <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
                        Built for Every Role in an Election
                    </Text>

                    <View style={[styles.rolesGrid, isMobile && styles.rolesGridMobile]}>
                        {roleJourneys.map((role) => (
                            <View key={role.title} style={styles.roleCard}>
                                <Text style={styles.roleIcon}>{role.icon}</Text>
                                <Text style={styles.roleTitle}>{role.title}</Text>
                                <Text style={styles.roleBody}>{role.body}</Text>
                                <Pressable
                                    style={({ pressed }) => [styles.roleButton, pressed && styles.secondaryButtonPressed]}
                                    onPress={
                                        role.title === 'Voter'
                                            ? handleVoterContinue
                                            : role.title === 'Election Organizer'
                                                ? handleSignUp
                                                : handleAdminAuditorLogin
                                    }
                                >
                                    <Text style={styles.roleButtonText}>{role.actionLabel}</Text>
                                </Pressable>
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
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f4f9',
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
        color: '#0f2851',
        fontSize: 54,
        fontWeight: '800',
        lineHeight: 62,
        textAlign: 'center',
        letterSpacing: -0.8,
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
        color: '#5a6f87',
        fontSize: 18,
        lineHeight: 28,
        maxWidth: 760,
        textAlign: 'center',
        marginBottom: 28,
        fontWeight: '400',
    },
    subtitleMobile: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 26,
    },
    heroTrustRow: {
        marginTop: 14,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
    },
    heroTrustRowMobile: {
        flexDirection: 'column',
        width: '100%',
        alignItems: 'center',
    },
    heroTrustChip: {
        backgroundColor: '#eaf2ff',
        borderColor: '#c4d7f7',
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 14,
    },
    heroTrustChipText: {
        color: '#264c8d',
        fontSize: 13,
        fontWeight: '700',
    },
    organizerBanner: {
        width: '100%',
        maxWidth: 760,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#b8ccee',
        backgroundColor: '#eef4ff',
        paddingVertical: 16,
        paddingHorizontal: 18,
        marginBottom: 20,
        shadowColor: '#2f64e6',
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 2,
    },
    organizerBannerMobile: {
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    organizerBannerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    organizerBannerTopRowMobile: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
    },
    organizerBadge: {
        color: '#244f94',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
    },
    organizerBannerCta: {
        backgroundColor: '#2f64e6',
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 14,
    },
    organizerBannerCtaText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    organizerBannerTitle: {
        fontSize: 20,
        lineHeight: 26,
        color: '#13284f',
        fontWeight: '800',
        marginBottom: 4,
    },
    organizerBannerBody: {
        fontSize: 14,
        lineHeight: 21,
        color: '#4a5e7d',
        marginBottom: 12,
    },
    organizerPillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    organizerPillRowMobile: {
        flexDirection: 'column',
        gap: 7,
    },
    organizerPill: {
        backgroundColor: '#dce9ff',
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 11,
        borderWidth: 1,
        borderColor: '#bfd4f8',
    },
    organizerPillText: {
        color: '#1d427a',
        fontSize: 12,
        fontWeight: '700',
    },
    primaryButton: {
        backgroundColor: '#2f64e6',
        borderRadius: 12,
        minWidth: 330,
        paddingVertical: 13,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: '#2f64e6',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 5,
    },
    primaryButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderColor: '#2f64e6',
        borderWidth: 2,
        borderRadius: 12,
        minWidth: 330,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonPressed: {
        opacity: 0.92,
        transform: [{ scale: 0.99 }],
    },
    secondaryButtonText: {
        color: '#2f64e6',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    sectionShell: {
        width: '100%',
        maxWidth: 1120,
        alignSelf: 'center',
        paddingHorizontal: 22,
        paddingVertical: 54,
    },
    sectionShellMuted: {
        backgroundColor: '#f7fafD',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#e8eff7',
    },
    sectionEyebrow: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.5,
        color: '#5a7c9e',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    sectionTitle: {
        fontSize: 36,
        lineHeight: 44,
        fontWeight: '800',
        color: '#0f2851',
        marginBottom: 28,
        letterSpacing: -0.5,
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
        backgroundColor: '#ffffff',
        borderColor: '#e2ecf7',
        borderWidth: 1,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    featureIcon: {
        fontSize: 32,
        marginBottom: 12,
    },
    featureTitle: {
        fontSize: 18,
        color: '#0f2851',
        fontWeight: '800',
        marginBottom: 10,
        letterSpacing: 0.3,
    },
    featureBody: {
        fontSize: 14,
        lineHeight: 21,
        color: '#5a6f87',
    },
    rolesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    rolesGridMobile: {
        flexDirection: 'column',
    },
    roleCard: {
        flex: 1,
        minWidth: 280,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2ecf7',
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    roleIcon: {
        fontSize: 40,
        marginBottom: 14,
    },
    roleTitle: {
        fontSize: 20,
        lineHeight: 27,
        color: '#0f2851',
        fontWeight: '800',
        marginBottom: 10,
        letterSpacing: 0.3,
    },
    roleBody: {
        fontSize: 14,
        lineHeight: 21,
        color: '#5a6f87',
        marginBottom: 18,
    },
    roleButton: {
        alignSelf: 'flex-start',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#2f64e6',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#eef3ff',
        shadowColor: '#2f64e6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 1,
    },
    roleButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1f52cb',
        letterSpacing: 0.2,
    },
    stepsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    stepsGridMobile: {
        flexDirection: 'column',
    },
    setupGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 18,
    },
    setupGridMobile: {
        flexDirection: 'column',
    },
    setupCard: {
        flexBasis: '31.5%',
        minWidth: 250,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2ecf7',
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    stepCard: {
        flexBasis: '48%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2ecf7',
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    stepNumber: {
        fontSize: 12,
        color: '#2f64e6',
        fontWeight: '800',
        letterSpacing: 1.2,
        marginBottom: 10,
    },
    stepTitle: {
        fontSize: 18,
        color: '#0f2851',
        fontWeight: '800',
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    stepBody: {
        fontSize: 14,
        lineHeight: 21,
        color: '#5a6f87',
    },
    aboutBody: {
        fontSize: 16,
        lineHeight: 26,
        color: '#5a6f87',
        maxWidth: 940,
        marginBottom: 24,
        fontWeight: '400',
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
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2ecf7',
        paddingVertical: 16,
        paddingHorizontal: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    statValue: {
        color: '#1f52cb',
        fontWeight: '800',
        fontSize: 20,
        marginBottom: 6,
        letterSpacing: 0.2,
    },
    statLabel: {
        color: '#5a6f87',
        fontSize: 13,
        fontWeight: '500',
    },
    aboutButton: {
        alignSelf: 'flex-start',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#2f64e6',
        paddingVertical: 10,
        paddingHorizontal: 18,
        backgroundColor: '#ffffff',
        shadowColor: '#2f64e6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 1,
    },
    aboutButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.99 }],
    },
    aboutButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1f52cb',
        letterSpacing: 0.2,
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
