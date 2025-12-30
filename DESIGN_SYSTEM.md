# Youngie Design System

## Overview
A comprehensive, centralized design system for the Youngie app built with React Native and Expo. All design tokens, colors, typography, spacing, and shadows are managed in a single source of truth.

## Architecture

### Core Files

#### 1. **`constants/design-tokens.ts`** - Design Token System
Central repository for all design values:

- **Colors** - Modern indigo/pink scheme with comprehensive palette
  - Primary: Indigo (#6366F1) - Main brand color
  - Secondary: Pink (#EC4899) - Call-to-action, signup
  - Accent: Teal (#14B8A6) - Secondary actions
  - Neutrals: Full slate of grays for backgrounds and text
  - Status: Success (green), Warning (amber), Error (red)

- **Spacing Scale** (4px baseline)
  - `xs`: 4px | `sm`: 8px | `md`: 16px | `lg`: 24px | `xl`: 32px | `xxl`: 48px

- **Typography**
  - **Sizes**: heading1 (32px) → tiny (10px)
  - **Weights**: light (300) → extrabold (800)
  - All weights as numeric values for React Native compatibility

- **Border Radius**
  - `sm`: 4px | `md`: 8px | `lg`: 12px | `xl`: 16px | `round`: 999px

- **Shadow System** (4 levels)
  - `sm`, `md`, `lg`, `xl` with proper elevation for Android

#### 2. **`components/icon-system.tsx`** - Icon Library
Professional emoji-based icon system with 20+ icons:

- **Navigation Icons**: Home, Chat, Compass, Flame, User
- **Action Icons**: Heart, HeartFilled, Comment, Share, Send, Plus
- **Utility Icons**: Search, Settings, Bell, Edit, Trash, LogOut, Check, Close
- **IconBadge Component**: Notification badges with count display

#### 3. **`components/header.tsx`** - Header Component
Reusable header with customization:
- Title and subtitle support
- Right icon with press handler
- Background color customization
- Border toggle option
- Proper spacing and shadows

#### 4. **`components/card.tsx`** - Card Component System
Flexible card layout with 3 variants:
- **default**: Standard card with subtle shadow
- **elevated**: Enhanced shadow for prominence
- **outlined**: Bordered card without shadow
- Composition pattern: `Card` > `CardHeader` > `CardContent` > `CardFooter`

#### 5. **`constants/styles.ts`** - Style Patterns
Reusable style combinations (expandable):
- Common styles for cards, buttons, inputs
- Theme-aware style patterns
- Ready for application across screens

### Redesigned Screens

#### `app/login.tsx`
**Features:**
- Logo in colored primary container (80x80) with shadow
- Icon-prefixed inputs:
  - ✉️ Email field
  - 🔒 Password with show/hide toggle
- Professional feature cards with icon boxes
- Sign-up link
- Design token integration throughout
- Fully functional with auth context

#### `app/signup.tsx`
**Features:**
- Logo in colored secondary container (pink)
- Icon-prefixed form fields:
  - 👤 Username
  - ✉️ Email
  - 🎂 Age (validation 13-18)
  - 🔒 Password with show/hide toggle
- Info box with left border accent (pink)
- Privacy messaging
- Design token integration
- Full registration flow

## Color Palette

```
Primary:    #6366F1 (Indigo)
Secondary:  #EC4899 (Pink)
Accent:     #14B8A6 (Teal)
Success:    #10B981 (Green)
Warning:    #F59E0B (Amber)
Error:      #EF4444 (Red)
Background: #F8FAFC (Slate 50)
Surface:    #FFFFFF (White)
Text:       #1E293B (Slate 800)
Light Text: #64748B (Slate 500)
```

## Usage Examples

### Using Design Tokens
```typescript
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design-tokens';

// In styles
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  } as ViewStyle,
});
```

### Using Icon System
```typescript
import { Icons, IconBadge } from '@/components/icon-system';

// Icon component
<Icons.Heart size={24} color={colors.error} />

// Icon with badge
<IconBadge icon="💬" badge={5} size={24} />
```

### Using Header Component
```typescript
import Header from '@/components/header';

<Header
  title="Chat"
  subtitle="3 messages"
  rightIconName="settings"
  onRightIconPress={() => {}}
/>
```

### Using Card Component
```typescript
import Card, { CardHeader, CardContent } from '@/components/card';

<Card variant="elevated">
  <CardHeader title="Profile" />
  <CardContent>
    {/* Card content */}
  </CardContent>
</Card>
```

## TypeScript Compatibility

All design tokens use React Native-compatible types:
- Font weights are numeric values (300-800)
- Shadows properly typed with shadow properties
- Explicit `ViewStyle` and `TextStyle` annotations
- Full type safety throughout the system

## Benefits

✅ **Consistency** - Single source of truth for all design values
✅ **Maintainability** - Easy to update colors, spacing, typography globally
✅ **Efficiency** - Reusable components reduce code duplication
✅ **Professional** - Enterprise-grade design system
✅ **Scalable** - Ready for additional components and screens
✅ **Type-Safe** - Full TypeScript support

## Integration Plan

### Current Status ✅
- Design tokens system created and tested
- Login/Signup screens completely redesigned
- Icon system implemented
- Header component created
- Card component system created
- All TypeScript errors resolved

### Next Steps 📋
1. Apply design tokens to feed/home screen (index.tsx)
2. Update chat screen with professional styling
3. Redesign profile screen with card components
4. Apply design system to explore screen
5. Update swipe screen with professional cards
6. Create additional UI components (Button, TextInput wrappers)
7. Update tab navigation with professional icons
8. Add animations and transitions

## File Structure
```
youngie/
├── constants/
│   ├── design-tokens.ts     ← Core design system
│   ├── styles.ts             ← Reusable patterns
│   └── theme.ts              (existing)
├── components/
│   ├── icon-system.tsx       ← Icon library
│   ├── header.tsx            ← Header component
│   ├── card.tsx              ← Card component
│   └── (other components)
└── app/
    ├── login.tsx             ← Redesigned
    ├── signup.tsx            ← Redesigned
    └── (other screens)
```

## Notes

- All colors are accessible and WCAG-compliant
- Shadow system optimized for both iOS and Android
- Icons are emoji-based for rapid prototyping (can be replaced with native icons later)
- Typography system supports all text hierarchy levels
- Component library is extensible for future additions

---

**Last Updated**: Design system v1.0 complete with zero TypeScript errors
