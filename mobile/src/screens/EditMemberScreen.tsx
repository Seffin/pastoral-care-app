import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { getMemberById, updateMember, MemberRecord } from '../db/localDb';
import { Theme } from '../theme';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'migrated', label: 'Migrated' },
  { value: 'moved_out', label: 'Moved Out' },
];

interface Props { route: any; navigation: any; theme: Theme; }

export function EditMemberScreen({ route, navigation, theme }: Props) {
  const t = theme;
  const { memberId } = route.params || {};
  const [member, setMember] = useState<MemberRecord | null>(null);
  const [status, setStatus] = useState('active');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [familyMembers, setFamilyMembers] = useState<{ name: string; age: string; isHospitalized: boolean }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (memberId) {
      getMemberById(memberId).then((m) => {
        if (m) {
          setMember(m);
          setStatus(m.membershipStatus);
          setPhone(m.phone);
          setLocation(m.location);
          setFamilyMembers(m.familyMembers);
        }
      });
    }
  }, [memberId]);

  const updateFamilyMember = (index: number, field: string, value: any) => {
    const updated = [...familyMembers];
    (updated[index] as any)[field] = value;
    setFamilyMembers(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMember(memberId, { status, phone, location, familyMembers });
      Alert.alert('Success', 'Member updated');
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (!member) return <View style={{ flex: 1, backgroundColor: t.bg }}><Text style={{ padding: 20, color: t.text }}>Loading...</Text></View>;

  const s = makeStyles(t);

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>{member.fullName}</Text>
      <Text style={s.subtitle}>
        {member.memberType === 'family' ? `👨‍👩‍👧‍👦 Family of ${member.familyCount}` : '👤 Individual'}
      </Text>

      <Text style={s.label}>Status</Text>
      <View style={s.statusRow}>
        {STATUS_OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[s.statusChip, status === o.value && s.statusChipActive]}
            onPress={() => setStatus(o.value)}
          >
            <Text style={[s.statusChipText, status === o.value && s.statusChipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Phone</Text>
      <TextInput style={s.input} placeholder="Phone number" placeholderTextColor={t.textSecondary} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

      <Text style={s.label}>Location</Text>
      <TextInput style={[s.input, { minHeight: 60 }]} placeholder="Address" placeholderTextColor={t.textSecondary} multiline value={location} onChangeText={setLocation} />

      {/* Family member editing */}
      {member.memberType === 'family' && familyMembers.length > 0 && (
        <>
          <Text style={s.label}>Family Members</Text>
          {familyMembers.map((fm, i) => (
            <View key={i} style={s.familyCard}>
              <Text style={s.familyTitle}>Member {i + 1}</Text>
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

      <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
        <Text style={s.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
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
    label: { fontSize: 14, fontWeight: '600', color: t.text, marginBottom: 6, marginTop: 18 },
    input: {
      backgroundColor: t.inputBg, color: t.inputText, borderWidth: 1, borderColor: t.border,
      borderRadius: 10, padding: 14, fontSize: 15,
    },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statusChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99,
      borderWidth: 1, borderColor: t.border, backgroundColor: t.chipBg,
    },
    statusChipActive: { backgroundColor: t.chipSelectedBg, borderColor: t.chipSelectedBg },
    statusChipText: { fontSize: 13, fontWeight: '600', color: t.chipText },
    statusChipTextActive: { color: t.chipSelectedText },
    familyCard: {
      backgroundColor: t.card, padding: 14, borderRadius: 12, marginTop: 10,
      borderWidth: 1, borderColor: t.border,
    },
    familyTitle: { fontSize: 14, fontWeight: '700', color: t.accent, marginBottom: 8 },
    switchRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: t.card, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: t.border,
    },
    switchLabel: { fontSize: 15, color: t.text },
    saveBtn: {
      backgroundColor: t.accent, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32,
    },
    saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  });
}
