import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolateColor,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDailyChallenge, useSubmitDailyChallenge, useValidateWord } from '@/hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { InteractiveLetterPool } from '@/components/GameComponents';
import { calculateScore, hasLettersInPool } from '@/utils/gameLogic';
import { DailyChallengeLeaderboardEntry } from '@/utils/api';

const DAILY_DURATION = 60;
const DAILY_MIN_WORD_LENGTH = 3;
const SESSION_KEY = 'lexo_daily_session';

const TURKISH_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function formatTurkishDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${day} ${TURKISH_MONTHS[month - 1]}`;
}

interface DailySession {
  date: string;
  startedAt: string;
  words: Array<{ text: string; score: number }>;
  totalScore: number;
}

export default function DailyChallengePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { data: challengeData, isLoading, error, refetch } = useDailyChallenge();
  const submitMutation = useSubmitDailyChallenge();
  const validateWordMutation = useValidateWord();

  const [timeLeft, setTimeLeft] = useState(DAILY_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentWord, setCurrentWord] = useState('');
  const [words, setWords] = useState<{ text: string; score: number }[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [submitResult, setSubmitResult] = useState<{
    score: number;
    rank: number;
    leaderboard: DailyChallengeLeaderboardEntry[];
  } | null>(null);

  // Word validation cache
  const wordCacheRef = useRef<Map<string, boolean>>(new Map());
  // Prevent double-submit
  const submitRef = useRef(false);
  // Prevent session restore running more than once per mount
  const sessionRestoredRef = useRef(false);

  // Reanimated
  const successFlash = useSharedValue(0);
  const errorFlash = useSharedValue(0);
  const shakeAnim = useSharedValue(0);

  const wordCardAnimStyle = useAnimatedStyle(() => {
    'worklet';
    const successBg = interpolateColor(successFlash.value, [0, 1], ['#ffffff', '#dcfce7']);
    const errorBg   = interpolateColor(errorFlash.value,   [0, 1], ['#ffffff', '#fee2e2']);
    const bg = successFlash.value > 0
      ? successBg
      : errorFlash.value > 0
        ? errorBg
        : '#ffffff';
    return {
      backgroundColor: bg,
      transform: [{ translateX: shakeAnim.value }],
    };
  });

  const triggerSuccessAnim = () => {
    successFlash.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 300 }),
    );
  };

  const triggerErrorAnim = () => {
    errorFlash.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 250 }),
    );
    shakeAnim.value = withSequence(
      withTiming(-8, { duration: 60 }),
      withTiming(8,  { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(0,  { duration: 60 }),
    );
  };

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  // ── Restore in-progress session from AsyncStorage ────────────────────────
  // Runs once per mount, after challengeData is available.
  // Skipped if the user has already played today.
  useEffect(() => {
    if (!challengeData || challengeData.already_played || submitResult) return;
    if (sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const session: DailySession = JSON.parse(raw);

        // Discard stale sessions from a different day
        if (session.date !== challengeData.date) {
          await AsyncStorage.removeItem(SESSION_KEY);
          return;
        }

        // Calculate how much time has elapsed since the game started
        const elapsed = Math.floor(
          (Date.now() - new Date(session.startedAt).getTime()) / 1000,
        );
        const remaining = Math.max(0, DAILY_DURATION - elapsed);

        // Restore state
        setWords(session.words ?? []);
        setTotalScore(session.totalScore ?? 0);
        setHasStarted(true);
        submitRef.current = false;

        if (remaining > 0) {
          setTimeLeft(remaining);
          setIsRunning(true);
        } else {
          // Timer already expired while the user was away — go straight to submit
          setTimeLeft(0);
          // The auto-submit useEffect below will fire on the next render
        }
      } catch {
        // Ignore JSON parse errors or storage failures
      }
    })();
  }, [challengeData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // ── Auto-submit when timer reaches 0 ────────────────────────────────────
  useEffect(() => {
    if (timeLeft === 0 && hasStarted && !submitRef.current) {
      submitRef.current = true;
      handleAutoSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, hasStarted]);

  const handleAutoSubmit = async () => {
    if (submitMutation.isPending) return;
    try {
      const wordsPlayed = words.map((w) => w.text);
      const score = words.reduce((s, w) => s + w.score, 0);
      const result = await submitMutation.mutateAsync({ words: wordsPlayed, score });
      setSubmitResult(result);
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (err: any) {
      // 409 = already submitted (e.g. user restored session that was already submitted)
      await AsyncStorage.removeItem(SESSION_KEY);
      if (err?.status === 409) {
        refetch();
      } else {
        showToast('Sonuç kaydedilemedi', 'error');
      }
    }
  };

  const handleStart = async () => {
    wordCacheRef.current.clear();
    setWords([]);
    setCurrentWord('');
    setTotalScore(0);
    setSelectedIndices([]);
    setTimeLeft(DAILY_DURATION);
    submitRef.current = false;
    setHasStarted(true);
    setIsRunning(true);

    // Persist the session so navigating away doesn't reset the timer
    try {
      const session: DailySession = {
        date: challengeData!.date,
        startedAt: new Date().toISOString(),
        words: [],
        totalScore: 0,
      };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {}
  };

  const letterPool: string[] = challengeData?.letter_pool ?? [];

  const handleLetterClick = (index: number) => {
    if (!isRunning || timeLeft === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIndices([]);
    setCurrentWord('');
  };

  const handleDeleteLastLetter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIndices((prev) => {
      if (prev.length === 0) return prev;
      const updated = prev.slice(0, -1);
      setCurrentWord(updated.map((i) => letterPool[i]).join(''));
      return updated;
    });
  };

  const handleSubmitWord = async () => {
    if (!isRunning || isChecking) return;
    const trimmed = currentWord.trim();
    if (!trimmed) return;
    const normalized = trimmed.toLocaleLowerCase('tr-TR');
    if (normalized.length < DAILY_MIN_WORD_LENGTH) {
      showToast(`Kelime en az ${DAILY_MIN_WORD_LENGTH} harf olmalıdır`, 'warning');
      return;
    }
    if (words.some((w) => w.text === normalized)) {
      showToast('Bu kelimeyi zaten yazdın', 'warning');
      return;
    }
    if (!hasLettersInPool(normalized, letterPool)) {
      showToast('Havuzda yeterli harf yok', 'warning');
      return;
    }
    const cached = wordCacheRef.current.get(normalized);
    if (cached === false) {
      showToast('Geçersiz kelime', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      triggerErrorAnim();
      return;
    }

    setIsChecking(true);
    try {
      const result = await validateWordMutation.mutateAsync(normalized);
      wordCacheRef.current.set(normalized, result.valid);
      if (!result.valid) {
        showToast(result.message || 'Geçersiz kelime', 'error');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        triggerErrorAnim();
        setIsChecking(false);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      triggerSuccessAnim();

      const wordScore = calculateScore(normalized);
      const newWords = [{ text: normalized, score: wordScore }, ...words];
      const newScore = totalScore + wordScore;

      setWords(newWords);
      setTotalScore(newScore);
      setCurrentWord('');
      setSelectedIndices([]);

      // Persist updated word list so navigating away doesn't lose progress
      AsyncStorage.getItem(SESSION_KEY).then((raw) => {
        if (!raw) return;
        try {
          const session: DailySession = JSON.parse(raw);
          AsyncStorage.setItem(
            SESSION_KEY,
            JSON.stringify({ ...session, words: newWords, totalScore: newScore }),
          );
        } catch {}
      }).catch(() => {});
    } catch {
      showToast('Kelime doğrulanamadı', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsChecking(false);
    }
  };

  const dateLabel = challengeData?.date ? formatTurkishDate(challengeData.date) : '';

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centeredFull}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingText}>Günlük yarışma yükleniyor…</Text>
      </View>
    );
  }

  if (error || !challengeData) {
    return (
      <View style={styles.centeredFull}>
        <Text style={styles.errorText}>Yarışma yüklenemedi</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Already played (or just submitted) ──────────────────────────────────
  if (challengeData.already_played || submitResult) {
    const displayEntry = submitResult ?? (challengeData.user_entry
      ? { score: challengeData.user_entry.score, rank: 0, leaderboard: challengeData.leaderboard }
      : null);

    return (
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.backdrop} />
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backText}>←</Text>
              </TouchableOpacity>
              <View>
                <Text style={styles.title}>Günlük Yarışma</Text>
                <Text style={styles.subtitle}>{dateLabel}</Text>
              </View>
            </View>

            <View style={styles.resultCard}>
              <View style={styles.checkBadge}>
                <Text style={styles.checkIcon}>✓</Text>
              </View>
              <Text style={styles.resultTitle}>Tamamlandı!</Text>
              {displayEntry && (
                <>
                  <Text style={styles.resultScore}>{displayEntry.score} puan</Text>
                  {displayEntry.rank > 0 && (
                    <Text style={styles.resultRank}>#{displayEntry.rank}. sırada</Text>
                  )}
                  {challengeData.user_entry && (
                    <Text style={styles.resultWords}>
                      {challengeData.user_entry.word_count} kelime
                    </Text>
                  )}
                </>
              )}
            </View>

            {challengeData.user_entry && challengeData.user_entry.words.length > 0 && (
              <View style={styles.listCard}>
                <Text style={styles.listTitle}>Kelimeleriniz</Text>
                {challengeData.user_entry.words.map((w: string) => (
                  <View key={w} style={styles.wordItem}>
                    <Text style={styles.wordText}>{w.toLocaleUpperCase('tr-TR')}</Text>
                    <Text style={styles.wordScore}>+{calculateScore(w)}</Text>
                  </View>
                ))}
              </View>
            )}

            <LeaderboardSection
              leaderboard={displayEntry?.leaderboard ?? challengeData.leaderboard}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ── Active game or pre-start ─────────────────────────────────────────────
  const isFinished = hasStarted && !isRunning && timeLeft === 0;

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
                <Text style={styles.title}>Günlük Yarışma</Text>
                <Text style={styles.subtitle}>{dateLabel}</Text>
              </View>
            </View>

            {/* Timer — always visible once game has started */}
            {hasStarted && (
              <View style={styles.timerCard}>
                <Text style={styles.timerLabel}>Süre</Text>
                <Text style={[styles.timerValue, timeLeft <= 10 && isRunning && styles.timerUrgent]}>
                  {formattedTime}
                </Text>
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
            )}

            {/* Word input — only visible during active game */}
            {hasStarted && (
              <Animated.View style={[styles.wordCard, wordCardAnimStyle]}>
                <Text style={styles.wordLabel}>Seçilen kelime</Text>
                <View style={styles.wordRow}>
                  <Text style={styles.wordValue}>
                    {currentWord.toLocaleUpperCase('tr-TR') || '—'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleDeleteLastLetter}
                    disabled={!isRunning || isChecking || !currentWord}
                    style={[styles.backspaceButton, (!isRunning || isChecking || !currentWord) && styles.clearDisabled]}
                  >
                    <Text style={styles.backspaceText}>⌫</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleClear}
                    disabled={!isRunning || isChecking || !currentWord}
                    style={[styles.clearButton, (!isRunning || isChecking || !currentWord) && styles.clearDisabled]}
                  >
                    <Text style={styles.clearText}>✕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSubmitWord}
                    disabled={!isRunning || isChecking || !currentWord}
                    style={[styles.submitButton, (!isRunning || isChecking || !currentWord) && styles.submitDisabled]}
                  >
                    <Text style={styles.submitText}>{isChecking ? '...' : 'Ekle'}</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* Letter pool — only visible during active game */}
            {hasStarted && (
              <View style={styles.poolCard}>
                <Text style={styles.poolTitle}>Harf Havuzu</Text>
                <InteractiveLetterPool
                  letterPool={letterPool}
                  selectedIndices={selectedIndices}
                  onLetterClick={handleLetterClick}
                  disabled={!isRunning || timeLeft === 0}
                />
              </View>
            )}

            {/* Saving spinner after timer ends */}
            {isFinished && submitMutation.isPending && (
              <View style={styles.savingCard}>
                <ActivityIndicator size="small" color="#0f172a" />
                <Text style={styles.savingText}>Sonuç kaydediliyor…</Text>
              </View>
            )}

            {/* Pre-start info + button */}
            {!hasStarted && (
              <>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Nasıl oynanır?</Text>
                  <Text style={styles.infoText}>
                    Butona bastıktan sonra 15 harflik havuz açılır. 60 saniyede
                    bu harflerden olabildiğince çok kelime bul. Her oyuncu
                    bugün aynı harfleri kullanır. Yarışmaya yalnızca bir kez
                    katılabilirsin — ekrandan çıksan bile süre devam eder.
                  </Text>
                </View>
                <TouchableOpacity onPress={handleStart} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Yarışmayı Başlat</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Found words list */}
            {words.length > 0 && (
              <View style={styles.listCard}>
                <Text style={styles.listTitle}>Bulunan kelimeler</Text>
                {words.slice(0, 10).map((word) => (
                  <View key={word.text} style={styles.wordItem}>
                    <Text style={styles.wordText}>{word.text.toLocaleUpperCase('tr-TR')}</Text>
                    <Text style={styles.wordScore}>+{word.score}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard sub-component
// ---------------------------------------------------------------------------

function LeaderboardSection({ leaderboard }: { leaderboard: DailyChallengeLeaderboardEntry[] }) {
  if (!leaderboard || leaderboard.length === 0) return null;
  return (
    <View style={styles.listCard}>
      <Text style={styles.listTitle}>Günün Sıralaması</Text>
      {leaderboard.map((entry, i) => (
        <View key={entry.username + i} style={styles.lbRow}>
          <Text style={styles.lbRank}>
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
          </Text>
          <Text style={styles.lbUsername} numberOfLines={1}>{entry.username}</Text>
          <View style={styles.lbRight}>
            <Text style={styles.lbScore}>{entry.score}</Text>
            <Text style={styles.lbWords}>{entry.word_count} kelime</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  backdrop: {
    position: 'absolute',
    top: -100,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fbbf24',
    opacity: 0.35,
  },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  centeredFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
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
  backText: { fontSize: 18, color: '#0f172a' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { marginTop: 4, fontSize: 12, color: '#64748b' },
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
  timerUrgent: {
    color: '#ef4444',
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
  metaDivider: { width: 1, height: 28, backgroundColor: '#e2e8f0' },
  timerMetaText: { fontSize: 12, color: '#475569' },
  timerMetaNumber: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
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
  wordValue: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0f172a' },
  submitButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  submitDisabled: { backgroundColor: '#94a3b8' },
  submitText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  backspaceButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  backspaceText: { color: '#334155', fontWeight: '600', fontSize: 15 },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fca5a5',
  },
  clearDisabled: { backgroundColor: '#f1f5f9' },
  clearText: { color: '#7f1d1d', fontWeight: '600', fontSize: 13 },
  poolCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  poolTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  infoCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 18,
    gap: 8,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350f',
  },
  infoText: { fontSize: 13, color: '#92400e', lineHeight: 20 },
  primaryButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  savingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  savingText: { fontSize: 14, color: '#64748b' },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
    alignItems: 'center',
    gap: 8,
  },
  checkBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  checkIcon: { fontSize: 24 },
  resultTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  resultScore: { fontSize: 32, fontWeight: '700', color: '#16a34a' },
  resultRank: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  resultWords: { fontSize: 12, color: '#94a3b8' },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  listTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  wordText: { fontSize: 14, color: '#0f172a', fontWeight: '600' },
  wordScore: { fontSize: 12, fontWeight: '700', color: '#16a34a' },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  lbRank: { fontSize: 14, width: 28, textAlign: 'center' },
  lbUsername: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f172a' },
  lbRight: { alignItems: 'flex-end' },
  lbScore: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  lbWords: { fontSize: 11, color: '#94a3b8' },
});
