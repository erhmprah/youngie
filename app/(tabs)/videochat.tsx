import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Button, Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Socket, io } from 'socket.io-client';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { SOCKET_URL } from '@/utils/api'; // Import SOCKET_URL

const SOCKET_SERVER_URL = SOCKET_URL;

const VideoChatScreen: React.FC = () => {
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

  const { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, mediaDevices } = webRTC || {};

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // You might want to add TURN servers here for better NAT traversal
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
        video: {
          width: 640,
          height: 480,
          frameRate: 30,
          facingMode: 'user',
        },
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      Alert.alert('Error', (error as Error).message || 'Camera and microphone access is required for video chat.');
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

  const startVideoChat = useCallback(async () => {
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

    socket.current.on('match_found', async (peerId: string) => {
      console.log('Match found with peer:', peerId);
      setIsConnecting(false);
      setIsChatting(true);

      peerConnection.current = createPeerConnection();
      stream.getTracks().forEach(track => {
        peerConnection.current?.addTrack(track, stream);
      });

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.current?.emit('offer', offer, peerId);
    });

    socket.current.on('offer', async (offer: RTCSessionDescription, peerId: string) => {
      console.log('Received offer from:', peerId);
      peerConnection.current = createPeerConnection();
      stream.getTracks().forEach(track => {
        peerConnection.current?.addTrack(track, stream);
      });

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.current?.emit('answer', answer, peerId);
    });

    socket.current.on('answer', async (answer: RTCSessionDescription, peerId: string) => {
      console.log('Received answer from:', peerId);
      await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
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
      startVideoChat(); // Reconnect if socket is not active
    }
  }, [resetChat, startVideoChat]);

  useEffect(() => {
    startVideoChat();

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
      resetChat();
    };
  }, [startVideoChat, resetChat]);

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
      {!isChatting && !isConnecting && <ThemedText>Press "Start Chat" to begin.</ThemedText>}

      <View style={styles.videoContainer}>
        {localStream && RTCView && (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror={true}
          />
        )}
        {remoteStream && RTCView && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        )}
      </View>

      <View style={styles.controls}>
        <Button title="Next Peer" onPress={findNextPeer} disabled={isConnecting} />
        {/* Add more controls like mute/unmute, stop video etc. */}
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
  videoContainer: {
    width: '100%',
    height: 400,
    backgroundColor: '#000',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 20,
  },
  localVideo: {
    position: 'absolute',
    width: 100,
    height: 150,
    top: 10,
    right: 10,
    backgroundColor: '#333',
    zIndex: 1,
    borderRadius: 5,
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  controls: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
});

export default VideoChatScreen;