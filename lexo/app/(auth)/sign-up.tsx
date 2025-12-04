import * as React from 'react'
import { Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, ScrollView, Animated } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useToast } from '../../context/ToastContext'
import { getErrorMessage } from '../../utils/errorMessages'
import { useAuth } from '../../context/AuthContext'

export default function SignUpScreen() {
  const { signUp, isLoading } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
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

  const onSignUpPress = async () => {
    if (isLoading || isSubmitting) return

    if (!emailAddress || !password || !username) {
      showToast('Lütfen tüm alanları doldurun', 'error')
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
        // Küçük bir delay ile navigate et
        setTimeout(() => {
          router.replace('/(home)')
        }, 500)
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
      className="flex-1"
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }}
            className="items-center"
          >
            {/* Logo and Title */}
            <View className="items-center mb-10">
              <View className="mb-6">
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                  className="w-20 h-20 rounded-full justify-center items-center border-2 border-white/30"
                >
                  <Text className="text-4xl font-bold text-white">L</Text>
                </LinearGradient>
              </View>
              <Text className="text-[28px] font-bold text-white mb-2" style={{ textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>Hesap Oluştur</Text>
              <Text className="text-base text-white/80 text-center">Lexo&apos;ya katıl ve oynamaya başla!</Text>
            </View>

            {/* Form */}
            <View className="w-full max-w-[400px]">
              <View className="flex-row items-center bg-white/15 rounded-2xl mb-4 px-4 border border-white/20">
                <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.7)" style={{ marginRight: 12 }} />
                <TextInput
                  value={username}
                  placeholder="Kullanıcı adı"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  onChangeText={setUsername}
                  className="flex-1 h-14 text-white text-base"
                  autoCapitalize="none"
                  autoComplete="username"
                />
              </View>

              <View className="flex-row items-center bg-white/15 rounded-2xl mb-4 px-4 border border-white/20">
                <Ionicons name="mail-outline" size={20} color="rgba(255,255,255,0.7)" style={{ marginRight: 12 }} />
                <TextInput
                  value={emailAddress}
                  placeholder="E-posta adresi"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  onChangeText={setEmailAddress}
                  className="flex-1 h-14 text-white text-base"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <View className="flex-row items-center bg-white/15 rounded-2xl mb-4 px-4 border border-white/20">
                <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.7)" style={{ marginRight: 12 }} />
                <TextInput
                  value={password}
                  placeholder="Şifre (en az 6 karakter)"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  secureTextEntry={!showPassword}
                  onChangeText={setPassword}
                  className="flex-1 h-14 text-white text-base"
                  autoComplete="password-new"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
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
                className="rounded-2xl overflow-hidden mt-2 shadow-lg"
              >
                <LinearGradient
                  colors={isSubmitting || isLoading ? ['#ccc', '#aaa'] : ['#fff', '#f0f0f0']}
                  className="py-4 items-center"
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text className={`text-lg font-bold ${isSubmitting || isLoading ? 'text-gray-500' : 'text-[#667eea]'}`}>
                    {isSubmitting || isLoading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Sign In Link */}
            <View className="flex-row mt-8">
              <Text className="text-white/80 text-base">Zaten hesabın var mı? </Text>
              <Link href="/(auth)/sign-in" asChild>
                <TouchableOpacity>
                  <Text className="text-white text-base font-bold underline">Giriş Yap</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}
