import { Audio, AVPlaybackStatus } from 'expo-av';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Audio Manager - Centralized audio resource management
 * Prevents memory leaks from unreleased audio resources
 */
class AudioManager {
  private sounds = new Map<string, Audio.Sound>();
  private recordings = new Map<string, Audio.Recording>();
  private appStateSubscription: any = null;
  private isInitialized = false;

  /**
   * Initialize audio settings
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      this.setupAppStateListener();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
    }
  }

  /**
   * Listen for app state changes to clean up resources
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );
  }

  /**
   * Handle app state changes - clean up when backgrounded
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.pauseAllSounds();
    }
  };

  /**
   * Load a sound and cache it
   */
  async loadSound(key: string, uri: string): Promise<Audio.Sound> {
    // Return cached sound if available
    if (this.sounds.has(key)) {
      return this.sounds.get(key)!;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false }
      );
      this.sounds.set(key, sound);
      return sound;
    } catch (error) {
      console.error(`Failed to load sound ${key}:`, error);
      throw error;
    }
  }

  /**
   * Play a sound by key or URI
   */
  async playSound(key: string, uri?: string): Promise<void> {
    let sound = this.sounds.get(key);
    
    if (!sound && uri) {
      sound = await this.loadSound(key, uri);
    }
    
    if (!sound) {
      console.warn(`Sound ${key} not found`);
      return;
    }

    try {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch (error) {
      console.error(`Failed to play sound ${key}:`, error);
    }
  }

  /**
   * Pause a specific sound
   */
  async pauseSound(key: string): Promise<void> {
    const sound = this.sounds.get(key);
    if (sound) {
      try {
        await sound.pauseAsync();
      } catch (error) {
        console.error(`Failed to pause sound ${key}:`, error);
      }
    }
  }

  /**
   * Unload a specific sound
   */
  async unloadSound(key: string): Promise<void> {
    const sound = this.sounds.get(key);
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error(`Failed to unload sound ${key}:`, error);
      }
      this.sounds.delete(key);
    }
  }

  /**
   * Pause all loaded sounds
   */
  async pauseAllSounds(): Promise<void> {
    for (const sound of this.sounds.values()) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await sound.pauseAsync();
        }
      } catch (error) {
        // Ignore errors during mass pause
      }
    }
  }

  /**
   * Unload all sounds - call when cleaning up
   */
  async unloadAllSounds(): Promise<void> {
    for (const sound of this.sounds.values()) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    this.sounds.clear();
  }

  /**
   * Stop and unload a recording
   */
  async stopRecording(key: string): Promise<void> {
    const recording = this.recordings.get(key);
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (error) {
        console.error(`Failed to stop recording ${key}:`, error);
      }
      this.recordings.delete(key);
    }
  }

  /**
   * Unload all resources - call on app cleanup
   */
  async cleanup(): Promise<void> {
    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // Unload all sounds
    await this.unloadAllSounds();

    // Stop all recordings
    for (const key of this.recordings.keys()) {
      await this.stopRecording(key);
    }

    this.isInitialized = false;
  }
}

// Singleton instance
export const audioManager = new AudioManager();

// React hook for using the audio manager
export function useAudioManager() {
  return audioManager;
}
