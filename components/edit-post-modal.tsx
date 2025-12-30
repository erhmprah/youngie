import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { ThemedText } from './themed-text';
import { colors, spacing, borderRadius } from '@/constants/design-tokens';
import { ICONS, ICON_SIZES } from '@/constants/icons';

interface Post {
  _id: string;
  author: {
    _id: string;
    username: string;
  };
  content?: string;
  image?: string;
  video?: string;
  createdAt: string;
}

interface EditPostModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (content: string, imagePath?: string) => Promise<void>;
  initialData: Post;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  visible,
  onClose,
  onSave,
  initialData,
}) => {
  const [content, setContent] = useState(initialData.content || '');
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(
    initialData.image ? { uri: initialData.image, type: 'image' } : null
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setContent(initialData.content || '');
      setSelectedMedia(initialData.image ? { uri: initialData.image, type: 'image' } : null);
    }
  }, [visible, initialData]);

  const pickMedia = async () => {
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setSelectedMedia({ uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image' });
    }
  };

  const handleSave = async () => {
    if (!content || !content.trim()) return;
    setIsLoading(true);
    try {
      let imagePath;
      if (selectedMedia && !selectedMedia.uri.startsWith('/uploads')) {
        // New image uploaded
        const formData = new FormData();
        formData.append('image', {
          uri: selectedMedia.uri,
          type: selectedMedia.type === 'image' ? 'image/jpeg' : 'video/mp4',
          name: selectedMedia.type === 'image' ? 'image.jpg' : 'video.mp4',
        } as any);
        // Assume postAPI.uploadPostImage is available
        // const uploadRes = await postAPI.uploadPostImage(formData);
        // imagePath = uploadRes.data.imagePath;
        // For now, since not implemented, use the uri
        imagePath = selectedMedia.uri;
      } else if (selectedMedia) {
        imagePath = selectedMedia.uri;
      }
      await onSave(content, imagePath);
      setContent('');
      setSelectedMedia(null);
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update post');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Navigation */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Ionicons name={ICONS.close} size={ICON_SIZES.lg} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading || !content || !content.trim()}
            style={[styles.postBtn, ((!content || !content.trim()) || isLoading) && styles.postBtnDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <ThemedText style={styles.postBtnText}>Save</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled">
          <View style={styles.composerBody}>
            <View style={styles.avatarCircle}>
              <ThemedText style={styles.avatarEmoji}>👤</ThemedText>
            </View>

            <View style={styles.inputStack}>
              <ThemedText style={styles.usernameText}>Edit Post</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="What's happening?"
                placeholderTextColor="#999"
                multiline
                autoFocus
                value={content}
                onChangeText={setContent}
                editable={!isLoading}
              />

              {/* Media Preview with Remove Button */}
              {selectedMedia && (
                <View style={styles.mediaContainer}>
                  <Image source={{ uri: selectedMedia.uri }} style={styles.previewImage} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.removeMediaBtn}
                    onPress={() => setSelectedMedia(null)}
                  >
                    <Ionicons name={ICONS.closeCircle} size={ICON_SIZES.lg} color="rgba(0,0,0,0.7)" />
                  </TouchableOpacity>
                  {selectedMedia.type === 'video' && (
                    <View style={styles.videoBadge}>
                      <Ionicons name={ICONS.play} size={ICON_SIZES.xs} color="#FFF" />
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Toolbar */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.toolbar}>
            <View style={styles.toolRow}>
              <TouchableOpacity onPress={pickMedia} style={styles.toolItem}>
                <Ionicons name={ICONS.image} size={ICON_SIZES.md} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolItem}>
                <Ionicons name={ICONS.video} size={ICON_SIZES.md} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolItem}>
                <Ionicons name={ICONS.location} size={ICON_SIZES.md} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <ThemedText style={[styles.charCount, (content && content.length > 450) && { color: 'red' }]}>
              {500 - (content ? content.length : 0)}
            </ThemedText>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 10,
  },
  iconBtn: { padding: 4 },
  postBtn: {
    backgroundColor: colors.primary || '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  scrollArea: { flex: 1 },
  composerBody: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: { fontSize: 20 },
  inputStack: { flex: 1 },
  usernameText: { fontWeight: '700', fontSize: 16, marginBottom: 4 },
  textInput: {
    fontSize: 18,
    lineHeight: 24,
    color: '#000',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  mediaContainer: {
    marginTop: 15,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#F2F2F7',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFF',
    borderRadius: 14,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 20,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    backgroundColor: '#FFF',
  },
  toolRow: { flexDirection: 'row', gap: 20 },
  toolItem: { padding: 4 },
  charCount: { fontSize: 13, color: '#999', fontWeight: '600' },
});