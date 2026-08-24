import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getVisitsForMember, VisitRecord } from '../db/localDb';
import { Theme } from '../theme';

interface Props { route: any; navigation: any; theme: Theme; }

export function VisitHistoryScreen({ route, navigation, theme }: Props) {
  const t = theme;
  const { memberId, memberName } = route.params || {};
  const [visits, setVisits] = useState<VisitRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (memberId) getVisitsForMember(memberId).then(setVisits);
    }, [memberId])
  );

  const s = makeStyles(t);

  const formatTimeOfDay = (tod: string) => {
    const labels: Record<string, string> = {
      morning: '🌅 Morning', noon: '☀️ Noon', afternoon: '🌤 Afternoon',
      evening: '🌆 Evening', night: '🌙 Night', late_night: '🌑 Late Night',
    };
    return labels[tod] || tod;
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>{memberName}</Text>
      <Text style={s.subtitle}>{visits.length} visit{visits.length !== 1 ? 's' : ''} recorded</Text>

      <TouchableOpacity
        style={s.logButton}
        onPress={() => navigation.navigate('VisitLogger', { memberId, memberName })}
      >
        <Text style={s.logButtonText}>+ Log New Visit</Text>
      </TouchableOpacity>

      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardRow}>
              <Text style={s.dateText}>📅 {item.visitDate}</Text>
              <Text style={s.timeText}>{formatTimeOfDay(item.timeOfDay)}</Text>
            </View>
            <Text style={s.typeText}>{item.interactionType.replace('_', ' ').toUpperCase()}</Text>
            {item.notes ? <Text style={s.notesText}>{item.notes}</Text> : null}
            {item.nextFollowUp ? <Text style={s.followUpText}>📌 Follow-up: {item.nextFollowUp}</Text> : null}
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>No visits logged yet. Tap the button above to log the first one.</Text>}
        contentContainerStyle={{ paddingBottom: 30 }}
      />
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 16 },
    title: { fontSize: 22, fontWeight: '700', color: t.text },
    subtitle: { fontSize: 14, color: t.textSecondary, marginBottom: 12 },
    logButton: {
      backgroundColor: t.accent, padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 16,
    },
    logButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
    card: {
      backgroundColor: t.card, borderRadius: 12, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: t.border,
    },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    dateText: { fontSize: 15, fontWeight: '600', color: t.text },
    timeText: { fontSize: 13, color: t.textSecondary },
    typeText: { fontSize: 12, fontWeight: '600', color: t.accent, marginBottom: 4 },
    notesText: { fontSize: 13, color: t.text, marginTop: 4 },
    followUpText: { fontSize: 13, color: t.accent, marginTop: 4 },
    empty: { textAlign: 'center', marginTop: 40, color: t.textSecondary, fontSize: 14 },
  });
}

