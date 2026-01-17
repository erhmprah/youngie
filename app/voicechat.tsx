import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Button, Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Socket, io } from 'socket.io-client';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { SOCKET_URL } from '@/utils/api'; // Import SOCKET_URL

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

  useEffect(() => {
    try {
      const WebRTC = require('react-native-webrtc');
      setWebRTC(WebRTC);
    } catch (e) {
      setWebRTCSupported(false);
    }
  }, []);

  const { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices } = webRTC || {};

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // TURN servers are required for connectivity behind symmetric NATs or firewalls.
        // {
        //   urls: 'turn:your-turn-server.com:3478',
        //   username: 'your-username',
        //   credential: 'your-password',
        // },
      ],
    });

    // @ts-ignore
    pc.onicecandidate = (event) => {
      if (event.candidate && socket.current) {
        const peerId = peerConnection.current?.remoteDescription ? socket.current.id : null; // Simplified, adjust as needed
        if (peerId) {
          console.log('Sending ICE candidate to peer:', peerId);
          socket.current.emit('ice_candidate', event.candidate, peerId);
        }
      }
    };

    // @ts-ignore
    pc.ontrack = (event) => {
      console.log('Remote track received:', event.streams[0]);
      setRemoteStream(event.streams[0]);
      setIsChatting(true);
    };

    // @ts-ignore
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state change:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        if (isChatting) {
          Alert.alert('Chat Ended', 'Your peer has disconnected.');
          resetChat();
        }
      }
    };

    return pc;
  }, [isChatting]);

  const initLocalStream = useCallback(async () => {
    try {
      if (!mediaDevices || !mediaDevices.getUserMedia) {
        throw new Error('WebRTC not supported. Please use a development build.');
      }
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      Alert.alert('Error', (error as Error).message || 'Microphone access is required for voice chat.');
      navigation.goBack(); // Navigate back if permissions are denied
      return null;
    }
  }, [navigation]);

  const resetChat = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track: any) => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnecting(false);
    setIsChatting(false);
  }, [localStream]);

  const startVoiceChat = useCallback(async () => {
    setIsConnecting(true);
    resetChat(); // Ensure clean state
    const stream = await initLocalStream();
    if (!stream) {
      setIsConnecting(false);
      return;
    }

    socket.current = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
    });

    socket.current.on('connect', () => {
      console.log('Socket connected:', socket.current?.id);
      socket.current?.emit('join_room');
    });

    socket.current.on('match_found', async (data: { peerId: string; initiator: boolean }) => {
      const { peerId, initiator } = data;
      console.log('Match found with peer:', peerId, 'initiator:', initiator);
      setIsConnecting(false);
      setIsChatting(true);

      peerConnection.current = createPeerConnection();
      stream.getTracks().forEach((track: MediaStreamTrack) => {
        peerConnection.current?.addTrack(track, stream);
      });

      if (initiator) {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.current?.emit('offer', offer, peerId);
      }
    });

    socket.current.on('offer', async (offer: RTCSessionDescription, peerId: string) => {
      console.log('Received offer from:', peerId);
      if (peerConnection.current?.signalingState !== 'stable') {
        console.warn('Ignoring offer: signaling state is', peerConnection.current?.signalingState);
        return;
      }
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.current?.emit('answer', answer, peerId);
    });

    socket.current.on('answer', async (answer: RTCSessionDescription, peerId: string) => {
      console.log('Received answer from:', peerId);
      if (peerConnection.current && !peerConnection.current.remoteDescription) {
        if (peerConnection.current.signalingState === 'have-local-offer') {
          try {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
          } catch (e) {
            console.error('Error setting remote description:', e);
          }
        } else {
          console.warn('Ignoring answer: signaling state is', peerConnection.current.signalingState);
        }
      } else if (peerConnection.current?.remoteDescription) {
        console.warn('Ignoring answer: remote description already set.');
      } else {
        console.warn('Ignoring answer: no peer connection.');
      }
    });

    socket.current.on('ice_candidate', async (candidate: RTCIceCandidate, peerId: string) => {
      console.log('Received ICE candidate from:', peerId);
      try {
        await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE candidate', e);
      }
    });

    socket.current.on('peer_disconnected', () => {
      console.log('Peer disconnected.');
      Alert.alert('Chat Ended', 'Your peer has disconnected.');
      resetChat();
    });

    socket.current.on('disconnect', () => {
      console.log('Socket disconnected.');
      resetChat();
    });
  }, [initLocalStream, resetChat, createPeerConnection]);

  const findNextPeer = useCallback(() => {
    resetChat();
    if (socket.current && socket.current.connected) {
      socket.current.emit('next_peer');
      setIsConnecting(true);
    } else {
      startVoiceChat(); // Reconnect if socket is not active
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
        <ThemedText style={styles.title}>Voice Chat</ThemedText>
        <ThemedText>WebRTC is not supported in this environment. Please use a development build.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Voice Chat</ThemedText>
      {isConnecting && <ThemedText>Finding a peer...</ThemedText>}
      {!isChatting && !isConnecting && <ThemedText>Press "Start Chat" to begin.</ThemedText>}
      {isChatting && <ThemedText>Voice chat in progress...</ThemedText>}

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
    marginBottom: 20,
  },
  controls: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
});

export default VoiceChatScreen;