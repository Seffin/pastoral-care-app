// ─────────────────────────────────────────────────────────────────
//  App.tsx  —  Church Connect
//  Root component. Initialises DB, loads theme, wires navigation.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, TouchableOpacity, StatusBar, StyleSheet } from 'react-native';

// ── Screens ───────────────────────────────────────────────────────
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

// ── DB & Theme ────────────────────────────────────────────────────
import { getDb, getSetting } from './src/db/localDb';
import { getTheme, Theme }   from './src/theme';

const Stack = createNativeStackNavigator();

// ─────────────────────────────────────────────────────────────────
//  Screen wrappers  (defined OUTSIDE App to avoid remount on rerender)
//  They capture `theme` and `onThemeChange` via closure updated by
//  a ref pattern — this is the safe RN way to avoid stale closures.
// ─────────────────────────────────────────────────────────────────
type ThemeChangeHandler = (mode: 'light' | 'dark') => void;

function makeScreens(theme: Theme, onThemeChange: ThemeChangeHandler) {
  return {
    Home:             (p: any) => <OperationsDashboardScreen {...p} theme={theme} />,
    Members:          (p: any) => <DashboardScreen           {...p} theme={theme} />,
    AllMembers:       (p: any) => <AllMembersScreen          {...p} theme={theme} />,
    VisitHistory:     (p: any) => <VisitHistoryScreen        {...p} theme={theme} />,
    VisitLogger:      (p: any) => <VisitLoggerScreen         {...p} theme={theme} />,
    AddMember:        (p: any) => <AddMemberScreen           {...p} theme={theme} />,
    EditMember:       (p: any) => <EditMemberScreen          {...p} theme={theme} />,
    CottageMeetings:  (p: any) => <CottageMeetingsScreen     {...p} theme={theme} />,
    FastingPrayers:   (p: any) => <FastingPrayersScreen      {...p} theme={theme} />,
    BibleClasses:     (p: any) => <BibleClassesScreen        {...p} theme={theme} />,
    Backup:           (p: any) => <BackupScreen              {...p} theme={theme} />,
    Settings:         (p: any) => <SettingsScreen            {...p} theme={theme} onThemeChange={onThemeChange} />,
  };
}

export default function App() {
  const [dbReady,    setDbReady]   = useState(false);
  const [dbError,    setDbError]   = useState<string | null>(null);
  const [themeMode,  setThemeMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    getDb()
      .then(() => getSetting('theme_mode', 'light'))
      .then(mode => {
        setThemeMode(mode as 'light' | 'dark');
        setDbReady(true);
      })
      .catch(err => {
        console.error('[App] DB init failed:', err);
        setDbError(String(err));
        setDbReady(true); // show error screen rather than blank
      });
  }, []);

  // ── Loading splash ────────────────────────────────────────────
  if (!dbReady) {
    return (
      <View style={s.splash}>
        <Text style={s.splashIcon}>⛪</Text>
        <Text style={s.splashText}>Church Connect</Text>
        <Text style={s.splashSub}>Loading…</Text>
      </View>
    );
  }

  // ── DB error screen ───────────────────────────────────────────
  if (dbError) {
    return (
      <View style={s.splash}>
        <Text style={s.splashIcon}>⚠️</Text>
        <Text style={s.splashText}>Database Error</Text>
        <Text style={s.splashSub}>{dbError}</Text>
      </View>
    );
  }

  const theme  = getTheme(themeMode);
  const isDark = themeMode === 'dark';

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: theme.bg,
      card:       theme.headerBg,
      text:       theme.headerText,
      border:     theme.border,
      primary:    theme.accent,
    },
  };

  const screens = makeScreens(theme, setThemeMode);

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.headerBg}
      />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: theme.headerBg },
            headerTintColor: theme.headerText,
            headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          }}
        >
          {/* ── Home ──────────────────────────────────────────── */}
          <Stack.Screen
            name="Home"
            component={screens.Home}
            options={({ navigation }) => ({
              title: 'Church Connect',
              headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={s.iconBtn}>
                  <Text style={{ fontSize: 20 }}>⚙️</Text>
                </TouchableOpacity>
              ),
            })}
          />

          {/* ── Member visits ─────────────────────────────────── */}
          <Stack.Screen
            name="Members"
            component={screens.Members}
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
          />
          <Stack.Screen name="AllMembers"   component={screens.AllMembers}   options={{ title: 'All Members' }} />
          <Stack.Screen name="VisitHistory" component={screens.VisitHistory} options={{ title: 'Visit History' }} />
          <Stack.Screen name="VisitLogger"  component={screens.VisitLogger}  options={{ title: 'Log Visit' }} />
          <Stack.Screen name="AddMember"    component={screens.AddMember}    options={{ title: 'Add Member / Family' }} />
          <Stack.Screen name="EditMember"   component={screens.EditMember}   options={{ title: 'Edit Member' }} />

          {/* ── Activity logs ─────────────────────────────────── */}
          <Stack.Screen name="CottageMeetings" component={screens.CottageMeetings} options={{ title: 'Cottage Meetings' }} />
          <Stack.Screen name="FastingPrayers"  component={screens.FastingPrayers}  options={{ title: 'Fasting & Prayers' }} />
          <Stack.Screen name="BibleClasses"    component={screens.BibleClasses}    options={{ title: 'Bible Classes' }} />

          {/* ── Utilities ─────────────────────────────────────── */}
          <Stack.Screen name="Backup"   component={screens.Backup}   options={{ title: 'Backup & Restore' }} />
          <Stack.Screen name="Settings" component={screens.Settings} options={{ title: 'Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  splashIcon: { fontSize: 52 },
  splashText: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  splashSub:  { fontSize: 14, color: '#C7D2FE' },
  iconBtn: { padding: 4 },
  addBtn:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});
