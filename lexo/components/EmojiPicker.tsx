import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
} from 'react-native';

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectEmoji: (_emoji: string) => void;
  disabled?: boolean;
}

const EMOJI_LIST = [
  ['👍', '😂', '😢', '😡'],
  ['🔥', '😱', '💪', '🤔']
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  visible,
  onClose,
  onSelectEmoji,
  disabled = false,
}) => {
  const handleEmojiSelect = (emoji: string) => {
    if (!disabled) {
      onSelectEmoji(emoji);
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <View className="absolute bottom-0 left-0 right-0 h-full z-[999]" style={{ pointerEvents: 'box-none' }}>
      <TouchableOpacity 
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        activeOpacity={1}
      />
      <View className="absolute bottom-20 left-4 right-4 bg-white/[0.98] rounded-[20px] py-3 px-2 shadow-lg z-[1000] gap-2">
        {EMOJI_LIST.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row justify-around items-center">
            {row.map((emoji, index) => (
              <TouchableOpacity
                key={`${rowIndex}-${index}`}
                className="w-[52px] h-[52px] justify-center items-center rounded-[26px] bg-gray-100"
                onPress={() => {
                  handleEmojiSelect(emoji);
                }}
                disabled={disabled}
                activeOpacity={0.7}
              >
                <Text className="text-[28px]">{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};
