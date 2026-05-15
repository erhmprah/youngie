import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Button, Platform, Alert } from 'react-native';
import { CustomAlert } from '@/utils/alert';
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
        const peerId = peerConnection.current?.remoteDescription ? socket.current.id : null;
        if (peerId) {
          socket.current.emit('ice_candidate', event.candidate, peerId);
        }
      }
    };

    // @ts-ignore
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      setIsChatting(true);
    };

    // @ts-ignore
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        if (isChatting) {
          CustomAlert.info('Chat Ended', 'Your peer has disconnected.');
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
       console.log('Issue with microphone access, handling gracefully');
       CustomAlert.error('Error', 'Microphone access is required. Please check your permissions.');
       navigation.goBack();
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
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.current.on('connect', () => {
      console.log('Socket connected:', socket.current?.id);
      socket.current?.emit('join_room');
    });

    socket.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      CustomAlert.error('Connection Error', 'Failed to connect to the chat server. Please try again.');
      setIsConnecting(false);
    });

    socket.current.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (isChatting) {
        CustomAlert.error('Disconnected', 'Connection lost. Please try connecting again.');
      }
      resetChat();
    });

    socket.current.on('socket_error', (error: { message: string }) => {
      console.error('Socket error:', error.message);
      CustomAlert.error('Socket Error', error.message);
    });

    socket.current.on('match_found', async (data: { peerId: string; initiator: boolean }) => {
      try {
        const { peerId, initiator } = data;
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
       } catch (error) {
         console.error('Error in match_found:', error);
         CustomAlert.error('Connection Error', 'Failed to establish connection. Please try again.');
         resetChat();
       }
    });

    socket.current.on('offer', async (offer: RTCSessionDescription, peerId: string) => {
      try {
        if (peerConnection.current?.signalingState !== 'stable') {
          return;
        }
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
        if (peerConnection.current && !peerConnection.current.remoteDescription) {
          if (peerConnection.current.signalingState === 'have-local-offer') {
            try {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (e) {
              console.error('Error setting remote description:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    socket.current.on('ice_candidate', async (candidate: RTCIceCandidate, peerId: string) => {
      try {
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
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      if (!isChatting) {
        socket.current?.emit('join_room');
      }
    });

    socket.current.on('reconnect_attempt', (attemptNumber: number) => {
      console.log('Socket reconnection attempt:', attemptNumber);
    });

    socket.current.on('reconnect_error', (error: Error) => {
      console.error('Socket reconnection error:', error.message);
    });

    socket.current.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      CustomAlert.error('Connection Failed', 'Unable to reconnect to the server. Please restart the app.');
    });
  }, [initLocalStream, resetChat, createPeerConnection, isChatting]);

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