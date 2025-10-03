import * as React from 'react';
import { useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { useGameTimer } from '../hooks/useGameTimer';
import { useGameState } from '../hooks/useGameState';
import { usePulseAnimation } from '../hooks/usePulseAnimation';
import { GAME_DURATION } from '../utils/constants';

export default function Game() {
  const router = useRouter();
  const {
    letterPool,
    currentWord,
    setCurrentWord,
    words,
    totalScore,
    initializeGame,
    submitWord,
  } = useGameState(16);

  const [gameEnded, setGameEnded] = React.useState(false);
  const [selectedIndices, setSelectedIndices] = React.useState<number[]>([]);

  const handleGameEnd = () => {
    setGameEnded(true);
    Alert.alert(
      'Oyun Bitti!',
      `Toplam Skorunuz: ${totalScore}\nBulunan Kelime: ${words.length}`,
      [
        { text: 'Ana Menü', onPress: () => router.back() },
        { text: 'Yeni Oyun', onPress: handleReset },
      ]
    );
  };

  const { timeLeft, resetTimer, formatTime } = useGameTimer(
    GAME_DURATION,
    handleGameEnd,
    !gameEnded
  );

  const pulseAnim = usePulseAnimation(timeLeft <= 10 && timeLeft > 0);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  const handleReset = () => {
    initializeGame();
    resetTimer();
    setGameEnded(false);
    setSelectedIndices([]);
  };

  const handleLetterClick = (index: number) => {
    if (gameEnded) return;
    
    if (selectedIndices.includes(index)) {
      // Harf zaten seçilmişse, seçimi kaldır
      setSelectedIndices(prev => prev.filter(i => i !== index));
      const newWord = selectedIndices
        .filter(i => i !== index)
        .map(i => letterPool[i])
        .join('');
      setCurrentWord(newWord);
    } else {
      // Harfi seçime ekle
      setSelectedIndices(prev => [...prev, index]);
      const newWord = [...selectedIndices, index]
        .map(i => letterPool[i])
        .join('');
      setCurrentWord(newWord);
    }
  };

  const handleClearWord = () => {
    setSelectedIndices([]);
    setCurrentWord('');
  };

  const handleSubmit = () => {
    if (!gameEnded && currentWord) {
      const success = submitWord();
      if (success) {
        setSelectedIndices([]);
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Text className="text-base text-primary font-semibold">← Geri</Text>
        </TouchableOpacity>
        
        <Animated.View 
          className={`bg-blue-50 px-4 py-2 rounded-lg ${timeLeft <= 10 ? 'bg-red-50' : ''}`}
          style={{ transform: [{ scale: pulseAnim }] }}
        >
          <Text className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-danger' : 'text-primary'}`}>
            {formatTime()}
          </Text>
        </Animated.View>
        
        <View className="items-end">
          <Text className="text-xs text-text-secondary">Skor</Text>
          <Text className="text-2xl font-bold text-text-primary">{totalScore}</Text>
        </View>
      </View>

      {/* Letter Pool */}
      <View className="p-4">
        <Text className="text-base font-bold text-text-primary mb-3">Harfler (Tıklayın)</Text>
        <View className="flex-row flex-wrap justify-center gap-2">
          {letterPool.map((letter, index) => (
            <TouchableOpacity 
              key={`${letter}-${index}`} 
              onPress={() => handleLetterClick(index)}
              disabled={gameEnded}
              className={`w-12 h-12 rounded-lg justify-center items-center ${
                selectedIndices.includes(index) 
                  ? 'bg-primary' 
                  : 'bg-white'
              }`}
            >
              <Text className={`text-2xl font-bold ${
                selectedIndices.includes(index) 
                  ? 'text-white' 
                  : 'text-text-primary'
              }`}>
                {letter.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Current Word Display */}
      <View className="p-4">
        <Text className="text-sm text-text-secondary mb-2">Seçilen Kelime:</Text>
        <View className="flex-row gap-2 items-center">
          <View className="flex-1 bg-white rounded-lg px-4 py-3 border-2 border-slate-200 min-h-[48px] justify-center">
            <Text className="text-xl font-bold text-text-primary">
              {currentWord.toUpperCase() || '...'}
            </Text>
          </View>
          {currentWord && (
            <TouchableOpacity
              className="bg-slate-300 rounded-lg px-4 py-3"
              onPress={handleClearWord}
              disabled={gameEnded}
            >
              <Text className="text-white text-base font-bold">Temizle</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className={`rounded-lg px-6 py-3 ${gameEnded || !currentWord ? 'bg-slate-400' : 'bg-primary'}`}
            onPress={handleSubmit}
            disabled={gameEnded || !currentWord}
          >
            <Text className="text-white text-base font-bold">Gönder</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Words List */}
      <View className="flex-1 p-4">
        <Text className="text-base font-bold text-text-primary mb-2">
          Kelimeler ({words.length})
        </Text>
        <ScrollView className="flex-1">
          {words.map((word, index) => (
            <View 
              key={index} 
              className="flex-row justify-between items-center bg-white rounded-lg p-3 mb-2"
            >
              <Text className="text-base font-semibold text-text-primary">
                {word.text.toUpperCase()}
              </Text>
              <Text className="text-sm font-bold text-success">
                +{word.score}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <Toast />
    </SafeAreaView>
  );
}
