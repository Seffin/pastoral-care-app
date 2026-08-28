import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ScrollView, Alert, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getFastingPrayers, addFastingPrayer, deleteFastingPrayer, FastingPrayerRecord } from '../db/localDb';
import { Theme } from '../theme';

const TIME_OPTIONS = ['Morning', 'Noon', 'Afternoon', 'Evening', 'Night', 'Late Night'];
const TODAY = new Date().toISOString().split('T')[0];

interface Props { navigation: any; theme: Theme; }

export function FastingPrayersScreen({ theme: t }: Props) {
  const [records, setRecords] = useState<FastingPrayerRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [prayerDate, setPrayerDate] = useState(TODAY);
  const [timeOfDay, setTimeOfDay] = useState('Morning');
  const [attendees, setAttendees] = useState('');
  const [prayerRequests, setPrayerRequests] = useState('');
  const [notes, setNotes] = useState('');
  const [contribution, setContribution] = useState('');

  const load = useCallback(async () => {
    try { setRecords(await getFastingPrayers()); }
    catch (e) { console.error('[FastingPrayers] load:', e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const reset = () => {
    setPrayerDate(TODAY); setTimeOfDay('Morning'); setAttendees('');
    setPrayerRequests(''); setNotes(''); setContribution('');
  };

  const handleSave = async () => {
    if (!prayerDate.trim()) { Alert.alert('Validation', 'Please enter the prayer date.'); return; }
    setSaving(true);
    try {
      await addFastingPrayer({
        prayerDate, timeOfDay, attendeesCount: parseInt(attendees, 10) || 0,
        prayerRequests, notes, contribution,
      });
      reset(); setShowForm(false); load();
    } catch (e) {
      console.error('[FastingPrayers] save:', e);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this prayer record?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteFastingPrayer(id); load(); }
        catch { Alert.alert('Error', 'Could not delete the record.'); }
      }},
    ]);
  };

  const s = styles(t);

  return (
    <View style={s.root}>
      <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(true)}>
        <Text style={s.addBtnText}>+ Log Fasting Prayer</Text>
      </TouchableOpacity>

      <FlatList
        data={records}
        keyExtractor={r => r.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={s.empty}>No fasting prayers logged yet.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.cardMeta}>
                <Text style={s.cardDate}>📅 {item.prayerDate}</Text>
                <Text style={s.cardTime}>{item.timeOfDay}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.delBtn}>
                <Text style={s.delBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.cardAttendees}>👥 {item.attendeesCount} attendees</Text>
            {item.prayerRequests ? <Text style={s.cardPR}>🙏 {item.prayerRequests}</Text> : null}
            {item.notes ? <Text style={s.cardNotes}>{item.notes}</Text> : null}
            {item.contribution ? <Text style={s.cardContrib}>💰 Contribution: {item.contribution}</Text> : null}
          </View>
        )}
      />

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={[s.modal, { backgroundColor: t.bg }]} keyboardShouldPersistTaps="handled">
          <Text style={s.modalTitle}>Log Fasting Prayer</Text>

          <Text style={s.label}>Prayer Date</Text>
          <TextInput style={s.input} value={prayerDate} onChangeText={setPrayerDate} placeholder="YYYY-MM-DD" placeholderTextColor={t.inputPlaceholder} />

          <Text style={s.label}>Time of Day</Text>
          <View style={s.chipRow}>
            {TIME_OPTIONS.map(o => (
              <TouchableOpacity key={o} style={[s.chip, timeOfDay === o && s.chipActive]} onPress={() => setTimeOfDay(o)}>
                <Text style={[s.chipText, timeOfDay === o && s.chipActiveText]}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Number of Attendees</Text>
          <TextInput style={s.input} value={attendees} onChangeText={setAttendees} keyboardType="numeric" placeholder="e.g. 20" placeholderTextColor={t.inputPlaceholder} />

          <Text style={s.label}>Prayer Requests</Text>
          <TextInput style={s.textarea} value={prayerRequests} onChangeText={setPrayerRequests} multiline placeholder="Key prayer topics and requests…" placeholderTextColor={t.inputPlaceholder} />

          <Text style={s.label}>Notes</Text>
          <TextInput style={s.textarea} value={notes} onChangeText={setNotes} multiline placeholder="Additional observations…" placeholderTextColor={t.inputPlaceholder} />

          <Text style={s.label}>Contribution (Optional)</Text>
          <TextInput style={s.input} value={contribution} onChangeText={setContribution} keyboardType="numeric" placeholder="Amount" placeholderTextColor={t.inputPlaceholder} />

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Prayer'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={() => { reset(); setShowForm(false); }}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </Modal>
    </View>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    addBtn: { backgroundColor: '#F97316', margin: 14, padding: 14, borderRadius: 12, alignItems: 'center' },
    addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
    card: { backgroundColor: t.card, marginHorizontal: 14, marginBottom: 10, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    cardMeta: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    cardDate: { fontSize: 14, fontWeight: '700', color: t.text },
    cardTime: { fontSize: 12, color: t.textSecondary, backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
    cardAttendees: { fontSize: 13, color: t.textSecondary, marginBottom: 4 },
    cardPR: { fontSize: 13, color: t.text, marginTop: 4 },
    cardNotes: { fontSize: 13, color: t.textMuted, marginTop: 4, fontStyle: 'italic' },
    cardContrib: { fontSize: 13, color: t.success, marginTop: 4 },
    delBtn: { padding: 4 },
    delBtnText: { fontSize: 16, color: t.textMuted },
    empty: { textAlign: 'center', marginTop: 60, color: t.textMuted, fontSize: 14 },
    modal: { flex: 1, padding: 20 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: t.text, marginBottom: 20, marginTop: 10 },
    label: { fontSize: 13, fontWeight: '600', color: t.textSecondary, marginBottom: 6, marginTop: 16 },
    input: { backgroundColor: t.inputBg, color: t.inputText, borderWidth: 1, borderColor: t.inputBorder, borderRadius: 10, padding: 14, fontSize: 15 },
    textarea: { backgroundColor: t.inputBg, color: t.inputText, borderWidth: 1, borderColor: t.inputBorder, borderRadius: 10, padding: 14, fontSize: 15, minHeight: 90, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: t.border, backgroundColor: t.chipBg },
    chipActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
    chipText: { fontSize: 12, color: t.chipText },
    chipActiveText: { color: '#FFF', fontWeight: '600' },
    saveBtn: { backgroundColor: '#F97316', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 28 },
    saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    cancelBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
    cancelBtnText: { color: t.textMuted, fontSize: 15 },
  });
}
