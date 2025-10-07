import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
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
  const { user } = useUser();
  const createUserMutation = useCreateUser();
  
  const [scaleAnims] = useState({
    multiplayer: new Animated.Value(1),
    stats: new Animated.Value(1),
  });

  useEffect(() => {
    if (user && !createUserMutation.isPending) {
      const username = user.username || user.emailAddresses[0].emailAddress?.split('@')[0] || 'Player';
      createUserMutation.mutate({
        clerkId: user.id,
        username,
        email: user.primaryEmailAddress?.emailAddress
      });

      checkForActiveGame(username);
    }
  }, [user]);

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
          console.log('🔄 Active game found, reconnecting... (elapsed: ' + Math.floor(elapsed) + 's, remaining: ' + Math.floor(remaining) + 's)');
          router.push({
            pathname: '/multiplayer',
            params: { username, reconnect: 'true' }
          });
        } else {
          console.log('⏰ Game time expired, clearing storage (elapsed: ' + Math.floor(elapsed) + 's, remaining: ' + Math.floor(remaining) + 's)');
          await AsyncStorage.removeItem('activeGame');
        }
      }
    } catch (error) {
      console.error('Error checking for active game:', error);
    }
  };

  const handleMultiplayer = () => {
    const username = user?.username || user?.emailAddresses[0].emailAddress?.split('@')[0] || 'Player';
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
          <SignedIn>
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
                      {user?.username || user?.emailAddresses[0].emailAddress?.split('@')[0] || 'Player'}
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
          </SignedIn>
          
          <SignedOut>
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContentSignedOut}
              showsVerticalScrollIndicator={false}
            >
              {/* Header Section */}
              <AnimatedCard delay={0}>
                <View style={styles.headerContainerSignedOut}>
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

              {/* How to Play Card */}
              <AnimatedCard delay={200}>
                <View style={styles.howToPlayCard}>
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
                    style={styles.howToPlayContent}
                  >
                    <View style={styles.howToPlayHeader}>
                      <Text style={styles.lightbulbEmoji}>💡</Text>
                      <Text style={styles.howToPlayTitle}>Nasıl Oynanır?</Text>
                    </View>
                    <View style={styles.instructionsContainer}>
                      <View style={styles.instructionRow}>
                        <LinearGradient
                          colors={['#667eea', '#764ba2']}
                          style={styles.numberBadgeGradient}
                        >
                          <Text style={styles.numberTextWhite}>1</Text>
                        </LinearGradient>
                        <Text style={styles.instructionText}>Verilen harflerden kelime oluşturun</Text>
                      </View>
                      <View style={styles.instructionRow}>
                        <LinearGradient
                          colors={['#f093fb', '#f5576c']}
                          style={styles.numberBadgeGradient}
                        >
                          <Text style={styles.numberTextWhite}>2</Text>
                        </LinearGradient>
                        <Text style={styles.instructionText}>Her harf farklı puan değerine sahip</Text>
                      </View>
                      <View style={styles.instructionRow}>
                        <LinearGradient
                          colors={['#4facfe', '#00f2fe']}
                          style={styles.numberBadgeGradient}
                        >
                          <Text style={styles.numberTextWhite}>3</Text>
                        </LinearGradient>
                        <Text style={styles.instructionText}>Uzun kelimeler daha fazla puan kazandırır</Text>
                      </View>
                      <View style={styles.instructionRow}>
                        <LinearGradient
                          colors={['#11998e', '#38ef7d']}
                          style={styles.numberBadgeGradient}
                        >
                          <Text style={styles.numberTextWhite}>4</Text>
                        </LinearGradient>
                        <Text style={styles.instructionText}>60 saniye içinde en yüksek skoru yapın!</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              </AnimatedCard>

              {/* Auth Buttons */}
              <AnimatedCard delay={300}>
                <View style={styles.authButtonsContainer}>
                  <Link href="/(auth)/sign-in" asChild>
                    <TouchableOpacity 
                      activeOpacity={0.9}
                      style={styles.authButtonWrapper}
                    >
                      <LinearGradient
                        colors={['#667eea', '#764ba2']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.authButton}
                      >
                        <Text style={styles.authButtonText}>🚀 Hemen Başla</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Link>

                  <Link href="/(auth)/sign-up" asChild>
                    <TouchableOpacity 
                      activeOpacity={0.9}
                      style={styles.signUpButton}
                    >
                      <Text style={styles.signUpButtonText}>Hesap Oluştur</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </AnimatedCard>
            </ScrollView>
          </SignedOut>
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