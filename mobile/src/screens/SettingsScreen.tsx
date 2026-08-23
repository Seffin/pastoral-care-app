import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { getSetting, setSetting } from '../db/localDb';
import { Theme } from '../theme';

interface Props { navigation: any; theme: Theme; onThemeChange: (mode: 'light' | 'dark') => void; }

export function SettingsScreen({ navigation, theme, onThemeChange }: Props) {
  const t = theme;
  const [gapMonths, setGapMonths] = useState('3');
  const [isDark, setIsDark] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSetting('visit_gap_months', '3'),
      getSetting('theme_mode', 'light'),
    ]).then(([gap, mode]) => {
      setGapMonths(gap);
      setIsDark(mode === 'dark');
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    const val = parseInt(gapMonths, 10);
    if (isNaN(val) || val < 1) { Alert.alert('Error', 'Enter a valid number'); return; }
    try {
      await setSetting('visit_gap_months', val.toString());
      Alert.alert('Saved', 'Settings updated');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to save');
    }
  };

  const toggleTheme = async (dark: boolean) => {
    setIsDark(dark);
    const mode = dark ? 'dark' : 'light';
    await setSetting('theme_mode', mode);
    onThemeChange(mode);
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: t.bg }}><Text style={{ padding: 20, color: t.text }}>Loading...</Text></View>;

  const s = makeStyles(t);

  return (
    <View style={s.container}>
      <Text style={s.title}>Settings</Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>Appearance</Text>
        <View style={s.row}>
          <Text style={s.rowLabel}>🌙 Dark Mode</Text>
          <Switch value={isDark} onValueChange={toggleTheme} />
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Visit Configuration</Text>
        <Text style={s.description}>Members not visited in this many months will be flagged as "Overdue".</Text>
        <TextInput
          style={s.input}
          keyboardType="numeric"
          value={gapMonths}
          onChangeText={setGapMonths}
          placeholder="3"
          placeholderTextColor={t.textSecondary}
        />
      </View>

      <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
        <Text style={s.saveBtnText}>Save Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 16 },
    title: { fontSize: 24, fontWeight: '700', color: t.text, marginBottom: 20 },
    card: {
      backgroundColor: t.card, borderRadius: 14, padding: 16, marginBottom: 16,
      borderWidth: 1, borderColor: t.border,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: t.text, marginBottom: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowLabel: { fontSize: 15, color: t.text },
    description: { fontSize: 13, color: t.textSecondary, marginBottom: 10 },
    input: {
      backgroundColor: t.inputBg, color: t.inputText, borderRadius: 10, padding: 14,
      fontSize: 16, borderWidth: 1, borderColor: t.border,
    },
    saveBtn: {
      backgroundColor: t.accent, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16,
    },
    saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  });
}
