import type { CandidateRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function CastVotePage() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const electionId = String(params?.electionId ?? '');

    const [candidates, setCandidates] = useState<CandidateRow[]>([]);
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const rows = await serviceFactory.votingService.getElectionCandidates(electionId);
                setCandidates(rows);
                setSelectedCandidateId(rows[0]?.id ?? null);
            } catch (err) {
                console.error('Failed to load candidates', err);
                Alert.alert('Error', 'Failed to load candidates for this election');
                router.replace('/VoterDashboard');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [electionId, router]);

    const submitVote = async () => {
        if (!selectedCandidateId) return;
        setSubmitting(true);
        try {
            await serviceFactory.votingService.castVote({ electionId, candidateId: selectedCandidateId });
            if (Platform.OS === 'web') {
                // use react-toastify on web (ToastContainer is added in layout)
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { toast } = require('react-toastify');
                toast.success('Vote submitted successfully');
                setTimeout(() => router.replace('/VoterDashboard'), 1200);
            } else {
                Alert.alert('Vote submitted successfully', undefined, [
                    { text: 'OK', onPress: () => router.replace('/VoterDashboard') }
                ]);
            }
        } catch (err: any) {
            console.error('Failed to cast vote', err);
            if (Platform.OS === 'web') {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { toast } = require('react-toastify');
                toast.error(err?.message ?? 'Failed to cast vote');
            } else {
                Alert.alert('Vote Failed', err?.message ?? 'Failed to cast vote');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2f64e6" />
                <Text style={styles.loadingText}>Loading candidates...</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.logoRow}>
                <Image
                    source={require('../../assets/images/splash-icon.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                />
                <Text style={styles.logoText}>VoteKro</Text>
            </View>
            {candidates.map((c) => {
                const selected = c.id === selectedCandidateId;
                return (
                    <Pressable
                        key={c.id}
                        style={({ pressed }) => [styles.candidateCard, selected && styles.candidateSelected, pressed && styles.pressed]}
                        onPress={() => setSelectedCandidateId(c.id)}
                    >
                        <Text style={styles.candidateName}>{c.candidate_number}. {c.display_name}</Text>
                        {c.party_name ? <Text style={styles.candidateParty}>{c.party_name}</Text> : null}
                    </Pressable>
                );
            })}

            {selectedCandidateId ? (
                <View style={styles.detailBox}>
                    <Text style={styles.detailTitle}>Selected Candidate</Text>
                    <Text style={styles.detailText}>{candidates.find(x => x.id === selectedCandidateId)?.display_name}</Text>
                    <Pressable
                        style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
                        onPress={submitVote}
                        disabled={submitting}
                    >
                        <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Vote'}</Text>
                    </Pressable>
                </View>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 24, alignItems: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#556' },
    title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
    logoImage: { width: 28, height: 28 },
    logoText: { fontSize: 22, fontWeight: '800', color: '#2f64e6' },
    candidateCard: { width: '100%', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#d9e0ec', marginBottom: 10, backgroundColor: '#fff' },
    candidateSelected: { borderColor: '#2f64e6', backgroundColor: '#eef4ff' },
    candidateName: { fontSize: 16, fontWeight: '700', color: '#1b2a47' },
    candidateParty: { marginTop: 4, color: '#5f6f83' },
    detailBox: { width: '100%', marginTop: 18, padding: 14, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e0ec' },
    detailTitle: { fontWeight: '800', marginBottom: 6 },
    detailText: { marginBottom: 12 },
    submitButton: { backgroundColor: '#2f64e6', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    submitText: { color: '#fff', fontWeight: '800' },
    pressed: { opacity: 0.92 },
});
