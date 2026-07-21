import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, NativeModules, Platform, PermissionsAndroid } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';
import { Audio } from 'expo-av';
import { getSocket, joinChat, sendVoiceCallOffer, sendVoiceCallAnswer, sendVoiceCallIceCandidate, sendVoiceCallEnd, sendCallLog, onVoiceCallAnswer, onVoiceCallIceCandidate, onVoiceCallEnd, offVoiceCallAnswer, offVoiceCallIceCandidate, offVoiceCallEnd } from '@/utils/socket';
import InCallManager from 'react-native-incall-manager';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getImageUrl, chatAPI } from '@/utils/api';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import CallService from '@/utils/call-service';

export default function VoiceCallScreen() {
  const { chatId, name, image, offer: offerString } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<any>(null);
  const [callStatus, setCallStatus] = useState('Initializing...');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const socket = getSocket();
  const answerProcessedRef = useRef(false);
  const callTimeoutRef = useRef<number | null>(null);
  const inCallManagerStarted = useRef(false);
  const callConnectedRef = useRef(false);
  const callDurationRef = useRef(0);
  const callLogSentRef = useRef(false);

  const primaryColor = useThemeColor('primary');
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const errorColor = useThemeColor('error');

  useEffect(() => {
    let durationInterval: ReturnType<typeof setInterval> | null = null;
    if (callStatus === 'In call') {
      durationInterval = setInterval(() => {
        setCallDuration(prevDuration => {
          const next = prevDuration + 1;
          callDurationRef.current = next;
          return next;
        });
      }, 1000);
    }
    return () => {
      if (durationInterval) {
        clearInterval(durationInterval);
      }
    };
  }, [callStatus]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const requestAudioPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to your microphone for voice calls.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (error) {
        console.error('Failed to request audio permission:', error);
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    const handleCallStart = async () => {
        try {
            if (NativeModules.InCallManager && InCallManager && typeof InCallManager.start === 'function') {
                InCallManager.start({ media: 'audio' });
                InCallManager.setKeepScreenOn(true);
                InCallManager.setForceSpeakerphoneOn(false);
                inCallManagerStarted.current = true;
            } else {
            }
        } catch (error) {
        }

        try {
            // Fetch TURN credentials dynamically
            let iceServers = [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ];

            try {
                const response = await chatAPI.getTurnCredentials();
                if (response.data) iceServers = response.data;
            } catch (error) {
                console.warn('Failed to fetch TURN credentials, using defaults:', error);
            }

            if (!RTCPeerConnection || !mediaDevices) {
                Alert.alert("Feature Unavailable", "Voice calls require a Development Build and cannot run in Expo Go.");
                return;
            }

            const hasPermission = await requestAudioPermission();
            if (!hasPermission) {
              Alert.alert('Permission Denied', 'Microphone permission is required for voice calls.');
              hangUp('failed');
              return;
            }

            await Audio.setAudioModeAsync({
              allowsRecordingIOS: true,
              playsInSilentModeIOS: true,
              shouldDuckAndroid: true,
              playThroughEarpieceAndroid: false,
              staysActiveInBackground: true,
            });

            const pc = new RTCPeerConnection({ iceServers });
            pcRef.current = pc;

            const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            setLocalStream(stream);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            // @ts-ignore
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    sendVoiceCallIceCandidate(chatId as string, event.candidate);
                }
            };

            // @ts-ignore
            pc.ontrack = (event) => {
                setRemoteStream(event.streams[0]);
            };

            joinChat(chatId as string);

            if (offerString) { // Receiver of the call
                setCallStatus('Connecting...');
                const offer = JSON.parse(offerString as string);
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                 sendVoiceCallAnswer(chatId as string, answer);
                 callConnectedRef.current = true;
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

                 // Set timeout for missed call
                callTimeoutRef.current = setTimeout(async () => {
                    if (callStatus === 'Ringing...') {
                        hangUp('missed');
                    }
                }, 60000);
            }
        } catch (error) {
            console.error('Failed to start call:', error);
            Alert.alert('Error', 'Failed to access microphone or start call.');
            hangUp('failed');
        }
    };
    
    handleCallStart();

    const onIceCandidate = ({ candidate }: { candidate: any }) => {
        if (pcRef.current) {
            pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
    };

    const onEnd = () => hangUp('ended');

    onVoiceCallIceCandidate(onIceCandidate);
    onVoiceCallEnd(onEnd);

    if (!offerString) { // Only caller listens for answers
        const onAnswer = async ({ answer }: { answer: any }) => {
            if (pcRef.current && pcRef.current.signalingState === 'have-local-offer' && !answerProcessedRef.current) {
                answerProcessedRef.current = true;
                if (callTimeoutRef.current) {
                    clearTimeout(callTimeoutRef.current);
                    callTimeoutRef.current = null;
                }
                try {
                 await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                 callConnectedRef.current = true;
                 setCallStatus('In call');
                } catch (error) {
                }
            }
        };
        onVoiceCallAnswer(onAnswer);
    }

    return () => {
      offVoiceCallAnswer();
      offVoiceCallIceCandidate();
      offVoiceCallEnd();

      try {
        if (InCallManager && inCallManagerStarted.current) {
          InCallManager.stop();
          inCallManagerStarted.current = false;
        }
      } catch (error) {
          console.error("InCallManager error on stop:", error);
      }

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track: any) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, []);

  const hangUp = (status = 'ended') => {
    setCallStatus(`Call ${status}`);

    if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
    }

    // Log the call in the chat thread (only the caller is the source of truth,
    // and only once). Skip on a real connection failure.
    if (!offerString && !callLogSentRef.current && status !== 'failed') {
      callLogSentRef.current = true;
      let callStatusValue: 'missed' | 'declined' | 'completed' | 'cancelled';
      if (callConnectedRef.current) {
        callStatusValue = 'completed';
      } else if (status === 'missed') {
        callStatusValue = 'missed';
      } else if (status === 'cancelled') {
        callStatusValue = 'cancelled';
      } else {
        callStatusValue = 'declined';
      }
      sendCallLog(chatId as string, {
        callerId: user?._id || '',
        callType: 'voice',
        callStatus: callStatusValue,
        callDuration: callDurationRef.current,
      });
    }

    if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track: any) => track.stop());
    }

    if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
    }

    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track: any) => track.stop());
        localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);

    if (status !== 'ended') { // Avoid sending end event if call was ended by other party
        sendVoiceCallEnd(chatId as string);
    }

    CallService.onEndCall({ callUUID: CallService.currentCallId });

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
    const newSpeakerState = !isSpeaker;
    setIsSpeaker(newSpeakerState);
    try {
      if (NativeModules.InCallManager && InCallManager && typeof InCallManager.setSpeakerphoneOn === 'function') {
        InCallManager.setSpeakerphoneOn(newSpeakerState);
        InCallManager.setForceSpeakerphoneOn(newSpeakerState);
      }
    } catch (error) {
        console.error("InCallManager error on speaker toggle:", error);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: primaryColor }]}>
      <ThemedView style={styles.callInfoContainer}>
        {image && <Image source={{ uri: getImageUrl(image as string) }} style={styles.avatar} />}
        <ThemedText type="title" style={styles.name}>{name}</ThemedText>
        <ThemedText style={styles.status}>
          {callStatus === 'In call' ? formatDuration(callDuration) : callStatus}
        </ThemedText>
      </ThemedView>

      <View style={styles.controlsContainer}>
        <TouchableOpacity onPress={toggleMute} style={[styles.controlButton, { backgroundColor: isMuted ? errorColor : '#ffffff44' }]}>
          <IconSymbol name={isMuted ? "mic.slash.fill" : "mic.fill"} size={32} color={textColor} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => hangUp('cancelled')} style={[styles.controlButton, { backgroundColor: errorColor }]}>
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