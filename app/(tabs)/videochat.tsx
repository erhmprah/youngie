import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { borderRadius, shadows, spacing, typography, sizes } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { CustomAlert } from '@/utils/alert';
import { showFriendlySocketError } from '@/utils/socket-error';
import { SOCKET_URL, userAPI } from '@/utils/api';
import { getICEServers } from '@/utils/externalServices';
import { verticalScale } from '@/utils/scale';
import { Ionicons } from '@expo/vector-icons';
import InCallManager from 'react-native-incall-manager';
import * as KeepAwake from 'expo-keep-awake';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useInterstitialAdHelper } from '@/hooks/useInterstitialAdHelper';
import { ActivityIndicator, Animated, Dimensions, FlatList, KeyboardAvoidingView, PanResponder, PermissionsAndroid, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Socket, io } from 'socket.io-client';
import { setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [isSpeaker, setIsSpeaker] = useState(true);
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
  // Read inside long-lived socket handlers, which capture the values from the
  // render that created the socket and would otherwise always see false.
  const isChattingRef = useRef(isChatting);
  const isConnectingRef = useRef(isConnecting);
  // Delayed connect_error notice, cleared whenever the connection resolves.
  const connectErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drops the current socket completely: listeners first, so a late event from
  // the old connection cannot reach a handler, then the transport. Without
  // this, every retry left another live socket (and its handlers) behind, and
  // their `disconnect` callbacks kept calling resetChat() on a healthy session.
  const disposeSocket = useCallback(() => {
    if (connectErrorTimer.current) {
      clearTimeout(connectErrorTimer.current);
      connectErrorTimer.current = null;
    }
    const existing = socket.current;
    socket.current = null;
    if (existing) {
      existing.removeAllListeners();
      existing.disconnect();
    }
  }, []);
  const localStreamRef = useRef<any>(null);
  const remoteStreamRef = useRef<any>(null);
  const inCallManagerStarted = useRef(false);
  const pendingIceCandidates = useRef<any[]>([]);
  const router = useRouter();
  const { user } = useAuth();

  const primaryColor = useThemeColor('primary');
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const errorColor = useThemeColor('error');
  const surfaceColor = useThemeColor('surface');

  const { isClosed: interstitialClosed, showIfNeeded } = useInterstitialAdHelper();

  const [webRTC, setWebRTC] = useState<any>(null);

  const checkPermissionsRef = useRef<(...args: any[]) => Promise<void>>(async () => {});
  const resetChatRef = useRef<(...args: any[]) => void>(() => {});
  const findNextPeerRef = useRef<(...args: any[]) => void>(() => {});

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

  const { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, mediaDevices, MediaStream } = webRTC || {};

  const startInCallManager = useCallback(() => {
    try {
      // @ts-ignore
      if (typeof InCallManager?.start === 'function') {
        // media: 'video' keeps camera/speaker management; force speaker on
        // so audio is routed to the loud speaker automatically.
        InCallManager.start({ media: 'video' });
        InCallManager.setKeepScreenOn(true);
        InCallManager.setForceSpeakerphoneOn(true);
        InCallManager.setSpeakerphoneOn(true);
        inCallManagerStarted.current = true;
        setIsSpeaker(true);
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

  const attachRemoteStream = useCallback((stream: any) => {
    if (!stream) {
      console.log('❌ attachRemoteStream called with null/undefined stream');
      return;
    }

    console.log('✅ attachRemoteStream called with stream:', {
      id: stream?.id,
      active: stream?.active,
      videoTracks: stream?.getVideoTracks?.().length || 0,
      audioTracks: stream?.getAudioTracks?.().length || 0,
    });

    remoteStreamRef.current = stream;
    setRemoteStream(stream);
    setIsChatting(true);
    startInCallManager();
  }, [startInCallManager]);

  // Handle tab focus/blur to manage resources
  useFocusEffect(
    useCallback(() => {
      checkPermissionsRef.current();
      
      return () => {
        // Cleanup when switching tabs
        resetChatRef.current();
        disposeSocket();
        KeepAwake.deactivateKeepAwake().catch(() => {});
      };
    }, [disposeSocket])
  );

  // useFocusEffect cleanup covers tab blur, but the screen can also leave the
  // stack without a blur, so drop the transport on unmount too.
  useEffect(() => disposeSocket, [disposeSocket]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isChatting) {
      interval = setInterval(() => {
        setChatDuration(prev => prev + 1);
      }, 1000);
    } else {
      setChatDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
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

  checkPermissionsRef.current = checkPermissions;

  const createPeerConnection = useCallback(async () => {
    if (!RTCPeerConnection) {
      return null;
    }

    let pc;
    try {
      const iceServers = await getICEServers();
      pc = new RTCPeerConnection({
        iceServers,
      });
    } catch (error) {
      try {
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        });
      } catch (fallbackError) {
        return null;
      }
    }

    // @ts-ignore
    pc.onicecandidate = (event) => {
      if (event.candidate && socket.current && peerIdRef.current) {
        socket.current.emit('ice_candidate', event.candidate, peerIdRef.current);
      }
    };

    // @ts-ignore
    pc.ontrack = (event) => {
      console.log('🔊 ontrack event fired:', {
        streamCount: event?.streams?.length || 0,
        trackKind: event?.track?.kind,
        trackEnabled: event?.track?.enabled,
        hasStream: !!event?.streams?.[0],
      });

      const incomingStream = event?.streams?.[0] || event?.stream || null;

      if (incomingStream) {
        console.log('✅ Stream found in event.streams[0]');
        attachRemoteStream(incomingStream);
      } else if (event?.track) {
        console.log('⚙️ No stream, building from track:', event?.track?.kind);
        if (!remoteStreamRef.current && MediaStream) {
          remoteStreamRef.current = new MediaStream();
          console.log('📺 Created new MediaStream');
        }
        if (remoteStreamRef.current?.addTrack) {
          remoteStreamRef.current.addTrack(event.track);
          console.log('📥 Added track to MediaStream');
          attachRemoteStream(remoteStreamRef.current);
        }
      } else {
        console.log('❌ ontrack fired but no stream or track available');
      }
    };

    // @ts-ignore
    pc.onaddstream = (event) => {
      if (event?.stream) {
        attachRemoteStream(event.stream);
      }
    };

    // @ts-ignore
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        if (isChattingRef.current) {
          CustomAlert.info('Chat Ended', 'Connection lost.');
          resetChatRef.current();
        }
      }
    };

    // @ts-ignore
    pc.onconnectionstatechange = () => {
    };

    return pc;
  }, [attachRemoteStream, RTCPeerConnection, MediaStream]);

  const initLocalStream = useCallback(async () => {
    if (!hasPermissions) {
      // Alert.alert('Permissions Required', 'Please grant camera and microphone permissions to use video chat.');
      return null;
    }

    try {
      if (!mediaDevices || !mediaDevices.getUserMedia) {
        throw new Error('WebRTC not supported. Please use a development build.');
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: true,
      });

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
            buttons: [{ text: 'OK', onPress: () => router.back(), style: 'cancel' }],
           dismissable: false
         });
       } else {
         CustomAlert.error('Error', (error as Error).message || 'Failed to access camera and microphone.');
       }
       return null;
     }
  }, [hasPermissions, mediaDevices, router]);

  const resetChat = useCallback((keepLocalStream = false) => {
    // Cancel a queued match or notify the current peer before cleaning up.
    // The server also unmatches on leave_queue to cover a match_found event
    // that races this reset before peerIdRef has been populated.
    if (socket.current?.connected) {
      if (peerIdRef.current) {
        socket.current.emit('peer_disconnected', peerIdRef.current);
      } else {
        socket.current.emit('leave_queue');
      }
    }
    peerIdRef.current = null;
    
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
    remoteStreamRef.current = null;
    pendingIceCandidates.current = [];
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
    isChattingRef.current = false;
    isConnectingRef.current = false;
    stopInCallManager();
    KeepAwake.deactivateKeepAwake().catch(() => {});
  }, [stopInCallManager]);

resetChatRef.current = resetChat;

  // The actual connection logic, held in a ref so the interstitial's close
  // handler can invoke it after the ad dismisses — without depending on
  // component state that may have changed in the meantime.
  const startChatRef = useRef<() => void>(() => {});

  startChatRef.current = async () => {
      resetChat();
      setIsConnecting(true);
      isConnectingRef.current = true;

      const stream = await initLocalStream();
      if (!stream) {
        setIsConnecting(false);
        isConnectingRef.current = false;
        return;
      }

      disposeSocket();

      try {
        const s = io(SOCKET_URL, {
        auth: async (cb) => {
          cb({ token: await AsyncStorage.getItem('authToken') });
        },
        // Allow the polling fallback: a proxy or load balancer that drops the
        // WebSocket Upgrade header turns a websocket-only client into a hard
        // failure instead of a slower working connection.
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket.current = s;

      // Handlers below were registered on `s`. If a newer socket has taken
      // over by the time one of them fires, this socket is stale and must not
      // touch screen state.
      const isCurrent = () => socket.current === s;

      // Add an ICE candidate safely: buffer it until the remote description
      // has been applied (candidates often arrive before setRemoteDescription).
      const addRemoteCandidate = async (candidate: any) => {
        const pc = peerConnection.current;
        if (!pc || !candidate) return;
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
          pendingIceCandidates.current.push(candidate);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      };

      // Flush any buffered candidates after the remote description is set.
      const flushIceCandidates = async () => {
        const pc = peerConnection.current;
        if (!pc) return;
        while (pendingIceCandidates.current.length > 0) {
          const candidate = pendingIceCandidates.current.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error flushing ICE candidate:', e);
          }
        }
      };

      s.on('connect', () => {
        if (!isCurrent()) return;
        if (connectErrorTimer.current) {
          clearTimeout(connectErrorTimer.current);
          connectErrorTimer.current = null;
        }
        console.log('Video chat socket connected:', s.id);
        s.emit('join_room');
      });

      s.on('connect_error', (error) => {
        if (!isCurrent()) return;
        console.error('Video chat socket connection error:', error.message);
        // Hold the alert back so a slow first connect does not look like a
        // failure. The timer is cleared on connect, on replacement, and on
        // unmount, and it re-checks this exact socket, so it can no longer fire
        // against a newer connection.
        if (connectErrorTimer.current) clearTimeout(connectErrorTimer.current);
        connectErrorTimer.current = setTimeout(() => {
          connectErrorTimer.current = null;
          if (isCurrent() && !s.connected) {
            showFriendlySocketError(error, 'video');
            setIsConnecting(false);
            isConnectingRef.current = false;
          }
        }, 15000);
      });

      s.on('timeout', () => {
        if (!isCurrent()) return;
        console.log('Video chat socket connection timed out');
        showFriendlySocketError('timeout', 'video');
        setIsConnecting(false);
        isConnectingRef.current = false;
      });

      s.on('close', () => {
        if (!isCurrent()) return;
        console.log('Video chat socket closed');
        if (isChattingRef.current || isConnectingRef.current) {
          showFriendlySocketError('closed', 'video');
          resetChat();
        }
      });

      s.on('disconnect', (reason) => {
        if (!isCurrent()) return;
        console.log('Video chat socket disconnected:', reason);
        if (connectErrorTimer.current) {
          clearTimeout(connectErrorTimer.current);
          connectErrorTimer.current = null;
        }
        if (isChattingRef.current || isConnectingRef.current) {
          showFriendlySocketError(reason, 'video');
        }
        resetChat();
      });

      s.on('reconnect', (attemptNumber) => {
        if (!isCurrent()) return;
        console.log('Video chat socket reconnected after', attemptNumber, 'attempts');
        if (!isChattingRef.current) {
          s.emit('join_room');
        }
      });

      s.on('reconnect_attempt', (attemptNumber) => {
        if (!isCurrent()) return;
        console.log('Video chat socket reconnection attempt:', attemptNumber);
      });

      s.on('reconnect_failed', () => {
        if (!isCurrent()) return;
        console.error('Video chat socket reconnection failed');
        showFriendlySocketError('reconnect_failed', 'video');
      });

      s.on('match_found', async (data: { peerId: string; initiator: boolean }) => {
        if (!isCurrent()) return;
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
        isConnectingRef.current = false;
        peerIdRef.current = peerId;
        setPeerId(peerId);
        setIsChatting(true);
        isChattingRef.current = true;
        KeepAwake.activateKeepAwake().catch(() => {});

         if (initiator) {
           peerConnection.current = await createPeerConnection();
            if (!peerConnection.current) {
              showFriendlySocketError('peer_connection_failed', 'video');
              return;
            }

          stream.getTracks().forEach((track: any) => {
            try {
              console.log('📤 Adding local track to peer connection:', track.kind);
              peerConnection.current?.addTrack(track, stream);
            } catch (e) {
              console.error('❌ Error adding track:', e);
            }
          });

          try {
            const offer = await peerConnection.current.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await peerConnection.current.setLocalDescription(offer);
            s.emit('offer', offer, peerId);
          } catch (e) {
          }
        }
      });

      s.on('offer', async (offer: any, remotePeerId?: string) => {
        if (!isCurrent()) return;
        try {
          if (remotePeerId) {
            peerIdRef.current = remotePeerId;
            setPeerId(remotePeerId);
          }
          
          // Update UI state when offer is received - peer is found but still connecting
          setIsConnecting(false);
          isConnectingRef.current = false;
          setIsChatting(true);
          isChattingRef.current = true;
          KeepAwake.activateKeepAwake().catch(() => {});
          
          if (!peerConnection.current || peerConnection.current.signalingState !== 'stable') {
            peerConnection.current = await createPeerConnection();
            if (!peerConnection.current) return;

            stream.getTracks().forEach((track: MediaStreamTrack) => {
              try {
                console.log('📤 Adding local track in offer handler:', track.kind);
                peerConnection.current?.addTrack(track, stream);
              } catch (e) {
                console.error('❌ Error adding track in offer:', e);
              }
            });
          }

          try {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
            await flushIceCandidates();
            const answer = await peerConnection.current.createAnswer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await peerConnection.current.setLocalDescription(answer);
            s.emit('answer', answer, remotePeerId || peerIdRef.current);
          } catch (e) {
            console.error('Error handling offer:', e);
          }
        } catch (error) {
          console.error('Error in offer handler:', error);
        }
      });

      s.on('answer', async (answer: any) => {
        if (!isCurrent()) return;
        try {
          if (peerConnection.current && !peerConnection.current.remoteDescription) {
            try {
              if (peerConnection.current.signalingState === 'have-local-offer' ||
                  (peerConnection.current.signalingState === 'stable' && !peerConnection.current.remoteDescription)) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
                await flushIceCandidates();
              }
            } catch (e) {
              console.error('Error setting remote description:', e);
            }
          }
        } catch (error) {
          console.error('Error in answer handler:', error);
        }
      });

      s.on('ice_candidate', async (candidate: any) => {
        if (!isCurrent()) return;
        await addRemoteCandidate(candidate);
      });

      s.on('peer_disconnected', () => {
        if (!isCurrent()) return;
        // Ignore if we're not actively in a chat (e.g. the peer is reacting
        // to our own disconnect or we already returned to idle)
        if (!isChattingRef.current && !isConnectingRef.current) return;

        CustomAlert.info('Chat Ended', 'Your peer has ended the chat.');

        // Clear peer so we don't re-notify an already-gone peer
        peerIdRef.current = null;
        setPeerId(null);
        resetChat(true);

        // Continue searching for a new match
        if (s.connected) {
          s.emit('next_peer');
          setIsConnecting(true);
          isConnectingRef.current = true;
        }
      });

      s.on('socket_error', (error: { message: string }) => {
        if (!isCurrent()) return;
        console.error('Video chat socket error:', error?.message || error);
        showFriendlySocketError(error, 'video');
      });

      s.on('video_status_change', (data: { isPaused: boolean }) => {
        if (!isCurrent()) return;
        setIsRemoteVideoPaused(data.isPaused);
      });

      s.on('receive_message', (data: { message: string }) => {
        if (!isCurrent()) return;
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
        showFriendlySocketError(error, 'video');
        setIsConnecting(false);
      }
    };

  // Track the interstitial's closed transition so we can resume the
  // "Start Matching" flow exactly once after the ad dismisses. Watching the
  // raw isClosed flag is unreliable because it stays true between sessions,
  // so we diff against the previous value.
  const wasShowingAdRef = useRef(false);
  const prevClosedRef = useRef(interstitialClosed);
  useEffect(() => {
    const justClosed = !prevClosedRef.current && interstitialClosed;
    prevClosedRef.current = interstitialClosed;

    if (wasShowingAdRef.current && justClosed) {
      wasShowingAdRef.current = false;
      startChatRef.current();
    }
  }, [interstitialClosed]);

  // Track whether an interstitial is currently blocking the start tap.
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

     const adShown = showIfNeeded();
     if (adShown) {
       // Block until the ad closes; the effect above resumes the flow.
       wasShowingAdRef.current = true;
       return;
     }

     startChatRef.current();
  }, [webRTCSupported, hasPermissions, checkPermissions, showIfNeeded]);

  const handleReportUser = useCallback(() => {
    CustomAlert.confirm(
      'Report User',
      'Are you sure you want to report this user for inappropriate behavior?',
      async () => {
        try {
          if (user?._id && peerId) {
            await userAPI.reportUser(user._id, peerId);
          }
          CustomAlert.success('Reported', 'User has been reported. Finding a new peer...');
        } catch {
          CustomAlert.error('Error', 'Failed to report user');
        }
        findNextPeerRef.current();
      }
    );
  }, [user?._id, peerId]);

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

  const toggleSpeaker = useCallback(() => {
    const newSpeakerState = !isSpeaker;
    setIsSpeaker(newSpeakerState);
    try {
      if (typeof InCallManager?.setSpeakerphoneOn === 'function') {
        InCallManager.setSpeakerphoneOn(newSpeakerState);
        InCallManager.setForceSpeakerphoneOn(newSpeakerState);
      }
    } catch (error) {
      console.error('InCallManager error on speaker toggle:', error);
    }
  }, [isSpeaker]);

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
      isConnectingRef.current = true;
    } else {
      startVideoChat();
    }
  }, [resetChat, startVideoChat]);

  findNextPeerRef.current = findNextPeer;

  const pan = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    isChattingRef.current = isChatting;
  }, [isChatting]);

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
      let timeout: ReturnType<typeof setTimeout> | null = null;
      if (isConnecting) {
        timeout = setTimeout(() => {
          CustomAlert.warning('Timeout', 'No match found. Please try again.');
          resetChat();
          disposeSocket();
        }, 30000);
      }
      return () => {
        if (timeout) clearTimeout(timeout);
      };
    }, [disposeSocket, isConnecting, resetChat]);

  const localStreamUrl = localStream?.toURL?.() || null;
  const remoteStreamUrl = remoteStream?.toURL?.() || null;

  // Debug logging for stream URL changes


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
    <SafeAreaView style={[styles.container, { backgroundColor: (isChatting || isConnecting) ? 'transparent' : backgroundColor }]}>
      <View style={styles.videoWrapper}>
        <Animated.View 
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: pan.x }] }]}
          {...panResponder.panHandlers}
        >
        {remoteStream && RTCView && remoteStreamUrl && (
          <RTCView
            key={remoteStream?.id}
            streamURL={remoteStreamUrl}
            style={styles.fullScreenVideo}
            objectFit="cover"
            zOrder={0}
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
        {localStream && RTCView && localStreamUrl && (
          <View style={[styles.localVideoContainer, { borderColor: surfaceColor }]}>
            {isVideoPaused ? (
              <View style={[styles.localVideo, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="videocam-off" size={30} color="white" />
              </View>
            ) : (
              <RTCView
                key={localStream?.id}
                streamURL={localStreamUrl}
                style={styles.localVideo}
                objectFit="cover"
                mirror={true}
                zOrder={1}
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
            <TouchableOpacity style={styles.mediaButton} onPress={toggleSpeaker}>
              <Ionicons name={isSpeaker ? 'volume-high' : 'volume-low'} size={24} color="white" />
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
              onPress={() => resetChat()}
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
    width: verticalScale(100),
    height: verticalScale(140),
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: sizes.borderWidth,
    zIndex: 20,
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
    width: sizes.iconLarge + 10,
    height: sizes.iconLarge + 10,
    borderRadius: (sizes.iconLarge + 10) / 2,
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
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
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
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.85)',
    minHeight: 80,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: 'white',
    fontSize: typography.sizes.body1,
    minHeight: 48,
    maxHeight: 120,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 48,
    height: 48,
    borderRadius: borderRadius.round,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  badge: {
    position: 'absolute',
    top: -spacing.xxs,
    right: -spacing.xxs,
    backgroundColor: '#FF3B30',
    borderRadius: sizes.iconSmall,
    minWidth: sizes.iconSmall,
    height: sizes.iconSmall,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxs,
    borderWidth: sizes.borderWidth,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: typography.sizes.tiny,
    fontWeight: 'bold',
  },
});

export default VideoChatScreen;