import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated';

export function HapticTab(props: BottomTabBarButtonProps) {
  const scale = useSharedValue(1);

  // Animated scale effect for a "bouncy" tab feel
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (ev: any) => {
    // 1. Trigger Haptics
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Soft vibration for Android to match iOS Light Impact
      Haptics.selectionAsync();
    }

    // 2. Start scale down animation
    scale.value = withSpring(0.92, { damping: 10, stiffness: 300 });

    props.onPressIn?.(ev);
  };

  const handlePressOut = (ev: any) => {
    // 3. Scale back to original size
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
    props.onPressOut?.(ev);
  };

  return (
    <Animated.View style={[props.style, { flex: 1 }, animatedStyle]}>
      <PlatformPressable
        {...props}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{ color: 'transparent' }}
      />
    </Animated.View>
  );
}