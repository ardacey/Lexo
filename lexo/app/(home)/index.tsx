import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import { SignOutButton } from '@/components/SignOutButton';
import { createUser } from '@/utils/api';
import { LinearGradient } from 'expo-linear-gradient';

export default function Page() {
  const router = useRouter();
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      const username = user.username || user.emailAddresses[0].emailAddress?.split('@')[0] || 'Player';
      createUser(user.id, username, user.primaryEmailAddress?.emailAddress).catch(console.error);
    }
  }, [user]);

  const handleMultiplayer = () => {
    const username = user?.username || user?.emailAddresses[0].emailAddress?.split('@')[0] || 'Player';
    router.push({
      pathname: '/multiplayer',
      params: { username }
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#f8f9ff', '#f0f4ff', '#fff5f7']}
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
              <View style={styles.headerContainer}>
                <View style={styles.logoContainer}>
                  <Text style={styles.logoText}>Lexo</Text>
                </View>
                <Text style={styles.subtitle}>Türkçe Kelime Oyunu</Text>
              </View>

              {/* Welcome Card */}
              <View style={styles.welcomeCard}>
                <View style={styles.welcomeContent}>
                  <LinearGradient
                    colors={['#a855f7', '#ec4899']}
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
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonsContainer}>
                {/* Multiplayer Button */}
                <TouchableOpacity 
                  onPress={handleMultiplayer}
                  activeOpacity={0.8}
                  style={styles.buttonWrapper}
                >
                  <LinearGradient
                    colors={['#10b981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButton}
                  >
                    <View style={styles.buttonContent}>
                      <View style={styles.iconContainer}>
                        <Text style={styles.buttonIcon}>🎮</Text>
                      </View>
                      <View style={styles.buttonTextContainer}>
                        <Text style={styles.buttonTitle}>Oyun Ara</Text>
                        <Text style={styles.buttonSubtitle}>Çevrimiçi rakip bul</Text>
                      </View>
                    </View>
                    <View style={styles.arrowContainer}>
                      <Text style={styles.arrowText}>→</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Stats Button */}
                <TouchableOpacity 
                  onPress={() => router.push('/stats')}
                  activeOpacity={0.8}
                  style={styles.buttonWrapper}
                >
                  <LinearGradient
                    colors={['#3b82f6', '#2563eb']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButton}
                  >
                    <View style={styles.buttonContent}>
                      <View style={styles.iconContainer}>
                        <Text style={styles.buttonIcon}>📊</Text>
                      </View>
                      <View style={styles.buttonTextContainer}>
                        <Text style={styles.buttonTitle}>İstatistikler</Text>
                        <Text style={styles.buttonSubtitle}>Performansını gör</Text>
                      </View>
                    </View>
                    <View style={styles.arrowContainer}>
                      <Text style={styles.arrowText}>→</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* How to Play Card */}
              <View style={styles.howToPlayCard}>
                <View style={styles.howToPlayHeader}>
                  <Text style={styles.lightbulbEmoji}>💡</Text>
                  <Text style={styles.howToPlayTitle}>Nasıl Oynanır?</Text>
                </View>
                <View style={styles.instructionsContainer}>
                  <View style={styles.instructionRow}>
                    <View style={[styles.numberBadge, styles.purpleBadge]}>
                      <Text style={styles.numberText}>1</Text>
                    </View>
                    <Text style={styles.instructionText}>Verilen harflerden kelime oluşturun</Text>
                  </View>
                  <View style={styles.instructionRow}>
                    <View style={[styles.numberBadge, styles.blueBadge]}>
                      <Text style={[styles.numberText, styles.blueText]}>2</Text>
                    </View>
                    <Text style={styles.instructionText}>Her harf farklı puan değerine sahip</Text>
                  </View>
                  <View style={styles.instructionRow}>
                    <View style={[styles.numberBadge, styles.pinkBadge]}>
                      <Text style={[styles.numberText, styles.pinkText]}>3</Text>
                    </View>
                    <Text style={styles.instructionText}>Uzun kelimeler daha fazla puan kazandırır</Text>
                  </View>
                  <View style={styles.instructionRow}>
                    <View style={[styles.numberBadge, styles.greenBadge]}>
                      <Text style={[styles.numberText, styles.greenText]}>4</Text>
                    </View>
                    <Text style={styles.instructionText}>60 saniye içinde en yüksek skoru yapın!</Text>
                  </View>
                </View>
              </View>

              {/* Sign Out Button */}
              <SignOutButton />
            </ScrollView>
          </SignedIn>
          
          <SignedOut>
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContentSignedOut}
              showsVerticalScrollIndicator={false}
            >
              {/* Header Section */}
              <View style={styles.headerContainerSignedOut}>
                <View style={styles.logoContainer}>
                  <Text style={styles.logoText}>Lexo</Text>
                </View>
                <Text style={styles.subtitle}>Türkçe Kelime Oyunu</Text>
              </View>

              {/* How to Play Card */}
              <View style={styles.howToPlayCard}>
                <View style={styles.howToPlayHeader}>
                  <Text style={styles.lightbulbEmoji}>💡</Text>
                  <Text style={styles.howToPlayTitle}>Nasıl Oynanır?</Text>
                </View>
                <View style={styles.instructionsContainer}>
                  <View style={styles.instructionRow}>
                    <View style={[styles.numberBadge, styles.purpleBadge]}>
                      <Text style={styles.numberText}>1</Text>
                    </View>
                    <Text style={styles.instructionText}>Verilen harflerden kelime oluşturun</Text>
                  </View>
                  <View style={styles.instructionRow}>
                    <View style={[styles.numberBadge, styles.blueBadge]}>
                      <Text style={[styles.numberText, styles.blueText]}>2</Text>
                    </View>
                    <Text style={styles.instructionText}>Her harf farklı puan değerine sahip</Text>
                  </View>
                  <View style={styles.instructionRow}>
                    <View style={[styles.numberBadge, styles.pinkBadge]}>
                      <Text style={[styles.numberText, styles.pinkText]}>3</Text>
                    </View>
                    <Text style={styles.instructionText}>Uzun kelimeler daha fazla puan kazandırır</Text>
                  </View>
                  <View style={styles.instructionRow}>
                    <View style={[styles.numberBadge, styles.greenBadge]}>
                      <Text style={[styles.numberText, styles.greenText]}>4</Text>
                    </View>
                    <Text style={styles.instructionText}>60 saniye içinde en yüksek skoru yapın!</Text>
                  </View>
                </View>
              </View>

              {/* Auth Buttons */}
              <View style={styles.authButtonsContainer}>
                <Link href="/(auth)/sign-in" asChild>
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    style={styles.authButtonWrapper}
                  >
                    <LinearGradient
                      colors={['#6366f1', '#4f46e5']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.authButton}
                    >
                      <Text style={styles.authButtonText}>Giriş Yap</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </Link>

                <Link href="/(auth)/sign-up" asChild>
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    style={styles.signUpButton}
                  >
                    <Text style={styles.signUpButtonText}>Kayıt Ol</Text>
                  </TouchableOpacity>
                </Link>
              </View>
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
    marginBottom: 48,
  },
  logoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#6366f1',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#475569',
    fontWeight: '500',
  },
  welcomeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  waveEmoji: {
    fontSize: 28,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  buttonsContainer: {
    marginBottom: 24,
    gap: 16,
  },
  buttonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 16,
  },
  actionButton: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  buttonIcon: {
    fontSize: 28,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  buttonSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  arrowContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: '#ffffff',
    fontSize: 18,
  },
  howToPlayCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  howToPlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  lightbulbEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  howToPlayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  instructionsContainer: {
    gap: 12,
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
  },
  authButtonsContainer: {
    gap: 16,
  },
  authButtonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  authButton: {
    padding: 20,
    alignItems: 'center',
  },
  authButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  signUpButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  signUpButtonText: {
    color: '#1e293b',
    fontSize: 20,
    fontWeight: 'bold',
  },
});