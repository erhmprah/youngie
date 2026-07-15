import type { PropsWithChildren, ReactElement } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  Extrapolation,
} from 'react-native-reanimated';

import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 300; // Increased for a more cinematic feel

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
}: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          // Pull down to zoom (Rubber band effect)
          translateY: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0],
            [-HEADER_HEIGHT / 2, 0],
            Extrapolation.CLAMP
          ),
        },
        {
          // Massive scale when pulling down
          scale: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0],
            [2, 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      // Content slides up to cover header and adds rounded corners
      marginTop: -24,
      borderTopLeftRadius: interpolate(scrollOffset.value, [0, HEADER_HEIGHT], [32, 0], Extrapolation.CLAMP),
      borderTopRightRadius: interpolate(scrollOffset.value, [0, HEADER_HEIGHT], [32, 0], Extrapolation.CLAMP),
    };
  });

  return (
    <ThemedView style={styles.container}>
      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        
        <Animated.View
          style={[
            styles.header,
            { backgroundColor: headerBackgroundColor[colorScheme as 'light' | 'dark'] },
            headerAnimatedStyle,
          ]}>
          {headerImage}
        </Animated.View>

        <Animated.View style={[styles.contentWrapper, contentAnimatedStyle]}>
          <ThemedView style={styles.content}>
            {/* Visual handle for the sheet look */}
            <View style={styles.sheetHandle} />
            {children}
          </ThemedView>
        </Animated.View>
      </Animated.ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    width: width,
    overflow: 'hidden',
  },
  contentWrapper: {
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: Dimensions.get('window').height - 100,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E5E7',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
    opacity: 0.5,
  },
});