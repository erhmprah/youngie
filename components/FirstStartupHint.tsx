// components/FirstStartupHint.tsx

import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Ionicons } from '@expo/vector-icons';

const ONBOARDING_SEEN_KEY = 'onboardingSeen';

interface HintStep {
  icon: string;
  title: string;
  description: string;
  accent: 'feed' | 'swipe' | 'explore' | 'chat' | 'video' | 'profile';
}

const STEPS: HintStep[] = [
  {
    icon: 'house.fill',
    title: 'Feed',
    description: 'See posts from people you follow and communities you have joined. Tap the + to share something.',
    accent: 'feed',
  },
  {
    icon: 'heart.fill',
    title: 'Swipe',
    description: 'Discover new people. Swipe right to like, left to skip, and start a connection.',
    accent: 'swipe',
  },
  {
    icon: 'magnifyingglass',
    title: 'Explore',
    description: 'Search for people, posts, and communities across Youngie.',
    accent: 'explore',
  },
  {
    icon: 'message.fill',
    title: 'Chat',
    description: 'Message your friends and start voice or video calls.',
    accent: 'chat',
  },
  {
    icon: 'bell',
    title: 'Notifications',
    description: 'Tap the bell to see likes, comments, new matches, and messages in one place.',
    accent: 'explore',
  },
  {
    icon: 'plus',
    title: 'Create a Post',
    description: 'Tap the + button to share a post, photo, or story with your followers.',
    accent: 'feed',
  },
  {
    icon: 'glasses',
    title: 'Anonymous Feed',
    description: 'Tap the glasses icon to browse posts anonymously without revealing your identity.',
    accent: 'video',
  },
  {
    icon: 'person.fill',
    title: 'Profile',
    description: 'Manage your posts, settings, and how others see you.',
    accent: 'profile',
  },
];

const ACCENT_COLORS: Record<HintStep['accent'], string> = {
  feed: '#007AFF',
  swipe: '#D72C67',
  explore: '#FF9500',
  chat: '#34C759',
  video: '#AF52DE',
  profile: '#5856D6',
};

export function FirstStartupHint() {
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const surfaceColor = useThemeColor('surface');
  const borderColor = useThemeColor('border');
  const white = useThemeColor('white');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { width } = useWindowDimensions();

  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ONBOARDING_SEEN_KEY)
      .then((seen) => {
        if (active && !seen) {
          // Small delay so the underlying screen renders first
          setTimeout(() => active && setVisible(true), 400);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const dismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    } catch {
      // Non-fatal: hint can simply re-show next launch
    }
  };

  const next = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      dismiss();
    }
  };

  const skip = () => {
    dismiss();
  };

  if (!visible) return null;

  const step = STEPS[stepIndex];
  const accent = ACCENT_COLORS[step.accent];
  const isLast = stepIndex === STEPS.length - 1;
  const dots = STEPS.map((_, i) => i);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: surfaceColor, borderColor, maxWidth: width - spacing.xxl }]}>
            <View style={[styles.iconWrap, { backgroundColor: accent + (isDark ? '33' : '1A') }]}>
              {step.icon === 'glasses' ? (
                <Ionicons name="glasses" size={40} color={accent} />
              ) : (
                <IconSymbol name={step.icon as any} size={40} color={accent} />
              )}
            </View>

            <Text style={[styles.title, { color: textColor }]}>{step.title}</Text>
            <Text style={[styles.description, { color: lightTextColor }]}>{step.description}</Text>

            <View style={styles.dots}>
              {dots.map((i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i === stepIndex ? accent : borderColor },
                    i === stepIndex && { width: 20 },
                  ]}
                />
              ))}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.skipButton, { borderColor }]}
                onPress={skip}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.skipText, { color: lightTextColor }]}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextButton, { backgroundColor: accent }, shadows.md]}
                onPress={next}
                activeOpacity={0.7}
              >
                <Text style={[styles.nextText, { color: white }]}>
                  {isLast ? 'Get Started' : 'Next'}
                </Text>
                {!isLast && <IconSymbol name="chevron.right" size={18} color={white} />}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.absoluteSkip}
            onPress={skip}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <IconSymbol name="x" size={22} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    width: '100%',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    ...shadows.xl,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.heading3,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.sizes.body2,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  skipButton: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
  },
  nextText: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
  },
  absoluteSkip: {
    marginTop: spacing.xl,
    padding: spacing.sm,
  },
});

export default FirstStartupHint;
