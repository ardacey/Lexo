import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useCheckUsername, useCreateUser, useUpdateUsername } from '@/hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { getOnlineStats, respondFriendInvite } from '@/utils/api';
import { WS_BASE_URL } from '@/utils/constants';
import { Ionicons } from '@expo/vector-icons';

export default function Page() {
  const router = useRouter();
  const { user, isSignedIn, isLoading, signOut, updateUsername, getToken } = useAuth();
  const { showToast } = useToast();
  const createUserMutation = useCreateUser();
  const checkUsernameMutation = useCheckUsername();
  const updateUsernameMutation = useUpdateUsername();
  const [userInitialized, setUserInitialized] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<number | null>(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const notificationSocketRef = React.useRef<WebSocket | null>(null);
  const [pendingInvite, setPendingInvite] = useState<{
    inviteId: string;
    fromUserId: string;
    fromUsername: string;
  } | null>(null);
  const lastInviteIdRef = React.useRef<string | null>(null);
  const [isInviteActionLoading, setIsInviteActionLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const glowAnim = React.useRef(new Animated.Value(0.25)).current;

  const displayUsername = useMemo(
    () => user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player',
    [user]
  );

  const checkForActiveGame = async (username: string) => {
    try {
      const gameData = await AsyncStorage.getItem('activeGame');
      if (gameData) {
        const game = JSON.parse(gameData);
        const startTime = new Date(game.startTime);
        const now = new Date();
        const elapsed = (now.getTime() - startTime.getTime()) / 1000;
        const remaining = game.duration - elapsed;

        if (remaining > 0) {
          router.push({
            pathname: '/multiplayer',
            params: { username, reconnect: 'true' },
          });
        } else {
          await AsyncStorage.removeItem('activeGame');
        }
      }
    } catch {
      // Silent error
    }
  };

  useEffect(() => {
    if (user && !userInitialized && !createUserMutation.isPending) {
      const username = displayUsername;
      createUserMutation.mutate(
        {
          userId: user.id,
          username,
          email: user.email,
        },
        {
          onSuccess: () => {
            setUserInitialized(true);
          },
          onError: () => {
            setUserInitialized(true);
          },
        }
      );

      checkForActiveGame(username);
    }
  }, [user, userInitialized, createUserMutation, createUserMutation.isPending, displayUsername]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;

    const fetchOnlineStats = async () => {
      const stats = await getOnlineStats();
      if (cancelled || !stats) return;
      const count = typeof stats.online_players === 'number'
        ? stats.online_players
        : stats.waiting_players + stats.active_rooms * 2;
      setOnlinePlayers(count);
    };

    fetchOnlineStats();
    const intervalId = setInterval(fetchOnlineStats, 10000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;

    const connectNotifications = async () => {
      const authToken = await getToken();
      if (cancelled) return;
      if (!authToken) return;

      const socket = new WebSocket(`${WS_BASE_URL}/ws/notify?token=${encodeURIComponent(authToken)}`);
      notificationSocketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'friend_invite') {
            if (!data.invite_id) return;
            if (pendingInvite && pendingInvite.inviteId === data.invite_id) return;
            if (lastInviteIdRef.current === data.invite_id) return;
            lastInviteIdRef.current = data.invite_id;
            setPendingInvite({
              inviteId: data.invite_id,
              fromUserId: data.from_user_id,
              fromUsername: data.from_username || 'Arkadaş',
            });
          }
          if (data.type === 'friend_invite_cancelled') {
            if (!data.invite_id) return;
            setPendingInvite((prev) => {
              if (prev && prev.inviteId === data.invite_id) {
                lastInviteIdRef.current = null;
                return null;
              }
              return prev;
            });
          }
        } catch {
          // Silent parse error
        }
      };
    };

    connectNotifications();

    return () => {
      cancelled = true;
      if (notificationSocketRef.current) {
        try {
          notificationSocketRef.current.close();
        } catch {
          // Silent close error
        }
        notificationSocketRef.current = null;
      }
    };
  }, [isSignedIn, router, getToken]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.25,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [glowAnim]);

  const handleInviteDecline = async () => {
    if (!pendingInvite || isInviteActionLoading) return;
    const inviteId = pendingInvite.inviteId;
    setIsInviteActionLoading(true);
    try {
      const token = await getToken();
      await respondFriendInvite(inviteId, 'decline', token ?? undefined);
      setPendingInvite(null);
      showToast('Davet reddedildi', 'info');
    } catch (error) {
      showToast('Davet reddedilemedi', 'error');
    } finally {
      setIsInviteActionLoading(false);
    }
  };

  const handleInviteAccept = async () => {
    if (!pendingInvite || isInviteActionLoading) return;
    const inviteId = pendingInvite.inviteId;
    setIsInviteActionLoading(true);
    try {
      const token = await getToken();
      await respondFriendInvite(inviteId, 'accept', token ?? undefined);
      setPendingInvite(null);
      router.push({
        pathname: '/multiplayer',
        params: { inviteId },
      });
    } catch (error) {
      showToast('Davet kabul edilemedi', 'error');
    } finally {
      setIsInviteActionLoading(false);
    }
  };

  useEffect(() => {
    if (isEditingUsername) {
      setUsernameDraft(displayUsername);
      setUsernameError('');
    }
  }, [isEditingUsername, displayUsername]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  const handleMultiplayer = () => {
    const username = displayUsername;
    router.push({
      pathname: '/multiplayer',
      params: { username },
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (error) {
      showToast('Çıkış yapılırken bir hata oluştu', 'error');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabı Sil',
          style: 'destructive',
          onPress: () => router.push({ pathname: '/delete-account' }),
        },
      ]
    );
  };

  const handleSaveUsername = async () => {
    if (isSavingUsername) return;

    const trimmed = usernameDraft.trim();

    if (!trimmed) {
      setUsernameError('Kullanıcı adı boş olamaz');
      return;
    }

    if (trimmed === displayUsername) {
      setUsernameError('Bu zaten mevcut kullanıcı adın');
      return;
    }

    setIsSavingUsername(true);
    setUsernameError('');

    const previousUsername = displayUsername;

    try {
      const result = await checkUsernameMutation.mutateAsync(trimmed);
      if (!result.available) {
        setUsernameError('Bu kullanıcı adı zaten alınmış');
        setIsSavingUsername(false);
        return;
      }

      const { error } = await updateUsername(trimmed);
      if (error) {
        showToast('Kullanıcı adı güncellenemedi', 'error');
        setIsSavingUsername(false);
        return;
      }

      await updateUsernameMutation.mutateAsync(trimmed);

      showToast('Kullanıcı adı güncellendi', 'success');
      setIsEditingUsername(false);
      setIsSavingUsername(false);
      setTimeout(() => setIsSettingsOpen(false), 0);
    } catch (error) {
      await updateUsername(previousUsername);
      showToast('Kullanıcı adı güncellenemedi', 'error');
      setUsernameError('Kullanıcı adı güncellenemedi');
      setIsSavingUsername(false);
    }
  };

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.backdrop} />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        {isSignedIn && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.appName}>Lexo</Text>
              <TouchableOpacity
                onPress={() => setIsSettingsOpen((prev) => !prev)}
                style={styles.settingsLauncher}
                accessibilityLabel="Ayarlar"
              >
                <Ionicons name="settings-outline" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {pendingInvite && (
              <View style={styles.inviteBanner}>
                <View style={styles.inviteText}>
                  <Text style={styles.inviteTitle}>Arkadaş Daveti</Text>
                  <Text style={styles.inviteSubtitle}>
                    {pendingInvite.fromUsername} seni maça çağırıyor
                  </Text>
                </View>
                <View style={styles.inviteActions}>
                  <TouchableOpacity
                    onPress={handleInviteDecline}
                    style={[styles.inviteDecline, isInviteActionLoading && styles.inviteActionDisabled]}
                    disabled={isInviteActionLoading}
                  >
                    <Text style={styles.inviteDeclineText}>Reddet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleInviteAccept}
                    style={[styles.inviteAccept, isInviteActionLoading && styles.inviteActionDisabled]}
                    disabled={isInviteActionLoading}
                  >
                    <Text style={styles.inviteAcceptText}>Kabul</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.profileCard}>
              <View style={styles.accentBar} />
              <Text style={styles.greeting}>Merhaba</Text>
              <Text style={styles.username} numberOfLines={1}>
                {displayUsername}
              </Text>
              {onlinePlayers !== null && (
                <View style={styles.onlinePill}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>{onlinePlayers} oyuncu çevrimiçi</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.quickGrid}>
                <TouchableOpacity onPress={handleMultiplayer} style={styles.quickPrimary} activeOpacity={0.9}>
                  <LinearGradient
                    colors={['#0f172a', '#1e3a8a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.quickPrimaryGradient}
                  >
                    <Animated.View style={[styles.quickGlow, { opacity: glowAnim }]} />
                    <View style={styles.quickIconRow}>
                      <View style={styles.quickIconBubble}>
                        <Ionicons name="game-controller-outline" size={18} color="#0f172a" />
                      </View>
                    </View>
                    <Text style={styles.quickTitle}>Oyun Ara</Text>
                    <Text style={styles.quickSubtitle}>Anında rakip bul</Text>
                    <View style={styles.quickArrowBubble}>
                      <Text style={styles.quickArrow}>→</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/practice')} style={styles.quickPrimaryAlt} activeOpacity={0.9}>
                  <LinearGradient
                    colors={['#ffffff', '#eef2ff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.quickPrimaryGradient}
                  >
                    <Animated.View style={[styles.quickGlowAlt, { opacity: glowAnim }]} />
                    <View style={styles.quickIconRow}>
                      <View style={styles.quickIconBubbleAlt}>
                        <Ionicons name="sparkles-outline" size={18} color="#ffffff" />
                      </View>
                    </View>
                    <Text style={styles.quickTitleDark}>Hızlı Pratik</Text>
                    <Text style={styles.quickSubtitleDark}>Hızlı solo kelime turu</Text>
                    <View style={styles.quickArrowBubbleAlt}>
                      <Text style={styles.quickArrowLight}>→</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/stats')} style={styles.quickMini}>
                  <View style={styles.quickMiniIcon}>
                    <Ionicons name="stats-chart-outline" size={18} color="#0f172a" />
                  </View>
                  <View>
                    <Text style={styles.quickMiniTitle}>İstatistikler</Text>
                    <Text style={styles.quickMiniSubtitle}>Performansını gör</Text>
                  </View>
                  <Text style={styles.quickMiniArrow}>→</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/friends')} style={styles.quickMini}>
                  <View style={styles.quickMiniIcon}>
                    <Ionicons name="people-outline" size={18} color="#0f172a" />
                  </View>
                  <View>
                    <Text style={styles.quickMiniTitle}>Arkadaşlar</Text>
                    <Text style={styles.quickMiniSubtitle}>Davet ve istekler</Text>
                  </View>
                  <Text style={styles.quickMiniArrow}>→</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={isSettingsOpen} transparent animationType="slide" onRequestClose={() => setIsSettingsOpen(false)}>
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.2)', 'rgba(15, 23, 42, 0.55)']}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setIsSettingsOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Ayarlar</Text>
            <Text style={styles.sheetSubtitle}>Hesabını yönet ve uygulamayı kişiselleştir.</Text>
            <View style={styles.card}>
              <TouchableOpacity
                onPress={() => setIsEditingUsername((prev) => !prev)}
                style={styles.settingsRow}
              >
                <View>
                  <Text style={styles.settingsTitle}>Kullanıcı adı</Text>
                  <Text style={styles.settingsValue}>{displayUsername}</Text>
                </View>
                <Text style={styles.settingsAction}>{isEditingUsername ? 'Kapat' : 'Değiştir'}</Text>
              </TouchableOpacity>

              {isEditingUsername && (
                <View style={styles.usernameEditor}>
                  <TextInput
                    value={usernameDraft}
                    onChangeText={(text) => {
                      setUsernameDraft(text);
                      if (usernameError) setUsernameError('');
                    }}
                    placeholder="Yeni kullanıcı adı"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
                  <View style={styles.editorActions}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => setIsEditingUsername(false)}
                      disabled={isSavingUsername}
                    >
                      <Text style={styles.secondaryButtonText}>Vazgeç</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={handleSaveUsername}
                      disabled={isSavingUsername}
                    >
                      <Text style={styles.primaryButtonText}>
                        {isSavingUsername ? 'Kaydediliyor...' : 'Kaydet'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.divider} />

              <TouchableOpacity
                onPress={() => {
                  handleSignOut();
                  setTimeout(() => setIsSettingsOpen(false), 0);
                }}
                style={styles.settingsRow}
              >
                <View>
                  <Text style={[styles.settingsTitle, styles.dangerText]}>Çıkış Yap</Text>
                  <Text style={styles.settingsHint}>Oturumu sonlandır</Text>
                </View>
                <View style={styles.dangerPill}>
                  <Text style={[styles.settingsAction, styles.dangerText]}>→</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                onPress={() => {
                  handleDeleteAccount();
                  setTimeout(() => setIsSettingsOpen(false), 0);
                }}
                style={styles.settingsRow}
              >
                <View>
                  <Text style={[styles.settingsTitle, styles.dangerText]}>Hesabı Sil</Text>
                  <Text style={styles.settingsHint}>Geri alınamaz</Text>
                </View>
                <View style={styles.dangerPill}>
                  <Text style={[styles.settingsAction, styles.dangerText]}>→</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  backdrop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#7dd3fc',
    opacity: 0.6,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  settingsLauncher: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  accentBar: {
    height: 4,
    width: 48,
    backgroundColor: '#06b6d4',
    borderRadius: 999,
    marginBottom: 12,
  },
  greeting: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  onlinePill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#cffafe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  onlineText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  quickGrid: {
    gap: 12,
  },
  quickPrimary: {
    borderRadius: 20,
    minHeight: 104,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  quickPrimaryAlt: {
    borderRadius: 20,
    minHeight: 104,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  quickPrimaryGradient: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  quickGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(94, 234, 212, 0.25)',
  },
  quickGlowAlt: {
    position: 'absolute',
    bottom: -50,
    left: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
  },
  quickIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  quickIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#5eead4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconBubbleAlt: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBadge: {
    fontSize: 11,
    color: '#c7d2fe',
    fontWeight: '600',
  },
  quickBadgeAlt: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  quickTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 4,
  },
  quickTitleDark: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  quickSubtitle: {
    marginTop: 10,
    fontSize: 12,
    color: '#cbd5f5',
  },
  quickSubtitleDark: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748b',
  },
  quickArrowBubble: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5eead4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickArrowBubbleAlt: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  quickArrowLight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  quickMini: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickMiniIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickMiniTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  quickMiniSubtitle: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
  },
  quickMiniArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  actionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
  },
  actionArrow: {
    fontSize: 18,
    color: '#0f172a',
    fontWeight: '700',
  },
  actionPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#5eead4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillAlt: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f9a8d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillWarm: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fdba74',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  settingsValue: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
  },
  settingsHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#94a3b8',
  },
  settingsAction: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  dangerPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
    gap: 12,
  },
  inviteText: {
    gap: 4,
  },
  inviteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  inviteSubtitle: {
    fontSize: 12,
    color: '#475569',
  },
  inviteActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  inviteDecline: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  inviteDeclineText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  inviteAccept: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  inviteAcceptText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  inviteActionDisabled: {
    opacity: 0.6,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalOverlay: {
    flex: 1,
  },
  sheet: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
  },
  dangerText: {
    color: '#ef4444',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 18,
  },
  usernameEditor: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  errorText: {
    marginTop: 8,
    color: '#ef4444',
    fontSize: 12,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 13,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
});
