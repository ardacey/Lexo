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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useCheckUsername, useCreateUser, useUpdateUsername } from '@/hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { getOnlineStats } from '@/utils/api';

export default function Page() {
  const router = useRouter();
  const { user, isSignedIn, isLoading, signOut, updateUsername } = useAuth();
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
      const count = stats.waiting_players + stats.active_rooms * 2;
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
            </View>

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
              <Text style={styles.sectionTitle}>Hızlı Başla</Text>
              <View style={styles.card}>
                <TouchableOpacity onPress={handleMultiplayer} style={styles.actionRow}>
                  <View>
                    <Text style={styles.actionTitle}>Oyun Ara</Text>
                    <Text style={styles.actionSubtitle}>Anında rakip bul</Text>
                  </View>
                  <View style={styles.actionPill}>
                    <Text style={styles.actionArrow}>→</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity onPress={() => router.push('/stats')} style={styles.actionRow}>
                  <View>
                    <Text style={styles.actionTitle}>İstatistikler</Text>
                    <Text style={styles.actionSubtitle}>Performansına göz at</Text>
                  </View>
                  <View style={styles.actionPillAlt}>
                    <Text style={styles.actionArrow}>→</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity onPress={() => router.push('/practice')} style={styles.actionRow}>
                  <View>
                    <Text style={styles.actionTitle}>Hızlı Pratik</Text>
                    <Text style={styles.actionSubtitle}>Hızlı solo kelime turu</Text>
                  </View>
                  <View style={styles.actionPillWarm}>
                    <Text style={styles.actionArrow}>→</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ayarlar</Text>
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

                <TouchableOpacity onPress={handleSignOut} style={styles.settingsRow}>
                  <View>
                    <Text style={[styles.settingsTitle, styles.dangerText]}>Çıkış Yap</Text>
                    <Text style={styles.settingsHint}>Oturumu sonlandır</Text>
                  </View>
                  <View style={styles.dangerPill}>
                    <Text style={[styles.settingsAction, styles.dangerText]}>→</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity onPress={handleDeleteAccount} style={styles.settingsRow}>
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
          </ScrollView>
        )}
      </SafeAreaView>
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
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.5,
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
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
