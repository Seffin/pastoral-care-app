import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { addVisit } from '../db/localDb';
import { Theme } from '../theme';

export type InteractionType = 'in_person' | 'phone_call' | 'video_call' | 'text_message' | 'other';
export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'late_night';

const INTERACTION_TYPES: { value: InteractionType; label: string }[] = [
  { value: 'in_person', label: 'In-Person' },
  { value: 'phone_call', label: 'Phone' },
  { value: 'video_call', label: 'Video' },
  { value: 'text_message', label: 'Text' },
  { value: 'other', label: 'Other' },
];

const TIME_OPTIONS: { value: TimeOfDay; label: string; icon: string }[] = [
  { value: 'morning', label: 'Morning', icon: '🌅' },
  { value: 'noon', label: 'Noon', icon: '☀️' },
  { value: 'afternoon', label: 'Afternoon', icon: '🌤' },
  { value: 'evening', label: 'Evening', icon: '🌆' },
  { value: 'night', label: 'Night', icon: '🌙' },
  { value: 'late_night', label: 'Late Night', icon: '🌑' },
];

interface Props { route: any; navigation: any; theme: Theme; }

export function VisitLoggerScreen({ route, navigation, theme }: Props) {
  const t = theme;
  const { memberId, memberName } = route.params || {};

  const [interactionType, setInteractionType] = useState<InteractionType>('in_person');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  const [notes, setNotes] = useState('');
  const [contribution, setContribution] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!visitDate.trim()) { Alert.alert('Error', 'Enter a visit date'); return; }
    setSubmitting(true);
    try {
      await addVisit(memberId, interactionType, visitDate, timeOfDay, notes, contribution, nextFollowUp || null);
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save visit');
    } finally {
      setSubmitting(false);
    }
  };

  if (!memberId) return <Text style={{ padding: 20, color: t.text }}>Error: No member selected.</Text>;

  const s = makeStyles(t);

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Log a Visit</Text>
      <Text style={s.subtitle}>{memberName}</Text>

      <Text style={s.label}>Visit Date</Text>
      <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor={t.textSecondary} value={visitDate} onChangeText={setVisitDate} />

      <Text style={s.label}>Time of Day</Text>
      <View style={s.chipRow}>
        {TIME_OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[s.chip, timeOfDay === o.value && s.chipSelected]}
            onPress={() => setTimeOfDay(o.value)}
          >
            <Text style={[s.chipText, timeOfDay === o.value && s.chipSelectedText]}>
              {o.icon} {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Interaction Type</Text>
      <View style={s.chipRow}>
        {INTERACTION_TYPES.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[s.chip, interactionType === o.value && s.chipSelected]}
            onPress={() => setInteractionType(o.value)}
          >
            <Text style={[s.chipText, interactionType === o.value && s.chipSelectedText]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Notes</Text>
      <TextInput style={s.notesInput} multiline placeholder="What was discussed?" placeholderTextColor={t.textSecondary} value={notes} onChangeText={setNotes} />

      <Text style={s.label}>Contribution (Optional)</Text>
      <TextInput style={s.input} placeholder="e.g. 50" placeholderTextColor={t.textSecondary} keyboardType="numeric" value={contribution} onChangeText={setContribution} />

      <Text style={s.label}>Next Follow-Up (Optional)</Text>
      <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor={t.textSecondary} value={nextFollowUp} onChangeText={setNextFollowUp} />

      <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.5 }]} onPress={handleSubmit} disabled={submitting}>
        <Text style={s.submitBtnText}>{submitting ? 'Saving…' : 'Save Visit'}</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 16 },
    title: { fontSize: 22, fontWeight: '700', color: t.text },
    subtitle: { fontSize: 14, color: t.textSecondary, marginBottom: 12 },
    label: { fontSize: 13, fontWeight: '600', color: t.text, marginBottom: 6, marginTop: 18 },
    input: {
      backgroundColor: t.inputBg, color: t.inputText, borderWidth: 1, borderColor: t.border,
      borderRadius: 10, padding: 14, fontSize: 15,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99,
      borderWidth: 1, borderColor: t.border, backgroundColor: t.chipBg,
    },
    chipSelected: { backgroundColor: t.chipSelectedBg, borderColor: t.chipSelectedBg },
    chipText: { fontSize: 12, color: t.chipText },
    chipSelectedText: { color: t.chipSelectedText },
    notesInput: {
      backgroundColor: t.inputBg, color: t.inputText, minHeight: 100,
      borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 14,
      textAlignVertical: 'top', fontSize: 15,
    },
    submitBtn: {
      backgroundColor: t.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 32,
    },
    submitBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  });
}
