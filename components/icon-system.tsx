import React from 'react';
import { View, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { colors, spacing, borderRadius, typography } from '@/constants/design-tokens';

// Updated IconProps to include standard Vector Icon properties
interface IconProps {
  size?: number;
  color?: string;
  focused?: boolean; // Added for Tab navigation states
  style?: ViewStyle;
}

/**
 * Universal Icon Component
 * Maps your internal names to professional Vector Icons
 */
const VectorIcon = ({ 
  name, 
  size = 24, 
  color = colors.text, 
  focused, 
  style 
}: { name: keyof typeof Ionicons.glyphMap; size?: number; color?: string; focused?: boolean; style?: ViewStyle }) => {
  // Logic to switch between outline and filled versions based on focus
  const iconName = focused ? String(name) : `${String(name)}-outline`;

  return (
    <View style={[styles.iconWrapper, { width: size, height: size }, style]}>
      <Ionicons name={iconName as any} size={size} color={color} />
    </View>
  );
};

export const Icons = {
  // Navigation (Context aware)
  Home: (props: IconProps) => <VectorIcon name="home" {...props} />,
  Chat: (props: IconProps) => <VectorIcon name="chatbubble-ellipses" {...props} />,
  Compass: (props: IconProps) => <VectorIcon name="compass" {...props} />,
  Flame: (props: IconProps) => <VectorIcon name="flame" {...props} />,
  User: (props: IconProps) => <VectorIcon name="person" {...props} />,

  // Actions
  Heart: (props: IconProps) => <VectorIcon name={props.focused ? "heart" : "heart-outline"} {...props} />,
  Comment: (props: IconProps) => <VectorIcon name="chatbubble" {...props} />,
  Share: (props: IconProps) => <VectorIcon name="share-social" {...props} />,
  Plus: (props: IconProps) => <VectorIcon name="add-circle" size={props.size ? props.size * 1.2 : 32} {...props} />,
  
  // Utility
  Settings: (props: IconProps) => <VectorIcon name="settings-sharp" {...props} />,
  Bell: (props: IconProps) => <VectorIcon name="notifications" {...props} />,
  Trash: (props: IconProps) => <VectorIcon name="trash-bin" {...props} />,
  Close: (props: IconProps) => <VectorIcon name="close" {...props} />,
};

/**
 * Redesigned IconBadge with Animation
 */
export const IconBadge: React.FC<{
  iconName: keyof typeof Icons;
  badge?: number;
  size?: number;
  color?: string;
}> = ({ iconName, badge, size = 24, color = colors.text }: { iconName: keyof typeof Icons; badge?: number; size?: number; color?: string }) => {
  const IconComponent = Icons[iconName as keyof typeof Icons] as any;

  return (
    <View style={styles.badgeContainer}>
      <IconComponent size={size} color={color} />
      {badge && badge > 0 && (
        <Animated.View 
          entering={ZoomIn.duration(300)} 
          style={[styles.badge, { minWidth: size * 0.7, height: size * 0.7 }]}
        >
          <Text style={[styles.badgeText, { fontSize: size * 0.35 }]}>
            {badge > 99 ? '99' : badge}
          </Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: colors.primary || '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontWeight: '800',
  },
});