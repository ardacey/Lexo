import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLeaderboard } from '@/hooks/useApi';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const router = useRouter();
  const navigation = useNavigation();

  const safeBack = () => {
    if (navigation.canGoBack()) router.back();
    else router.replace('/(home)');
  };

  const { data: leaderboard = [], isLoading, refetch, isRefetching } = useLeaderboard(100);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-600">Sıralama yükleniyor...</Text>
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
          <Text className="text-2xl font-bold text-text-primary">Sıralama</Text>
          <Text className="text-sm text-gray-500 mt-0.5">ELO puanına göre</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {leaderboard.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-slate-400 text-base">Henüz sıralama yok</Text>
          </View>
        ) : (
          <View className="px-4 py-4">
            {leaderboard.map((entry, index) => {
              const rank = index + 1;
              const medal = MEDALS[index] ?? null;
              const isTop3 = rank <= 3;

              return (
                <TouchableOpacity
                  key={entry.username}
                  onPress={() =>
                    entry.user_id
                      ? router.push(`/(home)/profile/${entry.user_id}`)
                      : undefined
                  }
                  disabled={!entry.user_id}
                  className={`flex-row items-center bg-white rounded-2xl p-4 mb-3 border ${
                    isTop3 ? 'border-yellow-200' : 'border-slate-200'
                  }`}
                >
                  {/* Rank */}
                  <View className="w-10 items-center">
                    {medal ? (
                      <Text className="text-2xl">{medal}</Text>
                    ) : (
                      <Text className="text-base font-bold text-slate-500">#{rank}</Text>
                    )}
                  </View>

                  {/* Name + stats */}
                  <View className="flex-1 ml-3">
                    <Text className="text-base font-bold text-text-primary">{entry.username}</Text>
                    <Text className="text-xs text-slate-500 mt-0.5">
                      {entry.total_games} oyun · %{entry.win_rate.toFixed(0)} kazanma
                    </Text>
                  </View>

                  {/* ELO badge */}
                  <View className={`px-3 py-1.5 rounded-xl ${isTop3 ? 'bg-yellow-100' : 'bg-slate-100'}`}>
                    <Text className={`text-sm font-bold ${isTop3 ? 'text-yellow-700' : 'text-slate-600'}`}>
                      {entry.elo_rating ?? 1000}
                    </Text>
                    <Text className="text-[10px] text-slate-400 text-center">ELO</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
