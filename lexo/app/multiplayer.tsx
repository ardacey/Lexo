import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { WS_BASE_URL } from '../utils/constants';

interface Word {
  text: string;
  score: number;
  player?: string;
}

interface Score {
  username: string;
  score: number;
}

export default function Multiplayer() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const username = params.username as string || 'Player';
  
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<'queue' | 'matched' | 'playing' | 'ended'>('queue');
  const [letterPool, setLetterPool] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [myWords, setMyWords] = useState<Word[]>([]);
  const [opponentWords, setOpponentWords] = useState<Word[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [opponent, setOpponent] = useState('');
  const [roomId, setRoomId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [winner, setWinner] = useState<string | null>(null);
  const [isTie, setIsTie] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    connectToQueue();
    
    return () => {
      if (ws) {
        ws.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (timeLeft <= 10 && timeLeft > 0 && gameState === 'playing') {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [timeLeft]);

  const connectToQueue = () => {
    try {
      const websocket = new WebSocket(`${WS_BASE_URL}/ws/queue`);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        websocket.send(JSON.stringify({ username }));
      };

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received:', data);
        handleMessage(data);
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        Alert.alert('Bağlantı Hatası', 'Sunucuya bağlanılamadı');
      };

      websocket.onclose = () => {
        console.log('WebSocket closed');
      };

      setWs(websocket);
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Hata', 'Sunucuya bağlanılamadı');
    }
  };

  const handleMessage = (data: any) => {
    switch (data.type) {
      case 'queue_joined':
        setPlayerId(data.player_id);
        setGameState('queue');
        break;

      case 'match_found':
        setRoomId(data.room_id);
        setOpponent(data.opponent);
        setGameState('matched');
        Toast.show({
          type: 'success',
          text1: 'Eşleşme Bulundu!',
          text2: `Rakip: ${data.opponent}`,
          position: 'top',
          visibilityTime: 2000,
        });
        break;

      case 'game_start':
        setLetterPool(data.letter_pool);
        setScores(data.scores);
        setGameState('playing');
        startTimer(data.duration);
        break;

      case 'word_valid':
        setMyWords(prevWords => [...prevWords, { text: data.word, score: data.score }]);
        setLetterPool(data.letter_pool);
        setScores(data.scores);
        setCurrentWord('');
        setSelectedIndices([]);
        Toast.show({
          type: 'success',
          text1: 'Harika!',
          text2: `+${data.score} puan!`,
          position: 'top',
          visibilityTime: 1500,
        });
        break;

      case 'word_invalid':
        Toast.show({
          type: 'error',
          text1: 'Hata',
          text2: data.message,
          position: 'top',
          visibilityTime: 2000,
        });
        break;

      case 'opponent_word':
        setOpponentWords(prevWords => [...prevWords, { 
          text: data.word, 
          score: data.score,
          player: data.player 
        }]);
        setLetterPool(data.letter_pool);
        setScores(data.scores);
        break;

      case 'game_end':
        setWinner(data.winner);
        setIsTie(data.is_tie);
        setScores(data.scores);
        setGameState('ended');
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        showGameEndAlert(data.winner, data.is_tie);
        break;

      case 'opponent_disconnected':
        Alert.alert('Oyun Bitti', 'Rakip oyundan ayrıldı');
        router.back();
        break;
    }
  };

  const startTimer = (duration: number) => {
    setTimeLeft(duration);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const showGameEndAlert = (winnerName: string | null, tie: boolean) => {
    let message = '';
    if (tie) {
      message = 'Oyun berabere bitti!';
    } else if (winnerName === username) {
      message = 'Tebrikler, kazandınız!';
    } else {
      message = `${winnerName} kazandı!`;
    }

    setTimeout(() => {
      Alert.alert(
        'Oyun Bitti',
        message,
        [
          { text: 'Ana Menü', onPress: () => router.back() }
        ]
      );
    }, 500);
  };

  const handleLetterClick = (index: number) => {
    if (gameState !== 'playing') return;
    
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

  const submitWord = () => {
    if (!currentWord.trim() || !ws || gameState !== 'playing') return;

    const word = currentWord.trim();

    if (word.length < 2) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Kelime en az 2 harf olmalıdır',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }

    ws.send(JSON.stringify({
      type: 'submit_word',
      word: word
    }));
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getMyScore = () => {
    const myScore = scores.find(s => s.username === username);
    return myScore?.score || 0;
  };

  const getOpponentScore = () => {
    const oppScore = scores.find(s => s.username !== username);
    return oppScore?.score || 0;
  };

  if (gameState === 'queue') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <StatusBar style="dark" />
        <View className="flex-1 justify-center items-center p-6">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-2xl font-bold text-text-primary mt-6">Oyun Aranıyor...</Text>
          <Text className="text-base text-text-secondary mt-2">Rakip bekleniyor</Text>
          <TouchableOpacity
            className="mt-12 px-8 py-3 rounded-lg border-2 border-danger"
            onPress={() => router.back()}
          >
            <Text className="text-danger text-base font-semibold">İptal</Text>
          </TouchableOpacity>
        </View>
        <Toast />
      </SafeAreaView>
    );
  }

  if (gameState === 'matched') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <StatusBar style="dark" />
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-4xl font-bold text-success mb-6">Eşleşme Bulundu!</Text>
          <Text className="text-5xl font-bold text-primary my-4">VS</Text>
          <Text className="text-2xl font-semibold text-text-primary mb-6">{opponent}</Text>
          <Text className="text-base text-text-secondary">Oyun başlıyor...</Text>
        </View>
        <Toast />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 bg-white">
        <View className="items-center flex-1">
          <Text className="text-sm text-text-secondary font-semibold">{username}</Text>
          <Text className="text-2xl font-bold text-text-primary mt-1">{getMyScore()}</Text>
        </View>
        
        <Animated.View 
          className={`px-4 py-2 rounded-lg ${timeLeft <= 10 ? 'bg-red-50' : 'bg-blue-50'}`}
          style={{ transform: [{ scale: pulseAnim }] }}
        >
          <Text className={`text-xl font-bold ${timeLeft <= 10 ? 'text-danger' : 'text-primary'}`}>
            {formatTime(timeLeft)}
          </Text>
        </Animated.View>
        
        <View className="items-center flex-1">
          <Text className="text-sm text-text-secondary font-semibold">{opponent}</Text>
          <Text className="text-2xl font-bold text-text-primary mt-1">{getOpponentScore()}</Text>
        </View>
      </View>

      {/* Letter Pool */}
      <View className="p-4">
        <Text className="text-base font-bold text-text-primary mb-3">Harfler</Text>
        <View className="flex-row flex-wrap justify-center gap-2">
          {letterPool.map((letter, index) => (
            <TouchableOpacity
              key={`${letter}-${index}`}
              onPress={() => handleLetterClick(index)}
              disabled={gameState !== 'playing'}
              className={`w-11 h-11 rounded-lg justify-center items-center ${
                selectedIndices.includes(index) 
                  ? 'bg-primary' 
                  : 'bg-white'
              }`}
            >
              <Text className={`text-xl font-bold ${
                selectedIndices.includes(index) 
                  ? 'text-white' 
                  : 'text-text-primary'
              }`}>{letter.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Current Word Display */}
      {gameState === 'playing' && (
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
              >
                <Text className="text-white text-base font-bold">Temizle</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className={`rounded-lg px-6 py-3 ${!currentWord ? 'bg-slate-400' : 'bg-primary'}`}
              onPress={submitWord}
              disabled={!currentWord}
            >
              <Text className="text-white text-base font-bold">Gönder</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Words Lists */}
      <View className="flex-1 flex-row p-4 gap-2">
        <View className="flex-1">
          <Text className="text-sm font-bold text-text-primary mb-2">Kelimelerim ({myWords.length})</Text>
          <ScrollView className="flex-1">
            {myWords.map((word, index) => (
              <View key={index} className="flex-row justify-between items-center bg-green-100 rounded-lg p-2.5 mb-1.5">
                <Text className="text-sm font-semibold text-text-primary">{word.text.toUpperCase()}</Text>
                <Text className="text-xs font-bold text-success">+{word.score}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
        
        <View className="flex-1">
          <Text className="text-sm font-bold text-text-primary mb-2">Rakip ({opponentWords.length})</Text>
          <ScrollView className="flex-1">
            {opponentWords.map((word, index) => (
              <View key={index} className="flex-row justify-between items-center bg-yellow-100 rounded-lg p-2.5 mb-1.5">
                <Text className="text-sm font-semibold text-text-primary">{word.text.toUpperCase()}</Text>
                <Text className="text-xs font-bold text-success">+{word.score}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
      <Toast />
    </SafeAreaView>
  );
}
