import * as React from 'react'
import { Text, TextInput, TouchableOpacity, View, StyleSheet, KeyboardAvoidingView, Platform, Animated } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useToast } from '../../context/ToastContext'
import { getErrorMessage } from '../../utils/errorMessages'
import { useAuth } from '../../context/AuthContext'

export default function VerifyEmailScreen() {
  const { verifyOtp, resendVerification, isLoading } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()
  const params = useLocalSearchParams<{ email: string }>()
  const email = params.email || ''

  const [otpCode, setOtpCode] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isResending, setIsResending] = React.useState(false)
  const [resendCooldown, setResendCooldown] = React.useState(0)
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

  // Cooldown timer
  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const onVerifyPress = async () => {
    if (isLoading || isSubmitting) return

    if (!otpCode || otpCode.length < 6) {
      showToast('Lütfen 6 haneli kodu girin', 'error')
      return
    }

    if (!email) {
      showToast('E-posta adresi bulunamadı', 'error')
      router.replace('/(auth)/sign-up')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await verifyOtp(email, otpCode)

      if (error) {
        showToast(getErrorMessage(error), 'error')
      } else {
        showToast('E-posta doğrulandı! Giriş yapabilirsiniz.', 'success')
        router.replace('/(auth)/sign-in')
      }
    } catch (err) {
      showToast('Bir hata oluştu', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onResendPress = async () => {
    if (isResending || resendCooldown > 0) return

    if (!email) {
      showToast('E-posta adresi bulunamadı', 'error')
      return
    }

    setIsResending(true)
    try {
      const { error } = await resendVerification(email)

      if (error) {
        showToast(getErrorMessage(error), 'error')
      } else {
        showToast('Doğrulama kodu tekrar gönderildi', 'success')
        setResendCooldown(60) // 60 seconds cooldown
      }
    } catch (err) {
      showToast('Bir hata oluştu', 'error')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail-outline" size={48} color="#667eea" />
            </View>
            <Text style={styles.title}>E-posta Doğrulama</Text>
            <Text style={styles.subtitle}>
              {email ? `${email} adresine gönderilen 6 haneli kodu girin` : 'E-postanıza gönderilen kodu girin'}
            </Text>
          </View>

          {/* OTP Input */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="keypad-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={otpCode}
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                textAlign="center"
              />
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.button, (isSubmitting || isLoading) && styles.buttonDisabled]}
              onPress={onVerifyPress}
              disabled={isSubmitting || isLoading}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {isSubmitting ? (
                  <Text style={styles.buttonText}>Doğrulanıyor...</Text>
                ) : (
                  <>
                    <Text style={styles.buttonText}>Doğrula</Text>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Resend Code */}
            <TouchableOpacity
              style={styles.resendButton}
              onPress={onResendPress}
              disabled={isResending || resendCooldown > 0}
            >
              <Text style={[styles.resendText, (isResending || resendCooldown > 0) && styles.resendTextDisabled]}>
                {isResending
                  ? 'Gönderiliyor...'
                  : resendCooldown > 0
                  ? `Tekrar gönder (${resendCooldown}s)`
                  : 'Kodu tekrar gönder'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Back to Sign Up */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/(auth)/sign-up')}
          >
            <Ionicons name="arrow-back" size={16} color="#667eea" />
            <Text style={styles.backText}>Kayıt sayfasına dön</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: 8,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: '#9CA3AF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 4,
  },
  backText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
})
