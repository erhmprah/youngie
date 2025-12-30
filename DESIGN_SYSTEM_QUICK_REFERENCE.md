# Youngie Design System - Quick Reference

## Essential Imports
```typescript
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design-tokens';
import { Icons, IconBadge } from '@/components/icon-system';
import Header from '@/components/header';
import Card, { CardHeader, CardContent, CardFooter } from '@/components/card';
```

## Color Tokens Quick Access
```typescript
// Backgrounds
colors.background    // #F8FAFC - Main app background
colors.surface       // #FFFFFF - Card/content background

// Text
colors.text          // #1E293B - Primary text
colors.lightText     // #64748B - Secondary text
colors.lighterText   // #94A3B8 - Tertiary text

// Actions
colors.primary       // #6366F1 - Main buttons, key actions
colors.secondary     // #EC4899 - Sign-up, secondary actions
colors.accent        // #14B8A6 - Accents, highlights

// Status
colors.success       // #10B981
colors.warning       // #F59E0B
colors.error         // #EF4444

// Inputs
colors.inputBorder   // #E2E8F0
colors.inputText     // #1E293B
```

## Spacing Scale
```typescript
spacing.xs   // 4px  - Tiny gaps
spacing.sm   // 8px  - Small gaps
spacing.md   // 16px - Standard gaps
spacing.lg   // 24px - Large gaps
spacing.xl   // 32px - Extra large
spacing.xxl  // 48px - Huge gaps

// Common usage:
gap: spacing.md              // Gap between elements
padding: spacing.lg          // Standard padding
marginBottom: spacing.xl     // Standard margins
```

## Typography
```typescript
// Sizes
typography.sizes.heading1    // 32px
typography.sizes.heading2    // 28px
typography.sizes.heading3    // 24px
typography.sizes.heading4    // 20px
typography.sizes.title       // 18px
typography.sizes.body1       // 16px
typography.sizes.body2       // 14px
typography.sizes.caption     // 12px
typography.sizes.tiny        // 10px

// Weights (use numeric values)
fontWeight: 300              // Light
fontWeight: 400              // Regular
fontWeight: 500              // Medium
fontWeight: 600              // Semibold
fontWeight: 700              // Bold
fontWeight: 800              // Extrabold
```

## Border Radius
```typescript
borderRadius.sm      // 4px  - Small, subtle
borderRadius.md      // 8px  - Standard
borderRadius.lg      // 12px - Medium
borderRadius.xl      // 16px - Large
borderRadius.round   // 999px - Pill/circular
```

## Shadows
```typescript
// Apply to views:
shadowColor: shadows.sm.shadowColor,
shadowOffset: shadows.sm.shadowOffset,
shadowOpacity: shadows.sm.shadowOpacity,
shadowRadius: shadows.sm.shadowRadius,
elevation: shadows.sm.elevation,

// Or spread individual shadow levels:
// shadows.sm, shadows.md, shadows.lg, shadows.xl
```

## Component Patterns

### Basic View with Styling
```typescript
<View style={{
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
  backgroundColor: colors.surface,
  borderRadius: borderRadius.md,
  shadowColor: shadows.sm.shadowColor,
  shadowOffset: shadows.sm.shadowOffset,
  shadowOpacity: shadows.sm.shadowOpacity,
  shadowRadius: shadows.sm.shadowRadius,
  elevation: shadows.sm.elevation,
}}>
  <ThemedText style={{
    fontSize: typography.sizes.body1,
    fontWeight: 600,
    color: colors.text,
  }}>
    Content
  </ThemedText>
</View>
```

### Using Card Component
```typescript
<Card variant="elevated">
  <CardHeader title="Title" subtitle="Subtitle" />
  <CardContent>
    <ThemedText>Content goes here</ThemedText>
  </CardContent>
  <CardFooter>
    <TouchableOpacity>
      <ThemedText style={{ color: colors.primary }}>Action</ThemedText>
    </TouchableOpacity>
  </CardFooter>
</Card>
```

### Using Header Component
```typescript
<Header
  title="Screen Title"
  subtitle="Optional subtitle"
  rightIconName="settings"
  onRightIconPress={() => navigation.goBack()}
  backgroundColor={colors.surface}
/>
```

### Icon System Usage
```typescript
// Individual icons
<Icons.Heart size={24} color={colors.error} />
<Icons.Chat size={20} color={colors.primary} />

// Icons with badges
<IconBadge 
  icon="💬" 
  badge={unreadCount} 
  size={24} 
  color={colors.text} 
/>
```

## Common Style Patterns

### Card Style
```typescript
backgroundColor: colors.surface,
borderRadius: borderRadius.lg,
paddingHorizontal: spacing.lg,
paddingVertical: spacing.md,
shadowColor: shadows.sm.shadowColor,
shadowOffset: shadows.sm.shadowOffset,
shadowOpacity: shadows.sm.shadowOpacity,
shadowRadius: shadows.sm.shadowRadius,
elevation: shadows.sm.elevation,
```

### Input Style
```typescript
borderWidth: 1,
borderColor: colors.inputBorder,
borderRadius: borderRadius.md,
backgroundColor: colors.white,
paddingHorizontal: spacing.md,
paddingVertical: spacing.sm,
fontSize: typography.sizes.body1,
color: colors.inputText,
```

### Button Style
```typescript
backgroundColor: colors.primary,
paddingVertical: spacing.md,
paddingHorizontal: spacing.lg,
borderRadius: borderRadius.md,
alignItems: 'center',
justifyContent: 'center',
shadowColor: shadows.md.shadowColor,
shadowOffset: shadows.md.shadowOffset,
shadowOpacity: shadows.md.shadowOpacity,
shadowRadius: shadows.md.shadowRadius,
elevation: shadows.md.elevation,
```

## Next Screens to Update

1. **Feed/Home (`app/(tabs)/index.tsx`)**
   - Replace hardcoded colors with design tokens
   - Use Card component for posts
   - Apply Header component
   - Update icon usage

2. **Chat (`app/(tabs)/chat.tsx`)**
   - Use Card for chat list items
   - Apply Icon system for status indicators
   - Use Header with badge support
   - Professional input styling

3. **Profile (`app/(tabs)/profile.tsx`)**
   - Card variant: outlined for user info
   - Stats section with professional layout
   - Use Icon system for profile actions
   - Settings list with proper spacing

4. **Explore (`app/(tabs)/explore.tsx`)**
   - Category cards with proper spacing
   - Professional search input
   - Filter buttons with design tokens
   - Icon-based quick actions

5. **Swipe (`app/(tabs)/swipe.tsx`)**
   - Large cards with elevated variant
   - Action buttons with proper spacing
   - Icon badges for match info
   - Smooth transitions between cards

## StyleSheet Type Safety Template
```typescript
const styles = StyleSheet.create<{
  container: ViewStyle;
  text: TextStyle;
}>({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  text: {
    fontSize: typography.sizes.body1,
    color: colors.text,
  } as TextStyle,
});
```

## Common Mistakes to Avoid

❌ Hardcoding colors: `backgroundColor: '#6366F1'`
✅ Use tokens: `backgroundColor: colors.primary`

❌ Using string font weights: `fontWeight: 'bold'`
✅ Use numeric: `fontWeight: 700`

❌ Spreading shadows: `...shadows.md`
✅ Expand properties: `shadowColor: shadows.md.shadowColor, ...`

❌ Inconsistent spacing: `padding: 10`
✅ Use scale: `padding: spacing.md`

## Testing Checklist

- [ ] Colors render correctly on light/dark backgrounds
- [ ] Text is readable with sufficient contrast
- [ ] Shadows display properly on Android and iOS
- [ ] Spacing is consistent across all screens
- [ ] Icons display at correct sizes
- [ ] Components are responsive on different screen sizes
- [ ] No TypeScript errors in build

---

**Pro Tip**: Export frequently used style combinations from `constants/styles.ts` to reduce duplication and ensure consistency!
