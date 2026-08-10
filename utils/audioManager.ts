import { setAudioModeAsync, requestRecordingPermissionsAsync, createAudioPlayer } from 'expo-audio';
import type { AudioPlayer, AudioRecorder } from 'expo-audio';
import { AppState, AppStateStatus } from 'react-native';

class AudioManager {
  private sounds = new Map<string, AudioPlayer>();
  private recordings = new Map<string, AudioRecorder>();
  private appStateSubscription: any = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: true,
      });

      this.setupAppStateListener();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
    }
  }

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.pauseAllSounds();
    }
  };

  async loadSound(key: string, uri: string): Promise<AudioPlayer> {
    if (this.sounds.has(key)) {
      return this.sounds.get(key)!;
    }

    try {
      const sound = createAudioPlayer({ uri });
      this.sounds.set(key, sound);
      return sound;
    } catch (error) {
      console.error(`Failed to load sound ${key}:`, error);
      throw error;
    }
  }

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
      sound.play();
    } catch (error) {
      console.error(`Failed to play sound ${key}:`, error);
    }
  }

  async pauseSound(key: string): Promise<void> {
    const sound = this.sounds.get(key);
    if (sound) {
      try {
        sound.pause();
      } catch (error) {
        console.error(`Failed to pause sound ${key}:`, error);
      }
    }
  }

  async unloadSound(key: string): Promise<void> {
    const sound = this.sounds.get(key);
    if (sound) {
      try {
        sound.pause();
        sound.remove();
      } catch (error) {
        console.error(`Failed to unload sound ${key}:`, error);
      }
      this.sounds.delete(key);
    }
  }

  async pauseAllSounds(): Promise<void> {
    for (const sound of this.sounds.values()) {
      try {
        if (sound.currentStatus.playing) {
          sound.pause();
        }
      } catch (error) {
        // Ignore errors during mass pause
      }
    }
  }

  async unloadAllSounds(): Promise<void> {
    for (const sound of this.sounds.values()) {
      try {
        sound.pause();
        sound.remove();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    this.sounds.clear();
  }

  async stopRecording(key: string): Promise<void> {
    const recording = this.recordings.get(key);
    if (recording) {
      try {
        await recording.stop();
      } catch (error) {
        console.error(`Failed to stop recording ${key}:`, error);
      }
      this.recordings.delete(key);
    }
  }

  async cleanup(): Promise<void> {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    await this.unloadAllSounds();

    for (const key of this.recordings.keys()) {
      await this.stopRecording(key);
    }

    this.isInitialized = false;
  }
}

export const audioManager = new AudioManager();

export function useAudioManager() {
  return audioManager;
}