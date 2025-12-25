import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { cancelFriendInvite, getInviteStatus, sendFriendInvite } from '@/utils/api';

export default function InviteWaitingPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const friendUserId = params.friendUserId as string | undefined;
  const friendUsername = params.friendUsername as string | undefined;
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [status, setStatus] = useState('Davet gönderiliyor...');
  const [inviteId, setInviteId] = useState<string | null>(null);
  const endedRef = useRef(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!friendUserId) {
      showToast('Arkadaş bilgisi eksik', 'error');
      router.replace('/friends');
      return;
    }

    let cancelled = false;

    const connect = async () => {
      const token = await getToken();
      tokenRef.current = token ?? null;
      if (cancelled || !token) return;

      try {
        const result = await sendFriendInvite(friendUserId, token);
        if (cancelled) return;
        setInviteId(result.invite_id);
        setStatus('Onay bekleniyor...');
      } catch (error) {
        showToast((error as Error).message || 'Davet gönderilemedi', 'error');
        router.replace('/friends');
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (!endedRef.current && tokenRef.current && inviteId) {
        cancelFriendInvite(inviteId, tokenRef.current).catch(() => undefined);
      }
    };
  }, [friendUserId, getToken, router, showToast]);

  useEffect(() => {
    if (!inviteId) return;
    let cancelled = false;
    const poll = async () => {
      if (!tokenRef.current) return;
      try {
        const result = await getInviteStatus(inviteId, tokenRef.current);
        if (cancelled) return;
        if (result.status === 'accepted') {
          endedRef.current = true;
          router.replace({
            pathname: '/multiplayer',
            params: { inviteId },
          });
        } else if (result.status === 'declined' || result.status === 'cancelled' || result.status === 'missing') {
          endedRef.current = true;
          showToast('Davet reddedildi', 'info');
          router.back();
        }
      } catch {
        // Silent poll error
      }
    };
    poll();
    const intervalId = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [inviteId, router, showToast]);

  const handleCancel = () => {
    if (tokenRef.current && inviteId) {
      cancelFriendInvite(inviteId, tokenRef.current).catch(() => undefined);
    }
    endedRef.current = true;
    router.back();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.card}>
          <Text style={styles.title}>Arkadaş Daveti</Text>
          <Text style={styles.subtitle}>
            {friendUsername ? `${friendUsername} için` : 'Arkadaş için'} davet bekleniyor
          </Text>
          <ActivityIndicator size="small" color="#0f172a" style={styles.spinner} />
          <Text style={styles.status}>{status}</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  safeArea: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  spinner: {
    marginTop: 8,
  },
  status: {
    fontSize: 12,
    color: '#475569',
  },
  secondaryButton: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  secondaryButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
});
