import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomAlert } from '@/utils/alert';
import { SOCKET_URL } from '@/utils/api';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, View } from 'react-native';
import { Socket, io } from 'socket.io-client';

const SOCKET_SERVER_URL = SOCKET_URL;

const VoiceChatScreen: React.FC = () => {
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [webRTCSupported, setWebRTCSupported] = useState(true);

  const peerConnection = useRef<any>(null);
  const socket = useRef<Socket | null>(null);
  const navigation = useNavigation();

  const [webRTC, setWebRTC] = useState<any>(null);
  const matchedPeerIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const WebRTC = require('react-native-webrtc');
      setWebRTC(WebRTC);
    } catch (e) {
      setWebRTCSupported(false);
    }
  }, []);

  const { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, RTCView } = webRTC || {};

  const resetChat = useCallback(() => {
    matchedPeerIdRef.current = null;

    if (peerConnection.current) {
      try {
        peerConnection.current.close();
      } catch {}
      peerConnection.current = null;
    }

    if (localStream) {
      try {
        localStream.getTracks().forEach((track: any) => track.stop());
      } catch {}
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIsConnecting(false);
    setIsChatting(false);
  }, [localStream]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: process.env.EXPO_PUBLIC_TURN_USERNAME || 'c8fc480759e47fc7056658ee', credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL || 'MV+OjmMOYoqgZ8YF' },
        { urls: 'turn:global.relay.metered.ca:443', username: process.env.EXPO_PUBLIC_TURN_USERNAME || 'c8fc480759e47fc7056658ee', credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL || 'MV+OjmMOYoqgZ8YF' },
        { urls: 'turn:global.relay.metered.ca:3478', username: process.env.EXPO_PUBLIC_TURN_USERNAME || 'c8fc480759e47fc7056658ee', credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL || 'MV+OjmMOYoqgZ8YF' },
      ],
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
        setRemoteStream(stream);
        setIsChatting(true);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (!peerConnection.current) return;

      const state = peerConnection.current.iceConnectionState;
      if (state === 'disconnected' || state === 'failed') {
        if (isChatting) {
          CustomAlert.info('Chat Ended', 'Your peer has disconnected.');
          resetChat();
        }
      }
    };

    return pc;
  }, [isChatting, resetChat]);

  const initLocalStream = useCallback(async () => {
    try {
      if (!mediaDevices || !mediaDevices.getUserMedia) {
        throw new Error('WebRTC not supported. Please use a development build.');
      }

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

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

    socket.current = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.current.on('connect', () => {
      socket.current?.emit('join_room');
    });

    socket.current.on('connect_error', (error: any) => {
      CustomAlert.error('Connection Error', 'Failed to connect to the chat server. Please try again.');
      setIsConnecting(false);
      console.error('Socket connection error:', error?.message || error);
    });

    socket.current.on('disconnect', (reason: any) => {
      if (isChatting) {
        CustomAlert.error('Disconnected', 'Connection lost. Please try connecting again.');
      }
      console.log('Socket disconnected:', reason);
      resetChat();
    });

    socket.current.on('socket_error', (error: { message: string }) => {
      console.error('Socket error:', error.message);
      CustomAlert.error('Socket Error', error.message);
    });

    socket.current.on('match_found', async (data: { peerId: string; initiator: boolean }) => {
      try {
        const { peerId, initiator } = data;
        matchedPeerIdRef.current = peerId;

        setIsConnecting(false);
        setIsChatting(true);

        peerConnection.current = createPeerConnection();

        // Add local tracks (audio + video)
        stream.getTracks().forEach((track: any) => {
          peerConnection.current?.addTrack(track, stream);
        });

        if (initiator) {
          const offer = await peerConnection.current.createOffer();
          await peerConnection.current.setLocalDescription(offer);
          socket.current?.emit('offer', offer, peerId);
        }
      } catch (error) {
        console.error('Error in match_found:', error);
        CustomAlert.error('Connection Error', 'Failed to establish connection. Please try again.');
        resetChat();
      }
    });

    socket.current.on('offer', async (offer: RTCSessionDescription, peerId: string) => {
      try {
        matchedPeerIdRef.current = peerId;

        if (peerConnection.current?.signalingState !== 'stable') return;

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.current?.emit('answer', answer, peerId);
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    socket.current.on('answer', async (answer: RTCSessionDescription, peerId: string) => {
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

    socket.current.on('ice_candidate', async (candidate: RTCIceCandidate, peerId: string) => {
      try {
        matchedPeerIdRef.current = peerId;
        await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    });

    socket.current.on('peer_disconnected', () => {
      CustomAlert.info('Chat Ended', 'Your peer has disconnected.');
      resetChat();
    });

    socket.current.on('reconnect', (attemptNumber: number) => {
      if (!isChatting) {
        socket.current?.emit('join_room');
      }
      console.log('Socket reconnected after', attemptNumber, 'attempts');
    });

    socket.current.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      CustomAlert.error('Connection Failed', 'Unable to reconnect to the server. Please restart the app.');
    });
  }, [createPeerConnection, initLocalStream, isChatting, resetChat]);

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
        socket.current.disconnect();
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

