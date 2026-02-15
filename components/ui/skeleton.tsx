// components/ui/skeleton.tsx

import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Animated, 
  StyleSheet, 
  ViewStyle, 
  LayoutChangeEvent 
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors } from '@/constants/design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  isLoading?: boolean;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  isLoading = true,
}: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const systemColorScheme = useColorScheme();
  const theme: 'light' | 'dark' = systemColorScheme === 'dark' ? 'dark' : 'light';
  const { colorScheme } = useTheme();
  const colors = getColors(theme, colorScheme);

  useEffect(() => {
    if (isLoading) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isLoading, animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  if (!isLoading) {
    return null;
  }

  // Build style object
  const baseStyle: ViewStyle = {
    height,
    borderRadius,
    backgroundColor: colors.surfaceLight,
    opacity,
  };

  // Handle width based on type
  const widthStyle: ViewStyle = typeof width === 'number' 
    ? { width } 
    : width === '100%' 
      ? { flex: 1 } 
      : { width: width as any };

  return (
    <Animated.View style={[baseStyle, widthStyle, style]} />
  );
}

// Circle skeleton for avatars
interface SkeletonCircleProps {
  size: number;
  style?: ViewStyle;
  isLoading?: boolean;
}

export function SkeletonCircle({
  size,
  style,
  isLoading = true,
}: SkeletonCircleProps) {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
      isLoading={isLoading}
    />
  );
}

// Text skeleton with multiple lines
interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  width?: number | string;
  lastLineWidth?: number | string;
  style?: ViewStyle;
  isLoading?: boolean;
}

export function SkeletonText({
  lines = 3,
  lineHeight = 16,
  width = '100%',
  lastLineWidth = '60%',
  style,
  isLoading = true,
}: SkeletonTextProps) {
  return (
    <View style={[styles.textContainer, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : width}
          height={lineHeight}
          borderRadius={4}
          style={index > 0 ? { marginTop: 8 } : undefined}
          isLoading={isLoading}
        />
      ))}
    </View>
  );
}

// Card skeleton for feed posts
interface SkeletonCardProps {
  style?: ViewStyle;
  isLoading?: boolean;
}

export function SkeletonCard({ style, isLoading = true }: SkeletonCardProps) {
  const systemColorScheme = useColorScheme();
  const theme: 'light' | 'dark' = systemColorScheme === 'dark' ? 'dark' : 'light';
  const { colorScheme } = useTheme();
  const colors = getColors(theme, colorScheme);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, style]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <SkeletonCircle size={40} isLoading={isLoading} />
        <View style={styles.cardHeaderText}>
          <Skeleton width={120} height={14} isLoading={isLoading} />
          <Skeleton width={80} height={12} style={{ marginTop: 4 }} isLoading={isLoading} />
        </View>
      </View>
      
      {/* Content */}
      <View style={styles.cardContent}>
        <SkeletonText lines={2} lineHeight={14} isLoading={isLoading} />
      </View>
      
      {/* Image placeholder */}
      <Skeleton 
        width="100%" 
        height={200} 
        borderRadius={8} 
        style={{ marginTop: 12 }}
        isLoading={isLoading}
      />
      
      {/* Actions */}
      <View style={styles.cardActions}>
        <Skeleton width={60} height={24} borderRadius={12} isLoading={isLoading} />
        <Skeleton width={60} height={24} borderRadius={12} isLoading={isLoading} />
        <Skeleton width={60} height={24} borderRadius={12} isLoading={isLoading} />
      </View>
    </View>
  );
}

// Profile skeleton
interface SkeletonProfileProps {
  style?: ViewStyle;
  isLoading?: boolean;
}

export function SkeletonProfile({ style, isLoading = true }: SkeletonProfileProps) {
  const systemColorScheme = useColorScheme();
  const theme: 'light' | 'dark' = systemColorScheme === 'dark' ? 'dark' : 'light';
  const { colorScheme } = useTheme();
  const colors = getColors(theme, colorScheme);

  return (
    <View style={[styles.profile, style]}>
      {/* Avatar and basic info */}
      <View style={styles.profileHeader}>
        <SkeletonCircle size={80} isLoading={isLoading} />
        <View style={styles.profileInfo}>
          <Skeleton width={150} height={20} isLoading={isLoading} />
          <Skeleton width={100} height={14} style={{ marginTop: 4 }} isLoading={isLoading} />
        </View>
      </View>
      
      {/* Stats */}
      <View style={styles.profileStats}>
        <View style={styles.statItem}>
          <Skeleton width={40} height={24} isLoading={isLoading} />
          <Skeleton width={50} height={12} style={{ marginTop: 4 }} isLoading={isLoading} />
        </View>
        <View style={styles.statItem}>
          <Skeleton width={40} height={24} isLoading={isLoading} />
          <Skeleton width={50} height={12} style={{ marginTop: 4 }} isLoading={isLoading} />
        </View>
        <View style={styles.statItem}>
          <Skeleton width={40} height={24} isLoading={isLoading} />
          <Skeleton width={50} height={12} style={{ marginTop: 4 }} isLoading={isLoading} />
        </View>
      </View>
      
      {/* Bio */}
      <View style={styles.profileBio}>
        <SkeletonText lines={2} lineHeight={14} isLoading={isLoading} />
      </View>
    </View>
  );
}

// List item skeleton
interface SkeletonListItemProps {
  style?: ViewStyle;
  isLoading?: boolean;
  showAvatar?: boolean;
  showSubtitle?: boolean;
}

export function SkeletonListItem({ 
  style, 
  isLoading = true,
  showAvatar = true,
  showSubtitle = true,
}: SkeletonListItemProps) {
  return (
    <View style={[styles.listItem, style]}>
      {showAvatar && <SkeletonCircle size={48} isLoading={isLoading} />}
      <View style={styles.listItemContent}>
        <Skeleton width="60%" height={16} isLoading={isLoading} />
        {showSubtitle && (
          <Skeleton width="40%" height={12} style={{ marginTop: 4 }} isLoading={isLoading} />
        )}
      </View>
    </View>
  );
}

// Grid skeleton for explore/feed
interface SkeletonGridProps {
  columns?: number;
  rows?: number;
  itemHeight?: number;
  gap?: number;
  style?: ViewStyle;
  isLoading?: boolean;
}

export function SkeletonGrid({
  columns = 2,
  rows = 4,
  itemHeight = 150,
  gap = 8,
  style,
  isLoading = true,
}: SkeletonGridProps) {
  return (
    <View style={[styles.grid, style]}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <View key={rowIndex} style={[styles.gridRow, { gap }]}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`${rowIndex}-${colIndex}`}
              width="100%"
              height={itemHeight}
              borderRadius={8}
              isLoading={isLoading}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// Chat bubble skeleton
interface SkeletonChatBubbleProps {
  isOwn?: boolean;
  style?: ViewStyle;
  isLoading?: boolean;
}

export function SkeletonChatBubble({ 
  isOwn = false, 
  style,
  isLoading = true,
}: SkeletonChatBubbleProps) {
  const systemColorScheme = useColorScheme();
  const theme: 'light' | 'dark' = systemColorScheme === 'dark' ? 'dark' : 'light';
  const { colorScheme } = useTheme();
  const colors = getColors(theme, colorScheme);

  return (
    <View style={[
      styles.chatBubble,
      isOwn ? styles.chatBubbleOwn : styles.chatBubbleOther,
      { backgroundColor: isOwn ? colors.primary : colors.surfaceLight },
      style
    ]}>
      <Skeleton 
        width={150} 
        height={16} 
        borderRadius={12}
        isLoading={isLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  textContainer: {
    width: '100%',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  cardContent: {
    marginTop: 12,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  profile: {
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  profileBio: {
    marginTop: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  grid: {
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
  },
  chatBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%',
    marginVertical: 4,
  },
  chatBubbleOwn: {
    alignSelf: 'flex-end',
  },
  chatBubbleOther: {
    alignSelf: 'flex-start',
  },
});
