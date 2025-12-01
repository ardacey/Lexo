import * as React from 'react'
import { useEffect } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../utils/supabase'
import { useToast } from '../../context/ToastContext'

export default function AuthCallbackScreen() {
  const router = useRouter()
  const { showToast } = useToast()
  const params = useLocalSearchParams<{
    token_hash?: string
    type?: string
    access_token?: string
    refresh_token?: string
    error?: string
    error_description?: string
  }>()

  useEffect(() => {
    const handleCallback = async () => {
      // Handle error from Supabase
      if (params.error) {
        const errorMessage = params.error_description?.replace(/\+/g, ' ') || 'Doğrulama hatası'
        showToast(errorMessage, 'error')
        router.replace('/(auth)/sign-in')
        return
      }

      // Handle token_hash (email confirmation via magic link)
      if (params.token_hash && params.type) {
        try {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: params.token_hash,
            type: params.type as 'signup' | 'email' | 'recovery' | 'invite',
          })

          if (error) {
            showToast(error.message, 'error')
            router.replace('/(auth)/sign-in')
          } else {
            showToast('E-posta doğrulandı!', 'success')
            router.replace('/(home)')
          }
        } catch (err) {
          showToast('Doğrulama sırasında bir hata oluştu', 'error')
          router.replace('/(auth)/sign-in')
        }
        return
      }

      // Handle access_token and refresh_token (OAuth or session restore)
      if (params.access_token && params.refresh_token) {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          })

          if (error) {
            showToast(error.message, 'error')
            router.replace('/(auth)/sign-in')
          } else {
            showToast('Giriş başarılı!', 'success')
            router.replace('/(home)')
          }
        } catch (err) {
          showToast('Oturum oluşturulurken bir hata oluştu', 'error')
          router.replace('/(auth)/sign-in')
        }
        return
      }

      // No valid params, redirect to sign-in
      router.replace('/(auth)/sign-in')
    }

    handleCallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#667eea" />
      <Text style={styles.text}>Doğrulanıyor...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
})
