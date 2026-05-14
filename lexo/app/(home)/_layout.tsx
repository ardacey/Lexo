import { Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { respondFriendInvite } from '../../utils/api';

function FriendInviteHandler() {
  const { onFriendInvite, declineInvite } = useNotifications();
  const { getToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    return onFriendInvite((payload) => {
      Alert.alert(
        'Arkadaş Daveti',
        `${payload.from_username} seni maça çağırıyor`,
        [
          {
            text: 'Reddet',
            style: 'destructive',
            onPress: () => declineInvite(payload.invite_id),
          },
          {
            text: 'Kabul Et',
            onPress: async () => {
              try {
                const token = await getToken();
                if (!token) return;
                await respondFriendInvite(payload.invite_id, 'accept', token);
                router.push({
                  pathname: '/multiplayer',
                  params: { inviteId: payload.invite_id },
                });
              } catch {
                // Accept failed silently; user remains on current screen
              }
            },
          },
        ],
      );
    });
  }, [onFriendInvite, declineInvite, getToken, router]);

  return null;
}

export default function Layout() {
  return (
    <>
      <FriendInviteHandler />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
