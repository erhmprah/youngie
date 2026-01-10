import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useThemeColor } from '@/hooks/use-theme-color';
import { borderRadius, spacing, shadows } from '@/constants/design-tokens';

export type ReactionType = 'like' | 'heart' | 'laugh' | 'wow' | 'sad' | 'fire';

interface ReactionPickerProps {
  onSelect: (reaction: ReactionType) => void;
  onClose?: () => void;
}

const REACTIONS: { type: ReactionType; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { type: 'like', icon: 'thumbs-up', color: '#4A90E2' },
  { type: 'heart', icon: 'heart', color: '#E0245E' },
  { type: 'laugh', icon: 'happy', color: '#F7B500' },
  { type: 'wow', icon: 'star', color: '#9013FE' },
  { type: 'sad', icon: 'sad', color: '#F5A623' },
  { type: 'fire', icon: 'flame', color: '#FF5722' },
];

export function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  const backgroundColor = useThemeColor('background');
  
  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      style={[styles.container, { backgroundColor }]}
    >
      {REACTIONS.map((reaction, index) => (
        <Animated.View 
          key={reaction.type}
          entering={ZoomIn.delay(index * 30).springify()}
        >
          <TouchableOpacity
            style={styles.reactionButton}
            onPress={() => {
              onSelect(reaction.type);
              onClose?.();
            }}
          >
            <Ionicons name={reaction.icon} size={28} color={reaction.color} />
          </TouchableOpacity>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  reactionButton: {
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
});