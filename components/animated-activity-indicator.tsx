import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, ViewStyle } from 'react-native';

interface AnimatedActivityIndicatorProps {
  size?: 'small' | 'large' | number;
  color?: string;
  style?: ViewStyle;
}

export default function AnimatedActivityIndicator({ size = 'large', color, style }: AnimatedActivityIndicatorProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale]);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <ActivityIndicator size={size} color={color} />
    </Animated.View>
  );
}