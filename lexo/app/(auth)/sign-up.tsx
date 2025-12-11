import * as React from 'react'
import { Text, TextInput, TouchableOpacity, View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Animated } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useToast } from '../../context/ToastContext'
import { getErrorMessage } from '../../utils/errorMessages'
import { useAuth } from '../../context/AuthContext'
import { useCheckUsername } from '../../hooks/useApi'

export default function SignUpScreen() {
  const { signUp, isLoading } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()
  const checkUsernameMutation = useCheckUsername()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [usernameError, setUsernameError] = React.useState('')
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

  const checkUsernameAvailability = React.useCallback(async (usernameToCheck: string) => {
    if (!usernameToCheck.trim()) {
      setUsernameError('')
      return
    }

    try {
      const result = await checkUsernameMutation.mutateAsync(usernameToCheck.trim())
      if (!result.available) {
        setUsernameError('Bu kullanıcı adı zaten alınmış')
      } else {
        setUsernameError('')
      }
    } catch (error) {
      console.error('Username check error:', error)
      // Hata durumunda sessizce geç, validation'ı engelleme
      setUsernameError('')
    }
  }, [checkUsernameMutation])

  const onSignUpPress = async () => {
    if (isLoading || isSubmitting) return

    if (!emailAddress || !password || !username) {
      showToast('Lütfen tüm alanları doldurun', 'error')
      return
    }

    if (usernameError) {
      showToast(usernameError, 'error')
      return
    }

    if (password.length < 6) {
      showToast('Şifre en az 6 karakter olmalıdır', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await signUp(emailAddress, password, username)

      if (error) {
        showToast(getErrorMessage(error), 'error')
      } else {
        showToast('Kayıt başarılı!', 'success')
        // Yönlendirme otomatik olarak (auth)/_layout.tsx'deki Redirect ile yapılır
      }
    } catch (err: unknown) {
      showToast(getErrorMessage(err as Error), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

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
              <Text style={styles.title}>Hesap Oluştur</Text>
              <Text style={styles.subtitle}>Lexo&apos;ya katıl ve oynamaya başla!</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                <TextInput
                  value={username}
                  placeholder="Kullanıcı adı"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  onChangeText={(text) => {
                    setUsername(text)
                    // Clear error when user starts typing
                    if (usernameError) setUsernameError('')
                  }}
                  onBlur={() => checkUsernameAvailability(username)}
                  style={styles.input}
                  autoCapitalize="none"
                  autoComplete="username"
                />
              </View>
              {usernameError ? (
                <Text style={styles.errorText}>{usernameError}</Text>
              ) : null}

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
                  placeholder="Şifre (en az 6 karakter)"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  secureTextEntry={!showPassword}
                  onChangeText={setPassword}
                  style={styles.input}
                  autoComplete="password-new"
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
                onPress={onSignUpPress}
                disabled={isSubmitting || isLoading}
                style={styles.signUpButton}
              >
                <LinearGradient
                  colors={isSubmitting || isLoading ? ['#ccc', '#aaa'] : ['#fff', '#f0f0f0']}
                  style={styles.signUpButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={[styles.signUpButtonText, (isSubmitting || isLoading) && styles.disabledText]}>
                    {isSubmitting || isLoading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Sign In Link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Zaten hesabın var mı? </Text>
              <Link href="/(auth)/sign-in" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Giriş Yap</Text>
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
    textAlign: 'center',
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
  signUpButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  signUpButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  signUpButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  disabledText: {
    color: '#666',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
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
