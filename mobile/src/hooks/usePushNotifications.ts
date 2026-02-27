import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  registerForPushNotifications,
  uploadPushToken,
  parseNotificationData,
} from '../services/notifications';
import { useGameStore } from '../store/gameStore';

/**
 * Registers for push notifications on mount.
 * Handles foreground + background notification taps.
 * Must be called inside the authenticated app layout.
 */
export function usePushNotifications() {
  const router           = useRouter();
  const setPendingInvite = useGameStore((s) => s.setPendingInvite);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const receivedListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Register device for push + upload token to server
    (async () => {
      const token = await registerForPushNotifications();
      if (token) await uploadPushToken(token);
    })();

    // Handle notification tap (app in background/killed)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = parseNotificationData(response.notification);
        if (!data) return;

        if (data.type === 'friend_invite' && data.roomId && data.joinToken) {
          setPendingInvite(data.roomId, data.joinToken);
          // Navigate to the game screen — expo-router deep link
          router.push(`/game/${data.roomId}?t=${data.joinToken}`);
        }
      });

    // Handle notification received while app is foregrounded
    receivedListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const data = parseNotificationData(notification);
        if (!data) return;

        if (data.type === 'friend_invite' && data.roomId && data.joinToken) {
          setPendingInvite(data.roomId, data.joinToken);
        }
      });

    return () => {
      responseListener.current?.remove();
      receivedListener.current?.remove();
    };
  }, []);
}
