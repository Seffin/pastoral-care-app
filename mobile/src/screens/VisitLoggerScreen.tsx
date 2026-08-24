import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { addVisit } from '../db/localDb';
import { Theme } from '../theme';

export type InteractionType = 'in_person' | 'phone_call' | 'video_call' | 'text_message' | 'other';
export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'late_night';

const INTERACTION_TYPES: { value: InteractionType; label: string }[] = [
  { value: 'in_person', label: '🤝 In-Person' },
  { value: 'phone_call', label: '📞 Phone Call' },
  { value: 'video_call', label: '📹 Video Call' },
  { value: 'text_message', label: '💬 Text Message' },
  { value: 'other', label: '✨ Other' },
];

const TIME_OPTIONS: { value: TimeOfDay; label: string; icon: string }[] = [
  { value: 'morning', label: 'Morning', icon: '🌅' },
  { value: 'noon', label: 'Noon', icon: '☀️' },
  { value: 'afternoon', label: 'Afternoon', icon: '🌤' },
  { value: 'evening', label: 'Evening', icon: '🌆' },
  { value: 'night', label: 'Night', icon: '🌙' },
  { value: 'late_night', label: 'Late Night', icon: '🌑' },
];

interface Props {
  route: any;
  navigation: any;
  theme: Theme;
}

export function VisitLoggerScreen({ route, navigation, theme }: Props) {
  const t = theme;
  const { memberId, memberName } = route.params || {};

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [interactionType, setInteractionType] = useState<InteractionType>('in_person');
  const [visitDate, setVisitDate] = useState(todayStr);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  const [notes, setNotes] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Generate recent 30 dates for the horizontal date strip
  const dateOptions = useMemo(() => {
    const days: { dateStr: string; dayLabel: string; dayNum: string; monthLabel: string; isToday: boolean; isYesterday: boolean }[] = [];
    const now = new Date();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      days.push({
        dateStr,
        dayLabel: i === 0 ? 'TODAY' : i === 1 ? 'YESTERDAY' : dayNames[d.getDay()],
        dayNum: String(d.getDate()),
        monthLabel: monthNames[d.getMonth()],
        isToday: i === 0,
        isYesterday: i === 1,
      });
    }
    return days;
  }, []);

  const handleSubmit = async () => {
    if (!visitDate.trim()) {
      Alert.alert('Error', 'Please enter or select a visit date');
      return;
    }
    setSubmitting(true);
    try {
      await addVisit(memberId, interactionType, visitDate.trim(), timeOfDay, notes.trim(), nextFollowUp.trim() || null);
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
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.title}>Log a Visit</Text>
      <Text style={s.subtitle}>{memberName}</Text>

      {/* Date Header & Quick Selector */}
      <View style={s.sectionHeaderRow}>
        <Text style={s.label}>Visit Date</Text>
        <TouchableOpacity onPress={() => setVisitDate(todayStr)}>
          <Text style={s.todayQuickBtn}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Date Strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.dateScrollContainer}
      >
        {dateOptions.map((item) => {
          const isSelected = visitDate === item.dateStr;
          return (
            <TouchableOpacity
              key={item.dateStr}
              style={[
                s.dateCard,
                isSelected && s.dateCardSelected,
              ]}
              onPress={() => setVisitDate(item.dateStr)}
              activeOpacity={0.7}
            >
              <Text style={[s.dateDayLabel, isSelected && s.dateTextSelected]}>
                {item.dayLabel}
              </Text>
              <Text style={[s.dateDayNum, isSelected && s.dateTextSelected]}>
                {item.dayNum}
              </Text>
              <Text style={[s.dateMonthLabel, isSelected && s.dateTextSelected]}>
                {item.monthLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Custom/Exact Date Input */}
      <TextInput
        style={s.input}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={t.textSecondary}
        value={visitDate}
        onChangeText={setVisitDate}
      />

      {/* Time of Day Selection */}
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

      {/* Interaction Type Selection */}
      <Text style={s.label}>Interaction Type</Text>
      <View style={s.chipRow}>
        {INTERACTION_TYPES.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[s.chip, interactionType === o.value && s.chipSelected]}
            onPress={() => setInteractionType(o.value)}
          >
            <Text style={[s.chipText, interactionType === o.value && s.chipSelectedText]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pastoral Notes */}
      <Text style={s.label}>Pastoral Notes</Text>
      <TextInput
        style={s.notesInput}
        multiline
        placeholder="What was discussed? Prayer requests, family updates..."
        placeholderTextColor={t.textSecondary}
        value={notes}
        onChangeText={setNotes}
      />

      {/* Next Follow-Up Date */}
      <Text style={s.label}>Next Follow-Up (Optional)</Text>
      <TextInput
        style={s.input}
        placeholder="YYYY-MM-DD (e.g. next week)"
        placeholderTextColor={t.textSecondary}
        value={nextFollowUp}
        onChangeText={setNextFollowUp}
      />

      {/* Submit Button */}
      <TouchableOpacity
        style={[s.submitBtn, submitting && { opacity: 0.5 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={s.submitBtnText}>{submitting ? 'Saving…' : 'Save Visit'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 16 },
    title: { fontSize: 22, fontWeight: '700', color: t.text },
    subtitle: { fontSize: 14, color: t.textSecondary, marginBottom: 12 },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 14,
      marginBottom: 6,
    },
    label: { fontSize: 13, fontWeight: '600', color: t.text, marginBottom: 6, marginTop: 14 },
    todayQuickBtn: { fontSize: 13, color: t.accent, fontWeight: '700' },
    dateScrollContainer: {
      paddingVertical: 6,
      gap: 8,
    },
    dateCard: {
      width: 68,
      height: 76,
      borderRadius: 12,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
    },
    dateCardSelected: {
      backgroundColor: t.accent,
      borderColor: t.accent,
      elevation: 2,
    },
    dateDayLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
    },
    dateDayNum: {
      fontSize: 18,
      fontWeight: '800',
      color: t.text,
      marginVertical: 2,
    },
    dateMonthLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: t.textSecondary,
      textTransform: 'uppercase',
    },
    dateTextSelected: {
      color: '#FFFFFF',
    },
    input: {
      backgroundColor: t.inputBg,
      color: t.inputText,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      padding: 14,
      fontSize: 15,
      marginTop: 8,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 99,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.chipBg,
    },
    chipSelected: { backgroundColor: t.chipSelectedBg, borderColor: t.chipSelectedBg },
    chipText: { fontSize: 12, color: t.chipText, fontWeight: '500' },
    chipSelectedText: { color: t.chipSelectedText, fontWeight: '700' },
    notesInput: {
      backgroundColor: t.inputBg,
      color: t.inputText,
      minHeight: 110,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      padding: 14,
      textAlignVertical: 'top',
      fontSize: 15,
    },
    submitBtn: {
      backgroundColor: t.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 28,
    },
    submitBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  });
}

