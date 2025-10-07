import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useUserStats, useUserGames } from '@/hooks/useApi';

export default function StatsPage() {
  const router = useRouter();
  const { user } = useUser();
  
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useUserStats(user?.id || null);
  const { data: games = [], isLoading: gamesLoading, refetch: refetchGames } = useUserGames(user?.id || null, 10);
  
  const loading = statsLoading || gamesLoading;
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchGames()]);
    setRefreshing(false);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}s ${minutes}dk`;
    }
    return `${minutes}dk`;
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('tr-TR', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="flex-row items-center px-6 py-4 border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-text-primary">İstatistiklerim</Text>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {stats && (
          <>
            {/* Overall Stats Card */}
            <View className="mx-6 mt-6 bg-white rounded-2xl p-6 shadow-sm">
              <Text className="text-xl font-bold text-text-primary mb-4">Genel İstatistikler</Text>
              
              <View className="flex-row justify-between mb-3">
                <Text className="text-slate-600">Toplam Oyun</Text>
                <Text className="text-lg font-bold text-text-primary">{stats.total_games}</Text>
              </View>
              
              <View className="flex-row justify-between mb-3">
                <Text className="text-slate-600">Galibiyet</Text>
                <Text className="text-lg font-bold text-green-600">{stats.wins}</Text>
              </View>
              
              <View className="flex-row justify-between mb-3">
                <Text className="text-slate-600">Mağlubiyet</Text>
                <Text className="text-lg font-bold text-red-600">{stats.losses}</Text>
              </View>
              
              <View className="flex-row justify-between mb-3">
                <Text className="text-slate-600">Beraberlik</Text>
                <Text className="text-lg font-bold text-gray-600">{stats.ties}</Text>
              </View>
              
              <View className="flex-row justify-between mb-3 pt-3 border-t border-gray-200">
                <Text className="text-slate-600">Kazanma Oranı</Text>
                <Text className="text-lg font-bold text-blue-600">{stats.win_rate.toFixed(1)}%</Text>
              </View>
              
              {stats.rank && (
                <View className="flex-row justify-between">
                  <Text className="text-slate-600">Sıralama</Text>
                  <Text className="text-lg font-bold text-purple-600">#{stats.rank}</Text>
                </View>
              )}
            </View>

            {/* Score Stats Card */}
            <View className="mx-6 mt-4 bg-white rounded-2xl p-6 shadow-sm">
              <Text className="text-xl font-bold text-text-primary mb-4">Skor İstatistikleri</Text>
              
              <View className="flex-row justify-between mb-3">
                <Text className="text-slate-600">En Yüksek Skor</Text>
                <Text className="text-lg font-bold text-orange-600">{stats.highest_score}</Text>
              </View>
              
              <View className="flex-row justify-between mb-3">
                <Text className="text-slate-600">Ortalama Skor</Text>
                <Text className="text-lg font-bold text-text-primary">{stats.average_score.toFixed(1)}</Text>
              </View>
              
              <View className="flex-row justify-between">
                <Text className="text-slate-600">Toplam Skor</Text>
                <Text className="text-lg font-bold text-text-primary">{stats.total_score}</Text>
              </View>
            </View>

            {/* Word Stats Card */}
            <View className="mx-6 mt-4 bg-white rounded-2xl p-6 shadow-sm">
              <Text className="text-xl font-bold text-text-primary mb-4">Kelime İstatistikleri</Text>
              
              <View className="flex-row justify-between mb-3">
                <Text className="text-slate-600">Toplam Kelime</Text>
                <Text className="text-lg font-bold text-text-primary">{stats.total_words}</Text>
              </View>
              
              <View className="flex-row justify-between mb-3">
                <Text className="text-slate-600">En Uzun Kelime</Text>
                <Text className="text-lg font-bold text-indigo-600">
                  {stats.longest_word || '-'} {stats.longest_word && `(${stats.longest_word_length})`}
                </Text>
              </View>
            </View>

            {/* Streak Stats Card */}
            <View className="mx-6 mt-4 bg-white rounded-2xl p-6 shadow-sm">
              <Text className="text-xl font-bold text-text-primary mb-4">Seri İstatistikleri</Text>
              
              <View className="flex-row justify-between mb-3">
                <Text className="text-slate-600">Mevcut Seri</Text>
                <Text className="text-lg font-bold text-green-600">
                  🔥 {stats.current_win_streak}
                </Text>
              </View>
              
              <View className="flex-row justify-between">
                <Text className="text-slate-600">En İyi Seri</Text>
                <Text className="text-lg font-bold text-orange-600">
                  🏆 {stats.best_win_streak}
                </Text>
              </View>
            </View>

            {/* Time Stats Card */}
            <View className="mx-6 mt-4 bg-white rounded-2xl p-6 shadow-sm">
              <Text className="text-xl font-bold text-text-primary mb-4">Süre İstatistikleri</Text>
              
              <View className="flex-row justify-between">
                <Text className="text-slate-600">Toplam Oyun Süresi</Text>
                <Text className="text-lg font-bold text-text-primary">
                  {formatTime(stats.total_play_time)}
                </Text>
              </View>
            </View>

            {/* Recent Games */}
            {games.length > 0 && (
              <View className="mx-6 mt-4 mb-6">
                <Text className="text-xl font-bold text-text-primary mb-4">Son Oyunlar</Text>
                
                {games.map((game, index) => {
                  const resultColor = game.won ? 'bg-green-50 border-green-200' : 
                                     game.tied ? 'bg-gray-50 border-gray-200' : 
                                     'bg-red-50 border-red-200';
                  const resultText = game.won ? '✓ Kazandın' : 
                                    game.tied ? '○ Berabere' : 
                                    '✗ Kaybettin';
                  const resultTextColor = game.won ? 'text-green-700' : 
                                         game.tied ? 'text-gray-700' : 
                                         'text-red-700';

                  return (
                    <View 
                      key={index} 
                      className={`bg-white rounded-xl p-4 mb-3 border ${resultColor}`}
                    >
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-base font-semibold text-text-primary">
                          vs {game.opponent}
                        </Text>
                        <Text className={`text-sm font-bold ${resultTextColor}`}>
                          {resultText}
                        </Text>
                      </View>
                      
                      <View className="flex-row justify-between items-center">
                        <Text className="text-2xl font-bold text-text-primary">
                          {game.user_score} - {game.opponent_score}
                        </Text>
                        <Text className="text-xs text-slate-500">
                          {formatDate(game.played_at)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {games.length === 0 && stats.total_games === 0 && (
              <View className="mx-6 mt-8 mb-6 items-center">
                <Text className="text-slate-500 text-center mb-2">
                  Henüz oyun oynamadınız
                </Text>
                <TouchableOpacity 
                  className="bg-primary rounded-xl px-6 py-3 mt-4"
                  onPress={() => router.back()}
                >
                  <Text className="text-white font-bold">İlk Oyununu Oyna!</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
