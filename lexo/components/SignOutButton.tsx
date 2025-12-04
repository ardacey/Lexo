import { useAuth } from '../context/AuthContext'
import { useRouter } from 'expo-router'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

export const SignOutButton = () => {
  const { signOut } = useAuth()
  const router = useRouter()
  
  const handleSignOut = async () => {
    try {
      await signOut()
      router.replace('/(auth)/sign-in')
    } catch {
      // Silent sign out error
    }
  }
  return (
    <TouchableOpacity 
      onPress={handleSignOut}
      activeOpacity={0.8}
      className="bg-white/90 rounded-2xl p-5 shadow-md border border-red-200"
    >
      <View className="flex-row items-center justify-center">
        <View className="bg-red-100 w-10 h-10 rounded-full items-center justify-center mr-3">
          <Text className="text-xl">🚪</Text>
        </View>
        <Text className="text-red-600 text-lg font-semibold">Çıkış Yap</Text>
      </View>
    </TouchableOpacity>
  )
}