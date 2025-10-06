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
import { WS_BASE_URL } from '../../utils/constants';
import { saveGame, createUser } from '@/utils/api';

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
  const { user } = useUser();
  
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<'queue' | 'matched' | 'playing' | 'ended'>('queue');
  const [letterPool, setLetterPool] = useState<string[]>([]);
  const [initialLetterPool, setInitialLetterPool] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [myWords, setMyWords] = useState<Word[]>([]);
  const [opponentWords, setOpponentWords] = useState<Word[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameDuration, setGameDuration] = useState(60);
  const [opponent, setOpponent] = useState('');
  const [opponentClerkId, setOpponentClerkId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [winner, setWinner] = useState<string | null>(null);
  const [isTie, setIsTie] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [gameStartTime, setGameStartTime] = useState<Date | null>(null);
  const [gameSaved, setGameSaved] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<number | null>(null);
  const gameDataRef = useRef({
    startTime: null as Date | null,
    roomId: '',
    opponent: '',
    opponentClerkId: '',
    initialLetterPool: [] as string[],
    myWords: [] as Word[],
    opponentWords: [] as Word[]
  });

  useEffect(() => {
    if (user) {
      createUser(user.id, username, user.primaryEmailAddress?.emailAddress).catch(console.error);
    }
    
    connectToQueue();
    
    return () => {
      console.log('Cleaning up multiplayer component...');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (ws) {
        try {
          ws.close();
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
          clerk_id: user.id 
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
        }
        saveGameToDatabase(data.winner, data.is_tie, data.scores);
        showGameEndAlert(data.winner, data.is_tie);
        break;

      case 'opponent_disconnected':
        // Clean up timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        
        // Close WebSocket connection
        if (ws) {
          ws.close();
          setWs(null);
        }
        
        // Show alert and navigate back
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

  const saveGameToDatabase = async (winnerName: string | null, tie: boolean, finalScores: Score[]) => {
    console.log('=== saveGameToDatabase called ===');
    console.log('State values:', {
      gameSaved,
      userId: user?.id,
      gameStartTime,
      roomId,
      opponent
    });
    console.log('Ref values:', gameDataRef.current);
    
    // Use ref values as fallback
    const actualStartTime = gameStartTime || gameDataRef.current.startTime;
    const actualRoomId = roomId || gameDataRef.current.roomId;
    const actualOpponent = opponent || gameDataRef.current.opponent;
    const actualOpponentClerkId = opponentClerkId || gameDataRef.current.opponentClerkId;
    
    if (gameSaved || !user || !actualStartTime) {
      console.log('❌ Skipping save:', { 
        gameSaved, 
        hasUser: !!user, 
        hasGameStartTime: !!actualStartTime 
      });
      return;
    }
    
    console.log('✅ Saving game to database...');
    console.log('Using values:', {
      startTime: actualStartTime,
      roomId: actualRoomId,
      opponent: actualOpponent
    });
    
    try {
      setGameSaved(true);

      console.log('Creating/getting user:', user.id, username);
      await createUser(user.id, username, user.primaryEmailAddress?.emailAddress);

      const myScore = finalScores.find(s => s.username === username)?.score || 0;
      const opponentScore = finalScores.find(s => s.username === actualOpponent)?.score || 0;

      console.log('Score comparison:', { myScore, opponentScore, username, actualOpponent, actualOpponentClerkId });

      let winnerClerkId: string | undefined = undefined;
      if (!tie) {
        // Determine winner based on actual scores
        if (myScore > opponentScore) {
          winnerClerkId = user.id;
          console.log('🏆 I won! Winner clerk_id:', winnerClerkId);
        } else if (opponentScore > myScore) {
          winnerClerkId = actualOpponentClerkId;
          console.log('🏆 Opponent won! Winner clerk_id:', winnerClerkId);
        }
      } else {
        console.log('🤝 Game is tied, no winner');
      }
      
      // Use ref values for words to ensure they're not lost
      const actualMyWords = myWords.length > 0 ? myWords : gameDataRef.current.myWords;
      const actualOpponentWords = opponentWords.length > 0 ? opponentWords : gameDataRef.current.opponentWords;
      const actualLetterPool = initialLetterPool.length > 0 ? initialLetterPool : gameDataRef.current.initialLetterPool;
      
      const myWordsList = actualMyWords.map(w => w.text);
      const opponentWordsList = actualOpponentWords.map(w => w.text);
      
      console.log('Words:', {
        myWords: myWordsList,
        opponentWords: opponentWordsList,
        letterPool: actualLetterPool
      });
      
      // Both players must have real clerk_ids from WebSocket
      if (!actualOpponentClerkId) {
        console.error('❌ Cannot save game: opponent clerk_id missing');
        Toast.show({
          type: 'error',
          text1: 'Hata',
          text2: 'Oyun kaydedilemedi: Rakip bilgisi eksik',
          position: 'bottom'
        });
        return;
      }

      const gameData = {
        room_id: actualRoomId,
        player1_clerk_id: user.id,
        player2_clerk_id: actualOpponentClerkId,
        player1_score: myScore,
        player2_score: opponentScore,
        player1_words: myWordsList,
        player2_words: opponentWordsList,
        winner_clerk_id: winnerClerkId,
        duration: gameDuration,
        letter_pool: actualLetterPool,
        started_at: actualStartTime.toISOString(),
        ended_at: new Date().toISOString()
      };
      
      console.log('📤 Sending game data:', gameData);
      const result = await saveGame(gameData);
      console.log('✅ Game saved to database successfully:', result);
    } catch (error: any) {
      console.error('Error saving game to database:', error);
      const isDuplicate = error?.message?.includes('duplicate key') || 
                         error?.message?.includes('already exists');
      
      if (isDuplicate) {
        console.log('ℹ️ Game already saved by opponent');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Oyun kaydedilemedi',
          text2: 'İstatistikler güncellenemedi',
          visibilityTime: 3000,
        });
      }
    }
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
          { 
            text: 'Ana Menü', 
            onPress: () => {
              // Clean up WebSocket before navigating
              if (ws) {
                try {
                  ws.close();
                  setWs(null);
                } catch (error) {
                  console.error('Error closing WebSocket:', error);
                }
              }
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
    // Clean up WebSocket before going back
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
      
      {/* Header with Scores */}
      <View className="bg-white p-4 border-b border-slate-200">
        <View className="flex-row justify-between items-center mb-3">
          <View className="items-center flex-1">
            <Text className="text-sm text-text-secondary font-semibold">{username}</Text>
            <Text className="text-3xl font-bold text-text-primary mt-1">{getMyScore()}</Text>
          </View>
          
          <Animated.View 
            className={`px-4 py-2 rounded-lg ${timeLeft <= 10 ? 'bg-red-50' : 'bg-blue-50'}`}
            style={{ transform: [{ scale: pulseAnim }] }}
          >
            <Text className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-danger' : 'text-primary'}`}>
              {formatTime(timeLeft)}
            </Text>
          </Animated.View>
          
          <View className="items-center flex-1">
            <Text className="text-sm text-text-secondary font-semibold">{opponent}</Text>
            <Text className="text-3xl font-bold text-text-primary mt-1">{getOpponentScore()}</Text>
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

      {/* Letter Pool at Bottom */}
      <View className="bg-white p-3 border-t border-slate-200">
        <Text className="text-base font-bold text-text-primary mb-2 text-center">Harfler</Text>
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
      <Toast />
    </SafeAreaView>
  );
}
