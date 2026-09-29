import { useThemeColor } from '@/hooks/use-theme-color';
import { useNetwork } from '@/contexts/NetworkContext';
import { Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';

export default function ConnectionBanner() {
  const { isOffline } = useNetwork();
  const backgroundColor = useThemeColor('error');
  const textColor = '#FFFFFF';
  const [translateY] = useState(() => new Animated.Value(-100));
  const previousOffline = useRef(isOffline);

  useEffect(() => {
    if (isOffline) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();
    } else if (previousOffline.current) {
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
          delay: 1500,
        }),
      ]).start();
    }
    previousOffline.current = isOffline;
  }, [isOffline, translateY]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={[styles.text, { color: textColor }]}>
        {isOffline ? 'No Internet Connection' : 'Back Online'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 10,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
