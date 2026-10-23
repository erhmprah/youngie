import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomAlert } from '@/utils/alert';
import { showFriendlySocketError } from '@/utils/socket-error';
import { SOCKET_URL } from '@/utils/api';
import { getICEServers } from '@/utils/externalServices';
import { useNavigation } from "expo-router/react-navigation";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, View, Text, TouchableOpacity, Platform, PermissionsAndroid } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import { Socket, io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import InCallManager from 'react-native-incall-manager';

const SOCKET_SERVER_URL = SOCKET_URL;

const VoiceChatScreen: React.FC = () => {
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [webRTCSupported, setWebRTCSupported] = useState(true);

  const peerConnection = useRef<any>(null);
  const socket = useRef<Socket | null>(null);
  const localStreamRef = useRef<any>(null);
  const remoteStreamRef = useRef<any>(null);
  const inCallManagerStarted = useRef(false);
  const navigation = useNavigation();

  const [webRTC, setWebRTC] = useState<any>(null);
  const matchedPeerIdRef = useRef<string | null>(null);
  const isChattingRef = useRef(isChatting);

  useEffect(() => {
    try {
      const WebRTC = require('react-native-webrtc');
      setWebRTC(WebRTC);
    } catch (e) {
      setWebRTCSupported(false);
    }
  }, []);

  const { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, RTCView } = webRTC || {};

  const requestAudioPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to your microphone for voice chat.',
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

  const startInCallManager = useCallback(() => {
    try {
      if (typeof InCallManager?.start === 'function') {
        InCallManager.start({ media: 'audio' });
        InCallManager.setKeepScreenOn(true);
        InCallManager.setForceSpeakerphoneOn(false);
        inCallManagerStarted.current = true;
      }
    } catch (e) {
      console.error('Error starting InCallManager:', e);
    }
  }, []);

  const stopInCallManager = useCallback(() => {
    try {
      if (inCallManagerStarted.current && typeof InCallManager?.stop === 'function') {
        InCallManager.stop();
        inCallManagerStarted.current = false;
      }
    } catch (e) {
      console.error('Error stopping InCallManager:', e);
    }
  }, []);

  const resetChat = useCallback(() => {
    matchedPeerIdRef.current = null;

    if (peerConnection.current) {
      try {
        peerConnection.current.close();
      } catch {}
      peerConnection.current = null;
    }

    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track: any) => track.stop());
      } catch {}
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
    setIsConnecting(false);
    setIsChatting(false);
    isChattingRef.current = false;
    stopInCallManager();
  }, [stopInCallManager]);

  const createPeerConnection = useCallback(async () => {
    const iceServers = await getICEServers();
    const pc = new RTCPeerConnection({
      iceServers,
    });

    pc.onicecandidate = (event: any) => {
      if (!event.candidate) return;
      if (!socket.current) return;

      const peerId = matchedPeerIdRef.current;
      if (!peerId) return;

      socket.current.emit('ice_candidate', event.candidate, peerId);
    };

    pc.ontrack = (event: any) => {
      const stream = event.streams?.[0];
      if (stream) {
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
        setIsChatting(true);
        isChattingRef.current = true;
        startInCallManager();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (!peerConnection.current) return;

      const state = peerConnection.current.iceConnectionState;
      if (state === 'disconnected' || state === 'failed') {
        if (isChattingRef.current) {
          CustomAlert.info('Chat Ended', 'Your peer has disconnected.');
          resetChat();
        }
      }
    };

    return pc;
  }, [resetChat, startInCallManager]);

  const initLocalStream = useCallback(async () => {
    try {
      if (!mediaDevices || !mediaDevices.getUserMedia) {
        throw new Error('WebRTC not supported. Please use a development build.');
      }

      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        CustomAlert.error('Permission Denied', 'Microphone permission is required for voice chat.');
        return null;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: true,
      });

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      CustomAlert.error('Error', 'Camera + microphone access is required. Please check your permissions.');
      navigation.goBack();
      return null;
    }
  }, [navigation]);

  const startVoiceChat = useCallback(async () => {
    setIsConnecting(true);
    resetChat();

    const stream = await initLocalStream();
    if (!stream) {
      setIsConnecting(false);
      return;
    }

    // Tear down any previous socket before creating another one, otherwise
    // each retry leaves a live connection and its handlers behind.
    if (socket.current) {
      socket.current.removeAllListeners();
      socket.current.disconnect();
      socket.current = null;
    }

    const s = io(SOCKET_SERVER_URL, {
      auth: async (cb) => {
        cb({ token: await AsyncStorage.getItem('authToken') });
      },
      // Allow the polling fallback so a proxy that drops the WebSocket Upgrade
      // header degrades instead of failing the connection outright.
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.current = s;

    // A socket replaced by a newer one must not touch screen state.
    const isCurrent = () => socket.current === s;

    s.on('connect', () => {
      if (!isCurrent()) return;
      s.emit('join_room');
    });

    s.on('connect_error', (error: any) => {
      if (!isCurrent()) return;
      showFriendlySocketError(error, 'voice');
      setIsConnecting(false);
      console.error('Socket connection error:', error?.message || error);
    });

    s.on('disconnect', (reason: any) => {
      if (!isCurrent()) return;
      if (isChattingRef.current) {
        showFriendlySocketError(reason, 'voice');
      }
      console.log('Socket disconnected:', reason);
      resetChat();
    });

    s.on('socket_error', (error: { message: string }) => {
      if (!isCurrent()) return;
      console.error('Socket error:', error?.message || error);
      showFriendlySocketError(error, 'voice');
    });

    s.on('match_found', async (data: { peerId: string; initiator: boolean }) => {
      if (!isCurrent()) return;
      try {
        const { peerId, initiator } = data;
        matchedPeerIdRef.current = peerId;

        setIsConnecting(false);
        setIsChatting(true);
        isChattingRef.current = true;

        peerConnection.current = await createPeerConnection();

        // Add local tracks (audio + video)
        stream.getTracks().forEach((track: any) => {
          peerConnection.current?.addTrack(track, stream);
        });

        if (initiator) {
          const offer = await peerConnection.current.createOffer();
          await peerConnection.current.setLocalDescription(offer);
          s.emit('offer', offer, peerId);
        }
      } catch (error) {
        console.error('Error in match_found:', error);
        CustomAlert.error('Connection Error', 'Failed to establish connection. Please try again.');
        resetChat();
      }
    });

    s.on('offer', async (offer: RTCSessionDescription, peerId: string) => {
      if (!isCurrent()) return;
      try {
        matchedPeerIdRef.current = peerId;

        if (peerConnection.current?.signalingState !== 'stable') return;

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        s.emit('answer', answer, peerId);
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    s.on('answer', async (answer: RTCSessionDescription, peerId: string) => {
      if (!isCurrent()) return;
      try {
        matchedPeerIdRef.current = peerId;

        if (peerConnection.current && !peerConnection.current.remoteDescription) {
          if (peerConnection.current.signalingState === 'have-local-offer') {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
          }
        }
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    s.on('ice_candidate', async (candidate: RTCIceCandidate, peerId: string) => {
      if (!isCurrent()) return;
      try {
        matchedPeerIdRef.current = peerId;
        await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    });

    s.on('peer_disconnected', () => {
      if (!isCurrent()) return;
      CustomAlert.info('Chat Ended', 'Your peer has disconnected.');
      resetChat();
    });

    s.on('reconnect', (attemptNumber: number) => {
      if (!isCurrent()) return;
      if (!isChattingRef.current) {
        s.emit('join_room');
      }
      console.log('Socket reconnected after', attemptNumber, 'attempts');
    });

    s.on('reconnect_failed', () => {
      if (!isCurrent()) return;
      console.error('Socket reconnection failed');
      showFriendlySocketError('reconnect_failed', 'voice');
      });
  }, [createPeerConnection, initLocalStream, resetChat]);

  const findNextPeer = useCallback(() => {
    resetChat();
    if (socket.current && socket.current.connected) {
      socket.current.emit('next_peer');
      setIsConnecting(true);
    } else {
      startVoiceChat();
    }
  }, [resetChat, startVoiceChat]);

  useEffect(() => {
    startVoiceChat();

    return () => {
      if (socket.current) {
        socket.current.removeAllListeners();
        socket.current.disconnect();
        socket.current = null;
      }
      resetChat();
    };
  }, [startVoiceChat, resetChat]);

  if (!webRTCSupported) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.title}>Video Chat</ThemedText>
        <ThemedText>WebRTC is not supported in this environment. Please use a development build.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Video Chat</ThemedText>

      {isConnecting && <ThemedText>Finding a peer...</ThemedText>}
      {!isChatting && !isConnecting && <ThemedText>Press "Next Peer" to begin.</ThemedText>}
      {isChatting && <ThemedText>Call in progress...</ThemedText>}

      <View style={styles.videosWrapper}>
        {localStream && RTCView ? (
          <View style={styles.localVideo}>
            <RTCView streamURL={localStream.toURL()} style={styles.localVideoView} objectFit="cover" />
          </View>
        ) : null}

        {remoteStream && RTCView ? (
          <View style={styles.remoteVideo}>
            <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideoView} objectFit="cover" />
          </View>
        ) : (
          <View style={styles.remoteVideoPlaceholder}>
            <ThemedText style={styles.placeholderText}>Waiting for remote video...</ThemedText>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <Button title="Next Peer" onPress={findNextPeer} disabled={isConnecting} />
        <Button title="End Chat" onPress={resetChat} />
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  videosWrapper: {
    flex: 1,
    width: '100%',
    marginVertical: 12,
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
  },
  remoteVideoView: {
    width: '100%',
    height: '100%',
  },
  remoteVideoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  placeholderText: {
    color: '#fff',
    opacity: 0.85,
  },
  localVideo: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 120,
    height: 160,
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  localVideoView: {
    width: '100%',
    height: '100%',
  },
  controls: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 10,
  },
});

export default VoiceChatScreen;

