import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  FlatList, RefreshControl, StyleSheet, Text,
  TouchableOpacity, View, Alert,
} from 'react-native';
import { getAllMembers, deleteMember, getSetting, MemberRecord } from '../db/localDb';
import { Theme } from '../theme';

interface Props { navigation: any; theme: Theme; }

export function DashboardScreen({ navigation, theme: t }: Props) {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [gapDays, setGapDays] = useState(90);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const gapMonths = parseInt(await getSetting('visit_gap_months', '3'), 10) || 3;
      setGapDays(gapMonths * 30);
      setMembers(await getAllMembers('all'));
    } catch (e) {
      console.error('[Dashboard] refresh:', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteMember(id); refresh(); }
          catch (e) { console.error('[Dashboard] delete:', e); Alert.alert('Error', 'Could not delete member.'); }
        },
      },
    ]);
  };

  const s = styles(t);

  const renderBadge = (m: MemberRecord) => {
    if (m.membershipStatus !== 'active') {
      return <BadgePill text={m.membershipStatus.replace('_', ' ').toUpperCase()} bg={t.badgeInfoBg} color={t.badgeText} />;
    }
    if (m.daysSinceContact >= gapDays) {
      return <BadgePill text="⚠ OVERDUE" bg={t.badgeWarningBg} color={t.warning} />;
    }
    const hospitalized = m.careFlags.includes('hospitalized') || m.familyMembers.some(f => f.isHospitalized);
    if (hospitalized) {
      return <BadgePill text="🏥 HOSPITALIZED" bg={t.badgeCriticalBg} color={t.danger} />;
    }
    return <BadgePill text="✓ ON TRACK" bg={t.badgeSuccessBg} color={t.success} />;
  };

  return (
    <View style={s.root}>
      <TouchableOpacity style={s.allBtn} onPress={() => navigation.navigate('AllMembers')}>
        <Text style={s.allBtnText}>📋 All Members & Filters</Text>
      </TouchableOpacity>

      <FlatList
        data={members}
        keyExtractor={m => m.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.accent} />}
        ListEmptyComponent={<Text style={s.empty}>No members yet. Tap + Add to get started.</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('VisitHistory', { memberId: item.id, memberName: item.fullName })}
          >
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.fullName}</Text>
                <Text style={s.meta}>
                  {item.memberType === 'family' ? `👨‍👩‍👧‍👦 Family of ${item.familyCount}` : '👤 Individual'}
                  {item.phone ? `  ·  📞 ${item.phone}` : ''}
                </Text>
                <Text style={[s.days, item.daysSinceContact >= gapDays && { color: t.warning }]}>
                  {item.daysSinceContact >= 9999
                    ? 'Never visited'
                    : `Last visited ${item.daysSinceContact}d ago`}
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity
                  style={[s.btn, { backgroundColor: t.accentLight }]}
                  onPress={() => navigation.navigate('EditMember', { memberId: item.id })}
                >
                  <Text style={[s.btnText, { color: t.accent }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, { backgroundColor: t.dangerLight }]}
                  onPress={() => handleDelete(item.id, item.fullName)}
                >
                  <Text style={[s.btnText, { color: t.danger }]}>Del</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.badgeRow}>{renderBadge(item)}</View>
            {item.location ? <Text style={s.location}>📍 {item.location}</Text> : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function BadgePill({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <View style={[badgeStyle.pill, { backgroundColor: bg }]}>
      <Text style={[badgeStyle.text, { color }]}>{text}</Text>
    </View>
  );
}

const badgeStyle = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  text: { fontSize: 11, fontWeight: '700' },
});

function styles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    allBtn: { backgroundColor: t.accent, margin: 14, padding: 13, borderRadius: 12, alignItems: 'center' },
    allBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    card: {
      backgroundColor: t.card, marginHorizontal: 14, marginBottom: 8,
      borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: t.border,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    name: { fontSize: 16, fontWeight: '700', color: t.text },
    meta: { fontSize: 12, color: t.textSecondary, marginTop: 3 },
    days: { fontSize: 12, color: t.accent, fontWeight: '600', marginTop: 4 },
    btn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, alignItems: 'center' },
    btnText: { fontSize: 12, fontWeight: '700' },
    badgeRow: { marginTop: 10 },
    location: { fontSize: 11, color: t.textMuted, marginTop: 6 },
    empty: { textAlign: 'center', marginTop: 60, color: t.textMuted, fontSize: 14 },
  });
}
