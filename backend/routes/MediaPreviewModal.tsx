import React, { useState } from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';

interface MediaPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  mediaUrl: string | null;
  mediaType: string; // e.g., 'image/jpeg' or 'video/mp4'
}

const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  visible,
  onClose,
  mediaUrl,
  mediaType,
}) => {
  const [saving, setSaving] = useState(false);

  if (!mediaUrl) return null;

  const isVideo = mediaType?.startsWith('video');

  const handleSave = async () => {
    try {
      setSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to save media to your gallery.');
        setSaving(false);
        return;
      }

      // Create a local filename
      const filename = mediaUrl.split('/').pop() || `download-${Date.now()}`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      // Download the file
      const downloadRes = await FileSystem.downloadAsync(mediaUrl, fileUri);

      if (downloadRes.status !== 200) {
        throw new Error('Failed to download file');
      }

      // Save to gallery
      await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
      Alert.alert('Success', 'Media saved to gallery!');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save media.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="black" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.button}>
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.button}>
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Ionicons name="download-outline" size={28} color="white" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {isVideo ? (
            <Video
              source={{ uri: mediaUrl }}
              style={styles.media}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          ) : (
            <Image
              source={{ uri: mediaUrl }}
              style={styles.media}
              resizeMode="contain"
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    zIndex: 10,
  },
  button: { padding: 8 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  media: { width: '100%', height: '100%' },
});

export default MediaPreviewModal;