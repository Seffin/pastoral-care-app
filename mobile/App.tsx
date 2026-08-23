import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';

import { DashboardScreen } from './src/screens/DashboardScreen';
import { VisitLoggerScreen } from './src/screens/VisitLoggerScreen';
import { AddMemberScreen } from './src/screens/AddMemberScreen';
import { EditMemberScreen } from './src/screens/EditMemberScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { VisitHistoryScreen } from './src/screens/VisitHistoryScreen';
import { AllMembersScreen } from './src/screens/AllMembersScreen';

import { getDb, getSetting } from './src/db/localDb';
import { getTheme, Theme } from './src/theme';

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
      .catch(console.error);
  }, []);

  if (!dbReady) {
    return <Text style={{ marginTop: 50, textAlign: 'center', color: '#999' }}>Initializing database...</Text>;
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

  const headerStyle = { backgroundColor: theme.headerBg };
  const headerTintColor = theme.headerText;

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.headerBg} />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{ headerStyle, headerTintColor, headerTitleStyle: { fontWeight: '700' } }}
        >
          {/* Dashboard */}
          <Stack.Screen
            name="Dashboard"
            options={({ navigation }) => ({
              title: 'Pastoral Care',
              headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('AddMember')} style={[styles.headerBtn, { backgroundColor: theme.accent }]}>
                  <Text style={styles.headerBtnText}>+ Add</Text>
                </TouchableOpacity>
              ),
              headerLeft: () => (
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
                  <Text style={{ fontSize: 22 }}>⚙️</Text>
                </TouchableOpacity>
              ),
            })}
          >
            {(props) => <DashboardScreen {...props} theme={theme} />}
          </Stack.Screen>

          {/* Visit History */}
          <Stack.Screen name="VisitHistory" options={{ title: 'Visit History' }}>
            {(props) => <VisitHistoryScreen {...props} theme={theme} />}
          </Stack.Screen>

          {/* Visit Logger */}
          <Stack.Screen name="VisitLogger" options={{ title: 'Log Visit' }}>
            {(props) => <VisitLoggerScreen {...props} theme={theme} />}
          </Stack.Screen>

          {/* Add Member */}
          <Stack.Screen name="AddMember" options={{ title: 'Add Member / Family' }}>
            {(props) => <AddMemberScreen {...props} theme={theme} />}
          </Stack.Screen>

          {/* Edit Member */}
          <Stack.Screen name="EditMember" options={{ title: 'Edit Member' }}>
            {(props) => <EditMemberScreen {...props} theme={theme} />}
          </Stack.Screen>

          {/* All Members */}
          <Stack.Screen name="AllMembers" options={{ title: 'All Members' }}>
            {(props) => <AllMembersScreen {...props} theme={theme} />}
          </Stack.Screen>

          {/* Settings */}
          <Stack.Screen name="Settings" options={{ title: 'Settings' }}>
            {(props) => <SettingsScreen {...props} theme={theme} onThemeChange={setThemeMode} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
  },
  headerBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  settingsBtn: { marginRight: 12, padding: 4 },
});
