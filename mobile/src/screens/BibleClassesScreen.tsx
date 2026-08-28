import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ScrollView, Alert, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getBibleClasses, addBibleClass, deleteBibleClass, BibleClassRecord } from '../db/localDb';
import { Theme } from '../theme';

const TIME_OPTIONS = ['Morning', 'Noon', 'Afternoon', 'Evening', 'Night', 'Late Night'];
const TODAY = new Date().toISOString().split('T')[0];

interface Props { navigation: any; theme: Theme; }

export function BibleClassesScreen({ theme: t }: Props) {
  const [records, setRecords] = useState<BibleClassRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [classDate, setClassDate] = useState(TODAY);
  const [timeOfDay, setTimeOfDay] = useState('Afternoon');
  const [topic, setTopic] = useState('');
  const [attendees, setAttendees] = useState('');
  const [notes, setNotes] = useState('');
  const [contribution, setContribution] = useState('');

  const load = useCallback(async () => {
    try { setRecords(await getBibleClasses()); }
    catch (e) { console.error('[BibleClasses] load:', e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const reset = () => {
    setClassDate(TODAY); setTimeOfDay('Afternoon'); setTopic('');
    setAttendees(''); setNotes(''); setContribution('');
  };

  const handleSave = async () => {
    if (!classDate.trim()) { Alert.alert('Validation', 'Please enter the class date.'); return; }
    if (!topic.trim())     { Alert.alert('Validation', 'Please enter the topic.');      return; }
    setSaving(true);
    try {
      await addBibleClass({
        classDate, timeOfDay, topic: topic.trim(),
        attendeesCount: parseInt(attendees, 10) || 0, notes, contribution,
      });
      reset(); setShowForm(false); load();
    } catch (e) {
      console.error('[BibleClasses] save:', e);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this class record?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteBibleClass(id); load(); }
        catch { Alert.alert('Error', 'Could not delete the record.'); }
      }},
    ]);
  };

  const s = styles(t);

  return (
    <View style={s.root}>
      <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(true)}>
        <Text style={s.addBtnText}>+ Log Bible Class</Text>
      </TouchableOpacity>

      <FlatList
        data={records}
        keyExtractor={r => r.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={s.empty}>No bible classes logged yet.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.cardMeta}>
                <Text style={s.cardDate}>📅 {item.classDate}</Text>
                <Text style={s.cardTime}>{item.timeOfDay}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.delBtn}>
                <Text style={s.delBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.cardTopic}>📖 {item.topic}</Text>
            <Text style={s.cardAttendees}>👥 {item.attendeesCount} attendees</Text>
            {item.notes ? <Text style={s.cardNotes}>{item.notes}</Text> : null}
            {item.contribution ? <Text style={s.cardContrib}>💰 Contribution: {item.contribution}</Text> : null}
          </View>
        )}
      />

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={[s.modal, { backgroundColor: t.bg }]} keyboardShouldPersistTaps="handled">
          <Text style={s.modalTitle}>Log Bible Class</Text>

          <Text style={s.label}>Class Date</Text>
          <TextInput style={s.input} value={classDate} onChangeText={setClassDate} placeholder="YYYY-MM-DD" placeholderTextColor={t.inputPlaceholder} />

          <Text style={s.label}>Time of Day</Text>
          <View style={s.chipRow}>
            {TIME_OPTIONS.map(o => (
              <TouchableOpacity key={o} style={[s.chip, timeOfDay === o && s.chipActive]} onPress={() => setTimeOfDay(o)}>
                <Text style={[s.chipText, timeOfDay === o && s.chipActiveText]}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Topic / Lesson Title</Text>
          <TextInput style={s.input} value={topic} onChangeText={setTopic} placeholder="e.g. The Sermon on the Mount" placeholderTextColor={t.inputPlaceholder} />

          <Text style={s.label}>Number of Attendees</Text>
          <TextInput style={s.input} value={attendees} onChangeText={setAttendees} keyboardType="numeric" placeholder="e.g. 15" placeholderTextColor={t.inputPlaceholder} />

          <Text style={s.label}>Notes</Text>
          <TextInput style={s.textarea} value={notes} onChangeText={setNotes} multiline placeholder="Key points, questions asked…" placeholderTextColor={t.inputPlaceholder} />

          <Text style={s.label}>Contribution (Optional)</Text>
          <TextInput style={s.input} value={contribution} onChangeText={setContribution} keyboardType="numeric" placeholder="Amount" placeholderTextColor={t.inputPlaceholder} />

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Class'}</Text>
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
    addBtn: { backgroundColor: '#10B981', margin: 14, padding: 14, borderRadius: 12, alignItems: 'center' },
    addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
    card: { backgroundColor: t.card, marginHorizontal: 14, marginBottom: 10, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    cardMeta: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    cardDate: { fontSize: 14, fontWeight: '700', color: t.text },
    cardTime: { fontSize: 12, color: t.textSecondary, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
    cardTopic: { fontSize: 15, fontWeight: '700', color: t.accent, marginBottom: 4 },
    cardAttendees: { fontSize: 13, color: t.textSecondary },
    cardNotes: { fontSize: 13, color: t.textMuted, marginTop: 6, fontStyle: 'italic' },
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
    chipActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
    chipText: { fontSize: 12, color: t.chipText },
    chipActiveText: { color: '#FFF', fontWeight: '600' },
    saveBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 28 },
    saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    cancelBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
    cancelBtnText: { color: t.textMuted, fontSize: 15 },
  });
}
