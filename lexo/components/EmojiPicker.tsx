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
    console.log('🎯 EmojiPicker: handleEmojiSelect called with:', emoji, 'disabled:', disabled);
    if (!disabled) {
      console.log('✅ EmojiPicker: Calling onSelectEmoji');
      onSelectEmoji(emoji);
      onClose();
    } else {
      console.log('❌ EmojiPicker: Disabled, not sending emoji');
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity 
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        activeOpacity={1}
      />
      <View style={styles.container}>
        {EMOJI_LIST.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.emojiRow}>
            {row.map((emoji, index) => (
              <TouchableOpacity
                key={`${rowIndex}-${index}`}
                style={styles.emojiButton}
                onPress={() => {
                  console.log('👆 TouchableOpacity onPress triggered for emoji:', emoji);
                  handleEmojiSelect(emoji);
                }}
                onPressIn={() => console.log('👇 onPressIn for emoji:', emoji)}
                disabled={disabled}
                activeOpacity={0.7}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    zIndex: 999,
    pointerEvents: 'box-none',
  },
  container: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    gap: 8,
    zIndex: 1000,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  emojiButton: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 26,
    backgroundColor: '#F3F4F6',
  },
  emoji: {
    fontSize: 28,
  },
});
