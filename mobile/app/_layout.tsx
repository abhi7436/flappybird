import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { getToken } from '../src/services/storage';
import { Profile } from '../src/services/api';

// Keep splash visible while loading auth state
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const setAuth = useGameStore((s) => s.setAuth);

  useEffect(() => {
    (async () => {
      // Attempt to restore session from secure storage
      try {
        const token = await getToken();
        if (token) {
          const me = await Profile.me();
          setAuth(
            {
              id: me.id,
              username: me.username,
              avatar: me.avatar,
              high_score: me.high_score,
            },
            token
          );
        }
      } catch {
        // Token invalid / expired — will redirect to auth
      } finally {
        await SplashScreen.hideAsync();
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="game/[roomId]"
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen
          name="solo"
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
