import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const STORAGE_KEY = '@lexo/haptics_enabled';

/**
 * Reads and persists the user's haptic-feedback preference.
 *
 * Provides thin wrapper functions (`triggerImpact`, `triggerNotification`)
 * that are no-ops when the preference is disabled, so callers don't need
 * any conditional logic of their own.
 */
export const useHapticsPreference = () => {
  // Default true — first-time users get haptics out of the box.
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // Load persisted preference once on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value !== null) {
        setHapticsEnabled(value === 'true');
      }
    });
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    setHapticsEnabled(enabled);
    await AsyncStorage.setItem(STORAGE_KEY, String(enabled));
  }, []);

  const triggerImpact = useCallback(
    (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
      if (hapticsEnabled) {
        Haptics.impactAsync(style);
      }
    },
    [hapticsEnabled]
  );

  const triggerNotification = useCallback(
    (type: Haptics.NotificationFeedbackType) => {
      if (hapticsEnabled) {
        Haptics.notificationAsync(type);
      }
    },
    [hapticsEnabled]
  );

  return { hapticsEnabled, setEnabled, triggerImpact, triggerNotification };
};
