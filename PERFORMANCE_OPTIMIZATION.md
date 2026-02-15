# Performance Optimization & Memory Leak Prevention Guide

This document outlines comprehensive strategies to improve app performance and prevent memory leaks in your React Native/Expo application.

---

## Table of Contents

1. [Memory Leak Prevention](#1-memory-leak-prevention)
2. [Performance Optimizations](#2-performance-optimizations)
3. [Network & Data Optimizations](#3-network--data-optimizations)
4. [UI Rendering Optimizations](#4-ui-rendering-optimizations)
5. [Media & Audio Handling](#5-media--audio-handling)
6. [Socket Management](#6-socket-management)
7. [Implementation Priority](#7-implementation-priority)

---

## 1. Memory Leak Prevention

### 1.1 Proper useEffect Cleanup

**Current Issue**: Many useEffects in your codebase don't have proper cleanup functions.

**Solution**:
```typescript
// ❌ BAD - Missing cleanup
useEffect(() => {
  const subscription = someEvent.subscribe(handleEvent);
}, []);

// ✅ GOOD - Proper cleanup
useEffect(() => {
  const subscription = someEvent.subscribe(handleEvent);
  return () => {
    subscription.unsubscribe(); // Always clean up!
  };
}, []);
```

### 1.2 Fix Chat Screen (app/chat/[id].tsx)

The chat screen has socket listeners but needs improved cleanup:

```typescript
// Add to chat/[id].tsx - Enhanced cleanup with useRef for interval timers
const recordingDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  // ... existing code ...
  
  // Recording duration timer
  if (isRecording) {
    recordingDurationIntervalRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  }

  return () => {
    // ... existing cleanup ...
    
    // Clean up recording interval
    if (recordingDurationIntervalRef.current) {
      clearInterval(recordingDurationIntervalRef.current);
      recordingDurationIntervalRef.current = null;
    }
    
    // Clean up typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    // Unload all sound references
    soundRefs.current.forEach(async (sound) => {
      try {
        await sound.unloadAsync();
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
    soundRefs.current.clear();
  };
}, [id, isRecording]);
```

### 1.3 Fix Video/Audio Chat Screens

**app/(tabs)/videochat.tsx** and **app/voicechat.tsx**:

```typescript
// Add proper cleanup for media streams
useEffect(() => {
  let isMounted = true;
  
  const setupMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      if (isMounted) {
        setLocalStream(stream);
      }
    } catch (error) {
      console.error('Media setup error:', error);
    }
  };
  
  setupMedia();
  
  return () => {
    isMounted = false;
    // Clean up local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    // Clean up peer connection
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
  };
}, []);
```

### 1.4 Clean Up Intervals and Timeouts

**Current Issue**: setInterval and setTimeout are never cleared.

**Solution** - Create a custom hook:

```typescript
// hooks/useInterval.ts
import { useEffect, useRef } from 'react';

export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  
  useEffect(() => {
    if (delay === null) return;
    
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// hooks/useTimeout.ts
import { useEffect, useRef } from 'react';

export function useTimeout(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  
  useEffect(() => {
    if (delay === null) return;
    
    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}
```

---

## 2. Performance Optimizations

### 2.1 Memoization with useMemo and useCallback

**Current Issue**: Components re-render unnecessarily due to new function references.

**Solution**:
```typescript
// ❌ BAD - New function every render
<FeedCard 
  post={post} 
  onLike={() => handleLike(post._id)} 
  onComment={() => handleComment(post._id)}
/>

// ✅ GOOD - Memoized callbacks
const handleLike = useCallback((postId: string) => {
  // Like logic
}, [userId]); // Only changes when userId changes

const memoizedPost = useMemo(() => ({
  ...post,
  isLiked: post.likes.some(l => l._id === userId)
}), [post, userId]);

<FeedCard 
  post={memoizedPost} 
  onLike={handleLike}
  onComment={handleComment}
/>
```

### 2.2 Add to FeedCard Component

```typescript
// app/chat/FeedCard.component.tsx - Add React.memo
import React, { memo, useCallback, useMemo } from 'react';

// Wrap the component with memo
export const FeedCard = memo(function FeedCard({ 
  initialPost, 
  onPress,
  isVisible = false 
}: FeedCardProps) {
  // ... existing code ...
  
  // Memoize expensive computations
  const likeCount = useMemo(() => 
    post.likes?.length || 0, 
    [post.likes]
  );
  
  const commentCount = useMemo(() => 
    post.comments?.length || 0, 
    [post.comments]
  );
  
  // Memoize handlers
  const handleLikePress = useCallback(() => {
    // ... like logic
  }, [post._id, isFavorited]);
  
  const handleCommentPress = useCallback(() => {
    setCommentsModalVisible(true);
  }, []);
  
  return (
    // ... JSX
  );
});
```

### 2.3 Optimize FlatList Rendering

**Current Issue**: FlatLists render all items at once, causing performance issues.

**Solution** - Add proper keyExtractor and optimization props:

```typescript
// app/(tabs)/index.tsx - Optimize FlatList
<FlatList
  ref={flatListRef}
  data={posts}
  keyExtractor={(item) => item._id}
  renderItem={({ item, index }) => (
    <FeedCard 
      initialPost={item}
      isVisible={index === visiblePostIndex}
    />
  )}
  // Performance optimization props
  initialNumToRender={5}
  maxToRenderPerBatch={10}
  windowSize={10}
  removeClippedSubviews={true}
  updateCellsBatchingPeriod={50}
  getItemLayout={(data, index) => ({
    length: POST_ITEM_HEIGHT,
    offset: POST_ITEM_HEIGHT * index,
    index,
  })}
  // Lazy loading
  onEndReached={() => loadMorePosts()}
  onEndReachedThreshold={0.5}
  // Preloading
  ListFooterComponent={loadingMore ? <ActivityIndicator /> : null}
/>
```

### 2.4 Implement Windowed Virtualization for Chat

```typescript
// app/chat/[id].tsx - Windowed message list
const [windowStart, setWindowStart] = useState(0);
const WINDOW_SIZE = 30;

const visibleMessages = useMemo(() => {
  return messages.slice(windowStart, windowStart + WINDOW_SIZE);
}, [messages, windowStart]);

const handleScroll = useCallback(({ nativeEvent }) => {
  const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
  const distanceFromEnd = contentSize - contentOffset - layoutMeasurement;
  
  // Load more when near the top (inverted chat)
  if (contentOffset.y < 100 && windowStart > 0) {
    setWindowStart(prev => Math.max(0, prev - WINDOW_SIZE));
  }
}, [windowStart]);
```

---

## 3. Network & Data Optimizations

### 3.1 Implement Request Deduplication

```typescript
// utils/requestQueue.ts
class RequestQueue {
  private pendingRequests = new Map<string, Promise<any>>();
  
  async execute<T>(key: string, request: () => Promise<T>): Promise<T> {
    // If request is already pending, return existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }
    
    const promise = request().finally(() => {
      this.pendingRequests.delete(key);
    });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
}

export const requestQueue = new RequestQueue();
```

### 3.2 Add Response Caching

```typescript
// utils/apiCache.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.DEFAULT_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const apiCache = new APICache();
```

### 3.3 Optimize Image Loading

```typescript
// Add to components using images
import { Image } from 'react-native';
import { CacheManager } from '@nickmillerdev/react-native-image-cache';

// Use cache-aware image component
<CacheManagerImage
  uri={imageUrl}
  style={styles.image}
  preview={placeholderImage}
  options={{
    // Cache configuration
  }}
/>
```

### 3.4 Implement Lazy Image Loading

```typescript
// components/LazyImage.tsx
import React, { useState, useCallback } from 'react';
import { Image, View, ActivityIndicator, StyleSheet } from 'react-native';

interface LazyImageProps {
  uri: string;
  style?: object;
  placeholder?: string;
}

export function LazyImage({ uri, style, placeholder }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  const onLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);
  
  const onError = useCallback(() => {
    setError(true);
    setIsLoaded(true);
  }, []);
  
  return (
    <View style={[styles.container, style]}>
      {!isLoaded && (
        <ActivityIndicator size="small" style={styles.loader} />
      )}
      <Image
        source={{ uri: error ? placeholder : uri }}
        style={[styles.image, !isLoaded && styles.hidden]}
        onLoad={onLoad}
        onError={onError}
        progressiveRenderingEnabled={true}
      />
    </View>
  );
}
```

---

## 4. UI Rendering Optimizations

### 4.1 Use FlashList Instead of FlatList

Install: `npx expo install @shopify/flash-list`

```typescript
// Replace FlatList with FlashList for better performance
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={posts}
  estimatedItemSize={400}
  renderItem={({ item }) => <FeedCard initialPost={item} />}
  keyExtractor={item => item._id}
/>
```

### 4.2 Optimize Animated Values

```typescript
// ❌ BAD - Creating new Animated.Value on every render
const animatedValue = new Animated.Value(0);

// ✅ GOOD - Use useRef
const animatedValue = useRef(new Animated.Value(0)).current;

// ✅ GOOD - Use useSharedValue (Reanimated)
import { useSharedValue } from 'react-native-reanimated';
const animatedValue = useSharedValue(0);
```

### 4.3 Debounce Search Input

```typescript
// hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// Usage in explore.tsx
const debouncedSearchQuery = useDebounce(searchQuery, 500);

useEffect(() => {
  if (debouncedSearchQuery) {
    performSearch(debouncedSearchQuery);
  }
}, [debouncedSearchQuery]);
```

### 4.4 Reduce Re-renders with React.memo

```typescript
// Create optimized versions of frequently rendered components
export const MemoizedIcon = React.memo(IconSymbol);
export const MemoizedTouchable = React.memo(TouchableOpacity);
export const MemoizedImage = React.memo(Image);

// Wrap simple display components
const PostStat = React.memo(({ count, label }) => (
  <View>
    <Text>{count}</Text>
    <Text>{label}</Text>
  </View>
));
```

---

## 5. Media & Audio Handling

### 5.1 Proper Audio Resource Management

```typescript
// utils/audioManager.ts
class AudioManager {
  private sounds = new Map<string, Audio.Sound>();
  private recordings = new Map<string, Audio.Recording>();
  
  async loadSound(key: string, uri: string): Promise<Audio.Sound> {
    // Check if already loaded
    if (this.sounds.has(key)) {
      return this.sounds.get(key)!;
    }
    
    const { sound } = await Audio.Sound.createAsync({ uri });
    this.sounds.set(key, sound);
    return sound;
  }
  
  async unloadSound(key: string): Promise<void> {
    const sound = this.sounds.get(key);
    if (sound) {
      await sound.unloadAsync();
      this.sounds.delete(key);
    }
  }
  
  async unloadAll(): Promise<void> {
    for (const sound of this.sounds.values()) {
      await sound.unloadAsync();
    }
    this.sounds.clear();
  }
  
  // Cleanup on app background
  handleAppBackground(): void {
    this.unloadAll();
  }
}

export const audioManager = new AudioManager();
```

### 5.2 Add Background Audio Cleanup

```typescript
// app/_layout.tsx - Add AppState listener
import { AppState } from 'react-native';

useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // Clean up audio resources when app goes to background
      audioManager.unloadAll();
    }
  });
  
  return () => {
    subscription.remove();
  };
}, []);
```

---

## 6. Socket Management

### 6.1 Optimize Socket Event Handling

```typescript
// utils/socket.ts - Add connection state management
class SocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners = new Map<string, Set<Function>>();
  
  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }
    
    this.socket = io(SOCKET_URL, {
      // Connection options
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      
      // Performance optimizations
      transports: ['websocket'], // Force websocket
      upgrade: false,
      
      // Timeout settings
      timeout: 20000,
    });
    
    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.reconnectAttempts = 0;
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
    
    return this.socket;
  }
  
  // Efficient event subscription
  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    this.socket?.on(event, handler as any);
  }
  
  off(event: string, handler?: Function): void {
    if (handler) {
      this.listeners.get(event)?.delete(handler);
      this.socket?.off(event, handler as any);
    } else {
      // Remove all listeners for event
      this.listeners.delete(event);
      this.socket?.off(event);
    }
  }
  
  // Clean up all listeners
  disconnect(): void {
    this.listeners.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.socket?.off(event, handler);
      });
    });
    this.listeners.clear();
    this.socket?.disconnect();
    this.socket = null;
  }
}
```

---

## 7. Implementation Priority

### High Priority (Fix Immediately)

1. **Fix useEffect cleanup** in chat screens - Prevents memory leaks from socket listeners
2. **Add interval/timeout cleanup** - Prevents timer accumulation
3. **Clean up audio/video streams** on unmount - Prevents media resource leaks

### Medium Priority (Next Sprint)

4. **Add React.memo to FeedCard** - Reduces unnecessary re-renders
5. **Optimize FlatList** with proper windowSize and render props
6. **Implement request deduplication** - Reduces duplicate API calls

### Lower Priority (Future Enhancement)

7. **Migrate to FlashList** - Better list virtualization
8. **Add API response caching** - Faster subsequent loads
9. **Implement image caching** - Reduced bandwidth

---

## Quick Wins Checklist

```typescript
// Add this to EVERY useEffect that sets up listeners or timers:

useEffect(() => {
  // Setup code...
  
  return () => {
    // ✅ Clean up subscriptions
    subscription?.unsubscribe();
    
    // ✅ Clear intervals
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // ✅ Clear timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // ✅ Release media resources
    stream?.getTracks().forEach(track => track.stop());
    
    // ✅ Close connections
    peerConnection?.close();
  };
}, [dependencies]);
```

---

## Monitoring & Testing

### Use React Native Flipper

```bash
npx react-native init FlipperPlugins
```

Key plugins to use:
- **Performance Monitor** - Track frame rates
- **Network Inspector** - Monitor API calls
- **Database** - Track AsyncStorage usage

### Add Memory Monitoring

```typescript
// utils/memoryMonitor.ts
import { NativeModules } from 'react-native';

export function logMemoryUsage(): void {
  if (NativeModules.MemoryInfo) {
    const info = NativeModules.MemoryInfo.getMemoryInfo();
    console.log('Memory Usage:', {
      used: Math.round(info.jsUsed / 1024 / 1024) + 'MB',
      total: Math.round(info.jsTotal / 1024 / 1024) + 'MB',
    });
  }
}

// Add periodic monitoring during development
setInterval(logMemoryUsage, 30000);
```

---

## Summary

The most impactful changes for your app:

1. **Proper cleanup** of all useEffects (socket, intervals, timers)
2. **Memoization** of expensive computations and callbacks
3. **FlatList optimization** with proper virtualization settings
4. **Media resource cleanup** on unmount and background

Start with the high-priority items in chat/[id].tsx and videochat.tsx as these have the most complex state management and are most likely to cause memory leaks.
