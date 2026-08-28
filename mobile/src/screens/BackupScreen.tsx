import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Share, TextInput, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { exportBackupJson, importBackupJson } from '../db/localDb';
import { Theme } from '../theme';

interface Props { navigation: any; theme: Theme; }

export function BackupScreen({ theme: t }: Props) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  // ── Export ────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const json = await exportBackupJson();
      const filename = `pastoral_backup_${new Date().toISOString().split('T')[0]}.json`;
      await Share.share({
        title: filename,
        message: json,
      });
    } catch (e: any) {
      // User cancelled share dialog – not an error
      if (e?.message !== 'User did not share') {
        console.error('[Backup] export error:', e);
        Alert.alert('Export Failed', 'Could not generate the backup. Please try again.');
      }
    } finally {
      setExporting(false);
    }
  };

  // ── Import ────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!importText.trim()) {
      Alert.alert('Validation', 'Please paste your backup JSON into the text box.');
      return;
    }

    Alert.alert(
      'Restore Backup',
      'This will replace all current records with the backup data. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setImporting(true);
            try {
              await importBackupJson(importText.trim());
              setImportText('');
              setShowImport(false);
              Alert.alert('✅ Restored', 'Your data has been restored successfully. Navigate back to see the updated records.');
            } catch (e: any) {
              console.error('[Backup] import error:', e);
              Alert.alert('Import Failed', e?.message || 'The backup could not be read. Make sure you pasted the full JSON correctly.');
            } finally {
              setImporting(false);
            }
          },
        },
      ],
    );
  };

  const s = styles(t);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      {/* Export card */}
      <View style={s.card}>
        <Text style={s.cardIcon}>📤</Text>
        <Text style={s.cardTitle}>Export Backup</Text>
        <Text style={s.cardDesc}>
          Generates a complete JSON backup of all your church records — members, visits, cottage
          meetings, fasting prayers, and bible classes. Share via WhatsApp, Email, or save to Files.
        </Text>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: t.accent }, exporting && s.btnDisabled]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator color="#FFF" />
            : <Text style={s.actionBtnText}>Share Backup File</Text>}
        </TouchableOpacity>
      </View>

      {/* Import card */}
      <View style={s.card}>
        <Text style={s.cardIcon}>📥</Text>
        <Text style={s.cardTitle}>Restore from Backup</Text>
        <Text style={s.cardDesc}>
          Paste the backup JSON you received to restore all records. ⚠ This will replace all current data.
        </Text>

        {!showImport ? (
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: t.warning }]} onPress={() => setShowImport(true)}>
            <Text style={s.actionBtnText}>Paste Backup to Restore</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              style={s.textarea}
              value={importText}
              onChangeText={setImportText}
              multiline
              placeholder={'Paste your backup JSON here…\n{"version":2,"exportedAt":…}'}
              placeholderTextColor={t.inputPlaceholder}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: t.danger, marginTop: 10 }, importing && s.btnDisabled]}
              onPress={handleImport}
              disabled={importing}
            >
              {importing
                ? <ActivityIndicator color="#FFF" />
                : <Text style={s.actionBtnText}>Restore Data</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowImport(false); setImportText(''); }}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Info box */}
      <View style={s.infoBox}>
        <Text style={s.infoTitle}>ℹ About backups</Text>
        <Text style={s.infoText}>
          • Backups are plain JSON text — you can read and store them anywhere.{'\n'}
          • Share the file to another phone to migrate all data.{'\n'}
          • The theme setting is preserved separately and will not be overwritten on restore.{'\n'}
          • This app is cloud-ready — syncing to a server will be added in a future update.
        </Text>
      </View>
    </ScrollView>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingBottom: 40 },
    card: {
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    cardIcon: { fontSize: 36, marginBottom: 10 },
    cardTitle: { fontSize: 18, fontWeight: '800', color: t.text, marginBottom: 8, textAlign: 'center' },
    cardDesc: { fontSize: 13, color: t.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    actionBtn: {
      width: '100%',
      padding: 15,
      borderRadius: 12,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.5 },
    actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
    textarea: {
      width: '100%',
      backgroundColor: t.inputBg,
      color: t.inputText,
      borderWidth: 1,
      borderColor: t.inputBorder,
      borderRadius: 10,
      padding: 14,
      fontSize: 13,
      fontFamily: 'monospace',
      minHeight: 160,
      textAlignVertical: 'top',
    },
    cancelBtn: { paddingVertical: 12, alignItems: 'center' },
    cancelBtnText: { color: t.textMuted, fontSize: 14 },
    infoBox: {
      backgroundColor: t.accentLight,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: t.accent + '40',
    },
    infoTitle: { fontSize: 14, fontWeight: '700', color: t.accent, marginBottom: 8 },
    infoText: { fontSize: 12, color: t.textSecondary, lineHeight: 20 },
  });
}
