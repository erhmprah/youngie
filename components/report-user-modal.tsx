// components/report-user-modal.tsx

import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { borderRadius, sizes, spacing, typography } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { CustomAlert } from '@/utils/alert';
import { userAPI } from '@/utils/api';
import { serverText } from '@/utils/error-messages';

interface ReportReason {
    value: string;
    label: string;
    icon: 'flag' | 'person.slash' | 'exclamationmark.triangle';
}

const REPORT_REASONS: ReportReason[] = [
    { value: 'inappropriate_content', label: 'Inappropriate or explicit content', icon: 'exclamationmark.triangle' },
    { value: 'harassment', label: 'Harassment or bullying', icon: 'person.slash' },
    { value: 'spam_or_scam', label: 'Spam, scam or fake account', icon: 'flag' },
    { value: 'hate_speech', label: 'Hate speech or discrimination', icon: 'exclamationmark.triangle' },
    { value: 'violence', label: 'Violence or threatening behaviour', icon: 'exclamationmark.triangle' },
    { value: 'underage', label: 'This person may be a minor', icon: 'exclamationmark.triangle' },
    { value: 'other', label: 'Something else', icon: 'flag' },
];

const MAX_DETAILS_LENGTH = 500;

interface ReportUserModalProps {
    visible: boolean;
    onClose: () => void;
    targetUserId: string;
    targetUsername?: string;
    onReported?: () => void;
}

export function ReportUserModal({ visible, onClose, targetUserId, targetUsername, onReported }: ReportUserModalProps) {
    const { user: currentUser } = useAuth();

    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const backgroundColor = useThemeColor('background');
    const surfaceColor = useThemeColor('surface');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const borderColor = useThemeColor('border');
    const primaryColor = useThemeColor('primary');
    const errorColor = useThemeColor('error');

    const { height: windowHeight } = useWindowDimensions();
    const reasonsMaxHeight = windowHeight * 0.8 - 220;

    const reset = useCallback(() => {
        setSelectedReason(null);
        setDetails('');
        setSubmitting(false);
    }, []);

    const handleClose = useCallback(() => {
        reset();
        onClose();
    }, [reset, onClose]);

    const handleSubmit = async () => {
        if (!currentUser?._id || !targetUserId || !selectedReason || submitting) return;

        const trimmedDetails = details.trim().slice(0, MAX_DETAILS_LENGTH);
        const reason = trimmedDetails ? `${selectedReason}: ${trimmedDetails}` : selectedReason;

        setSubmitting(true);
        try {
            await userAPI.reportUser(currentUser._id, targetUserId, reason);
            reset();
            onClose();
            CustomAlert.success('Reported', `Thanks for letting us know. We will review ${targetUsername ? `the report about ${targetUsername}` : 'this report'}.`);
            onReported?.();
        } catch (error: any) {
            setSubmitting(false);
            const message = serverText(error?.response?.data, '');
            if (message) {
                CustomAlert.warning('Report Not Submitted', message);
            } else {
                CustomAlert.error('Error', 'Failed to report user. Please try again.');
            }
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={submitting ? undefined : handleClose}>
            <TouchableWithoutFeedback onPress={submitting ? undefined : handleClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                            <ThemedView style={[styles.sheet, { backgroundColor: surfaceColor }]}>
                                <SafeAreaView edges={['bottom']}>
                                    <View style={[styles.header, { borderBottomColor: borderColor }]}>
                                        <View style={styles.headerText}>
                                            <ThemedText type="heading4">
                                                Report {targetUsername || 'user'}
                                            </ThemedText>
                                            <ThemedText style={[styles.subtitle, { color: lightTextColor }]}>
                                                Tell us what is wrong. Reports are confidential and reviewed by our moderation team.
                                            </ThemedText>
                                        </View>
                                        <TouchableOpacity onPress={handleClose} disabled={submitting} style={styles.closeButton} activeOpacity={0.7}>
                                            <IconSymbol name="xmark" size={18} color={lightTextColor} />
                                        </TouchableOpacity>
                                    </View>

                                    <ScrollView style={[styles.reasons, { maxHeight: reasonsMaxHeight }]} showsVerticalScrollIndicator={false}>
                                        {REPORT_REASONS.map((item) => {
                                            const isSelected = selectedReason === item.value;
                                            return (
                                                <TouchableOpacity
                                                    key={item.value}
                                                    style={[
                                                        styles.reasonRow,
                                                        { borderColor: isSelected ? primaryColor : borderColor, backgroundColor: isSelected ? primaryColor + '15' : 'transparent' },
                                                    ]}
                                                    onPress={() => setSelectedReason(item.value)}
                                                    activeOpacity={0.7}
                                                    disabled={submitting}
                                                >
                                                    <IconSymbol name={item.icon} size={18} color={isSelected ? primaryColor : lightTextColor} />
                                                    <ThemedText style={[styles.reasonLabel, { color: textColor }]}>{item.label}</ThemedText>
                                                    {isSelected && <IconSymbol name="checkmark" size={18} color={primaryColor} />}
                                                </TouchableOpacity>
                                            );
                                        })}

                                        {selectedReason === 'other' && (
                                            <TextInput
                                                style={[styles.input, { borderColor, color: textColor, backgroundColor }]}
                                                placeholder="Add details (optional)"
                                                placeholderTextColor={lightTextColor}
                                                value={details}
                                                onChangeText={(text) => setDetails(text.slice(0, MAX_DETAILS_LENGTH))}
                                                multiline
                                                numberOfLines={4}
                                                maxLength={MAX_DETAILS_LENGTH}
                                                editable={!submitting}
                                            />
                                        )}
                                    </ScrollView>

                                    <View style={styles.footer}>
                                        <TouchableOpacity
                                            style={[styles.cancelButton, { borderColor }]}
                                            onPress={handleClose}
                                            disabled={submitting}
                                            activeOpacity={0.7}
                                        >
                                            <ThemedText style={{ color: textColor }}>Cancel</ThemedText>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.submitButton,
                                                { backgroundColor: !selectedReason || submitting ? errorColor + '55' : errorColor },
                                            ]}
                                            onPress={handleSubmit}
                                            disabled={!selectedReason || submitting}
                                            activeOpacity={0.7}
                                        >
                                            {submitting ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <ThemedText style={styles.submitText}>Submit Report</ThemedText>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </SafeAreaView>
                            </ThemedView>
                        </KeyboardAvoidingView>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

export default ReportUserModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        maxHeight: '80%',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingBottom: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerText: {
        flex: 1,
    },
    subtitle: {
        marginTop: spacing.xs,
        fontSize: typography.sizes.caption,
        lineHeight: typography.sizes.caption * 1.4,
    },
    closeButton: {
        padding: spacing.xs,
    },
    reasons: {
        marginTop: spacing.md,
    },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    reasonLabel: {
        flex: 1,
        fontSize: typography.sizes.body2,
        fontFamily: typography.families.medium,
    },
    input: {
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        minHeight: 96,
        textAlignVertical: 'top',
        fontSize: typography.sizes.body2,
    },
    footer: {
        flexDirection: 'row',
        gap: spacing.md,
        paddingVertical: spacing.md,
    },
    cancelButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderWidth: 1,
        borderRadius: borderRadius.full,
    },
    submitButton: {
        flex: 2,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        minHeight: sizes.buttonHeight,
    },
    submitText: {
        color: '#fff',
        fontFamily: typography.families.bold,
    },
});
