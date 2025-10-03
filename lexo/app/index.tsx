import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState('');

  const handleSinglePlayer = () => {
    router.push('/game');
  };

  const handleMultiplayer = () => {
    if (!username.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Lütfen kullanıcı adınızı girin',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }
    router.push({
      pathname: '/multiplayer',
      params: { username: username.trim() }
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="dark" />
      <View className="flex-1 p-6 justify-center">
        {/* Header */}
        <View className="items-center mb-12">
          <Text className="text-6xl font-bold text-text-primary mb-2">Lexo</Text>
          <Text className="text-lg text-text-secondary">Türkçe Kelime Oyunu</Text>
        </View>

        {/* Info Box */}
        <View className="bg-white rounded-2xl p-6 mb-8">
          <Text className="text-xl font-bold text-text-primary mb-4">Nasıl Oynanır?</Text>
          <Text className="text-base text-slate-600 mb-2 leading-6">• Verilen harflerden kelime oluşturun</Text>
          <Text className="text-base text-slate-600 mb-2 leading-6">• Her harf farklı puan değerine sahip</Text>
          <Text className="text-base text-slate-600 mb-2 leading-6">• Uzun kelimeler daha fazla puan kazandırır</Text>
          <Text className="text-base text-slate-600 leading-6">• 60 saniye içinde en yüksek skoru yapın!</Text>
        </View>

        {/* Username Input */}
        <View className="mb-6">
          <Text className="text-sm text-text-secondary mb-2 font-semibold">
            Kullanıcı Adı
          </Text>
          <TextInput
            className="bg-white rounded-lg p-4 text-base border-2 border-slate-200"
            value={username}
            onChangeText={setUsername}
            placeholder="Kullanıcı adınızı girin..."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
          />
        </View>

        {/* Single Player Button */}
        <TouchableOpacity 
          className="bg-primary rounded-xl p-5 items-center mb-3"
          onPress={handleSinglePlayer}
        >
          <Text className="text-white text-xl font-bold">🎮 Tek Oyunculu</Text>
        </TouchableOpacity>

        {/* Multiplayer Button */}
        <TouchableOpacity 
          className="bg-success rounded-xl p-5 items-center mb-3"
          onPress={handleMultiplayer}
        >
          <Text className="text-white text-xl font-bold">👥 Multiplayer (Oyun Ara)</Text>
        </TouchableOpacity>
      </View>
      <Toast />
    </SafeAreaView>
  );
}
