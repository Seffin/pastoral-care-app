import React, { useState, useMemo, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  // Modern Date Picker Modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const initialDate = useMemo(() => {
    const parts = visitDate.split('-');
    return {
      year: parseInt(parts[0], 10) || new Date().getFullYear(),
      month: parseInt(parts[1], 10) || (new Date().getMonth() + 1),
      day: parseInt(parts[2], 10) || new Date().getDate(),
    };
  }, [visitDate]);

  const [pickerYear, setPickerYear] = useState(initialDate.year);
  const [pickerMonth, setPickerMonth] = useState(initialDate.month);
  const [pickerDay, setPickerDay] = useState(initialDate.day);

  const openPicker = () => {
    const parts = visitDate.split('-');
    setPickerYear(parseInt(parts[0], 10) || new Date().getFullYear());
    setPickerMonth(parseInt(parts[1], 10) || (new Date().getMonth() + 1));
    setPickerDay(parseInt(parts[2], 10) || new Date().getDate());
    setPickerVisible(true);
  };

  const confirmPicker = () => {
    const yyyy = pickerYear;
    const mm = String(pickerMonth).padStart(2, '0');
    const dd = String(pickerDay).padStart(2, '0');
    setVisitDate(`${yyyy}-${mm}-${dd}`);
    setPickerVisible(false);
  };

  // Days in selected month/year
  const daysInMonth = useMemo(() => {
    return new Date(pickerYear, pickerMonth, 0).getDate();
  }, [pickerYear, pickerMonth]);

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const list: number[] = [];
    for (let y = currentYear - 5; y <= currentYear + 2; y++) {
      list.push(y);
    }
    return list;
  }, []);

  // Quick 30-day ribbon
  const dateOptions = useMemo(() => {
    const days: { dateStr: string; dayLabel: string; dayNum: string; monthLabel: string }[] = [];
    const now = new Date();
    const dayShort = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      days.push({
        dateStr,
        dayLabel: i === 0 ? 'TODAY' : i === 1 ? 'YESTERDAY' : dayShort[d.getDay()],
        dayNum: String(d.getDate()),
        monthLabel: MONTH_SHORT[d.getMonth()],
      });
    }
    return days;
  }, []);

  // Formatted date title for display
  const formattedSelectedDate = useMemo(() => {
    const parts = visitDate.split('-');
    if (parts.length < 3) return visitDate;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    const dayName = DAY_NAMES[dateObj.getDay()] || '';
    const monthName = MONTH_NAMES[m] || '';
    return `${dayName}, ${d} ${monthName} ${y}`;
  }, [visitDate]);

  const formattedPickerDate = useMemo(() => {
    const dateObj = new Date(pickerYear, pickerMonth - 1, pickerDay);
    const dayName = DAY_NAMES[dateObj.getDay()] || '';
    const monthName = MONTH_NAMES[pickerMonth - 1] || '';
    return `${dayName}, ${pickerDay} ${monthName} ${pickerYear}`;
  }, [pickerYear, pickerMonth, pickerDay]);

  const handleSubmit = async () => {
    if (!visitDate.trim()) {
      Alert.alert('Error', 'Please select a visit date');
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
          <Text style={s.todayQuickBtn}>Set Today</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Scrollable 30-Day Ribbon */}
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
              style={[s.dateCard, isSelected && s.dateCardSelected]}
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

      {/* Selected Date Card with Modern Picker Trigger */}
      <TouchableOpacity style={s.dateDisplayCard} onPress={openPicker} activeOpacity={0.8}>
        <View style={s.dateDisplayLeft}>
          <Text style={s.dateDisplayIcon}>📅</Text>
          <View>
            <Text style={s.dateDisplayTitle}>{formattedSelectedDate}</Text>
            <Text style={s.dateDisplayHint}>Tap to open scrollable date picker</Text>
          </View>
        </View>
        <Text style={s.dateDisplayEditBtn}>Change ❯</Text>
      </TouchableOpacity>

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
        placeholder="YYYY-MM-DD (e.g. 2026-09-01)"
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

      {/* ── Modern Scrollable Date Picker Modal ── */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={s.modalCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Selected Date Preview */}
            <View style={s.pickerPreviewCard}>
              <Text style={s.pickerPreviewDate}>{formattedPickerDate}</Text>
            </View>

            {/* 3 Scrollable Wheel Columns: Day, Month, Year */}
            <View style={s.wheelsContainer}>
              {/* Day Column */}
              <View style={s.wheelColumn}>
                <Text style={s.wheelHeader}>Day</Text>
                <ScrollView style={s.wheelScrollView} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                    const active = pickerDay === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[s.wheelItem, active && s.wheelItemActive]}
                        onPress={() => setPickerDay(d)}
                      >
                        <Text style={[s.wheelItemText, active && s.wheelItemTextActive]}>
                          {String(d).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Month Column */}
              <View style={s.wheelColumnWide}>
                <Text style={s.wheelHeader}>Month</Text>
                <ScrollView style={s.wheelScrollView} showsVerticalScrollIndicator={false}>
                  {MONTH_NAMES.map((name, idx) => {
                    const m = idx + 1;
                    const active = pickerMonth === m;
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[s.wheelItem, active && s.wheelItemActive]}
                        onPress={() => {
                          setPickerMonth(m);
                          const maxDays = new Date(pickerYear, m, 0).getDate();
                          if (pickerDay > maxDays) setPickerDay(maxDays);
                        }}
                      >
                        <Text style={[s.wheelItemText, active && s.wheelItemTextActive]}>
                          {name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Year Column */}
              <View style={s.wheelColumn}>
                <Text style={s.wheelHeader}>Year</Text>
                <ScrollView style={s.wheelScrollView} showsVerticalScrollIndicator={false}>
                  {yearsList.map((y) => {
                    const active = pickerYear === y;
                    return (
                      <TouchableOpacity
                        key={y}
                        style={[s.wheelItem, active && s.wheelItemActive]}
                        onPress={() => setPickerYear(y)}
                      >
                        <Text style={[s.wheelItemText, active && s.wheelItemTextActive]}>
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={s.modalActionsRow}>
              <TouchableOpacity
                style={s.modalTodayBtn}
                onPress={() => {
                  const now = new Date();
                  setPickerYear(now.getFullYear());
                  setPickerMonth(now.getMonth() + 1);
                  setPickerDay(now.getDate());
                }}
              >
                <Text style={s.modalTodayText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirmBtn} onPress={confirmPicker}>
                <Text style={s.modalConfirmText}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    dateDisplayCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: 14,
      marginTop: 10,
    },
    dateDisplayLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    dateDisplayIcon: {
      fontSize: 22,
    },
    dateDisplayTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: t.text,
    },
    dateDisplayHint: {
      fontSize: 11,
      color: t.textSecondary,
      marginTop: 2,
    },
    dateDisplayEditBtn: {
      fontSize: 13,
      fontWeight: '700',
      color: t.accent,
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

    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: t.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderColor: t.border,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
    },
    modalCloseBtn: {
      fontSize: 18,
      fontWeight: '700',
      color: t.textSecondary,
      padding: 4,
    },
    pickerPreviewCard: {
      backgroundColor: t.inputBg,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      marginBottom: 16,
    },
    pickerPreviewDate: {
      fontSize: 15,
      fontWeight: '700',
      color: t.accent,
    },
    wheelsContainer: {
      flexDirection: 'row',
      height: 200,
      gap: 10,
      marginBottom: 20,
    },
    wheelColumn: {
      flex: 1,
      backgroundColor: t.inputBg,
      borderRadius: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    wheelColumnWide: {
      flex: 1.6,
      backgroundColor: t.inputBg,
      borderRadius: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    wheelHeader: {
      fontSize: 11,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    wheelScrollView: {
      width: '100%',
    },
    wheelItem: {
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 8,
      marginHorizontal: 6,
      marginVertical: 2,
      alignItems: 'center',
    },
    wheelItemActive: {
      backgroundColor: t.accent,
    },
    wheelItemText: {
      fontSize: 14,
      fontWeight: '600',
      color: t.text,
    },
    wheelItemTextActive: {
      color: '#FFFFFF',
      fontWeight: '800',
    },
    modalActionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    modalTodayBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.card,
      alignItems: 'center',
    },
    modalTodayText: {
      fontSize: 15,
      fontWeight: '700',
      color: t.text,
    },
    modalConfirmBtn: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: t.accent,
      alignItems: 'center',
    },
    modalConfirmText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}

