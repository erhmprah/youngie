import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { typography } from '@/constants/design-tokens';

const BRAND = '#FF009D';

export default function AuthLoadingScreen() {
  const [spin] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const progressLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );

    spinLoop.start();
    pulseLoop.start();
    progressLoop.start();

    Animated.timing(enter, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
      progressLoop.stop();
    };
  }, [spin, pulse, progress, enter]);

  const ringRotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.35],
  });

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.55],
  });

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['8%', '100%'],
  });

  const enterScale = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });

  const enterFade = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#150221', '#120018', '#0A000E']}
        locations={[0, 0.5, 1]}
        style={styles.container}
      >
        <View style={styles.glowTop} pointerEvents="none">
          <LinearGradient colors={[`${BRAND}2E`, '#00000000']} style={styles.glowBlob} />
        </View>

        <View style={styles.content}>
          <Animated.View
            style={[
              styles.stage,
              { opacity: enterFade, transform: [{ scale: enterScale }] },
            ]}
          >
            <Animated.View
              style={[
                styles.glow,
                { opacity: glowOpacity, transform: [{ scale: glowScale }] },
              ]}
            />

            <Animated.View
              style={[styles.ring, { transform: [{ rotate: ringRotate }] }]}
            />

            <View style={styles.badge}>
              <Image
                source={require('@/assets/images/youngie_icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          <ThemedText style={styles.title}>Signing you in</ThemedText>

          <LinearGradient
            colors={['#FF009D', '#FF009D00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentBar}
          />

          <ThemedText style={styles.subtitle}>
            Verifying your session and getting things ready
          </ThemedText>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressBar, { width: barWidth, backgroundColor: BRAND }]}
            />
          </View>

          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={BRAND} />
            <ThemedText style={styles.statusText}>One moment…</ThemedText>
          </View>

          <View style={styles.trustRow}>
            <IconSymbol name="shield-check" size={14} color="#8E7E92" />
            <ThemedText style={styles.trustText}>
              Encrypted connection · Your data stays private
            </ThemedText>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A000E',
  },

  container: {
    flex: 1,
    backgroundColor: '#0A000E',
  },

  glowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 420,
    alignItems: 'center',
    overflow: 'hidden',
  },

  glowBlob: {
    width: 440,
    height: 440,
    borderRadius: 220,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 30,
  },

  stage: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  glow: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: BRAND,
  },

  ring: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 3,
    borderColor: '#FFFFFF12',
    borderTopColor: BRAND,
    borderRightColor: `${BRAND}55`,
  },

  badge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B0722',
    borderWidth: 1,
    borderColor: '#FFFFFF1F',
  },

  logo: {
    width: 74,
    height: 74,
  },

  title: {
    color: '#FFFFFF',
    fontFamily: typography.families.bold,
    fontSize: 28,
    letterSpacing: -0.8,
    textAlign: 'center',
  },

  accentBar: {
    width: 78,
    height: 3,
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 10,
  },

  subtitle: {
    color: '#B7A9BC',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 290,
  },

  progressTrack: {
    width: '100%',
    maxWidth: 240,
    height: 4,
    borderRadius: 2,
    marginTop: 30,
    backgroundColor: '#FFFFFF14',
    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',
    borderRadius: 2,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 18,
  },

  statusText: {
    color: '#AFA3B8',
    fontSize: 14,
  },

  trustRow: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  trustText: {
    color: '#8E7E92',
    fontSize: 12,
  },
});
