import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, TouchableOpacity, StyleSheet, StatusBar, View, ActivityIndicator } from 'react-native';

import { DashboardScreen } from './src/screens/DashboardScreen';
import { VisitLoggerScreen } from './src/screens/VisitLoggerScreen';
import { AddMemberScreen } from './src/screens/AddMemberScreen';
import { EditMemberScreen } from './src/screens/EditMemberScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { VisitHistoryScreen } from './src/screens/VisitHistoryScreen';
import { AllMembersScreen } from './src/screens/AllMembersScreen';

import { getDb, getSetting } from './src/db/localDb';
import { getTheme } from './src/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  const initApp = useCallback(async () => {
    try {
      setInitError(null);
      await getDb();
      const mode = await getSetting('theme_mode', 'light');
      setThemeMode(mode as 'light' | 'dark');
      setDbReady(true);
    } catch (err: any) {
      console.error('Database initialization failed:', err);
      setInitError(err?.message || String(err) || 'Failed to initialize SQLite database.');
    }
  }, []);

  useEffect(() => {
    initApp();
  }, [initApp]);

  const theme = getTheme(themeMode);
  const isDark = themeMode === 'dark';

  if (initError) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={[styles.errorTitle, { color: theme.text }]}>Database Initialization Failed</Text>
        <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>{initError}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.accent }]} onPress={initApp}>
          <Text style={styles.retryBtnText}>Retry Initialization</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Initializing database...</Text>
      </View>
    );
  }

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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '500',
  },
  errorIcon: {
    fontSize: 42,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  headerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  settingsBtn: {
    marginRight: 12,
    padding: 4,
  },
});
