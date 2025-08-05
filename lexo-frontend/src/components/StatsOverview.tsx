import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUserStats, fetchLeaderboard, fetchQuickStats } from '../api/stats';
import type { UserStats, LeaderboardEntry, QuickStats } from '../api/stats';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Target, Clock, Award, Users, Gamepad2 } from 'lucide-react';

const StatsOverview: React.FC = () => {
  const { user } = useAuth();

  const { data: userStats, isLoading: userStatsLoading } = useQuery<UserStats>({
    queryKey: ['userStats'],
    queryFn: () => fetchUserStats(),
    enabled: !!user,
  });

  React.useEffect(() => {
    if (userStats) {
      console.log('DEBUG: User stats received:', userStats);
      console.log('DEBUG: Playtime seconds:', userStats?.total_playtime_seconds);
      console.log('DEBUG: Win rate data:', { wins: userStats?.wins, total_games: userStats?.total_games });
    }
  }, [userStats]);

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: () => fetchLeaderboard(5),
    refetchInterval: 30000,
  });

  const { data: quickStats, isLoading: quickStatsLoading } = useQuery<QuickStats>({
    queryKey: ['quickStats'],
    queryFn: fetchQuickStats,
    refetchInterval: 30000,
  });

  if (userStatsLoading || leaderboardLoading || quickStatsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8 text-slate-400" />
      </div>
    );
  }

  const formatPlaytime = (seconds: number): string => {
    if (!seconds || seconds === 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const getWinRate = (stats: { wins: number; total_games: number } | null): number => {
    if (!stats || !stats.total_games || stats.total_games === 0) return 0;
    const rate = (stats.wins / stats.total_games) * 100;
    return Math.round(Math.min(100, Math.max(0, rate)));
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Platform Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {quickStats?.total_users || 0}
              </div>
              <div className="text-sm text-slate-600">Total Players</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {quickStats?.total_games || 0}
              </div>
              <div className="text-sm text-slate-600">Total Games</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {quickStats?.total_words || 0}
              </div>
              <div className="text-sm text-slate-600">Total Words</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-orange-600">
                {quickStats?.top_player?.username || '-'}
              </div>
              <div className="text-sm text-slate-600">Top Player</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {userStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                My Personal Statistics
              </CardTitle>
              <CardDescription>
                {user?.username} - Your overall performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="font-semibold">{userStats.total_games}</div>
                    <div className="text-sm text-slate-600">Total Games</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <div>
                    <div className="font-semibold">{userStats.wins}</div>
                    <div className="text-sm text-slate-600">Wins</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="font-semibold">{userStats.total_score}</div>
                    <div className="text-sm text-slate-600">Total Score</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <div>
                    <div className="font-semibold">
                      {formatPlaytime(userStats.total_playtime_seconds || 0)}
                    </div>
                    <div className="text-sm text-slate-600">Playtime</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-600">Win Rate</span>
                  <Badge variant="secondary">
                    {getWinRate(userStats)}%
                  </Badge>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className={`bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300`}
                    style={{ 
                      width: `${Math.min(100, Math.max(0, getWinRate(userStats)))}%`,
                      minWidth: getWinRate(userStats) > 0 ? '2px' : '0px'
                    }}
                  />
                </div>
              </div>

              {userStats.longest_word && (
                <div className="pt-4 border-t">
                  <div className="text-sm text-slate-600 mb-1">Longest Word</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {userStats.longest_word}
                    </Badge>
                    <span className="text-sm text-slate-500">
                      ({userStats.longest_word_length} letters)
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Leaderboard
            </CardTitle>
            <CardDescription>
              Top players
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaderboard?.slice(0, 5).map((entry, index) => (
                <div key={entry.username} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-800' :
                      index === 1 ? 'bg-gray-100 text-gray-800' :
                      index === 2 ? 'bg-orange-100 text-orange-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {entry.rank}
                    </div>
                    <div>
                      <div className="font-medium">{entry.username}</div>
                      <div className="text-sm text-slate-600">
                        {entry.wins}/{entry.total_games} wins
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{entry.total_score}</div>
                    <div className="text-sm text-slate-600">points</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatsOverview;
