import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Notifications as NotificationsAPI } from './api';
import { NotificationData } from '../types';

// ── Configure how notifications are shown in-foreground ──────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Request permission + get Expo push token ────────────────
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[Notifications] Push requires a physical device');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f7c59f',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission denied');
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

// ── Register token with backend ───────────────────────────────
export async function uploadPushToken(token: string): Promise<void> {
  try {
    await NotificationsAPI.registerToken(token);
  } catch (err) {
    console.warn('[Notifications] Failed to register push token', err);
  }
}

// ── Parse notification payload ────────────────────────────────
export function parseNotificationData(
  notification: Notifications.Notification
): NotificationData | null {
  const data = notification.request.content.data as NotificationData | undefined;
  if (!data?.type) return null;
  return data;
}

// ── Schedule a local notification (friend invite received via WS) ─
export async function scheduleLocalInvite(
  fromUsername: string,
  roomId: string,
  joinToken: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Game Invite',
      body: `${fromUsername} invited you to play!`,
      data: { type: 'friend_invite', roomId, joinToken },
      sound: 'default',
    },
    trigger: null, // fire immediately
  });
}
