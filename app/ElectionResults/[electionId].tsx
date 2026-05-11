import type { CandidateRow } from '@/class/database-types';
import { serviceFactory } from '@/class/service-factory';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ElectionResultsPage() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const electionId = String(params?.electionId ?? '');

    const [candidates, setCandidates] = useState<CandidateRow[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const ledger = await serviceFactory.auditorService.getLedger(electionId);
                const c = await serviceFactory.votingService.getElectionCandidates(electionId);

                const map = new Map<string, number>();
                for (const candidate of c) map.set(candidate.id, 0);

                for (const vote of ledger) {
                    map.set(vote.encrypted_vote, (map.get(vote.encrypted_vote) ?? 0) + 1);
                }

                const obj: Record<string, number> = {};
                for (const candidate of c) {
                    obj[candidate.id] = map.get(candidate.id) ?? 0;
                }

                setCandidates(c);
                setCounts(obj);
            } catch (err) {
                console.warn('Failed to load election results:', err);
                Alert.alert('Results unavailable', 'The vote ledger service is offline. Returning to the home screen.');
                router.replace('/');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [electionId, router]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2f64e6" />
                <Text style={styles.loadingText}>Loading results...</Text>
            </View>
        );
    }

    const sorted = [...candidates].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
    const winner = sorted[0];

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Election Results</Text>
            {winner ? (
                <View style={styles.winnerBox}>
                    <Text style={styles.winnerLabel}>Winner</Text>
                    <Text style={styles.winnerName}>{winner.display_name}</Text>
                    <Text style={styles.winnerCount}>{counts[winner.id] ?? 0} vote{(counts[winner.id] ?? 0) === 1 ? '' : 's'}</Text>
                </View>
            ) : null}

            <View style={styles.resultsList}>
                {sorted.map((c) => (
                    <View key={c.id} style={styles.resultRow}>
                        <Text style={styles.resultName}>{c.display_name}</Text>
                        <Text style={styles.resultVotes}>{counts[c.id] ?? 0}</Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 24 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#556' },
    title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
    winnerBox: { padding: 16, borderRadius: 10, backgroundColor: '#eef9f0', marginBottom: 14 },
    winnerLabel: { fontSize: 12, fontWeight: '800', color: '#217a3d' },
    winnerName: { fontSize: 20, fontWeight: '900', marginTop: 6 },
    winnerCount: { marginTop: 6, color: '#3b5064' },
    resultsList: { marginTop: 8 },
    resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eef3fb' },
    resultName: { fontWeight: '700' },
    resultVotes: { fontWeight: '800' },
});
