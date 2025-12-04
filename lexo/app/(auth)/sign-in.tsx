import React from 'react'
import { Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, ScrollView, Animated } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useToast } from '../../context/ToastContext'
import { getErrorMessage } from '../../utils/errorMessages'
import { useAuth } from '../../context/AuthContext'

export default function Page() {
  const { signIn, isLoading } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
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
        router.replace('/')
      }
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }, [emailAddress, password, signIn, router, showToast])

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
              <Text className="text-[28px] font-bold text-white mb-2" style={{ textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>Tekrar Hoşgeldin!</Text>
              <Text className="text-base text-white/80">Hesabına giriş yap</Text>
            </View>

            {/* Form */}
            <View className="w-full max-w-[400px]">
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
                  placeholder="Şifre"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  secureTextEntry={!showPassword}
                  onChangeText={setPassword}
                  className="flex-1 h-14 text-white text-base"
                  autoComplete="password"
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
                onPress={onSignInPress}
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
                    {isSubmitting || isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Sign Up Link */}
            <View className="flex-row mt-8">
              <Text className="text-white/80 text-base">Hesabın yok mu? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <TouchableOpacity>
                  <Text className="text-white text-base font-bold underline">Kayıt Ol</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}
