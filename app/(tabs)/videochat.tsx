import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Platform, Alert } from 'react-native';
import { CustomAlert } from '@/utils/alert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { SOCKET_URL } from '@/utils/api';
import { useCustomAlert } from '@/utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, shadows, typography } from '@/constants/design-tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as KeepAwake from 'expo-keep-awake';

type Message = {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
};

const VideoChatScreen: React.FC = () => {
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [isRemoteVideoPaused, setIsRemoteVideoPaused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isChatVisibleRef = useRef(isChatVisible);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [chatDuration, setChatDuration] = useState(0);
  const [webRTCSupported, setWebRTCSupported] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const peerConnection = useRef<any>(null);
  const peerIdRef = useRef<string | null>(null);
  const socket = useRef<Socket | null>(null);
  const localStreamRef = useRef<any>(null);
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
      setWebRTCSupported(false);
    }
  }, []);

  useEffect(() => {
    isChatVisibleRef.current = isChatVisible;
    if (isChatVisible) {
      setUnreadCount(0);
    }
  }, [isChatVisible]);

  useEffect(() => {
    peerIdRef.current = peerId;
  }, [peerId]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

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
        KeepAwake.deactivateKeepAwake().catch(() => {});
      };
    }, [checkPermissions, resetChat])
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
        setHasPermissions(false);
      }
    } else {
      // iOS permissions are handled in Info.plist
      setHasPermissions(true);
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    if (!RTCPeerConnection) {
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
      return null;
    }

    // @ts-ignore
    pc.onicecandidate = (event) => {
      if (event.candidate && socket.current && peerIdRef.current) {
        socket.current.emit('ice_candidate', event.candidate, peerIdRef.current);
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
           CustomAlert.info('Chat Ended', 'Connection lost.');
          resetChat();
        }
      }
    };

    // @ts-ignore
    pc.onconnectionstatechange = () => {
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
      
       setLocalStream(stream);
       return stream;
     } catch (error) {
       if ((error as Error).message.includes('development build')) {
         CustomAlert.show({
           type: 'error',
           title: 'Development Build Required',
           message: 'WebRTC requires a development build. Please run the app using a development build (npx expo run:android).',
           buttons: [{ text: 'OK', onPress: () => navigation.goBack(), style: 'cancel' }],
           dismissable: false
         });
       } else {
         CustomAlert.error('Error', (error as Error).message || 'Failed to access camera and microphone.');
       }
       return null;
     }
  }, [hasPermissions, mediaDevices, navigation]);

  const resetChat = useCallback((keepLocalStream = false) => {
    // Notify peer before cleaning up
    if (peerId && socket.current?.connected) {
      socket.current.emit('peer_disconnected', peerId);
    }
    
    if (peerConnection.current) {
      try {
        peerConnection.current.close();
      } catch (e) {
      }
      peerConnection.current = null;
    }

    if (!keepLocalStream && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: any) => {
        try {
          track.stop();
        } catch (e) {
        }
      });
      setLocalStream(null);
    } else if (keepLocalStream && localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = true;

      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = true;
    }
    setRemoteStream(null);
    setIsConnecting(false);
    setIsChatting(false);
    setIsMuted(false);
    setIsVideoPaused(false);
    setIsRemoteVideoPaused(false);
    setMessages([]);
    setIsChatVisible(false);
    setInputText('');
    setUnreadCount(0);
    setPeerId(null);
    KeepAwake.deactivateKeepAwake().catch(() => {});
  }, []);

   const startVideoChat = useCallback(async () => {
     if (!webRTCSupported) {
       CustomAlert.error('WebRTC Not Available', 'Please ensure you are running a development build with react-native-webrtc installed.');
       return;
     }

     await checkPermissions();

     if (!hasPermissions) {
       CustomAlert.warning('Permissions Required', 'Camera and microphone permissions are required for video chat.');
       return;
     }

    resetChat();
    setIsConnecting(true);

    const stream = await initLocalStream();
    if (!stream) {
      setIsConnecting(false);
      return;
    }

    try {
      socket.current = io(SOCKET_URL, {
        transports: ['websocket'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket.current.on('connect', () => {
        console.log('Video chat socket connected:', socket.current?.id);
        socket.current?.emit('join_room');
      });

      socket.current.on('error', (error) => {
        console.error('Video chat socket error:', error.message || error);
        CustomAlert.error('Connection Error', 'A socket error occurred. Please try again.');
        setIsConnecting(false);
        resetChat();
      });

      socket.current.on('connect_error', (error) => {
        console.error('Video chat socket connection error:', error.message);
        // Don't show alert immediately - let reconnection attempts happen first
        if (socket.current && !socket.current.connected) {
          setTimeout(() => {
            if (!socket.current?.connected) {
              CustomAlert.error('Connection Error', 'Failed to connect. Please check your internet connection and try again.');
              setIsConnecting(false);
            }
          }, 15000); // Wait 15 seconds before showing error to allow reconnection attempts
        }
      });

      socket.current.on('timeout', () => {
        console.log('Video chat socket connection timed out');
        CustomAlert.error('Connection Timeout', 'The connection timed out. Please try again.');
        setIsConnecting(false);
      });

      socket.current.on('close', () => {
        console.log('Video chat socket closed');
        if (isChatting || isConnecting) {
          CustomAlert.error('Connection Closed', 'The connection was closed unexpectedly.');
          resetChat();
        }
      });

      socket.current.on('disconnect', (reason) => {
        console.log('Video chat socket disconnected:', reason);
        if (isChatting || isConnecting) {
          CustomAlert.error('Disconnected', 'Connection lost. Please try connecting again.');
        }
        resetChat();
      });

      socket.current.on('reconnect', (attemptNumber) => {
        console.log('Video chat socket reconnected after', attemptNumber, 'attempts');
        if (!isChatting) {
          socket.current?.emit('join_room');
        }
      });

      socket.current.on('reconnect_attempt', (attemptNumber) => {
        console.log('Video chat socket reconnection attempt:', attemptNumber);
      });

      socket.current.on('reconnect_failed', () => {
        console.error('Video chat socket reconnection failed');
        CustomAlert.error('Connection Failed', 'Unable to reconnect to the server. Please restart the app.');
      });

      socket.current.on('match_found', async (data: { peerId: string; initiator: boolean }) => {
        const { peerId, initiator } = data;
        if (peerConnection.current) {
          return;
        }

        // Slide in animation for new peer
        pan.setValue({ x: Dimensions.get('window').width, y: 0 });
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }).start();

        setIsConnecting(false);
        setPeerId(peerId);
        setIsChatting(true);
        KeepAwake.activateKeepAwake().catch(() => {});

         if (initiator) {
           peerConnection.current = createPeerConnection();
           if (!peerConnection.current) {
             CustomAlert.error('Error', 'Failed to create peer connection.');
             return;
           }

          stream.getTracks().forEach((track: any) => {
            try {
              peerConnection.current?.addTrack(track, stream);
            } catch (e) {
            }
          });

          try {
            const offer = await peerConnection.current.createOffer();
            await peerConnection.current.setLocalDescription(offer);
            socket.current?.emit('offer', offer, peerId);
          } catch (e) {
          }
        }
      });

      socket.current.on('offer', async (offer: any, remotePeerId?: string) => {
        try {
          if (remotePeerId) setPeerId(remotePeerId);
          
          // Update UI state when offer is received - peer is found but still connecting
          setIsConnecting(false);
          setIsChatting(true);
          KeepAwake.activateKeepAwake().catch(() => {});
          
          if (!peerConnection.current || peerConnection.current.signalingState !== 'stable') {
            peerConnection.current = createPeerConnection();
            if (!peerConnection.current) return;

            stream.getTracks().forEach((track: MediaStreamTrack) => {
              try {
                peerConnection.current?.addTrack(track, stream);
              } catch (e) {
                console.error('Error adding track in offer:', e);
              }
            });
          }

          try {
            if (peerConnection.current.signalingState !== 'stable') {
              return;
            }
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            socket.current?.emit('answer', answer, remotePeerId || peerIdRef.current);
          } catch (e) {
            console.error('Error handling offer:', e);
          }
        } catch (error) {
          console.error('Error in offer handler:', error);
        }
      });

      socket.current.on('answer', async (answer: any) => {
        try {
          if (peerConnection.current && !peerConnection.current.remoteDescription) {
            try {
              if (peerConnection.current.signalingState === 'have-local-offer' ||
                  (peerConnection.current.signalingState === 'stable' && !peerConnection.current.remoteDescription)) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
              }
            } catch (e) {
              console.error('Error setting remote description:', e);
            }
          }
        } catch (error) {
          console.error('Error in answer handler:', error);
        }
      });

      socket.current.on('ice_candidate', async (candidate: any) => {
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

      socket.current.on('socket_error', (error: { message: string }) => {
        console.error('Video chat socket error:', error.message);
        CustomAlert.error('Socket Error', error.message);
      });

      socket.current.on('video_status_change', (data: { isPaused: boolean }) => {
        setIsRemoteVideoPaused(data.isPaused);
      });

      socket.current.on('receive_message', (data: { message: string }) => {
        setMessages(prev => [...prev, {
          id: Date.now().toString() + Math.random(),
          text: data.message,
          sender: 'them',
          timestamp: Date.now(),
        }]);

        if (!isChatVisibleRef.current) {
          setUnreadCount(prev => prev + 1);
        }
      });

     } catch (error) {
       CustomAlert.error('Error', 'Failed to start video chat.');
       setIsConnecting(false);
     }
  }, [webRTCSupported, hasPermissions, checkPermissions, resetChat, initLocalStream, createPeerConnection, RTCSessionDescription, RTCIceCandidate]);

  const handleReportUser = useCallback(() => {
    CustomAlert.confirm(
      'Report User',
      'Are you sure you want to report this user for inappropriate behavior?',
      () => {
        CustomAlert.success('Reported', 'User has been reported. Finding a new peer...');
        findNextPeer();
      }
    );
  }, [findNextPeer]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!user?._id || !peerId) return;
    try {
      await userAPI.sendFriendRequest(user._id, peerId);
      CustomAlert.success('Success', 'Friend request sent!');
    } catch (error: any) {
      CustomAlert.error('Error', 'Something went wrong. Please try again.');
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

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoPaused(!videoTrack.enabled);
        socket.current?.emit('video_status_change', { isPaused: !videoTrack.enabled });
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

  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !socket.current) return;
    
    const text = inputText.trim();
    socket.current.emit('send_message', { message: text });
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text,
      sender: 'me',
      timestamp: Date.now(),
    }]);
    setInputText('');
  }, [inputText]);

  const findNextPeer = useCallback(() => {
    resetChat(true);
    if (socket.current && socket.current.connected) {
      socket.current.emit('next_peer');
      setIsConnecting(true);
    } else {
      startVideoChat();
    }
  }, [resetChat, startVideoChat]);

  const pan = useRef(new Animated.ValueXY()).current;

  // Refs for PanResponder to access latest state
  const findNextPeerRef = useRef(findNextPeer);
  useEffect(() => {
    findNextPeerRef.current = findNextPeer;
  }, [findNextPeer]);

  const isChattingRef = useRef(isChatting);
  useEffect(() => {
    isChattingRef.current = isChatting;
  }, [isChatting]);

  const isConnectingRef = useRef(isConnecting);
  useEffect(() => {
    isConnectingRef.current = isConnecting;
  }, [isConnecting]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isActive = isChattingRef.current || isConnectingRef.current;
        return isActive && Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value
        });
      },
      onPanResponderMove: (_, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: 0 });
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        if (gestureState.dx < -100) { // Swipe Left
          Animated.timing(pan, {
            toValue: { x: -Dimensions.get('window').width, y: 0 },
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            findNextPeerRef.current();
            pan.setValue({ x: 0, y: 0 });
          });
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

   useEffect(() => {
     let timeout: NodeJS.Timeout;
     if (isConnecting) {
       timeout = setTimeout(() => {
         CustomAlert.warning('Timeout', 'No match found. Please try again.');
         resetChat();
       }, 30000);
     }
     return () => clearTimeout(timeout);
   }, [isConnecting, resetChat]);

  if (!webRTCSupported) {
    return (
      <ThemedView style={styles.centeredContainer}>
        <Ionicons name="warning" size={60} color="#FFD700" />
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
          <Ionicons name="camera" size={60} color={primaryColor} />
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
        <Animated.View 
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: pan.x }] }]}
          {...panResponder.panHandlers}
        >
        {remoteStream && RTCView && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.fullScreenVideo}
            objectFit="cover"
          />
        )}

        {remoteStream && isRemoteVideoPaused && (
          <View style={styles.remotePausedOverlay}>
            <Ionicons name="videocam-off" size={50} color="white" />
            <ThemedText style={styles.remotePausedText}>Video Paused</ThemedText>
          </View>
        )}
        
        {/* Placeholder when no remote stream */}
        {!remoteStream && (
          <View style={[styles.placeholderContainer, { backgroundColor: surfaceColor }]}>
            {isConnecting || isChatting ? (
              <View style={styles.connectingState}>
                <ActivityIndicator size="large" color={primaryColor} />
                <ThemedText style={styles.connectingText}>
                  {isChatting ? 'Connecting to peer...' : 'Finding a match...'}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.idleState}>
                <Ionicons name="videocam" size={80} color={primaryColor} />
                <ThemedText type="heading2" style={styles.idleTitle}>Start Video Chat</ThemedText>
                <ThemedText style={styles.idleText}>Connect with random people instantly</ThemedText>
              </View>
            )}
          </View>
        )}
        </Animated.View>

        {/* Timer Overlay */}
        {isChatting && (
          <View style={styles.timerContainer}>
            <View style={styles.timerBadge}>
              <Ionicons name="time" size={14} color="white" />
              <ThemedText style={styles.timerText}>{formatTime(chatDuration)}</ThemedText>
            </View>
          </View>
        )}

        {/* Report Button */}
        {isChatting && (
          <TouchableOpacity style={styles.reportButton} onPress={handleReportUser}>
            <Ionicons name="flag" size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}

        {/* Mute Indicator Overlay */}
        {isMuted && localStream && (
          <View style={[styles.muteIndicator, { top: spacing.lg + 50 }]}>
            <Ionicons name="mic-off" size={20} color="white" />
            <ThemedText style={styles.muteText}>Muted</ThemedText>
          </View>
        )}

        {/* Local Video Overlay */}
        {localStream && RTCView && (
          <View style={[styles.localVideoContainer, { borderColor: surfaceColor }]}>
            {isVideoPaused ? (
              <View style={[styles.localVideo, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="videocam-off" size={30} color="white" />
              </View>
            ) : (
              <RTCView
                streamURL={localStream.toURL()}
                style={styles.localVideo}
                objectFit="cover"
                mirror={true}
              />
            )}
          </View>
        )}
      </View>

      {/* Chat Overlay */}
      {isChatVisible && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.chatOverlay}
        >
          <View style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <ThemedText style={styles.chatTitle}>Chat</ThemedText>
              <TouchableOpacity onPress={() => setIsChatVisible(false)} style={styles.closeChatButton}>
                <Ionicons name="close-circle" size={30} color="white" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={messages}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={[
                  styles.messageBubble,
                  item.sender === 'me' ? styles.myMessage : styles.theirMessage
                ]}>
                  <ThemedText style={styles.messageText}>{item.text}</ThemedText>
                </View>
              )}
              contentContainerStyle={styles.messageListContent}
            />

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type a message..."
                placeholderTextColor="#ccc"
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                <Ionicons name="send" size={24} color={primaryColor} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {(isChatting || isConnecting) && (
          <View style={styles.mediaControls}>
            <TouchableOpacity style={styles.mediaButton} onPress={toggleMute}>
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaButton} onPress={toggleVideo}>
              <Ionicons name={isVideoPaused ? 'videocam-off' : 'videocam'} size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaButton} onPress={() => setIsChatVisible(true)}>
              <Ionicons name="chatbubble" size={24} color="white" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <ThemedText style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaButton} onPress={switchCamera}>
              <Ionicons name="camera-reverse" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}
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
              <Ionicons name="call" size={24} color="white" />
              <ThemedText style={styles.controlButtonText}>End</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: primaryColor }]}
              onPress={findNextPeer}
            >
              <ThemedText style={styles.controlButtonText}>Next</ThemedText>
              <Ionicons name="chevron-forward" size={24} color="white" />
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
  mediaControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  mediaButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
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
  remotePausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  remotePausedText: {
    color: 'white',
    marginTop: spacing.md,
    fontSize: typography.sizes.heading3,
    fontFamily: typography.families.bold,
  },
  chatOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  chatTitle: {
    fontSize: typography.sizes.heading3,
    fontFamily: typography.families.bold,
    color: 'white',
  },
  closeChatButton: {
    padding: spacing.xs,
  },
  messageListContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 2,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#333',
    borderBottomLeftRadius: 2,
  },
  messageText: {
    color: 'white',
    fontSize: typography.sizes.body1,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  input: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: 'white',
    fontSize: typography.sizes.body1,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default VideoChatScreen;