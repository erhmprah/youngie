import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from './ui/icon-symbol';
import { postAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

export interface PollOption {
    text: string;
    votes: string[]; // Array of user IDs
}

interface PollViewProps {
    postId: string;
    options: PollOption[];
    onVote?: (updatedOptions: PollOption[]) => void;
    voteAPI?: (postId: string, optionIndex: number) => Promise<any>;
}

const PollOptionRow = ({ 
    option, 
    index, 
    totalVotes, 
    userVoteIndex, 
    onVote, 
    isVoting, 
    hasVoted,
    primaryColor,
    borderColor,
    surfaceColor,
    textColor,
    lightTextColor
}: any) => {
    const voteCount = option.votes?.length || 0;
    const optionText = typeof option === 'string' ? option : option.text;
    const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
    const isSelected = index === userVoteIndex;
    
    const widthAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (hasVoted) {
            Animated.timing(widthAnim, {
                toValue: percentage,
                duration: 600,
                useNativeDriver: false,
            }).start();
        }
    }, [hasVoted, percentage]);

    return (
        <TouchableOpacity
            style={[
                styles.optionButton,
                { 
                    borderColor: isSelected ? primaryColor : borderColor,
                    backgroundColor: surfaceColor 
                }
            ]}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onVote(index);
            }}
            disabled={hasVoted || isVoting}
        >
            {hasVoted && (
                <Animated.View 
                    style={[
                        styles.progressBar, 
                        { 
                            width: widthAnim.interpolate({
                                inputRange: [0, 100],
                                outputRange: ['0%', '100%']
                            }), 
                            backgroundColor: isSelected ? primaryColor + '30' : '#E0E0E0' 
                        }
                    ]} 
                />
            )}

            <View style={styles.contentRow}>
                {!hasVoted && !isVoting && (
                    <View style={[styles.radioCircle, { borderColor: lightTextColor }]} />
                )}
                <ThemedText style={{
                    fontWeight: isSelected ? 'bold' : 'normal',
                    color: textColor,
                    flex: 1
                }}>
                    {String(optionText)}
                </ThemedText>
                {hasVoted && (
                    <View style={styles.resultContainer}>
                        {isSelected && <IconSymbol name="checkmark.circle.fill" size={16} color={primaryColor} />}
                        <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption, fontWeight: '600' }}>
                            {percentage}%
                        </ThemedText>
                    </View>
                )}
                    {isVoting && !hasVoted && (
                    <ActivityIndicator size="small" color={primaryColor} />
                )}
            </View>
        </TouchableOpacity>
    );
};

export function PollView({ postId, options, onVote, voteAPI }: PollViewProps) {
    const { user } = useAuth();
    const [isVoting, setIsVoting] = useState(false);

    const primaryColor = useThemeColor('primary');
    const textColor = useThemeColor('text');
    const surfaceColor = useThemeColor('surface');
    const lightTextColor = useThemeColor('lightText');
    const borderColor = useThemeColor('border');

    // Check if current user has voted
    const userVoteIndex = options.findIndex(opt => opt.votes?.includes(user?._id || ''));
    const hasVoted = userVoteIndex !== -1;

    const totalVotes = options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0);

    const handleVote = async (index: number) => {
        if (hasVoted || isVoting || !user) return;

        setIsVoting(true);
        try {
            const api = voteAPI || postAPI.votePoll;
            const response = await api(postId, index);
            if (onVote && response.data && response.data.pollOptions) {
                onVote(response.data.pollOptions);
            }
        } catch (error) {
            console.error('Error voting:', error);
        } finally {
            setIsVoting(false);
        }
    };

    return (
        <View style={styles.container}>
            {options.map((option, index) => (
                <PollOptionRow 
                    key={index}
                    option={option}
                    index={index}
                    totalVotes={totalVotes}
                    userVoteIndex={userVoteIndex}
                    onVote={handleVote}
                    isVoting={isVoting}
                    hasVoted={hasVoted}
                    primaryColor={primaryColor}
                    borderColor={borderColor}
                    surfaceColor={surfaceColor}
                    textColor={textColor}
                    lightTextColor={lightTextColor}
                />
            ))}
            <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption, marginTop: spacing.xs, marginLeft: spacing.xs }}>
                {String(totalVotes)} {totalVotes === 1 ? 'vote' : 'votes'}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: spacing.sm,
        gap: spacing.sm,
    },
    optionButton: {
        height: 44,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        borderWidth: 1,
        overflow: 'hidden',
    },
    progressBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
    },
    contentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    resultContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        marginRight: spacing.sm,
    },
});