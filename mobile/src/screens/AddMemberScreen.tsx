import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ScrollView, Alert } from 'react-native';
import { addMemberFull } from '../db/localDb';
import { Theme } from '../theme';

interface Props { navigation: any; route: any; theme: Theme; }

export function AddMemberScreen({ navigation, route, theme }: Props) {
  const t = theme;
  const [name, setName] = useState('');
  const [memberType, setMemberType] = useState<'individual' | 'family'>('individual');
  const [familyCount, setFamilyCount] = useState('');
  const [familyMembers, setFamilyMembers] = useState<{ name: string; age: string; isHospitalized: boolean }[]>([]);
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [isHospitalized, setIsHospitalized] = useState(false);

  const handleFamilyCountChange = (val: string) => {
    setFamilyCount(val);
    const count = parseInt(val, 10) || 0;
    const updated = [...familyMembers];
    while (updated.length < count) updated.push({ name: '', age: '', isHospitalized: false });
    setFamilyMembers(updated.slice(0, count));
  };

  const updateFamilyMember = (index: number, field: string, value: any) => {
    const updated = [...familyMembers];
    (updated[index] as any)[field] = value;
    setFamilyMembers(updated);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    const careFlags: string[] = [];
    if (memberType === 'individual' && isHospitalized) careFlags.push('hospitalized');

    try {
      await addMemberFull(
        name.trim(),
        memberType,
        memberType === 'family' ? (parseInt(familyCount, 10) || 0) : 0,
        memberType === 'family' ? familyMembers : [],
        phone.trim(),
        location.trim(),
        careFlags,
      );
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save');
    }
  };

  const s = makeStyles(t);

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      {/* Type selector */}
      <Text style={s.label}>Type</Text>
      <View style={s.chipRow}>
        {(['individual', 'family'] as const).map((tp) => (
          <TouchableOpacity
            key={tp}
            style={[s.chip, memberType === tp && s.chipSelected]}
            onPress={() => setMemberType(tp)}
          >
            <Text style={[s.chipText, memberType === tp && s.chipSelectedText]}>
              {tp === 'individual' ? '👤 Individual' : '👨‍👩‍👧‍👦 Family'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Name */}
      <Text style={s.label}>{memberType === 'family' ? 'Family Name' : 'Full Name'}</Text>
      <TextInput style={s.input} placeholder="e.g. Smith Family" placeholderTextColor={t.textSecondary} value={name} onChangeText={setName} />

      {/* Phone */}
      <Text style={s.label}>Phone Number</Text>
      <TextInput style={s.input} placeholder="e.g. +91 9876543210" placeholderTextColor={t.textSecondary} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

      {/* Location */}
      <Text style={s.label}>Location / Address</Text>
      <TextInput style={[s.input, { minHeight: 60 }]} placeholder="e.g. 12 Church St, Near Main Road" placeholderTextColor={t.textSecondary} multiline value={location} onChangeText={setLocation} />

      {/* Individual hospitalized toggle */}
      {memberType === 'individual' && (
        <>
          <Text style={s.label}>Care Status</Text>
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Hospitalized</Text>
            <Switch value={isHospitalized} onValueChange={setIsHospitalized} />
          </View>
        </>
      )}

      {/* Family members */}
      {memberType === 'family' && (
        <>
          <Text style={s.label}>Number of Family Members</Text>
          <TextInput style={s.input} placeholder="e.g. 4" placeholderTextColor={t.textSecondary} keyboardType="numeric" value={familyCount} onChangeText={handleFamilyCountChange} />

          {familyMembers.map((fm, i) => (
            <View key={i} style={s.familyCard}>
              <Text style={s.familyCardTitle}>Member {i + 1}</Text>
              <TextInput style={s.input} placeholder="Name" placeholderTextColor={t.textSecondary} value={fm.name} onChangeText={(v) => updateFamilyMember(i, 'name', v)} />
              <TextInput style={[s.input, { marginTop: 8 }]} placeholder="Age" placeholderTextColor={t.textSecondary} keyboardType="numeric" value={fm.age} onChangeText={(v) => updateFamilyMember(i, 'age', v)} />
              <View style={[s.switchRow, { marginTop: 8 }]}>
                <Text style={s.switchLabel}>Hospitalized</Text>
                <Switch value={fm.isHospitalized} onValueChange={(v) => updateFamilyMember(i, 'isHospitalized', v)} />
              </View>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity style={s.saveButton} onPress={handleSave}>
        <Text style={s.saveButtonText}>Save</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 16 },
    label: { fontSize: 14, fontWeight: '600', color: t.text, marginBottom: 6, marginTop: 18 },
    input: {
      backgroundColor: t.inputBg, color: t.inputText, borderRadius: 10, padding: 14,
      fontSize: 15, borderWidth: 1, borderColor: t.border,
    },
    chipRow: { flexDirection: 'row', gap: 10 },
    chip: {
      flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: t.border,
      backgroundColor: t.chipBg, alignItems: 'center',
    },
    chipSelected: { backgroundColor: t.chipSelectedBg, borderColor: t.chipSelectedBg },
    chipText: { fontSize: 14, fontWeight: '600', color: t.chipText },
    chipSelectedText: { color: t.chipSelectedText },
    switchRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: t.card, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: t.border,
    },
    switchLabel: { fontSize: 15, color: t.text },
    familyCard: {
      backgroundColor: t.card, padding: 14, borderRadius: 12, marginTop: 12,
      borderWidth: 1, borderColor: t.border,
    },
    familyCardTitle: { fontSize: 14, fontWeight: '700', color: t.accent, marginBottom: 8 },
    saveButton: {
      backgroundColor: t.accent, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32,
    },
    saveButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  });
}
