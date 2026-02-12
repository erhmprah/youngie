import React, { useEffect, useRef, useMemo } from 'react';
import { ActivityIndicator, Animated, ViewStyle } from 'react-native';

interface AnimatedActivityIndicatorProps {
  size?: 'small' | 'large' | number;
  color?: string;
  style?: ViewStyle;
}

const AnimatedActivityIndicatorComponent = ({ size = 'large', color, style }: AnimatedActivityIndicatorProps) => {
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

  // Memoize the animated view style
  const animatedStyle = useMemo(() => [{ transform: [{ scale }] }, style], [scale, style]);

  return (
    <Animated.View style={animatedStyle}>
      <ActivityIndicator size={size} color={color} />
    </Animated.View>
  );
};

export default React.memo(AnimatedActivityIndicatorComponent);