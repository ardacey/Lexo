import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
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
import { useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WS_BASE_URL } from '../../utils/constants';
import { useCreateUser, useSaveGame } from '@/hooks/useApi';
import { EmojiPicker } from '@/components/EmojiPicker';
import { EmojiNotification } from '@/components/EmojiNotification';

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
  const isReconnecting = params.reconnect === 'true';
  const { user } = useUser();

  const createUserMutation = useCreateUser();
  const _saveGameMutation = useSaveGame();
  
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<'queue' | 'matched' | 'playing' | 'ended'>('queue');
  const [letterPool, setLetterPool] = useState<string[]>([]);
  const [_initialLetterPool, setInitialLetterPool] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [myWords, setMyWords] = useState<Word[]>([]);
  const [opponentWords, setOpponentWords] = useState<Word[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [_gameDuration, setGameDuration] = useState(60);
  const [opponent, setOpponent] = useState('');
  const [_opponentClerkId, setOpponentClerkId] = useState('');
  const [_roomId, setRoomId] = useState('');
  const [_playerId, setPlayerId] = useState('');
  const [_winner, setWinner] = useState<string | null>(null);
  const [_isTie, setIsTie] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [_gameStartTime, setGameStartTime] = useState<Date | null>(null);
  const [_gameSaved, setGameSaved] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [myEmoji, setMyEmoji] = useState<{emoji: string; visible: boolean}>({
    emoji: '',
    visible: false
  });
  const [opponentEmoji, setOpponentEmoji] = useState<{emoji: string; visible: boolean}>({
    emoji: '',
    visible: false
  });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<number | null>(null);
  const gameEndTimeoutRef = useRef<number | null>(null);
  const gameDataRef = useRef({
    startTime: null as Date | null,
    roomId: '',
    opponent: '',
    opponentClerkId: '',
    initialLetterPool: [] as string[],
    myWords: [] as Word[],
    opponentWords: [] as Word[]
  });

  const saveActiveGameToStorage = async (gameData: any) => {
    try {
      await AsyncStorage.setItem('activeGame', JSON.stringify(gameData));
      console.log('✅ Active game saved to storage');
    } catch (error) {
      console.error('❌ Error saving game to storage:', error);
    }
  };

  const clearActiveGameFromStorage = async () => {
    try {
      await AsyncStorage.removeItem('activeGame');
      console.log('✅ Active game cleared from storage');
    } catch (error) {
      console.error('❌ Error clearing game from storage:', error);
    }
  };

  const _getActiveGameFromStorage = async () => {
    try {
      const gameData = await AsyncStorage.getItem('activeGame');
      if (gameData) {
        return JSON.parse(gameData);
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting game from storage:', error);
      return null;
    }
  };

  useEffect(() => {
    if (user && !createUserMutation.isPending) {
      createUserMutation.mutate({
        clerkId: user.id,
        username,
        email: user.primaryEmailAddress?.emailAddress
      });
    }
    
    if (isReconnecting) {
      reconnectToGame();
    } else {
      connectToQueue();
    }
    
    return () => {
      console.log('Cleaning up multiplayer component...');
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (gameEndTimeoutRef.current !== null) {
        clearTimeout(gameEndTimeoutRef.current);
        gameEndTimeoutRef.current = null;
      }
      if (ws) {
        try {
          ws.close();
          setWs(null);
        } catch (error) {
          console.error('Error closing WebSocket:', error);
        }
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

  const reconnectToGame = () => {
    if (!user) {
      Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı');
      return;
    }
    
    try {
      setGameState('matched');
      const websocket = new WebSocket(`${WS_BASE_URL}/ws/queue`);
      
      websocket.onopen = () => {
        console.log('WebSocket connected for reconnection');
        websocket.send(JSON.stringify({ 
          username,
          clerk_id: user.id,
          is_reconnect: true
        }));
      };

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received (reconnect):', data);
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

  const connectToQueue = () => {
    if (!user) {
      Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı');
      return;
    }
    
    try {
      const websocket = new WebSocket(`${WS_BASE_URL}/ws/queue`);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        websocket.send(JSON.stringify({ 
          username,
          clerk_id: user.id,
          is_reconnect: false
        }));
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
        console.log('🎮 Match found:', data);
        setRoomId(data.room_id);
        setOpponent(data.opponent);
        setOpponentClerkId(data.opponent_clerk_id);
        gameDataRef.current.roomId = data.room_id;
        gameDataRef.current.opponent = data.opponent;
        gameDataRef.current.opponentClerkId = data.opponent_clerk_id;
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
        console.log('🎮 Game start:', data);
        const startTime = new Date();
        setLetterPool(data.letter_pool);
        setInitialLetterPool(data.letter_pool);
        setScores(data.scores);
        setGameState('playing');
        setGameDuration(data.duration);
        setGameStartTime(startTime);
        setGameSaved(false);
        setMyWords([]);
        setOpponentWords([]);
        gameDataRef.current.startTime = startTime;
        gameDataRef.current.initialLetterPool = data.letter_pool;
        gameDataRef.current.myWords = [];
        gameDataRef.current.opponentWords = [];
        console.log('✅ Game start time saved:', startTime);

        saveActiveGameToStorage({
          roomId: gameDataRef.current.roomId,
          opponent: gameDataRef.current.opponent,
          opponentClerkId: gameDataRef.current.opponentClerkId,
          startTime: startTime.toISOString(),
          duration: data.duration,
        });
        
        startTimer(data.duration);
        break;

      case 'word_valid':
        const newWord = { text: data.word, score: data.score };
        setMyWords(prevWords => {
          const updated = [...prevWords, newWord];
          gameDataRef.current.myWords = updated;
          return updated;
        });
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
        const opponentWord = { 
          text: data.word, 
          score: data.score,
          player: data.player 
        };
        setOpponentWords(prevWords => {
          const updated = [...prevWords, opponentWord];
          gameDataRef.current.opponentWords = updated;
          return updated;
        });
        setScores(data.scores);
        break;

      case 'game_end':
        setWinner(data.winner);
        setIsTie(data.is_tie);
        setScores(data.scores);
        setGameState('ended');
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (gameEndTimeoutRef.current) {
          clearTimeout(gameEndTimeoutRef.current);
          gameEndTimeoutRef.current = null;
        }
        if (!data.game_saved_by_server) {
          console.warn('Game was not saved by server');
        }
        clearActiveGameFromStorage();
        showGameEndAlert(data.winner, data.is_tie);
        break;

      case 'opponent_disconnected':
        if (timerRef.current !== null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        if (gameEndTimeoutRef.current !== null) {
          clearTimeout(gameEndTimeoutRef.current);
          gameEndTimeoutRef.current = null;
        }
        
        if (ws) {
          try {
            ws.close();
            setWs(null);
          } catch (error) {
            console.error('Error closing WebSocket:', error);
          }
        }
        clearActiveGameFromStorage();
        
        Alert.alert(
          'Oyun Bitti',
          'Rakip oyundan ayrıldı. Siz kazandınız!',
          [
            {
              text: 'Ana Menü',
              onPress: () => {
                try {
                  router.replace('/(home)');
                } catch (error) {
                  console.error('Navigation error:', error);
                  router.push('/(home)');
                }
              }
            }
          ],
          { cancelable: false }
        );
        break;

      case 'opponent_disconnected_temp':
        Toast.show({
          type: 'info',
          text1: 'Bağlantı Kesildi',
          text2: data.message,
          position: 'top',
          visibilityTime: 3000,
        });
        break;

      case 'opponent_reconnected':
        Toast.show({
          type: 'success',
          text1: 'Bağlantı Kuruldu',
          text2: data.message,
          position: 'top',
          visibilityTime: 2000,
        });
        break;

      case 'reconnected':
        console.log('🔄 Reconnected to game:', data);
        setRoomId(data.room_id);
        setOpponent(data.opponent);
        setOpponentClerkId(data.opponent_clerk_id);
        setLetterPool(data.letter_pool);
        setInitialLetterPool(data.letter_pool);
        setScores(data.scores);
        setGameState('playing');
 
        const restoredWords = data.my_words.map((word: string) => ({ text: word, score: 0 }));
        setMyWords(restoredWords);

        startTimer(data.time_remaining);
        
        Toast.show({
          type: 'success',
          text1: 'Oyuna Geri Döndünüz',
          text2: 'Oyun devam ediyor!',
          position: 'top',
          visibilityTime: 2000,
        });
        break;

      case 'game_expired':
        clearActiveGameFromStorage();
        Alert.alert(
          'Oyun Süresi Doldu',
          'Oyun süresi dolduğu için oyuna geri dönemezsiniz.',
          [
            {
              text: 'Tamam',
              onPress: () => router.replace('/(home)')
            }
          ]
        );
        break;

      case 'emoji_received':
        console.log('🎭 Emoji received:', data.emoji, 'from', data.from);
        console.log('📥 Setting opponent emoji state to visible');
        setOpponentEmoji({
          emoji: data.emoji,
          visible: true
        });
        break;

      case 'emoji_error':
        console.log('❌ Emoji error:', data.message);
        Toast.show({
          type: 'error',
          text1: 'Hata',
          text2: data.message,
          position: 'top',
          visibilityTime: 2000,
        });
        break;
    }
  };

  const handleTimeExpired = () => {
    console.log('⏰ Time expired, waiting for game_end message...');

    gameEndTimeoutRef.current = setTimeout(() => {
      console.log('⚠️ No game_end message received after timeout, ending game manually');

      const myScore = getMyScore();
      const opponentScore = getOpponentScore();
      
      let winnerName = null;
      let tie = false;
      
      if (myScore > opponentScore) {
        winnerName = username;
      } else if (opponentScore > myScore) {
        winnerName = opponent;
      } else {
        tie = true;
      }
      
      setWinner(winnerName);
      setIsTie(tie);
      setGameState('ended');
      clearActiveGameFromStorage();
      showGameEndAlert(winnerName, tie);
    }, 3000) as any;
  };

  const startTimer = (duration: number) => {
    setTimeLeft(duration);
    
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (gameEndTimeoutRef.current !== null) {
      clearTimeout(gameEndTimeoutRef.current);
      gameEndTimeoutRef.current = null;
    }
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000) as any;
  };

  const showGameEndAlert = (winnerName: string | null, tie: boolean) => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (gameEndTimeoutRef.current !== null) {
      clearTimeout(gameEndTimeoutRef.current);
      gameEndTimeoutRef.current = null;
    }

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
          { 
            text: 'Ana Menü', 
            onPress: async () => {
              if (ws) {
                try {
                  ws.close();
                  setWs(null);
                } catch (error) {
                  console.error('Error closing WebSocket:', error);
                }
              }
              await clearActiveGameFromStorage();
              router.back();
            }
          }
        ],
        { cancelable: false }
      );
    }, 500);
  };

  const handleLetterClick = (index: number) => {
    if (gameState !== 'playing') return;
    
    if (selectedIndices.includes(index)) {
      setSelectedIndices(prev => prev.filter(i => i !== index));
      const newWord = selectedIndices
        .filter(i => i !== index)
        .map(i => letterPool[i])
        .join('');
      setCurrentWord(newWord);
    } else {
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

  const handleCancel = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (gameEndTimeoutRef.current !== null) {
      clearTimeout(gameEndTimeoutRef.current);
      gameEndTimeoutRef.current = null;
    }
    if (ws) {
      try {
        ws.close();
        setWs(null);
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
    }
    router.back();
  };

  const sendEmoji = (emoji: string) => {
    console.log('🎭 sendEmoji called with:', emoji);
    console.log('🔌 WebSocket state:', ws?.readyState, 'Game state:', gameState);
    
    if (!ws || gameState !== 'playing') {
      console.log('❌ Cannot send emoji - ws:', !!ws, 'gameState:', gameState);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Sadece oyun sırasında emoji gönderebilirsiniz',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }

    if (ws.readyState !== WebSocket.OPEN) {
      console.log('❌ WebSocket is not open, state:', ws.readyState);
      Toast.show({
        type: 'error',
        text1: 'Bağlantı Hatası',
        text2: 'WebSocket bağlantısı açık değil',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }

    const message = {
      type: 'send_emoji',
      emoji: emoji
    };
    
    console.log('📤 Sending emoji message:', JSON.stringify(message));
    
    try {
      ws.send(JSON.stringify(message));
      console.log('✅ Emoji message sent successfully');

      setMyEmoji({
        emoji: emoji,
        visible: true
      });
    } catch (error) {
      console.error('❌ Error sending emoji:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Emoji gönderilemedi',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }
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
            onPress={handleCancel}
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
          {opponent ? (
            <>
              <Text className="text-4xl font-bold text-success mb-6">Eşleşme Bulundu!</Text>
              <Text className="text-5xl font-bold text-primary my-4">VS</Text>
              <Text className="text-2xl font-semibold text-text-primary mb-6">{opponent}</Text>
              <Text className="text-base text-text-secondary">Oyun başlıyor...</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text className="text-2xl font-bold text-text-primary mt-6">Oyuna Bağlanılıyor...</Text>
              <Text className="text-base text-text-secondary mt-2">Lütfen bekleyin</Text>
            </>
          )}
        </View>
        <Toast />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="dark" />
      
      {/* Header with Scores */}
      <View className="bg-white p-4 border-b border-slate-200">
        <View className="flex-row justify-between items-center mb-3">
          <View className="items-center flex-1 relative">
            <Text className="text-sm text-text-secondary font-semibold">{username}</Text>
            <Text className="text-3xl font-bold text-text-primary mt-1">{getMyScore()}</Text>
            <EmojiNotification
              emoji={myEmoji.emoji}
              visible={myEmoji.visible}
              position="left"
              onHide={() => setMyEmoji({ emoji: '', visible: false })}
            />
          </View>
          
          <Animated.View 
            className={`px-4 py-2 rounded-lg ${timeLeft <= 10 ? 'bg-red-50' : 'bg-blue-50'}`}
            style={{ transform: [{ scale: pulseAnim }] }}
          >
            <Text className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-danger' : 'text-primary'}`}>
              {formatTime(timeLeft)}
            </Text>
          </Animated.View>
          
          <View className="items-center flex-1 relative">
            <Text className="text-sm text-text-secondary font-semibold">{opponent}</Text>
            <Text className="text-3xl font-bold text-text-primary mt-1">{getOpponentScore()}</Text>
            <EmojiNotification
              emoji={opponentEmoji.emoji}
              visible={opponentEmoji.visible}
              position="right"
              onHide={() => setOpponentEmoji({ emoji: '', visible: false })}
            />
          </View>
        </View>
      </View>

      {/* Words Lists */}
      <View className="flex-1 flex-row p-3 gap-2">
        <View className="flex-1">
          <Text className="text-sm font-bold text-text-primary mb-2">Kelimelerim ({myWords.length})</Text>
          <ScrollView className="flex-1">
            {myWords.map((word, index) => (
              <View key={index} className="flex-row justify-between items-center bg-green-100 rounded-lg p-2.5 mb-1.5">
                <Text className="text-sm font-semibold text-text-primary">{word.text.toLocaleUpperCase('tr-TR')}</Text>
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
                <Text className="text-sm font-semibold text-text-primary">{word.text.toLocaleUpperCase('tr-TR')}</Text>
                <Text className="text-xs font-bold text-success">+{word.score}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Current Word Display */}
      {gameState === 'playing' && (
        <View className="px-3 pb-2">
          <Text className="text-sm text-text-secondary mb-2">Seçilen Kelime:</Text>
          <View className="flex-row gap-2 items-center">
            <View className="flex-1 bg-white rounded-lg px-4 py-3 border-2 border-slate-200 min-h-[52px] justify-center">
              <Text className="text-2xl font-bold text-text-primary">
                {currentWord.toLocaleUpperCase('tr-TR') || '...'}
              </Text>
            </View>
            {currentWord && (
              <TouchableOpacity
                className="bg-red-500 rounded-lg px-4 py-3"
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

      {/* Letter Pool at Bottom */}
      <View className="bg-white p-3 border-t border-slate-200">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-base font-bold text-text-primary flex-1 text-center">Harfler</Text>
          {/* Emoji Button - Clash Royale tarz\u0131 */}
          {gameState === 'playing' && (
            <TouchableOpacity
              className="absolute right-2 bg-yellow-400 w-11 h-11 rounded-full justify-center items-center shadow-md z-10"
              onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              activeOpacity={0.7}
            >
              <Text className="text-2xl">😊</Text>
            </TouchableOpacity>
          )}
        </View>
        <View className="flex-row flex-wrap justify-center gap-2">
          {letterPool.map((letter, index) => (
            <TouchableOpacity
              key={`${letter}-${index}`}
              onPress={() => handleLetterClick(index)}
              disabled={gameState !== 'playing'}
              className={`w-16 h-16 rounded-xl justify-center items-center shadow-sm ${
                selectedIndices.includes(index) 
                  ? 'bg-primary' 
                  : 'bg-slate-100'
              }`}
            >
              <Text className={`text-3xl font-bold ${
                selectedIndices.includes(index) 
                  ? 'text-white' 
                  : 'text-text-primary'
              }`}>{letter.toLocaleUpperCase('tr-TR')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Emoji Picker Modal */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={sendEmoji}
        disabled={gameState !== 'playing'}
      />

      <Toast />
    </SafeAreaView>
  );
}
