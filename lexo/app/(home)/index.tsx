import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SignOutButton } from '@/components/SignOutButton';
import { useCreateUser } from '@/hooks/useApi';
import { LinearGradient } from 'expo-linear-gradient';
import { getOnlineStats } from '@/utils/api';

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
  const [onlinePlayers, setOnlinePlayers] = useState<number | null>(null);
  
  const [scaleAnims] = useState({
    multiplayer: new Animated.Value(1),
    stats: new Animated.Value(1),
  });

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
    <View style={styles.container}>
      <LinearGradient
        colors={['#f0f9ff', '#e0f2fe', '#fef3c7', '#fce7f3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" />
          {isSignedIn && (
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Header Section */}
              <AnimatedCard delay={0}>
                <View style={styles.headerContainer}>
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.logoContainer}
                  >
                    <Text style={styles.logoText}>Lexo</Text>
                  </LinearGradient>
                </View>
              </AnimatedCard>

              {/* Welcome Card */}
              <AnimatedCard delay={100} style={styles.welcomeCard}>
                <View style={styles.welcomeContent}>
                  <LinearGradient
                    colors={['#f093fb', '#f5576c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarGradient}
                  >
                    <Text style={styles.waveEmoji}>👋</Text>
                  </LinearGradient>
                  <View style={styles.welcomeTextContainer}>
                    <Text style={styles.welcomeLabel}>Hoş geldin</Text>
                    <Text style={styles.username} numberOfLines={1}>
                      {user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player'}
                    </Text>
                  </View>
                </View>
              </AnimatedCard>

              {/* Action Buttons */}
              <View style={styles.buttonsContainer}>
                {/* Multiplayer Button */}
                <AnimatedCard delay={200}>
                  <Animated.View style={{ transform: [{ scale: scaleAnims.multiplayer }] }}>
                    <TouchableOpacity 
                      onPress={() => {
                        animateButton('multiplayer');
                        handleMultiplayer();
                      }}
                      activeOpacity={0.9}
                      style={styles.buttonWrapper}
                    >
                      <LinearGradient
                        colors={['#11998e', '#38ef7d']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.actionButton}
                      >
                        <View style={styles.glowEffect} />
                        <View style={styles.buttonContent}>
                          <View style={styles.iconContainer}>
                            <Text style={styles.buttonIcon}>🎮</Text>
                          </View>
                          <View style={styles.buttonTextContainer}>
                            <Text style={styles.buttonTitle}>Oyun Ara</Text>
                            <Text style={styles.buttonSubtitle}>🔥 Çevrimiçi rakiplerle yarış</Text>
                            {onlinePlayers !== null && (
                              <Text style={styles.buttonMeta}>Şu an {onlinePlayers} oyuncu çevrimiçi</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.arrowContainer}>
                          <Text style={styles.arrowText}>→</Text>
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
                      style={styles.buttonWrapper}
                    >
                      <LinearGradient
                        colors={['#4facfe', '#00f2fe']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.actionButton}
                      >
                        <View style={styles.glowEffect} />
                        <View style={styles.buttonContent}>
                          <View style={styles.iconContainer}>
                            <Text style={styles.buttonIcon}>📊</Text>
                          </View>
                          <View style={styles.buttonTextContainer}>
                            <Text style={styles.buttonTitle}>İstatistikler</Text>
                            <Text style={styles.buttonSubtitle}>📈 Performans analizini gör</Text>
                          </View>
                        </View>
                        <View style={styles.arrowContainer}>
                          <Text style={styles.arrowText}>→</Text>
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
            </ScrollView>
          )}
          <Toast />
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  scrollContentSignedOut: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerContainerSignedOut: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    borderRadius: 32,
    paddingHorizontal: 40,
    paddingVertical: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
  },
  sparkle: {
    fontSize: 24,
  },
  logoText: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  welcomeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#f5576c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  waveEmoji: {
    fontSize: 32,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  buttonsContainer: {
    marginBottom: 24,
    gap: 16,
  },
  buttonWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  actionButton: {
    padding: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  glowEffect: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 75,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    zIndex: 1,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  buttonIcon: {
    fontSize: 32,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  buttonSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonMeta: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  arrowContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  arrowText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  featuresContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  featureGradient: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  featureEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  featureTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  featureDesc: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    textAlign: 'center',
  },
  howToPlayCard: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  howToPlayContent: {
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  howToPlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  lightbulbEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  howToPlayTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  instructionsContainer: {
    gap: 16,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  numberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  numberBadgeGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  purpleBadge: {
    backgroundColor: '#f3e8ff',
  },
  blueBadge: {
    backgroundColor: '#dbeafe',
  },
  pinkBadge: {
    backgroundColor: '#fce7f3',
  },
  greenBadge: {
    backgroundColor: '#d1fae5',
  },
  numberText: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#9333ea',
  },
  numberTextWhite: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#ffffff',
  },
  blueText: {
    color: '#2563eb',
  },
  pinkText: {
    color: '#ec4899',
  },
  greenText: {
    color: '#059669',
  },
  instructionText: {
    flex: 1,
    color: '#475569',
    lineHeight: 24,
    fontSize: 15,
    fontWeight: '500',
  },
  welcomeDescription: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
    paddingHorizontal: 20,
  },
  featuresPreview: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  featurePreviewCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  featurePreviewEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  featurePreviewTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  authButtonsContainer: {
    gap: 16,
  },
  authButtonWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  authButton: {
    padding: 24,
    alignItems: 'center',
  },
  authButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  signUpButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  signUpButtonText: {
    color: '#1e293b',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
