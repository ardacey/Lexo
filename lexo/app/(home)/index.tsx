import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SignOutButton } from '@/components/SignOutButton';
import { useCreateUser } from '@/hooks/useApi';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedCard = ({ children, delay = 0, style }: any) => {
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export default function Page() {
  const router = useRouter();
  const { user, isSignedIn, isLoading } = useAuth();
  const createUserMutation = useCreateUser();
  const [userInitialized, setUserInitialized] = useState(false);
  
  const [scaleAnims] = useState({
    multiplayer: new Animated.Value(1),
    stats: new Animated.Value(1),
  });

  const openPrivacyPolicy = () => {
    Linking.openURL('https://ardacey.github.io/Lexo/privacy-policy.html');
  };

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
            params: { username, reconnect: 'true' }
          });
        } else {
          await AsyncStorage.removeItem('activeGame');
        }
      }
    } catch {
      // Silent error
    }
  };

  // Initialize user on mount
  useEffect(() => {
    if (user && !userInitialized && !createUserMutation.isPending) {
      const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Player';
      createUserMutation.mutate(
        {
          userId: user.id,
          username,
          email: user.email
        },
        {
          onSuccess: () => {
            setUserInitialized(true);
          },
          onError: () => {
            // Kullanıcı zaten varsa da initialized olarak işaretle
            setUserInitialized(true);
          }
        }
      );

      checkForActiveGame(username);
    }
  }, [user, userInitialized, createUserMutation.isPending]);

  // Show loading while initializing
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  const handleMultiplayer = () => {
    const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player';
    router.push({
      pathname: '/multiplayer',
      params: { username }
    });
  };

  const animateButton = (buttonName: 'multiplayer' | 'stats') => {
    Animated.sequence([
      Animated.timing(scaleAnims[buttonName], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnims[buttonName], {
        toValue: 1,
        tension: 100,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#f0f9ff', '#e0f2fe', '#fef3c7', '#fce7f3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="flex-1"
      >
        <SafeAreaView className="flex-1">
          <StatusBar style="dark" />
          {isSignedIn && (
            <ScrollView 
              className="flex-1"
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Header Section */}
              <AnimatedCard delay={0}>
                <View className="items-center mb-8">
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="rounded-[32px] px-10 py-5 mb-3 shadow-lg"
                  >
                    <Text className="text-6xl font-bold text-white text-center tracking-wider">Lexo</Text>
                  </LinearGradient>
                </View>
              </AnimatedCard>

              {/* Welcome Card */}
              <AnimatedCard delay={100} style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 28, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                <View className="flex-row items-center">
                  <LinearGradient
                    colors={['#f093fb', '#f5576c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="w-16 h-16 rounded-full items-center justify-center mr-4 shadow-md"
                  >
                    <Text className="text-3xl">👋</Text>
                  </LinearGradient>
                  <View className="flex-1">
                    <Text className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Hoş geldin</Text>
                    <Text className="text-xl font-bold text-slate-800" numberOfLines={1}>
                      {user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player'}
                    </Text>
                  </View>
                </View>
              </AnimatedCard>

              {/* Action Buttons */}
              <View className="mb-6 gap-4">
                {/* Multiplayer Button */}
                <AnimatedCard delay={200}>
                  <Animated.View style={{ transform: [{ scale: scaleAnims.multiplayer }] }}>
                    <TouchableOpacity 
                      onPress={() => {
                        animateButton('multiplayer');
                        handleMultiplayer();
                      }}
                      activeOpacity={0.9}
                      className="rounded-3xl overflow-hidden shadow-lg mb-4"
                    >
                      <LinearGradient
                        colors={['#11998e', '#38ef7d']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="p-7 flex-row items-center justify-between relative overflow-hidden"
                      >
                        <View className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full" />
                        <View className="flex-row items-center flex-1 z-10">
                          <View className="bg-white/25 w-14 h-14 rounded-full items-center justify-center mr-4">
                            <Text className="text-3xl">🎮</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-white text-xl font-bold mb-1.5 tracking-wide">Oyun Ara</Text>
                            <Text className="text-white/90 text-sm font-medium">🔥 Çevrimiçi rakiplerle yarış</Text>
                          </View>
                        </View>
                        <View className="bg-white/25 w-11 h-11 rounded-full items-center justify-center z-10">
                          <Text className="text-white text-xl font-bold">→</Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </AnimatedCard>

                {/* Stats Button */}
                <AnimatedCard delay={300}>
                  <Animated.View style={{ transform: [{ scale: scaleAnims.stats }] }}>
                    <TouchableOpacity 
                      onPress={() => {
                        animateButton('stats');
                        router.push('/stats');
                      }}
                      activeOpacity={0.9}
                      className="rounded-3xl overflow-hidden shadow-lg mb-4"
                    >
                      <LinearGradient
                        colors={['#4facfe', '#00f2fe']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="p-7 flex-row items-center justify-between relative overflow-hidden"
                      >
                        <View className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full" />
                        <View className="flex-row items-center flex-1 z-10">
                          <View className="bg-white/25 w-14 h-14 rounded-full items-center justify-center mr-4">
                            <Text className="text-3xl">📊</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-white text-xl font-bold mb-1.5 tracking-wide">İstatistikler</Text>
                            <Text className="text-white/90 text-sm font-medium">📈 Performans analizini gör</Text>
                          </View>
                        </View>
                        <View className="bg-white/25 w-11 h-11 rounded-full items-center justify-center z-10">
                          <Text className="text-white text-xl font-bold">→</Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </AnimatedCard>
              </View>

              {/* Sign Out Button */}
              <AnimatedCard delay={600}>
                <SignOutButton />
              </AnimatedCard>

              <TouchableOpacity onPress={openPrivacyPolicy} className="mt-5 items-center p-2.5">
                <Text className="text-white/70 text-sm underline">Gizlilik Politikası</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
          
          {!isSignedIn && (
            <ScrollView 
              className="flex-1"
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Header Section */}
              <AnimatedCard delay={0}>
                <View className="items-center mb-6">
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="rounded-[32px] px-10 py-5 mb-3 shadow-lg"
                  >
                    <Text className="text-6xl font-bold text-white text-center tracking-wider">Lexo</Text>
                  </LinearGradient>
                </View>
              </AnimatedCard>

              {/* How to Play Card */}
              <AnimatedCard delay={200}>
                <View className="rounded-[28px] overflow-hidden mb-6 shadow-md">
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
                    className="p-6 rounded-[28px] border border-white/30"
                  >
                    <View className="flex-row items-center mb-5">
                      <Text className="text-3xl mr-3">💡</Text>
                      <Text className="text-xl font-bold text-slate-800">Nasıl Oynanır?</Text>
                    </View>
                    <View className="gap-4">
                      <View className="flex-row items-start">
                        <LinearGradient
                          colors={['#667eea', '#764ba2']}
                          className="w-8 h-8 rounded-full items-center justify-center mr-3 mt-0.5"
                        >
                          <Text className="font-bold text-sm text-white">1</Text>
                        </LinearGradient>
                        <Text className="flex-1 text-slate-600 leading-6 text-[15px] font-medium">Verilen harflerden kelime oluşturun</Text>
                      </View>
                      <View className="flex-row items-start">
                        <LinearGradient
                          colors={['#f093fb', '#f5576c']}
                          className="w-8 h-8 rounded-full items-center justify-center mr-3 mt-0.5"
                        >
                          <Text className="font-bold text-sm text-white">2</Text>
                        </LinearGradient>
                        <Text className="flex-1 text-slate-600 leading-6 text-[15px] font-medium">Her harf farklı puan değerine sahip</Text>
                      </View>
                      <View className="flex-row items-start">
                        <LinearGradient
                          colors={['#4facfe', '#00f2fe']}
                          className="w-8 h-8 rounded-full items-center justify-center mr-3 mt-0.5"
                        >
                          <Text className="font-bold text-sm text-white">3</Text>
                        </LinearGradient>
                        <Text className="flex-1 text-slate-600 leading-6 text-[15px] font-medium">Uzun kelimeler daha fazla puan kazandırır</Text>
                      </View>
                      <View className="flex-row items-start">
                        <LinearGradient
                          colors={['#11998e', '#38ef7d']}
                          className="w-8 h-8 rounded-full items-center justify-center mr-3 mt-0.5"
                        >
                          <Text className="font-bold text-sm text-white">4</Text>
                        </LinearGradient>
                        <Text className="flex-1 text-slate-600 leading-6 text-[15px] font-medium">60 saniye içinde en yüksek skoru yapın!</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              </AnimatedCard>

              {/* Auth Buttons */}
              <AnimatedCard delay={300}>
                <View className="gap-4">
                  <Link href="/(auth)/sign-in" asChild>
                    <TouchableOpacity 
                      activeOpacity={0.9}
                      className="rounded-3xl overflow-hidden shadow-lg"
                    >
                      <LinearGradient
                        colors={['#667eea', '#764ba2']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="p-6 items-center"
                      >
                        <Text className="text-white text-xl font-bold tracking-wide">🚀 Hemen Başla</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Link>

                  <Link href="/(auth)/sign-up" asChild>
                    <TouchableOpacity 
                      activeOpacity={0.9}
                      className="bg-white/95 rounded-3xl p-6 items-center shadow-md border border-white/30"
                    >
                      <Text className="text-slate-800 text-xl font-bold tracking-wide">Hesap Oluştur</Text>
                    </TouchableOpacity>
                  </Link>

                  <TouchableOpacity onPress={openPrivacyPolicy} className="mt-5 items-center p-2.5">
                    <Text className="text-white/70 text-sm underline">Gizlilik Politikası</Text>
                  </TouchableOpacity>
                </View>
              </AnimatedCard>
            </ScrollView>
          )}
          <Toast />
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}