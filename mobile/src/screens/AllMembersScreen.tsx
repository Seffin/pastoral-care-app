import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getAllMembers, MemberRecord } from '../db/localDb';
import { Theme } from '../theme';

type Filter = 'all' | 'pending' | 'visited';

interface Props { navigation: any; theme: Theme; }

export function AllMembersScreen({ navigation, theme }: Props) {
  const t = theme;
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async (f: Filter) => {
    const data = await getAllMembers(f);
    setMembers(data);
  }, []);

  useFocusEffect(useCallback(() => { load(filter); }, [filter, load]));

  const handleFilterChange = (f: Filter) => {
    setFilter(f);
    load(f);
  };

  const s = makeStyles(t);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending Visit' },
    { key: 'visited', label: 'Visited This Month' },
  ];

  return (
    <View style={s.container}>
      {/* Filter chips */}
      <View style={s.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, filter === f.key && s.filterChipActive]}
            onPress={() => handleFilterChange(f.key)}
          >
            <Text style={[s.filterChipText, filter === f.key && s.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.countText}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>

      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
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
              </View>
              <View style={[s.gapBadge, item.daysSinceContact >= 90 ? s.gapBadgeOverdue : s.gapBadgeOk]}>
                <Text style={s.gapBadgeText}>
                  {item.daysSinceContact >= 9999 ? 'Never' : `${item.daysSinceContact}d`}
                </Text>
              </View>
            </View>
            {item.location ? <Text style={s.locationText}>📍 {item.location}</Text> : null}
            {item.membershipStatus !== 'active' && (
              <Text style={s.statusText}>{item.membershipStatus.replace('_', ' ').toUpperCase()}</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>No members found for this filter.</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 10 },
    filterChip: {
      flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: t.card,
      borderWidth: 1, borderColor: t.border, alignItems: 'center',
    },
    filterChipActive: { backgroundColor: t.accent, borderColor: t.accent },
    filterChipText: { fontSize: 12, fontWeight: '600', color: t.text },
    filterChipTextActive: { color: '#FFF' },
    countText: { fontSize: 13, color: t.textSecondary, paddingHorizontal: 14, paddingVertical: 8 },
    card: {
      backgroundColor: t.card, marginHorizontal: 14, marginVertical: 4, borderRadius: 12,
      padding: 14, borderWidth: 1, borderColor: t.border,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 16, fontWeight: '700', color: t.text },
    meta: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
    gapBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
    gapBadgeOverdue: { backgroundColor: t.badgeWarningBg },
    gapBadgeOk: { backgroundColor: t.badgeInfoBg },
    gapBadgeText: { fontSize: 12, fontWeight: '700', color: t.badgeText },
    locationText: { fontSize: 12, color: t.textSecondary, marginTop: 6 },
    statusText: { fontSize: 11, fontWeight: '700', color: t.textSecondary, marginTop: 4 },
    empty: { textAlign: 'center', marginTop: 40, color: t.textSecondary },
  });
}
