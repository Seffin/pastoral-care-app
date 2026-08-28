import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Text, StatusBar, StyleSheet } from 'react-native';

// Screens
import { OperationsDashboardScreen } from './src/screens/OperationsDashboardScreen';
import { DashboardScreen }           from './src/screens/DashboardScreen';
import { VisitHistoryScreen }        from './src/screens/VisitHistoryScreen';
import { VisitLoggerScreen }         from './src/screens/VisitLoggerScreen';
import { AddMemberScreen }           from './src/screens/AddMemberScreen';
import { EditMemberScreen }          from './src/screens/EditMemberScreen';
import { AllMembersScreen }          from './src/screens/AllMembersScreen';
import { SettingsScreen }            from './src/screens/SettingsScreen';
import { CottageMeetingsScreen }     from './src/screens/CottageMeetingsScreen';
import { FastingPrayersScreen }      from './src/screens/FastingPrayersScreen';
import { BibleClassesScreen }        from './src/screens/BibleClassesScreen';
import { BackupScreen }              from './src/screens/BackupScreen';

// DB & Theme
import { getDb, getSetting }  from './src/db/localDb';
import { getTheme }           from './src/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    getDb()
      .then(async () => {
        const mode = await getSetting('theme_mode', 'light');
        setThemeMode(mode as 'light' | 'dark');
        setDbReady(true);
      })
      .catch(err => {
        console.error('[App] DB init failed:', err);
        // Still mark as ready so user sees an error state, not a blank screen
        setDbReady(true);
      });
  }, []);

  if (!dbReady) {
    return null; // Splash / loading handled by OS
  }

  const theme = getTheme(themeMode);
  const isDark = themeMode === 'dark';

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: theme.bg,
      card: theme.headerBg,
      text: theme.headerText,
      border: theme.border,
      primary: theme.accent,
    },
  };

  const hStyle  = { backgroundColor: theme.headerBg };
  const hTint   = theme.headerText;
  const hTitle  = { fontWeight: '700' as const, fontSize: 16 };

  // Shortcut to inject theme into any screen component
  const screen = (Comp: React.ComponentType<any>, extra?: object) =>
    (props: any) => <Comp {...props} theme={theme} {...extra} />;

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.headerBg}
      />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerStyle: hStyle, headerTintColor: hTint, headerTitleStyle: hTitle }}>

          {/* ── Main operations hub ─────────────────────────────── */}
          <Stack.Screen
            name="Home"
            options={({ navigation }) => ({
              title: 'Pastoral Care',
              headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={s.iconBtn}>
                  <Text style={{ fontSize: 20 }}>⚙️</Text>
                </TouchableOpacity>
              ),
            })}
          >
            {screen(OperationsDashboardScreen)}
          </Stack.Screen>

          {/* ── Member visits ────────────────────────────────────── */}
          <Stack.Screen
            name="Members"
            options={({ navigation }) => ({
              title: 'House Visits',
              headerRight: () => (
                <TouchableOpacity
                  style={[s.addBtn, { backgroundColor: theme.accent }]}
                  onPress={() => navigation.navigate('AddMember')}
                >
                  <Text style={s.addBtnText}>+ Add</Text>
                </TouchableOpacity>
              ),
            })}
          >
            {screen(DashboardScreen)}
          </Stack.Screen>

          <Stack.Screen name="AllMembers"   options={{ title: 'All Members' }}>
            {screen(AllMembersScreen)}
          </Stack.Screen>
          <Stack.Screen name="VisitHistory" options={{ title: 'Visit History' }}>
            {screen(VisitHistoryScreen)}
          </Stack.Screen>
          <Stack.Screen name="VisitLogger"  options={{ title: 'Log Visit' }}>
            {screen(VisitLoggerScreen)}
          </Stack.Screen>
          <Stack.Screen name="AddMember"    options={{ title: 'Add Member / Family' }}>
            {screen(AddMemberScreen)}
          </Stack.Screen>
          <Stack.Screen name="EditMember"   options={{ title: 'Edit Member' }}>
            {screen(EditMemberScreen)}
          </Stack.Screen>

          {/* ── Activity logs ────────────────────────────────────── */}
          <Stack.Screen name="CottageMeetings" options={{ title: 'Cottage Meetings' }}>
            {screen(CottageMeetingsScreen)}
          </Stack.Screen>
          <Stack.Screen name="FastingPrayers"  options={{ title: 'Fasting & Prayers' }}>
            {screen(FastingPrayersScreen)}
          </Stack.Screen>
          <Stack.Screen name="BibleClasses"    options={{ title: 'Bible Classes' }}>
            {screen(BibleClassesScreen)}
          </Stack.Screen>

          {/* ── Utilities ────────────────────────────────────────── */}
          <Stack.Screen name="Backup"   options={{ title: 'Backup & Restore' }}>
            {screen(BackupScreen)}
          </Stack.Screen>
          <Stack.Screen name="Settings" options={{ title: 'Settings' }}>
            {(props) => <SettingsScreen {...props} theme={theme} onThemeChange={setThemeMode} />}
          </Stack.Screen>

        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

const s = StyleSheet.create({
  iconBtn: { padding: 4 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});
