import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDashboardStats, DashboardStats } from '../db/localDb';
import { Theme } from '../theme';

interface Props { navigation: any; theme: Theme; }

interface ModuleCard {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  screen: string;
  tintKey: keyof Theme;
  accentColor: string;
}

const MODULES: ModuleCard[] = [
  {
    id: 'visits',
    icon: '🏠',
    title: 'House Visits',
    subtitle: 'Home visit records',
    screen: 'Members',
    tintKey: 'visitTint',
    accentColor: '#3B82F6',
  },
  {
    id: 'cottage',
    icon: '⛪',
    title: 'Cottage Meetings',
    subtitle: 'Home fellowship gatherings',
    screen: 'CottageMeetings',
    tintKey: 'cottageTint',
    accentColor: '#A855F7',
  },
  {
    id: 'fasting',
    icon: '🙏',
    title: 'Fasting & Prayers',
    subtitle: 'Corporate prayer sessions',
    screen: 'FastingPrayers',
    tintKey: 'fastingTint',
    accentColor: '#F97316',
  },
  {
    id: 'bible',
    icon: '📖',
    title: 'Bible Classes',
    subtitle: 'Teaching & study sessions',
    screen: 'BibleClasses',
    tintKey: 'bibleTint',
    accentColor: '#10B981',
  },
  {
    id: 'backup',
    icon: '💾',
    title: 'Backup & Restore',
    subtitle: 'Export or import your data',
    screen: 'Backup',
    tintKey: 'backupTint',
    accentColor: '#6B7280',
  },
];

export function OperationsDashboardScreen({ navigation, theme: t }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const s = await getDashboardStats();
      setStats(s);
    } catch (e) {
      console.error('[Dashboard] Failed to load stats:', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const s = styles(t);

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={t.accent} />}
    >
      {/* ── Header banner ─────────────────────────────────────── */}
      <View style={s.banner}>
        <Text style={s.bannerGreeting}>Welcome 👋</Text>
        <Text style={s.bannerTitle}>Church Connect</Text>
        <Text style={s.bannerSub}>Community care management</Text>
      </View>

      {/* ── Stats row ─────────────────────────────────────────── */}
      <View style={s.statsGrid}>
        <StatCard label="Members" value={stats?.totalMembers ?? '–'} icon="👥" color="#3B82F6" t={t} />
        <StatCard label="Visited" value={stats?.visitedThisMonth ?? '–'} icon="✅" color="#10B981" t={t} />
        <StatCard label="Pending" value={stats?.pendingVisit ?? '–'} icon="⏳" color="#F97316" t={t} />
        <StatCard label="Meetings" value={stats?.cottageMeetingsThisMonth ?? '–'} icon="⛪" color="#A855F7" t={t} />
      </View>

      {/* ── This month strip ──────────────────────────────────── */}
      <View style={s.monthStrip}>
        <Text style={s.monthLabel}>This Month</Text>
        <View style={s.monthRow}>
          <MiniStat icon="🙏" label="Fasting" value={stats?.fastingPrayersThisMonth ?? 0} t={t} />
          <View style={s.monthDivider} />
          <MiniStat icon="📖" label="Bible" value={stats?.bibleClassesThisMonth ?? 0} t={t} />
        </View>
      </View>

      {/* ── Module cards ─────────────────────────────────────── */}
      <Text style={s.sectionTitle}>Ministry Operations</Text>
      {MODULES.map(mod => (
        <TouchableOpacity
          key={mod.id}
          style={[s.moduleCard, { backgroundColor: t[mod.tintKey] as string }]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate(mod.screen)}
        >
          <View style={[s.moduleIcon, { backgroundColor: mod.accentColor + '22' }]}>
            <Text style={s.moduleIconText}>{mod.icon}</Text>
          </View>
          <View style={s.moduleText}>
            <Text style={[s.moduleTitle, { color: t.text }]}>{mod.title}</Text>
            <Text style={[s.moduleSub, { color: t.textSecondary }]}>{mod.subtitle}</Text>
          </View>
          <View style={[s.moduleChevron, { backgroundColor: mod.accentColor }]}>
            <Text style={s.moduleChevronText}>›</Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Mini components ───────────────────────────────────────────────
function StatCard({ label, value, icon, color, t }: any) {
  const s = statCardStyles(t, color);
  return (
    <View style={s.card}>
      <Text style={s.icon}>{icon}</Text>
      <Text style={s.value}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

function MiniStat({ icon, label, value, t }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: t.text }}>{value}</Text>
      <Text style={{ fontSize: 11, color: t.textMuted }}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
function styles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    content: { paddingBottom: 32 },
    banner: {
      backgroundColor: t.accent,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 28,
    },
    bannerGreeting: { fontSize: 13, color: '#C7D2FE', fontWeight: '500', marginBottom: 4 },
    bannerTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
    bannerSub: { fontSize: 13, color: '#C7D2FE', marginTop: 2 },
    statsGrid: {
      flexDirection: 'row',
      marginTop: -12,
      marginHorizontal: 14,
      gap: 10,
    },
    monthStrip: {
      backgroundColor: t.card,
      marginHorizontal: 14,
      marginTop: 14,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
    },
    monthLabel: { fontSize: 11, fontWeight: '700', color: t.textMuted, marginBottom: 12, letterSpacing: 0.5 },
    monthRow: { flexDirection: 'row', alignItems: 'center' },
    monthDivider: { width: 1, height: 40, backgroundColor: t.divider, marginHorizontal: 16 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: t.textMuted,
      letterSpacing: 0.5,
      marginHorizontal: 14,
      marginTop: 20,
      marginBottom: 10,
    },
    moduleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 14,
      marginBottom: 10,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: t.border,
    },
    moduleIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moduleIconText: { fontSize: 22 },
    moduleText: { flex: 1, marginLeft: 14 },
    moduleTitle: { fontSize: 15, fontWeight: '700' },
    moduleSub: { fontSize: 12, marginTop: 2 },
    moduleChevron: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moduleChevronText: { color: '#FFF', fontSize: 18, fontWeight: '700', lineHeight: 24 },
  });
}

function statCardStyles(t: Theme, color: string) {
  return StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: t.card,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.border,
      borderTopWidth: 3,
      borderTopColor: color,
    },
    icon: { fontSize: 16, marginBottom: 4 },
    value: { fontSize: 20, fontWeight: '800', color: t.text },
    label: { fontSize: 10, color: t.textMuted, fontWeight: '600', marginTop: 2 },
  });
}
