import React from 'react'
import { Text, TextInput, TouchableOpacity, View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Animated } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useToast } from '../../context/ToastContext'
import { getErrorMessage } from '../../utils/errorMessages'
import { useAuth } from '../../context/AuthContext'

export default function Page() {
  const { signIn, signInWithGoogle, isLoading } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = React.useState(false)
  const fadeAnim = React.useRef(new Animated.Value(0)).current
  const slideAnim = React.useRef(new Animated.Value(50)).current

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const onSignInPress = React.useCallback(async () => {
    if (!emailAddress || !password) {
      showToast('Lütfen tüm alanları doldurun', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await signIn(emailAddress, password)

      if (error) {
        showToast(getErrorMessage(error), 'error')
      } else {
        // Yönlendirme otomatik olarak (auth)/_layout.tsx'deki Redirect ile yapılır
      }
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }, [emailAddress, password, signIn, router, showToast])

  const onGooglePress = React.useCallback(async () => {
    setIsGoogleSubmitting(true)
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        showToast(getErrorMessage(error), 'error')
      }
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setIsGoogleSubmitting(false)
    }
  }, [signInWithGoogle, showToast])

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2', '#f093fb']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Logo and Title */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                  style={styles.logoBackground}
                >
                  <Text style={styles.logoText}>L</Text>
                </LinearGradient>
              </View>
              <Text style={styles.title}>Tekrar Hoşgeldin!</Text>
              <Text style={styles.subtitle}>Hesabına giriş yap</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                <TextInput
                  value={emailAddress}
                  placeholder="E-posta adresi"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  onChangeText={setEmailAddress}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                <TextInput
                  value={password}
                  placeholder="Şifre"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  secureTextEntry={!showPassword}
                  onChangeText={setPassword}
                  style={styles.input}
                  autoComplete="password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="rgba(255,255,255,0.7)" 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={onSignInPress}
                disabled={isSubmitting || isLoading}
                style={styles.signInButton}
              >
                <LinearGradient
                  colors={isSubmitting || isLoading ? ['#ccc', '#aaa'] : ['#fff', '#f0f0f0']}
                  style={styles.signInButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={[styles.signInButtonText, (isSubmitting || isLoading) && styles.disabledText]}>
                    {isSubmitting || isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>veya</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                onPress={onGooglePress}
                disabled={isGoogleSubmitting || isLoading}
                style={styles.oauthButton}
              >
                <View style={styles.oauthButtonContent}>
                  <Ionicons name="logo-google" size={18} color="#0f172a" />
                  <Text style={styles.oauthButtonText}>
                    {isGoogleSubmitting ? 'Bağlanıyor...' : 'Google ile devam et'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Sign Up Link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Hesabın yok mu? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Kayıt Ol</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    color: '#fff',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  signInButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  signInButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  signInButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  disabledText: {
    color: '#666',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  oauthButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 14,
  },
  oauthButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  oauthButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    marginTop: 32,
  },
  footerText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  linkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
})
