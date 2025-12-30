import { Href, Link } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps } from 'react';
import { Platform, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Props for ExternalLink, extending standard Expo Router Link props.
 * We use 'string' for href to ensure compatibility with openBrowserAsync.
 */
type Props = Omit<ComponentProps<typeof Link>, 'href'> & { 
  href: string;
  asChild?: boolean;
};

export function ExternalLink({ href, asChild, onPress, ...rest }: Props) {
  
  const handlePress = async (event: any) => {
    // Call custom onPress if provided
    onPress?.(event);

    // Logic for Native (iOS/Android)
    if (Platform.OS !== 'web') {
      // Prevent the default deep-linking behavior
      event.preventDefault();
      
      try {
        // Open the link in a high-quality in-app browser
        await openBrowserAsync(href, {
          presentationStyle: WebBrowserPresentationStyle.FULL_SCREEN,
          toolbarColor: '#FFFFFF', // Can be linked to your design tokens
          enableBarCollapsing: true,
          showTitle: true,
        });
      } catch (error) {
        console.error("Failed to open external link:", error);
      }
    }
  };

  return (
    <Link
      {...rest}
      href={href as Href}
      onPress={handlePress}
      asChild={asChild}
      // On web, it renders as a standard <a> tag with target="_blank"
      target="_blank" 
      rel="noopener noreferrer"
    />
  );
}