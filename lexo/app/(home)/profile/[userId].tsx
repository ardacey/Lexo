import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useUserProfile, useFriends, useSendFriendRequest } from '@/hooks/useApi';
import { useAuth } from '../../../context/AuthContext';

export default function UserProfilePage() {
  const router = useRouter();
  const navigation = useNavigation();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();

  const safeBack = () => {
    if (navigation.canGoBack()) router.back();
    else router.replace('/(home)');
  };

  const { data: profile, isLoading, error } = useUserProfile(userId ?? null);
  const { data: friendsData } = useFriends();
  const sendFriendRequestMutation = useSendFriendRequest();

  const isOwnProfile = userId === user?.id;
  const isFriend = friendsData?.friends.some((f) => f.user_id === userId) ?? false;
  const isRequestPending = sendFriendRequestMutation.isPending;

  const handleAddFriend = () => {
    if (!userId) return;
    sendFriendRequestMutation.mutate(userId);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-600">Profil yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-xl font-bold text-red-600 mb-4">Profil bulunamadı</Text>
        <TouchableOpacity onPress={safeBack} className="bg-blue-500 px-6 py-3 rounded-lg">
          <Text className="text-white font-semibold">Geri Dön</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="flex-row items-center px-6 py-4 border-b border-gray-200">
        <TouchableOpacity onPress={safeBack} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-text-primary">{profile.username}</Text>
          {profile.rank && (
            <Text className="text-sm text-purple-600 font-semibold mt-0.5">#{profile.rank} sıralama</Text>
          )}
        </View>
        {!isOwnProfile && !isFriend && (
          <TouchableOpacity
            onPress={handleAddFriend}
            disabled={isRequestPending}
            className={`px-4 py-2 rounded-xl ${isRequestPending ? 'bg-slate-300' : 'bg-blue-500'}`}
          >
            <Text className="text-white font-semibold text-sm">
              {isRequestPending ? 'Gönderiliyor...' : 'Arkadaş Ekle'}
            </Text>
          </TouchableOpacity>
        )}
        {!isOwnProfile && isFriend && (
          <View className="px-4 py-2 rounded-xl bg-green-100">
            <Text className="text-green-700 font-semibold text-sm">Arkadaş</Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1">
        {/* Match Stats Card */}
        <View className="mx-6 mt-6 bg-white rounded-2xl p-6 shadow-sm">
          <Text className="text-xl font-bold text-text-primary mb-4">Maç İstatistikleri</Text>

          <View className="flex-row justify-between mb-3">
            <Text className="text-slate-600">Toplam Oyun</Text>
            <Text className="text-lg font-bold text-text-primary">{profile.total_games}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-slate-600">Galibiyet</Text>
            <Text className="text-lg font-bold text-green-600">{profile.wins}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-slate-600">Mağlubiyet</Text>
            <Text className="text-lg font-bold text-red-600">{profile.losses}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-slate-600">Beraberlik</Text>
            <Text className="text-lg font-bold text-gray-600">{profile.ties}</Text>
          </View>
          <View className="flex-row justify-between pt-3 border-t border-gray-200">
            <Text className="text-slate-600">Kazanma Oranı</Text>
            <Text className="text-lg font-bold text-blue-600">{profile.win_rate.toFixed(1)}%</Text>
          </View>
        </View>

        {/* Score & Word Stats Card */}
        <View className="mx-6 mt-4 bg-white rounded-2xl p-6 shadow-sm">
          <Text className="text-xl font-bold text-text-primary mb-4">Performans</Text>

          <View className="flex-row justify-between mb-3">
            <Text className="text-slate-600">En Yüksek Skor</Text>
            <Text className="text-lg font-bold text-orange-600">{profile.highest_score}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-slate-600">Ortalama Skor</Text>
            <Text className="text-lg font-bold text-text-primary">{profile.average_score.toFixed(1)}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-slate-600">En İyi Seri</Text>
            <Text className="text-lg font-bold text-orange-600">🏆 {profile.best_win_streak}</Text>
          </View>
          {profile.longest_word && (
            <View className="flex-row justify-between">
              <Text className="text-slate-600">En Uzun Kelime</Text>
              <Text className="text-lg font-bold text-indigo-600">
                {profile.longest_word.toLocaleUpperCase('tr-TR')}
              </Text>
            </View>
          )}
          {profile.elo_rating !== undefined && (
            <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-200">
              <Text className="text-slate-600">ELO Puanı</Text>
              <Text className="text-lg font-bold text-purple-600">{profile.elo_rating}</Text>
            </View>
          )}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
