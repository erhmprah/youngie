
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSocket, joinChat, onVoiceCallEnd, offVoiceCallEnd } from '@/utils/socket';
import CallService from '@/utils/call-service';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getImageUrl } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, typography } from '@/constants/design-tokens';

export default function IncomingCallScreen() {
  const { offer, caller, chatId } = useLocalSearchParams();
  const router = useRouter();
  const socket = getSocket();
  const timeoutRef = useRef<number | null>(null);

  const parsedOffer = JSON.parse(offer as string);
  const parsedCaller = JSON.parse(caller as string);

  const primaryColor = useThemeColor('primary');
  const errorColor = useThemeColor('error');

  useEffect(() => {
    if (!chatId) return;
    joinChat(chatId as string);

    // Auto-decline after 60 seconds
    timeoutRef.current = setTimeout(() => {
      declineCall();
    }, 60000) as unknown as number;

    // Handle call ended by caller
    const handleCallEnd = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      router.back();
    };

    onVoiceCallEnd(handleCallEnd);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      offVoiceCallEnd();
    };
  }, [router, chatId]);

  const acceptCall = () => {
    CallService.cancelIncomingCall();
    router.replace({
      pathname: '/chat/voice-call',
      params: { 
        chatId: chatId as string, 
        name: parsedCaller.username,
        image: parsedCaller.profilePhoto,
        offer: offer as string, // Pass the offer to the call screen
      },
    });
  };

  const declineCall = () => {
    CallService.cancelIncomingCall();
    // Notify the caller that the call was declined
    socket?.emit('voice-call-end', { chatId });
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: primaryColor }]}>
      <View style={styles.callInfoContainer}>
        {parsedCaller.profilePhoto ? (
          <Image source={{ uri: getImageUrl(parsedCaller.profilePhoto) }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <IconSymbol name="person.fill" size={50} color="white" />
          </View>
        )}
        <Text style={styles.name}>{parsedCaller.username} is calling</Text>
        <Text style={styles.status}>Voice Call</Text>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.controlGroup}>
            <TouchableOpacity onPress={declineCall} style={[styles.controlButton, { backgroundColor: errorColor }]}>
                <IconSymbol name="phone.down.fill" size={32} color="white" />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>Decline</Text>
        </View>
        <View style={styles.controlGroup}>
            <TouchableOpacity onPress={acceptCall} style={[styles.controlButton, { backgroundColor: '#4cd964' }]}>
                <IconSymbol name="phone.fill" size={32} color="white" />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>Accept</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
  },
  callInfoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.lg,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  name: {
    fontSize: typography.sizes.heading2,
    fontFamily: typography.families.bold,
    color: 'white',
    marginBottom: spacing.md,
  },
  status: {
    fontSize: typography.sizes.body1,
    color: 'white',
    opacity: 0.8,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingBottom: spacing.lg,
  },
  controlGroup: {
      alignItems: 'center',
  },
  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: {
      color: 'white',
      marginTop: spacing.sm,
  }
});
