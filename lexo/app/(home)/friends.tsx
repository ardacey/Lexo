import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  useFriends,
  useFriendRequests,
  useSearchUsers,
  useSendFriendRequest,
  useRespondFriendRequest,
  useRemoveFriend,
} from '@/hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getPresenceStatus } from '@/utils/api';

export default function FriendsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { getToken } = useAuth();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ user_id: string; username: string }[]>([]);
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());
  const [onlineFriendIds, setOnlineFriendIds] = useState<Set<string>>(new Set());

  const { data: friendsData, isLoading: isFriendsLoading } = useFriends();
  const { data: requestsData, isLoading: isRequestsLoading } = useFriendRequests();
  const searchMutation = useSearchUsers();
  const sendRequestMutation = useSendFriendRequest();
  const respondMutation = useRespondFriendRequest();
  const removeMutation = useRemoveFriend();

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSentRequestIds(new Set());
      return;
    }

    try {
      const result = await searchMutation.mutateAsync(trimmed);
      setSearchResults(result.users || []);
      setSentRequestIds(new Set());
    } catch (error) {
      showToast('Arama sırasında hata oluştu', 'error');
    }
  };

  const handleSendRequest = async (userId: string) => {
    // Optimistically mark as sent immediately so the button changes without waiting for the API
    setSentRequestIds((prev) => new Set([...prev, userId]));
    try {
      await sendRequestMutation.mutateAsync(userId);
      showToast('Arkadaş isteği gönderildi', 'success');
    } catch (error) {
      // Roll back the optimistic update if the request failed
      setSentRequestIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      showToast((error as Error).message || 'İstek gönderilemedi', 'error');
    }
  };

  const handleRespond = async (requestId: number, action: 'accept' | 'decline') => {
    try {
      await respondMutation.mutateAsync({ requestId, action });
      showToast(action === 'accept' ? 'Arkadaş eklendi' : 'İstek reddedildi', 'success');
    } catch (error) {
      showToast((error as Error).message || 'İstek güncellenemedi', 'error');
    }
  };

  const handleRemoveFriend = (friendUserId: string, username: string) => {
    Alert.alert(
      'Arkadaşı Kaldır',
      `${username} arkadaşlardan kaldırılacak. Emin misin?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMutation.mutateAsync(friendUserId);
              showToast('Arkadaş kaldırıldı', 'success');
            } catch (error) {
              showToast((error as Error).message || 'Arkadaş kaldırılamadı', 'error');
            }
          },
        },
      ]
    );
  };

  const friends = friendsData?.friends || [];
  const requests = requestsData?.requests || [];
  const friendIds = useMemo(() => friends.map((friend) => friend.user_id), [friends]);
  const friendIdsKey = useMemo(() => friendIds.join(','), [friendIds]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchStatuses = async () => {
      if (friendIds.length === 0) {
        setOnlineFriendIds(new Set());
        return;
      }
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const result = await getPresenceStatus(friendIds, token);
        if (cancelled) return;
        const ids = Array.isArray(result.online_user_ids) ? result.online_user_ids : [];
        setOnlineFriendIds(new Set(ids));
      } catch {
        if (!cancelled) {
          setOnlineFriendIds(new Set());
        }
      }
    };

    fetchStatuses();
    intervalId = setInterval(fetchStatuses, 10000);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [friendIdsKey, getToken]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={18} color="#0f172a" />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Arkadaşlar</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Arkadaş Ara</Text>
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Kullanıcı adı"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                style={styles.input}
              />
              <TouchableOpacity
                onPress={handleSearch}
                style={styles.primaryButton}
                disabled={searchMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>
                  {searchMutation.isPending ? '...' : 'Ara'}
                </Text>
              </TouchableOpacity>
            </View>
            {searchResults.length > 0 && (
              <View style={styles.list}>
                {searchResults.map((user) => {
                  const alreadySent = sentRequestIds.has(user.user_id);
                  const alreadyFriend = friends.some((f) => f.user_id === user.user_id);
                  return (
                    <View key={user.user_id} style={styles.listRow}>
                      <View>
                        <Text style={styles.listText}>{user.username}</Text>
                        <Text style={styles.listSubtext}>
                          {alreadyFriend ? 'Zaten arkadaşsınız' : alreadySent ? 'İstek gönderildi' : 'Yeni kişi'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleSendRequest(user.user_id)}
                        style={[
                          styles.secondaryButton,
                          (alreadySent || alreadyFriend) && styles.secondaryButtonSent,
                        ]}
                        disabled={sendRequestMutation.isPending || alreadySent || alreadyFriend}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {alreadyFriend ? 'Arkadaş' : alreadySent ? 'Gönderildi ✓' : 'İstek Gönder'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>İstekler</Text>
            {isRequestsLoading ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : requests.length === 0 ? (
              <Text style={styles.emptyText}>Bekleyen istek yok</Text>
            ) : (
              <View style={styles.list}>
                {requests.map((request) => (
                  <View key={request.id} style={styles.listRow}>
                    <View>
                      <Text style={styles.listText}>{request.requester.username}</Text>
                      <Text style={styles.listSubtext}>Bekleyen istek</Text>
                    </View>
                    <View style={styles.inlineActions}>
                      <TouchableOpacity
                        onPress={() => handleRespond(request.id, 'accept')}
                        style={styles.primaryPill}
                        disabled={respondMutation.isPending}
                      >
                        <Text style={styles.primaryPillText}>Kabul</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRespond(request.id, 'decline')}
                        style={styles.ghostPill}
                        disabled={respondMutation.isPending}
                      >
                        <Text style={styles.ghostPillText}>Red</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Arkadaş Listesi</Text>
            {isFriendsLoading ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : friends.length === 0 ? (
              <Text style={styles.emptyText}>Henüz arkadaş yok</Text>
            ) : (
              <View style={styles.list}>
                {friends.map((friend) => (
                  <View key={friend.user_id} style={styles.friendRow}>
                    <View style={styles.friendInfo}>
                      <Text style={styles.listText}>{friend.username}</Text>
                      <View style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            onlineFriendIds.has(friend.user_id)
                              ? styles.statusOnline
                              : styles.statusOffline,
                          ]}
                        />
                        <Text style={styles.statusText}>
                          {onlineFriendIds.has(friend.user_id) ? 'Çevrimiçi' : 'Çevrimdışı'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.inlineActions}>
                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: '/invite-waiting',
                            params: {
                              friendUserId: friend.user_id,
                              friendUsername: friend.username,
                            },
                          })
                        }
                        style={styles.primaryPill}
                      >
                        <Text style={styles.primaryPillText}>Davet Et</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveFriend(friend.user_id, friend.username)}
                        style={styles.ghostPill}
                      >
                        <Text style={styles.ghostPillText}>Kaldır</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
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
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  backText: {
    fontSize: 18,
    color: '#0f172a',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  primaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  list: {
    gap: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  listText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  listSubtext: {
    marginTop: 4,
    fontSize: 11,
    color: '#94a3b8',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  secondaryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  secondaryButtonSent: {
    backgroundColor: '#dcfce7',
  },
  secondaryButtonText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 12,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  friendInfo: {
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusOnline: {
    backgroundColor: '#22c55e',
  },
  statusOffline: {
    backgroundColor: '#cbd5f5',
  },
  statusText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  primaryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  primaryPillText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  ghostPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  ghostPillText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
});
