import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

export const usePulseAnimation = (shouldPulse: boolean) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (shouldPulse) {
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
  }, [shouldPulse, pulseAnim]);

  return pulseAnim;
};
