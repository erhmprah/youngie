import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Button, Platform, Alert, PermissionsAndroid, TouchableOpacity, ActivityIndicator, Dimensions, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import { Socket, io } from 'socket.io-client';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { SOCKET_URL, userAPI } from '@/utils/api'; // Import SOCKET_URL
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, shadows, typography } from '@/constants/design-tokens';

const VideoChatScreen: React.FC = () => {
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [chatDuration, setChatDuration] = useState(0);
  const [webRTCSupported, setWebRTCSupported] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const peerConnection = useRef<any>(null);
  const socket = useRef<Socket | null>(null);
  const navigation = useNavigation();
  const { user } = useAuth();

  const primaryColor = useThemeColor('primary');
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const errorColor = useThemeColor('error');
  const surfaceColor = useThemeColor('surface');

  const [webRTC, setWebRTC] = useState<any>(null);

  useEffect(() => {
    try {
      const WebRTC = require('react-native-webrtc');
      setWebRTC(WebRTC);
      setWebRTCSupported(true);
    } catch (e) {
      console.error('WebRTC not available:', e);
      setWebRTCSupported(false);
    }
  }, []);

  const { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, mediaDevices } = webRTC || {};

  // Handle tab focus/blur to manage resources
  useFocusEffect(
    useCallback(() => {
      checkPermissions();
      
      return () => {
        // Cleanup when switching tabs
        resetChat();
        if (socket.current) {
          socket.current.disconnect();
        }
      };
    }, [])
  );

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isChatting) {
      interval = setInterval(() => {
        setChatDuration(prev => prev + 1);
      }, 1000);
    } else {
      setChatDuration(0);
    }
    return () => clearInterval(interval);
  }, [isChatting]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const checkPermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const cameraPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to camera for video chat.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        const audioPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to microphone for video chat.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        setHasPermissions(
          cameraPermission === PermissionsAndroid.RESULTS.GRANTED &&
          audioPermission === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.error('Permission error:', err);
        setHasPermissions(false);
      }
    } else {
      // iOS permissions are handled in Info.plist
      setHasPermissions(true);
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    if (!RTCPeerConnection) {
      console.error('RTCPeerConnection not available');
      return null;
    }

    let pc;
    try {
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      });
    } catch (error) {
      console.error('Failed to create RTCPeerConnection:', error);
      return null;
    }

    // @ts-ignore
    pc.onicecandidate = (event) => {
      if (event.candidate && socket.current) {
        console.log('Sending ICE candidate');
        socket.current.emit('ice_candidate', event.candidate);
      }
    };

    // @ts-ignore
    pc.ontrack = (event) => {
      console.log('Remote track received');
      setRemoteStream(event.streams[0]);
      setIsChatting(true);
    };

    // @ts-ignore
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        if (isChatting) {
          Alert.alert('Chat Ended', 'Connection lost.');
          resetChat();
        }
      }
    };

    // @ts-ignore
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
    };

    return pc;
  }, [isChatting, RTCPeerConnection]);

  const initLocalStream = useCallback(async () => {
    if (!hasPermissions) {
      // Alert.alert('Permissions Required', 'Please grant camera and microphone permissions to use video chat.');
      return null;
    }

    try {
      if (!mediaDevices || !mediaDevices.getUserMedia) {
        throw new Error('WebRTC not supported. Please use a development build.');
      }

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user',
        },
      });
      
      console.log('Local stream obtained');
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      if ((error as Error).message.includes('development build')) {
        Alert.alert(
          'Development Build Required',
          'WebRTC requires a development build. Please run the app using a development build (npx expo run:android).',
          [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        Alert.alert('Error', (error as Error).message || 'Failed to access camera and microphone.');
      }
      return null;
    }
  }, [hasPermissions, mediaDevices, navigation]);

  const resetChat = useCallback(() => {
    if (peerConnection.current) {
      try {
        peerConnection.current.close();
      } catch (e) {
        console.error('Error closing peer connection:', e);
      }
      peerConnection.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track: any) => {
        try {
          track.stop();
        } catch (e) {
          console.error('Error stopping track:', e);
        }
      });
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnecting(false);
    setIsChatting(false);
    setIsMuted(false);
    setPeerId(null);
  }, [localStream]);

  const startVideoChat = useCallback(async () => {
    if (!webRTCSupported) {
      Alert.alert('WebRTC Not Available', 'Please ensure you are running a development build with react-native-webrtc installed.');
      return;
    }

    await checkPermissions();
    
    if (!hasPermissions) {
      Alert.alert('Permissions Required', 'Camera and microphone permissions are required for video chat.');
      return;
    }

    setIsConnecting(true);
    resetChat();

    const stream = await initLocalStream();
    if (!stream) {
      setIsConnecting(false);
      return;
    }

    try {
      socket.current = io(SOCKET_URL, {
        transports: ['websocket'],
        timeout: 10000,
      });

      socket.current.on('connect', () => {
        console.log('Socket connected:', socket.current?.id);
        socket.current?.emit('join_room');
      });

      socket.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        Alert.alert('Connection Error', 'Failed to connect to video chat server.');
        setIsConnecting(false);
      });

      socket.current.on('match_found', async (peerId: string) => {
        console.log('Match found with peer:', peerId);
        setIsConnecting(false);
        setPeerId(peerId);
        setIsChatting(true);

        peerConnection.current = createPeerConnection();
        if (!peerConnection.current) {
          Alert.alert('Error', 'Failed to create peer connection.');
          return;
        }

        stream.getTracks().forEach((track: MediaStreamTrack) => {
          try {
            peerConnection.current?.addTrack(track, stream);
          } catch (e) {
            console.error('Error adding track:', e);
          }
        });

        try {
          const offer = await peerConnection.current.createOffer();
          await peerConnection.current.setLocalDescription(offer);
          socket.current?.emit('offer', offer);
        } catch (e) {
          console.error('Error creating offer:', e);
        }
      });

      socket.current.on('offer', async (offer: any, remotePeerId?: string) => {
        console.log('Received offer');
        if (remotePeerId) setPeerId(remotePeerId);
        peerConnection.current = createPeerConnection();
        if (!peerConnection.current) return;

        stream.getTracks().forEach((track: MediaStreamTrack) => {
          try {
            peerConnection.current?.addTrack(track, stream);
          } catch (e) {
            console.error('Error adding track:', e);
          }
        });

        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socket.current?.emit('answer', answer);
        } catch (e) {
          console.error('Error handling offer:', e);
        }
      });

      socket.current.on('answer', async (answer: any) => {
        console.log('Received answer');
        try {
          await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (e) {
          console.error('Error setting remote description:', e);
        }
      });

      socket.current.on('ice_candidate', async (candidate: any) => {
        console.log('Received ICE candidate');
        try {
          await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      });

      socket.current.on('peer_disconnected', () => {
        console.log('Peer disconnected');
        Alert.alert('Chat Ended', 'Your peer has disconnected.');
        resetChat();
      });

      socket.current.on('disconnect', () => {
        console.log('Socket disconnected');
        resetChat();
      });

    } catch (error) {
      console.error('Error starting video chat:', error);
      Alert.alert('Error', 'Failed to start video chat.');
      setIsConnecting(false);
    }
  }, [webRTCSupported, hasPermissions, checkPermissions, resetChat, initLocalStream, createPeerConnection, RTCSessionDescription, RTCIceCandidate]);

  const handleReportUser = useCallback(() => {
    Alert.alert(
      'Report User',
      'Are you sure you want to report this user for inappropriate behavior?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Reported', 'User has been reported. Finding a new peer...');
            findNextPeer();
          },
        },
      ]
    );
  }, [findNextPeer]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!user?._id || !peerId) return;
    try {
      await userAPI.sendFriendRequest(user._id, peerId);
      Alert.alert('Success', 'Friend request sent!');
    } catch (error: any) {
      console.error('Friend request error:', error);
      Alert.alert('Error', error.response?.data?.msg || 'Failed to send friend request');
    }
  }, [user, peerId]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  const switchCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        // @ts-ignore
        videoTrack._switchCamera();
      }
    }
  }, [localStream]);

  const findNextPeer = useCallback(() => {
    resetChat();
    if (socket.current && socket.current.connected) {
      socket.current.emit('next_peer');
      setIsConnecting(true);
    } else {
      startVideoChat();
    }
  }, [resetChat, startVideoChat]);

  if (!webRTCSupported) {
    return (
      <ThemedView style={styles.centeredContainer}>
        <IconSymbol name="exclamationmark.triangle.fill" size={60} color="#FFD700" />
        <ThemedText type="heading2" style={{ marginTop: spacing.lg, textAlign: 'center' }}>Development Build Required</ThemedText>
        <ThemedText style={{ textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.xl, opacity: 0.7 }}>
          Video chat requires native WebRTC support which is not available in Expo Go. Please create a development build to test this feature.
        </ThemedText>
      </ThemedView>
    );
  }

  if (!hasPermissions) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.permissionContainer}>
          <IconSymbol name="camera.fill" size={60} color={primaryColor} />
          <ThemedText type="heading2" style={styles.permissionTitle}>Permissions Required</ThemedText>
          <ThemedText style={styles.permissionText}>
            We need access to your camera and microphone to connect you with others.
          </ThemedText>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: primaryColor }]} 
            onPress={checkPermissions}
          >
            <ThemedText style={styles.buttonText}>Grant Permissions</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.videoWrapper}>
        {remoteStream && RTCView && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.fullScreenVideo}
            objectFit="cover"
          />
        )}
        
        {/* Placeholder when no remote stream */}
        {!remoteStream && (
          <View style={[styles.placeholderContainer, { backgroundColor: surfaceColor }]}>
            {isConnecting ? (
              <View style={styles.connectingState}>
                <ActivityIndicator size="large" color={primaryColor} />
                <ThemedText style={styles.connectingText}>Finding a match...</ThemedText>
              </View>
            ) : (
              <View style={styles.idleState}>
                <IconSymbol name="video.fill" size={80} color={primaryColor} />
                <ThemedText type="heading2" style={styles.idleTitle}>Start Video Chat</ThemedText>
                <ThemedText style={styles.idleText}>Connect with random people instantly</ThemedText>
              </View>
            )}
          </View>
        )}

        {/* Timer Overlay */}
        {isChatting && (
          <View style={styles.timerContainer}>
            <View style={styles.timerBadge}>
              <IconSymbol name="clock.fill" size={14} color="white" />
              <ThemedText style={styles.timerText}>{formatTime(chatDuration)}</ThemedText>
            </View>
          </View>
        )}

        {/* Report Button */}
        {isChatting && (
          <TouchableOpacity style={styles.reportButton} onPress={handleReportUser}>
            <IconSymbol name="flag.fill" size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}

        {/* Mute Indicator Overlay */}
        {isMuted && localStream && (
          <View style={[styles.muteIndicator, { top: spacing.lg + 50 }]}>
            <IconSymbol name="mic.slash.fill" size={20} color="white" />
            <ThemedText style={styles.muteText}>Muted</ThemedText>
          </View>
        )}

        {/* Local Video Overlay */}
        {localStream && RTCView && (
          <View style={[styles.localVideoContainer, { borderColor: surfaceColor }]}>
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror={true}
            />
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {!isChatting && !isConnecting ? (
          <TouchableOpacity 
            style={[styles.startButton, { backgroundColor: primaryColor }]}
            onPress={startVideoChat}
          >
            <ThemedText style={styles.startButtonText}>Start Matching</ThemedText>
          </TouchableOpacity>
        ) : (
          <View style={styles.activeControls}>
            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: errorColor }]}
              onPress={resetChat}
            >
              <IconSymbol name="phone.down.fill" size={24} color="white" />
              <ThemedText style={styles.controlButtonText}>End</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: primaryColor }]}
              onPress={findNextPeer}
            >
              <ThemedText style={styles.controlButtonText}>Next</ThemedText>
              <IconSymbol name="chevron.right" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingState: {
    alignItems: 'center',
    gap: spacing.md,
  },
  connectingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.body1,
    opacity: 0.8,
  },
  idleState: {
    alignItems: 'center',
    gap: spacing.md,
  },
  idleTitle: {
    marginTop: spacing.md,
  },
  idleText: {
    opacity: 0.6,
  },
  localVideoContainer: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 100,
    height: 140,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    ...shadows.md,
  },
  localVideo: {
    flex: 1,
  },
  reportButton: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: spacing.sm,
    borderRadius: borderRadius.round,
    zIndex: 10,
  },
  muteIndicator: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: spacing.sm,
    borderRadius: borderRadius.round,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  muteText: {
    color: 'white',
    fontSize: typography.sizes.caption,
    fontFamily: typography.families.medium,
  },
  timerContainer: {
    position: 'absolute',
    top: spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    gap: spacing.xs,
  },
  timerText: {
    color: 'white',
    fontFamily: typography.families.medium,
    fontSize: typography.sizes.body2,
  },
  controlsContainer: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  startButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.round,
    alignItems: 'center',
    ...shadows.md,
  },
  startButtonText: {
    color: 'white',
    fontSize: typography.sizes.heading3,
    fontFamily: typography.families.bold,
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.round,
    gap: spacing.sm,
    ...shadows.sm,
  },
  controlButtonText: {
    color: 'white',
    fontSize: typography.sizes.body1,
    fontFamily: typography.families.bold,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  permissionTitle: {
    textAlign: 'center',
  },
  permissionText: {
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 24,
  },
  primaryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.round,
  },
  buttonText: {
    color: 'white',
    fontFamily: typography.families.bold,
  },
});

export default VideoChatScreen;