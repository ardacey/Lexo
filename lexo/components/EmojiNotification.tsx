import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';

interface EmojiNotificationProps {
  emoji: string;
  visible: boolean;
  onHide: () => void;
  position: 'left' | 'right'; 
}

export const EmojiNotification: React.FC<EmojiNotificationProps> = ({
  emoji,
  visible,
  onHide,
  position,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && emoji) {
      // Reset animations to ensure they run for each new emoji
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 5,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onHide();
        });
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [visible, emoji]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'left' ? styles.leftPosition : styles.rightPosition,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
  },
  leftPosition: {
    left: 16,
  },
  rightPosition: {
    right: 16,
  },
  emoji: {
    fontSize: 24,
  },
});
