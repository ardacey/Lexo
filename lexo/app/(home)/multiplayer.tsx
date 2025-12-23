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
import { calculateScore } from '@/utils/gameLogic';
import { getOnlineStats } from '@/utils/api';

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
  const [endReason, setEndReason] = useState<string | null>(null);
  const [isTimeOver, setIsTimeOver] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<number | null>(null);
  const [myEmoji, setMyEmoji] = useState<{emoji: string; visible: boolean}>({
    emoji: '',
    visible: false
  });
  const [opponentEmoji, setOpponentEmoji] = useState<{emoji: string; visible: boolean}>({
    emoji: '',
    visible: false
  });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const endScreenAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<number | null>(null);
  const gameEndTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const myWordsScrollRef = useRef<ScrollView | null>(null);
  const opponentWordsScrollRef = useRef<ScrollView | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isMounted = useRef(true);
  const serverTimeOffsetRef = useRef(0);
  const serverStartTimeRef = useRef<number | null>(null);
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

  const stopPingLoop = useCallback(() => {
    if (pingIntervalRef.current !== null) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const sendPing = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const clientTime = Date.now();
    wsRef.current.send(JSON.stringify({ type: 'ping', client_time: clientTime }));
  }, []);

  const startPingLoop = useCallback(() => {
    stopPingLoop();
    sendPing();
    pingIntervalRef.current = setInterval(() => {
      sendPing();
    }, 15000) as any;
  }, [sendPing, stopPingLoop]);

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
      stopPingLoop();
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

  useEffect(() => {
    if (gameState !== 'queue') return;
    let cancelled = false;

    const fetchOnlineStats = async () => {
      const stats = await getOnlineStats();
      if (cancelled || !stats) return;
      const count = stats.waiting_players + stats.active_rooms * 2;
      setOnlinePlayers(count);
    };

    fetchOnlineStats();
    const intervalId = setInterval(fetchOnlineStats, 8000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'ended') {
      endScreenAnim.setValue(0);
      Animated.timing(endScreenAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }).start();
    }
  }, [gameState, endScreenAnim]);

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
        startPingLoop();
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
        stopPingLoop();
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
        startPingLoop();
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
        stopPingLoop();
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
        serverStartTimeRef.current = typeof data.server_start_time === 'number'
          ? data.server_start_time
          : Date.now();
        if (typeof data.server_time === 'number') {
          serverTimeOffsetRef.current = data.server_time - Date.now();
        }
        setEndReason(null);
        setLetterPool(data.letter_pool);
        setInitialLetterPool(data.letter_pool);
        setScores(data.scores);
        gameDataRef.current.scores = data.scores;
        setGameState('playing');
        setIsTimeOver(false);
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
        setEndReason(null);
        setWinner(data.winner);
        setIsTie(data.is_tie);
        setScores(data.scores);
        gameDataRef.current.scores = data.scores;
        setGameState('ended');
        setIsTimeOver(false);
        serverStartTimeRef.current = null;
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
        setWinner(username);
        setIsTie(false);
        setEndReason('Rakip oyundan ayrıldı. Siz kazandınız!');
        setGameState('ended');
        setIsTimeOver(false);
        serverStartTimeRef.current = null;
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
        setIsTimeOver(false);
        if (typeof data.server_start_time === 'number') {
          serverStartTimeRef.current = data.server_start_time;
        } else {
          serverStartTimeRef.current = null;
        }
        if (typeof data.server_time === 'number') {
          serverTimeOffsetRef.current = data.server_time - Date.now();
        }
 
        const restoredWords = data.my_words.map((word: string) => ({ text: word, score: 0 }));
        setMyWords(restoredWords);

        if (typeof data.server_start_time === 'number' && typeof data.duration === 'number') {
          startTimer(data.duration);
        } else {
          startTimer(data.time_remaining);
        }
        
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

      case 'pong': {
        if (typeof data.server_time === 'number' && typeof data.client_time === 'number') {
          const now = Date.now();
          const rtt = now - data.client_time;
          const estimatedServerNow = data.server_time + Math.floor(rtt / 2);
          serverTimeOffsetRef.current = estimatedServerNow - now;
        } else if (typeof data.server_time === 'number') {
          serverTimeOffsetRef.current = data.server_time - Date.now();
        }
        break;
      }

      case 'ping':
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'pong',
            client_time: Date.now()
          }));
        }
        break;
    }
  };

  const startTimer = (duration: number) => {
    setTimeLeft(duration);
    setIsTimeOver(false);

    if (!serverStartTimeRef.current) {
      serverStartTimeRef.current = Date.now();
      serverTimeOffsetRef.current = 0;
    }
    
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (gameEndTimeoutRef.current !== null) {
      clearTimeout(gameEndTimeoutRef.current);
      gameEndTimeoutRef.current = null;
    }

    const updateTimeLeft = () => {
      const serverStart = serverStartTimeRef.current;
      const serverNow = Date.now() + serverTimeOffsetRef.current;

      if (!serverStart) {
        setTimeLeft(duration);
        return;
      }

      const elapsed = Math.floor((serverNow - serverStart) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsTimeOver(true);
      }
    };
    
    updateTimeLeft();
    timerRef.current = setInterval(() => {
      updateTimeLeft();
      if (serverStartTimeRef.current) {
        const serverNow = Date.now() + serverTimeOffsetRef.current;
        const elapsed = Math.floor((serverNow - serverStartTimeRef.current) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        if (remaining <= 0 && timerRef.current !== null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 1000) as any;
  };

  const handleLetterClick = useCallback((index: number) => {
    if (gameState !== 'playing' || isTimeOver) return;
    
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
  }, [gameState, selectedIndices, letterPool, isTimeOver]);

  const handleClearWord = useCallback(() => {
    setSelectedIndices([]);
    setCurrentWord('');
  }, []);

  const submitWord = useCallback(() => {
    if (!currentWord.trim() || !wsRef.current || gameState !== 'playing' || isTimeOver) return;

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
  }, [currentWord, gameState, isTimeOver]);

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

  const currentWordScore = currentWord.trim()
    ? calculateScore(currentWord.trim())
    : 0;

  const getWinnerText = () => {
    if (endReason) return endReason;
    if (_isTie) return 'Oyun berabere bitti!';
    if (_winner === username) return 'Tebrikler, kazandınız!';
    if (_winner) return `${_winner} kazandı!`;
    return 'Oyun bitti.';
  };

  const getTopWord = () => {
    const allWords = [
      ...myWords.map(word => ({ ...word, owner: username })),
      ...opponentWords.map(word => ({ ...word, owner: opponent || 'Rakip' })),
    ];
    if (allWords.length === 0) return null;
    return allWords
      .slice()
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const wordCompare = a.text.localeCompare(b.text, 'tr-TR');
        if (wordCompare !== 0) return wordCompare;
        return a.owner.localeCompare(b.owner, 'tr-TR');
      })[0] || null;
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
    stopPingLoop();
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
  }, [safeBack, stopPingLoop]);

  const sendEmoji = useCallback((emoji: string) => {
    if (!wsRef.current || gameState !== 'playing' || isTimeOver) {
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
  }, [gameState, isTimeOver]);

  if (gameState === 'ended') {
    const topWord = getTopWord();
    return (
      <SafeAreaView className="flex-1 bg-background">
        <StatusBar style="dark" />
        <Animated.View
          className="flex-1"
          style={{
            opacity: endScreenAnim,
            transform: [
              {
                translateY: endScreenAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          <ScrollView className="flex-1">
            <View className="px-5 pt-6 pb-4">
              <Text className="text-3xl font-bold text-text-primary">Oyun Bitti</Text>
              <Text className="text-base text-text-secondary mt-2">{getWinnerText()}</Text>
            </View>

            <View className="px-5">
              <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-4">
                <Text className="text-sm text-text-secondary mb-3">Skor Özeti</Text>
                <View className="flex-row justify-between items-center">
                  <View className="items-start">
                    <Text className="text-xs text-text-secondary">{username}</Text>
                    <Text className="text-2xl font-bold text-text-primary">{getMyScore()}</Text>
                    <Text className="text-xs text-text-secondary mt-1">{myWords.length} kelime</Text>
                  </View>
                  <Text className="text-lg font-bold text-primary">VS</Text>
                  <View className="items-end">
                    <Text className="text-xs text-text-secondary">{opponent || 'Rakip'}</Text>
                    <Text className="text-2xl font-bold text-text-primary">{getOpponentScore()}</Text>
                    <Text className="text-xs text-text-secondary mt-1">{opponentWords.length} kelime</Text>
                  </View>
                </View>
              </View>

              <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-4">
                <Text className="text-sm text-text-secondary mb-2">En Yüksek Puanlı Kelime</Text>
                {topWord ? (
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-lg font-bold text-text-primary">
                        {topWord.text.toLocaleUpperCase('tr-TR')}
                      </Text>
                      <Text className="text-xs text-text-secondary mt-1">{topWord.owner}</Text>
                    </View>
                    <Text className="text-lg font-bold text-success">+{topWord.score}</Text>
                  </View>
                ) : (
                  <Text className="text-sm text-text-secondary">Bu oyunda kelime yazılmadı.</Text>
                )}
              </View>
            </View>

            <View className="flex-row px-5 gap-3 pb-6">
              <View className="flex-1">
                <Text className="text-sm font-bold text-text-primary mb-2">Kelimelerim</Text>
                {myWords.length === 0 ? (
                  <Text className="text-xs text-text-secondary">Kelime yok.</Text>
                ) : (
                  myWords.map((word, index) => (
                    <View key={index} className="flex-row justify-between items-center bg-green-100 rounded-lg p-2.5 mb-2">
                      <Text className="text-sm font-semibold text-text-primary">{word.text.toLocaleUpperCase('tr-TR')}</Text>
                      <Text className="text-xs font-bold text-success">+{word.score}</Text>
                    </View>
                  ))
                )}
              </View>

              <View className="flex-1">
                <Text className="text-sm font-bold text-text-primary mb-2 text-right">Rakip</Text>
                {opponentWords.length === 0 ? (
                  <Text className="text-xs text-text-secondary text-right">Kelime yok.</Text>
                ) : (
                  opponentWords.map((word, index) => (
                    <View key={index} className="flex-row justify-between items-center bg-yellow-100 rounded-lg p-2.5 mb-2">
                      <Text className="text-sm font-semibold text-text-primary">{word.text.toLocaleUpperCase('tr-TR')}</Text>
                      <Text className="text-xs font-bold text-success">+{word.score}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </ScrollView>

          <View className="px-5 pb-6">
            <TouchableOpacity
              className="bg-primary rounded-xl py-4 items-center"
              onPress={handleCancel}
            >
              <Text className="text-white text-base font-bold">Ana Menü</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        <Toast />
      </SafeAreaView>
    );
  }

  if (gameState === 'queue') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <StatusBar style="dark" />
        <View className="flex-1 justify-center items-center p-6">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-2xl font-bold text-text-primary mt-6">Oyun Aranıyor...</Text>
          <Text className="text-base text-text-secondary mt-2">Rakip bekleniyor</Text>
          {onlinePlayers !== null && (
            <Text className="text-sm text-text-secondary mt-2">
              Şu an {onlinePlayers} oyuncu çevrimiçi
            </Text>
          )}
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
            {isTimeOver && (
              <Text className="text-[10px] text-text-secondary text-center mt-1">
                Sonuç bekleniyor...
              </Text>
            )}
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
          <ScrollView
            className="flex-1"
            ref={myWordsScrollRef}
            onContentSizeChange={() => myWordsScrollRef.current?.scrollToEnd({ animated: true })}
          >
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
          <ScrollView
            className="flex-1"
            ref={opponentWordsScrollRef}
            onContentSizeChange={() => opponentWordsScrollRef.current?.scrollToEnd({ animated: true })}
          >
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
            <View className="flex-1 bg-white rounded-lg px-4 py-3 border-2 border-slate-200 min-h-[52px] justify-center relative">
              <Text className="text-2xl font-bold text-text-primary">
                {currentWord.toLocaleUpperCase('tr-TR') || '...'}
              </Text>
              {!!currentWord.trim() && (
                <View className="absolute top-2 right-2 bg-slate-100 rounded-md px-2 py-1">
                  <Text className="text-xs font-semibold text-text-secondary">
                    +{currentWordScore}
                  </Text>
                </View>
              )}
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
              className={`rounded-lg px-6 py-3 ${!currentWord || isTimeOver ? 'bg-slate-400' : 'bg-primary'}`}
              onPress={submitWord}
              disabled={!currentWord || isTimeOver}
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
          disabled={gameState !== 'playing' || isTimeOver}
        />
      </View>

      {/* Emoji Picker Modal */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={sendEmoji}
        disabled={gameState !== 'playing' || isTimeOver}
      />

      <Toast />
    </SafeAreaView>
  );
}
