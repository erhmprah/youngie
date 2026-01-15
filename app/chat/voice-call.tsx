import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';
import { getSocket, sendVoiceCallOffer, sendVoiceCallAnswer, sendVoiceCallIceCandidate, sendVoiceCallEnd, onVoiceCallAnswer, onVoiceCallIceCandidate, onVoiceCallEnd, offVoiceCallAnswer, offVoiceCallIceCandidate, offVoiceCallEnd } from '@/utils/socket';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getImageUrl } from '@/utils/api';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function VoiceCallScreen() {
  const { chatId, name, image, offer: offerString } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [callStatus, setCallStatus] = useState('Initializing...');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const socket = getSocket();

  const primaryColor = useThemeColor('primary');
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const errorColor = useThemeColor('error');

  useEffect(() => {
    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;

    const setupPeerConnection = async () => {
        const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(stream);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendVoiceCallIceCandidate(chatId as string, event.candidate);
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };
    };

    const handleCallStart = async () => {
        await setupPeerConnection();

        if (offerString) { // Receiver of the call
            setCallStatus('Connecting...');
            const offer = JSON.parse(offerString as string);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendVoiceCallAnswer(chatId as string, answer);
            setCallStatus('In call');

        } else { // Caller
            setCallStatus('Ringing...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            sendVoiceCallOffer(chatId as string, offer, {
                _id: user?._id,
                username: user?.username,
                profilePhoto: user?.profilePhoto
            });
        }
    };
    
    handleCallStart();

    const onIceCandidate = ({ candidate }: { candidate: any }) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
    };

    const onEnd = () => hangUp('ended');

    onVoiceCallIceCandidate(onIceCandidate);
    onVoiceCallEnd(onEnd);

    if (!offerString) { // Only caller listens for answers
        const onAnswer = async ({ answer }: { answer: any }) => {
            if (pc.signalingState !== 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                setCallStatus('In call');
            }
        };
        onVoiceCallAnswer(onAnswer);
    }

    return () => {
      offVoiceCallAnswer();
      offVoiceCallIceCandidate();
      offVoiceCallEnd();

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop());
      }
    };
  }, []);

  const hangUp = (status = 'ended') => {
    setCallStatus(`Call ${status}`);
    
    if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop());
    }
    if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
    }
    
    setLocalStream(null);
    setRemoteStream(null);

    if (status !== 'ended') { // Avoid sending end event if call was ended by other party
        sendVoiceCallEnd(chatId as string);
    }

    if(router.canGoBack()) {
        router.back();
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  };

  const toggleSpeaker = () => {
    setIsSpeaker(!isSpeaker);
    // This requires platform-specific implementation, e.g., using InCallManager for React Native.
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: primaryColor }]}>
      <ThemedView style={styles.callInfoContainer}>
        {image && <Image source={{ uri: getImageUrl(image as string) }} style={styles.avatar} />}
        <ThemedText type="title" style={styles.name}>{name}</ThemedText>
        <ThemedText style={styles.status}>{callStatus}</ThemedText>
      </ThemedView>

      <View style={styles.controlsContainer}>
        <TouchableOpacity onPress={toggleMute} style={[styles.controlButton, { backgroundColor: isMuted ? errorColor : '#ffffff44' }]}>
          <IconSymbol name={isMuted ? "mic.slash.fill" : "mic.fill"} size={32} color={textColor} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => hangUp('declined')} style={[styles.controlButton, { backgroundColor: errorColor }]}>
          <IconSymbol name="phone.down.fill" size={32} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleSpeaker} style={[styles.controlButton, { backgroundColor: '#ffffff44' }]}>
          <IconSymbol name={isSpeaker ? "speaker.wave.2.fill" : "speaker.fill"} size={32} color={textColor} />
        </TouchableOpacity>
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
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.lg,
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
  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
});