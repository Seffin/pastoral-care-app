import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { getAllMembers, deleteMember, getSetting, MemberRecord } from '../db/localDb';
import { Theme } from '../theme';

interface Props {
  navigation: any;
  theme: Theme;
}

export function DashboardScreen({ navigation, theme }: Props) {
  const t = theme;
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [gapDays, setGapDays] = useState(90);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const gapMonths = parseInt(await getSetting('visit_gap_months', '3'), 10) || 3;
      setGapDays(gapMonths * 30);
      const data = await getAllMembers('all');
      setMembers(data);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteMember(id); refresh(); } },
    ]);
  };

  const s = makeStyles(t);

  const renderBadge = (m: MemberRecord) => {
    if (m.membershipStatus !== 'active') {
      return (
        <View style={[s.badge, { backgroundColor: t.badgeInfoBg }]}>
          <Text style={s.badgeText}>{m.membershipStatus.replace('_', ' ').toUpperCase()}</Text>
        </View>
      );
    }
    if (m.daysSinceContact >= gapDays) {
      return (
        <View style={[s.badge, { backgroundColor: t.badgeWarningBg }]}>
          <Text style={s.badgeText}>⚠ OVERDUE</Text>
        </View>
      );
    }
    const hasHospitalized = m.careFlags.includes('hospitalized') ||
      m.familyMembers.some(fm => fm.isHospitalized);
    if (hasHospitalized) {
      return (
        <View style={[s.badge, { backgroundColor: t.badgeCriticalBg }]}>
          <Text style={s.badgeText}>🏥 HOSPITALIZED</Text>
        </View>
      );
    }
    return (
      <View style={[s.badge, { backgroundColor: t.badgeInfoBg }]}>
        <Text style={s.badgeText}>✓ ON TRACK</Text>
      </View>
    );
  };

  return (
    <View style={s.container}>
      {/* Quick filter bar */}
      <TouchableOpacity style={s.allMembersButton} onPress={() => navigation.navigate('AllMembers')}>
        <Text style={s.allMembersText}>📋 View All Members & Filters</Text>
      </TouchableOpacity>

      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('VisitHistory', { memberId: item.id, memberName: item.fullName })}
            activeOpacity={0.7}
          >
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.fullName}</Text>
                <Text style={s.meta}>
                  {item.memberType === 'family' ? `👨‍👩‍👧‍👦 Family of ${item.familyCount}` : '👤 Individual'}
                  {item.phone ? `  ·  📞 ${item.phone}` : ''}
                </Text>
                <Text style={s.daysBadge}>
                  {item.daysSinceContact >= 9999 ? 'Never visited' : `Last visited ${item.daysSinceContact} day${item.daysSinceContact !== 1 ? 's' : ''} ago`}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={s.editBtn}
                    onPress={() => navigation.navigate('EditMember', { memberId: item.id })}
                  >
                    <Text style={s.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item.id, item.fullName)}>
                    <Text style={s.deleteBtnText}>Del</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            {renderBadge(item)}
            {item.location ? <Text style={s.locationText}>📍 {item.location}</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>No members yet. Tap "+ Add" to get started.</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    allMembersButton: {
      backgroundColor: t.accent, marginHorizontal: 14, marginTop: 10, marginBottom: 6,
      padding: 12, borderRadius: 10, alignItems: 'center',
    },
    allMembersText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    card: {
      backgroundColor: t.card, marginHorizontal: 14, marginVertical: 5, borderRadius: 14,
      padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
      elevation: 2, borderWidth: 1, borderColor: t.border,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    name: { fontSize: 17, fontWeight: '700', color: t.text },
    meta: { fontSize: 13, color: t.textSecondary, marginTop: 3 },
    daysBadge: { fontSize: 13, color: t.accent, fontWeight: '600', marginTop: 4 },
    editBtn: { backgroundColor: t.border, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
    editBtnText: { fontSize: 12, fontWeight: '700', color: t.text },
    deleteBtn: { backgroundColor: t.danger, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
    deleteBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
    badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, marginTop: 10 },
    badgeText: { fontSize: 11, fontWeight: '700', color: t.badgeText },
    locationText: { fontSize: 12, color: t.textSecondary, marginTop: 6 },
    empty: { textAlign: 'center', marginTop: 60, color: t.textSecondary, fontSize: 15 },
  });
}
