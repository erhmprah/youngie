import React from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface ImageViewerModalProps {
    visible: boolean;
    onClose: () => void;
    imageUrl: string | null;
}

export function ImageViewerModal({ visible, onClose, imageUrl }: ImageViewerModalProps) {
    // Don't render if not visible or no image URL
    if (!visible || !imageUrl) return null;

    console.log('ImageViewerModal rendering with imageUrl:', imageUrl);

    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Ionicons name="close" size={30} color="white" />
                </TouchableOpacity>
                <View style={styles.imageContainer}>
                    <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 1,
        padding: 10,
    },
    imageContainer: {
        width: width * 0.9,
        height: height * 0.8,
    },
    image: {
        width: '100%',
        height: '100%',
    },
});