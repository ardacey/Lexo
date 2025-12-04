import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WS_BASE_URL } from '../../utils/constants';
import { useCreateUser, useSaveGame } from '@/hooks/useApi';
import { EmojiPicker } from '@/components/EmojiPicker';
import { EmojiNotification } from '@/components/EmojiNotification';
import { InteractiveLetterPool } from '@/components/GameComponents';

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
  const navigation = useNavigation();
  // Safe back helper: check if we can go back, otherwise navigate to home
  const safeBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/(home)');
    }
  };
  const params = useLocalSearchParams();
  const username = params.username as string || 'Player';
  const isReconnecting = params.reconnect === 'true';
  const { user, getToken } = useAuth();

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
  const [_opponentUserId, setOpponentUserId] = useState('');
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
  const wsRef = useRef<WebSocket | null>(null);
  const isMounted = useRef(true);
  const gameDataRef = useRef({
    startTime: null as Date | null,
    roomId: '',
    opponent: '',
    opponentUserId: '',
    initialLetterPool: [] as string[],
    myWords: [] as Word[],
    opponentWords: [] as Word[],
    scores: [] as Score[]
  });

  const saveActiveGameToStorage = async (gameData: any) => {
    try {
      await AsyncStorage.setItem('activeGame', JSON.stringify(gameData));
    } catch {
      // Silent storage error
    }
  };

  const clearActiveGameFromStorage = async () => {
    try {
      await AsyncStorage.removeItem('activeGame');
    } catch {
      // Silent storage error
    }
  };

  const _getActiveGameFromStorage = async () => {
    try {
      const gameData = await AsyncStorage.getItem('activeGame');
      if (gameData) {
        return JSON.parse(gameData);
      }
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    isMounted.current = true;
    if (user && !createUserMutation.isPending && !createUserMutation.isSuccess) {
      createUserMutation.mutate({
        userId: user.id,
        username,
        email: user.email
      });
    }
    
    if (isReconnecting) {
      reconnectToGame();
    } else {
      connectToQueue();
    }
    
    return () => {
      isMounted.current = false;
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (gameEndTimeoutRef.current !== null) {
        clearTimeout(gameEndTimeoutRef.current);
        gameEndTimeoutRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
          wsRef.current = null;
        } catch (error) {
          // Silent close
        }
      }
    };
    // Dependencies are intentionally omitted - this should only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // pulseAnim and gameState are refs/stable values, not needed in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const reconnectToGame = async () => {
    if (!user) {
      Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı');
      return;
    }
    
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süresi dolmuş');
        return;
      }
      
      setGameState('matched');
      const websocket = new WebSocket(`${WS_BASE_URL}/ws/queue`);
      wsRef.current = websocket;
      
      websocket.onopen = () => {
        websocket.send(JSON.stringify({ 
          username,
          token,
          is_reconnect: true
        }));
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (isMounted.current) {
            handleMessage(data);
          }
        } catch (e) {
          // Silent parse error
        }
      };

      websocket.onerror = (error) => {
        if (isMounted.current) {
          Alert.alert('Bağlantı Hatası', 'Sunucuya bağlanılamadı');
        }
      };

      websocket.onclose = () => {
        // WebSocket closed
      };

      setWs(websocket);
    } catch (error) {
      Alert.alert('Hata', 'Sunucuya bağlanılamadı');
    }
  };

  const connectToQueue = async () => {
    if (!user) {
      Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı');
      return;
    }
    
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süresi dolmuş');
        return;
      }
      
      const websocket = new WebSocket(`${WS_BASE_URL}/ws/queue`);
      wsRef.current = websocket;
      
      websocket.onopen = () => {
        const payload = { 
          username,
          token,
          is_reconnect: false
        };
        websocket.send(JSON.stringify(payload));
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (isMounted.current) {
            handleMessage(data);
          }
        } catch (e) {
          // Silent parse error
        }
      };

      websocket.onerror = (error) => {
        if (isMounted.current) {
          Alert.alert('Bağlantı Hatası', 'Sunucuya bağlanılamadı');
        }
      };

      websocket.onclose = () => {
        // WebSocket closed
      };

      setWs(websocket);
    } catch (error) {
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
        setOpponentUserId(data.opponent_user_id);
        gameDataRef.current.roomId = data.room_id;
        gameDataRef.current.opponent = data.opponent;
        gameDataRef.current.opponentUserId = data.opponent_user_id;
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
        const startTime = new Date();
        setLetterPool(data.letter_pool);
        setInitialLetterPool(data.letter_pool);
        setScores(data.scores);
        gameDataRef.current.scores = data.scores;
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

        saveActiveGameToStorage({
          roomId: gameDataRef.current.roomId,
          opponent: gameDataRef.current.opponent,
          opponentUserId: gameDataRef.current.opponentUserId,
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
        gameDataRef.current.scores = data.scores;
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
        gameDataRef.current.scores = data.scores;
        break;

      case 'game_end':
        setWinner(data.winner);
        setIsTie(data.is_tie);
        setScores(data.scores);
        gameDataRef.current.scores = data.scores;
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
          // Game was not saved by server - silent warning
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
        
        if (wsRef.current) {
          try {
            wsRef.current.close();
            wsRef.current = null;
          } catch {
            // Silent close error
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
                } catch {
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
        setRoomId(data.room_id);
        setOpponent(data.opponent);
        setOpponentUserId(data.opponent_user_id);
        setLetterPool(data.letter_pool);
        setInitialLetterPool(data.letter_pool);
        setScores(data.scores);
        gameDataRef.current.scores = data.scores;
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
        setOpponentEmoji({
          emoji: data.emoji,
          visible: true
        });
        break;
      
      case 'emoji_error':
        Toast.show({
          type: 'error',
          text1: 'Emoji Gönderilemedi',
          text2: data.message || 'Bir hata oluştu',
          position: 'top',
        });
        break;
    }
  };

  const handleTimeExpired = () => {
    gameEndTimeoutRef.current = setTimeout(() => {
      const currentScores = gameDataRef.current.scores || [];
      const myScoreData = currentScores.find(s => s.username === username);
      const myScore = myScoreData?.score || 0;
      
      const oppScoreData = currentScores.find(s => s.username !== username);
      const opponentScore = oppScoreData?.score || 0;
      
      const currentOpponent = gameDataRef.current.opponent || opponent;
      
      let winnerName = null;
      let tie = false;
      
      if (myScore > opponentScore) {
        winnerName = username;
      } else if (opponentScore > myScore) {
        winnerName = currentOpponent;
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

  const showGameEndAlert = useCallback((winnerName: string | null, tie: boolean) => {
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
              if (wsRef.current) {
                try {
                  wsRef.current.close();
                  wsRef.current = null;
                } catch {
                  // Silent close error
                }
              }
              await clearActiveGameFromStorage();
              // Use safeBack to avoid calling goBack when there's no previous screen
              safeBack();
            }
          }
        ],
        { cancelable: false }
      );
    }, 500);
  }, [username]);

  const handleLetterClick = useCallback((index: number) => {
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
  }, [gameState, selectedIndices, letterPool]);

  const handleClearWord = useCallback(() => {
    setSelectedIndices([]);
    setCurrentWord('');
  }, []);

  const submitWord = useCallback(() => {
    if (!currentWord.trim() || !wsRef.current || gameState !== 'playing') return;

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

    wsRef.current.send(JSON.stringify({
      type: 'submit_word',
      word: word
    }));
  }, [currentWord, gameState]);

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

  const handleCancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (gameEndTimeoutRef.current !== null) {
      clearTimeout(gameEndTimeoutRef.current);
      gameEndTimeoutRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
        wsRef.current = null;
      } catch {
        // Silent close error
      }
    }
    // Try to go back safely, otherwise replace to home
    safeBack();
  }, []);

  const sendEmoji = useCallback((emoji: string) => {
    if (!wsRef.current || gameState !== 'playing') {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Sadece oyun sırasında emoji gönderebilirsiniz',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }

    if (wsRef.current.readyState !== WebSocket.OPEN) {
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
    
    try {
      wsRef.current.send(JSON.stringify(message));

      setMyEmoji({
        emoji: emoji,
        visible: true
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Emoji gönderilemedi',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }
  }, [gameState]);

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
          <Text className="text-sm font-bold text-text-primary mb-2 text-right">Rakip ({opponentWords.length})</Text>
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
        <InteractiveLetterPool
          letterPool={letterPool}
          selectedIndices={selectedIndices}
          onLetterClick={handleLetterClick}
          disabled={gameState !== 'playing'}
        />
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
