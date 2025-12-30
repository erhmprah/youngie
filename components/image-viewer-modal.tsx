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
    if (!imageUrl) return null;

    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Ionicons name="close" size={30} color="white" />
                </TouchableOpacity>
                <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
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
    image: {
        width: width,
        height: height * 0.8,
    },
});