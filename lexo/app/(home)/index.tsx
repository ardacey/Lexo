import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import { SignOutButton } from '@/components/SignOutButton';

export default function Page() {
  const router = useRouter();
  const { user } = useUser();

  const handleMultiplayer = () => {
    const username = user?.username || user?.emailAddresses[0].emailAddress?.split('@')[0] || 'Player';
    router.push({
      pathname: '/multiplayer',
      params: { username }
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="dark" />
      <SignedIn>
        <View className="flex-1 p-6 justify-center">
          <View className="items-center mb-12">
            <Text className="text-6xl font-bold text-text-primary mb-2">Lexo</Text>
            <Text className="text-lg text-text-secondary">Türkçe Kelime Oyunu</Text>
            <Text className="text-sm text-text-secondary mt-2">
              Hoş geldin, {user?.username || user?.emailAddresses[0].emailAddress?.split('@')[0] || 'Player'}
            </Text>
          </View>

          <View className="bg-white rounded-2xl p-6 mb-8">
            <Text className="text-xl font-bold text-text-primary mb-4">Nasıl Oynanır?</Text>
            <Text className="text-base text-slate-600 mb-2 leading-6">• Verilen harflerden kelime oluşturun</Text>
            <Text className="text-base text-slate-600 mb-2 leading-6">• Her harf farklı puan değerine sahip</Text>
            <Text className="text-base text-slate-600 mb-2 leading-6">• Uzun kelimeler daha fazla puan kazandırır</Text>
            <Text className="text-base text-slate-600 leading-6">• 60 saniye içinde en yüksek skoru yapın!</Text>
          </View>

          <TouchableOpacity 
            className="bg-success rounded-xl p-5 items-center mb-3"
            onPress={handleMultiplayer}
          >
            <Text className="text-white text-xl font-bold">👥 Multiplayer (Oyun Ara)</Text>
          </TouchableOpacity>

          <View className="mt-4">
            <SignOutButton />
          </View>
        </View>
      </SignedIn>
      
      <SignedOut>
        <View className="flex-1 p-6 justify-center">
          <View className="items-center mb-12">
            <Text className="text-6xl font-bold text-text-primary mb-2">Lexo</Text>
            <Text className="text-lg text-text-secondary">Türkçe Kelime Oyunu</Text>
          </View>

          <View className="bg-white rounded-2xl p-6 mb-8">
            <Text className="text-xl font-bold text-text-primary mb-4">Nasıl Oynanır?</Text>
            <Text className="text-base text-slate-600 mb-2 leading-6">• Verilen harflerden kelime oluşturun</Text>
            <Text className="text-base text-slate-600 mb-2 leading-6">• Her harf farklı puan değerine sahip</Text>
            <Text className="text-base text-slate-600 mb-2 leading-6">• Uzun kelimeler daha fazla puan kazandırır</Text>
            <Text className="text-base text-slate-600 leading-6">• 60 saniye içinde en yüksek skoru yapın!</Text>
          </View>

          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity className="bg-primary rounded-xl p-5 items-center mb-3">
              <Text className="text-white text-xl font-bold">Giriş Yap</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity className="bg-slate-100 rounded-xl p-5 items-center">
              <Text className="text-text-primary text-xl font-bold">Kayıt Ol</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </SignedOut>
      <Toast />
    </SafeAreaView>
  );
}