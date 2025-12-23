import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useValidateWord } from '@/hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { InteractiveLetterPool } from '@/components/GameComponents';
import { calculateScore, generateBalancedPool, hasLettersInPool } from '@/utils/gameLogic';

const PRACTICE_DURATION = 60;
const PRACTICE_POOL_SIZE = 15;
const PRACTICE_MIN_WORD_LENGTH = 3;

export default function PracticePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const validateWordMutation = useValidateWord();
  const [timeLeft, setTimeLeft] = useState(PRACTICE_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [currentWord, setCurrentWord] = useState('');
  const [words, setWords] = useState<{ text: string; score: number }[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [letterPool, setLetterPool] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  useEffect(() => {
    if (!isRunning) return;

    const intervalId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isRunning]);

  useEffect(() => {
    setLetterPool(generateBalancedPool(PRACTICE_POOL_SIZE));
  }, []);

  const resetPractice = () => {
    setWords([]);
    setCurrentWord('');
    setTotalScore(0);
    setSelectedIndices([]);
    setTimeLeft(PRACTICE_DURATION);
  };

  const handleStart = () => {
    resetPractice();
    setLetterPool(generateBalancedPool(PRACTICE_POOL_SIZE));
    setIsRunning(true);
  };

  const handleLetterClick = (index: number) => {
    if (!isRunning || timeLeft === 0) return;

    if (selectedIndices.includes(index)) {
      const updated = selectedIndices.filter((i) => i !== index);
      setSelectedIndices(updated);
      setCurrentWord(updated.map((i) => letterPool[i]).join(''));
    } else {
      const updated = [...selectedIndices, index];
      setSelectedIndices(updated);
      setCurrentWord(updated.map((i) => letterPool[i]).join(''));
    }
  };

  const handleClear = () => {
    setSelectedIndices([]);
    setCurrentWord('');
  };

  const handleSubmit = async () => {
    if (!isRunning || isChecking) return;

    const trimmed = currentWord.trim();
    if (!trimmed) return;

    const normalized = trimmed.toLocaleLowerCase('tr-TR');
    if (normalized.length < PRACTICE_MIN_WORD_LENGTH) {
      showToast(`Kelime en az ${PRACTICE_MIN_WORD_LENGTH} harf olmalıdır`, 'warning');
      return;
    }
    if (words.some((word) => word.text === normalized)) {
      showToast('Bu kelimeyi zaten yazdın', 'warning');
      return;
    }
    if (!hasLettersInPool(normalized, letterPool)) {
      showToast('Havuzda yeterli harf yok', 'warning');
      return;
    }

    setIsChecking(true);
    try {
      const result = await validateWordMutation.mutateAsync(normalized);
      if (!result.valid) {
        showToast(result.message || 'Geçersiz kelime', 'error');
        setIsChecking(false);
        return;
      }

      const score = calculateScore(normalized);
      setWords((prev) => [{ text: normalized, score }, ...prev]);
      setTotalScore((prev) => prev + score);
      setCurrentWord('');
      setSelectedIndices([]);
    } catch (error) {
      showToast('Kelime doğrulanamadı', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  const isFinished = !isRunning && timeLeft === 0;

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.backdrop} />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backText}>←</Text>
              </TouchableOpacity>
              <View>
                <Text style={styles.title}>Hızlı Pratik</Text>
                <Text style={styles.subtitle}>Hızlı solo kelime turu</Text>
              </View>
            </View>

            <View style={styles.timerCard}>
                <Text style={styles.timerLabel}>Süre</Text>
                <Text style={styles.timerValue}>{formattedTime}</Text>
                <View style={styles.timerMeta}>
                  <View>
                    <Text style={styles.timerMetaText}>Skor</Text>
                    <Text style={styles.timerMetaNumber}>{totalScore}</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View>
                    <Text style={styles.timerMetaText}>Doğru kelime</Text>
                    <Text style={styles.timerMetaNumber}>{words.length}</Text>
                  </View>
                </View>
              </View>

            <View style={styles.wordCard}>
              <Text style={styles.wordLabel}>Seçilen kelime</Text>
              <View style={styles.wordRow}>
                <Text style={styles.wordValue}>
                  {currentWord.toLocaleUpperCase('tr-TR') || '—'}
                </Text>
                <TouchableOpacity
                  onPress={handleClear}
                  disabled={!isRunning || isChecking || !currentWord}
                  style={[styles.clearButton, (!isRunning || isChecking || !currentWord) && styles.clearDisabled]}
                >
                  <Text style={styles.clearText}>Temizle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!isRunning || isChecking || !currentWord}
                  style={[styles.submitButton, (!isRunning || isChecking || !currentWord) && styles.submitDisabled]}
                >
                  <Text style={styles.submitText}>{isChecking ? '...' : 'Ekle'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.poolCard}>
              <Text style={styles.poolTitle}>Harf Havuzu</Text>
              <InteractiveLetterPool
                letterPool={letterPool}
                selectedIndices={selectedIndices}
                onLetterClick={handleLetterClick}
                disabled={!isRunning || timeLeft === 0}
              />
            </View>

            {isFinished ? (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Tur bitti</Text>
                <Text style={styles.resultValue}>{words.length} kelime</Text>
                <TouchableOpacity onPress={handleStart} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Yeniden dene</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handleStart} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  {isRunning ? 'Yeniden Başlat' : 'Başla'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.listCard}>
              <Text style={styles.listTitle}>Son kelimeler</Text>
              {words.length === 0 ? (
                <Text style={styles.emptyText}>Henüz kelime yok</Text>
              ) : (
                words.slice(0, 8).map((word) => (
                  <View key={word.text} style={styles.wordItem}>
                    <Text style={styles.wordText}>{word.text.toLocaleUpperCase('tr-TR')}</Text>
                    <Text style={styles.wordScore}>+{word.score}</Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  backdrop: {
    position: 'absolute',
    top: -100,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fcd34d',
    opacity: 0.4,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  backText: {
    fontSize: 18,
    color: '#0f172a',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
  },
  timerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  timerLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerValue: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: '700',
    color: '#0f172a',
  },
  timerMeta: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  metaDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
  },
  timerMetaText: {
    fontSize: 12,
    color: '#475569',
  },
  timerMetaNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  wordCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  wordLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  wordRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordValue: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  submitButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  submitDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  clearDisabled: {
    backgroundColor: '#f1f5f9',
  },
  clearText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 13,
  },
  poolCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  poolTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
    alignItems: 'center',
    gap: 10,
  },
  resultTitle: {
    fontSize: 14,
    color: '#64748b',
  },
  resultValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  wordText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  wordScore: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
});
