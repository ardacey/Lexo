import React from 'react';
import { View, Text, TouchableOpacity, Animated, TextInput, ScrollView } from 'react-native';

interface GameHeaderProps {
  timeLeft: number;
  formatTime: string;
  totalScore: number;
  onBack: () => void;
  pulseAnim: Animated.Value;
  isWarning?: boolean;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  timeLeft,
  formatTime,
  totalScore,
  onBack,
  pulseAnim,
  isWarning = false,
}) => (
  <View className="flex-row justify-between items-center p-4 bg-white">
    <TouchableOpacity onPress={onBack} className="p-2">
      <Text className="text-base text-primary font-semibold">← Geri</Text>
    </TouchableOpacity>

    <Animated.View 
      className={`px-4 py-2 rounded-lg ${isWarning ? 'bg-red-50' : 'bg-blue-50'}`}
      style={{ transform: [{ scale: pulseAnim }] }}
    >
      <Text className={`text-2xl font-bold ${isWarning ? 'text-danger' : 'text-primary'}`}>
        {formatTime}
      </Text>
    </Animated.View>

    <View className="items-end">
      <Text className="text-xs text-text-secondary">Skor</Text>
      <Text className="text-2xl font-bold text-text-primary">{totalScore}</Text>
    </View>
  </View>
);

interface LetterPoolProps {
  letterPool: string[];
}

export const LetterPool: React.FC<LetterPoolProps> = ({ letterPool }) => (
  <View className="p-4">
    <Text className="text-base font-bold text-text-primary mb-3">Harfler</Text>
    <View className="flex-row flex-wrap justify-center gap-2">
      {letterPool.map((letter, index) => (
        <View key={`${letter}-${index}`} className="w-12 h-12 bg-white rounded-lg justify-center items-center">
          <Text className="text-2xl font-bold text-text-primary">{letter.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  </View>
);

interface WordInputProps {
  currentWord: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const WordInput: React.FC<WordInputProps> = ({
  currentWord,
  onChangeText,
  onSubmit,
  disabled = false,
}) => (
  <View className="flex-row p-4 gap-2">
    <TextInput
      className="flex-1 bg-white rounded-lg px-4 py-3 text-base border-2 border-slate-200"
      value={currentWord}
      onChangeText={onChangeText}
      placeholder="Kelimeyi yazın..."
      autoCapitalize="none"
      autoCorrect={false}
      editable={!disabled}
      onSubmitEditing={onSubmit}
      keyboardType="default"
    />
    <TouchableOpacity
      className={`rounded-lg px-6 justify-center ${disabled ? 'bg-slate-400' : 'bg-primary'}`}
      onPress={onSubmit}
      disabled={disabled}
    >
      <Text className="text-white text-base font-bold">Gönder</Text>
    </TouchableOpacity>
  </View>
);

interface WordsListProps {
  words: Array<{ text: string; score: number }>;
  title: string;
}

export const WordsList: React.FC<WordsListProps> = ({ words, title }) => (
  <View className="flex-1 p-4">
    <Text className="text-base font-bold text-text-primary mb-2">{title} ({words.length})</Text>
    <ScrollView className="flex-1">
      {words.map((word, index) => (
        <View key={index} className="flex-row justify-between items-center bg-white rounded-lg p-3 mb-2">
          <Text className="text-base font-semibold text-text-primary">{word.text.toUpperCase()}</Text>
          <Text className="text-sm font-bold text-success">+{word.score}</Text>
        </View>
      ))}
    </ScrollView>
  </View>
);
