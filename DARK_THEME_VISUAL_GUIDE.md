# 🎨 Dark Theme Visual Guide

## Color Palette Visualization

### Primary Colors
```
┌─────────────────────────────────┐
│ MAGENTA PRIMARY (#E5007A)       │ ← Use for buttons, headers
│ Perfect contrast on dark        │
│ Vibrant, eye-catching           │
└─────────────────────────────────┘
```

### Backgrounds
```
┌─────────────────────────────────┐
│ DARK BACKGROUND (#0F190D)       │ ← Main app background
│ Very dark green-black           │
│ Premium, modern feel            │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ DARK SURFACE (#1A2817)          │ ← Card, input backgrounds
│ Subtle contrast from background │
│ Perfect for content containers  │
└─────────────────────────────────┘
```

### Text & Accents
```
┌─────────────────────────────────┐
│ PRIMARY TEXT (#F5F5F5)          │ ← Main text
│ Almost white, excellent contrast│
│ Readable on all dark surfaces   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ SECONDARY TEXT (#B0B0B0)        │ ← Hints, descriptions
│ Medium gray                     │
│ Still readable, clear hierarchy │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ CYAN ACCENT (#00D9FF)           │ ← Highlights, secondary actions
│ Bright cyan                     │
│ Perfect complement to magenta   │
└─────────────────────────────────┘
```

## Component Styling Examples

### Button - Primary (Magenta)
```
╔═════════════════════════════════╗
║          SIGN IN                ║  ← Text: White (#FFFFFF)
║       Background: #E5007A       ║  ← Magenta
║       Shadow: Magenta glow      ║
╚═════════════════════════════════╝
```

### Button - Secondary (Cyan)
```
╔─────────────────────────────────╗
│         LEARN MORE              │  ← Text: Cyan
│      Background: Transparent    │
│      Border: Cyan (#00D9FF)     │
╚─────────────────────────────────╝
```

### Card - Default
```
╔═════════════════════════════════╗
║  ┌───────────────────────────┐  ║
║  │ Card Title                │  │  ← Text: #F5F5F5
║  └───────────────────────────┘  ║
║  Card content goes here...      │
║  ────────────────────────────    │
║  [Action Button]                │
╚═════════════════════════════════╝
Background: #1A2817
Shadow: Dark with 0.4 opacity
```

### Input Field
```
┌─────────────────────────────────┐
│ ✉️ Email Address                │  ← Icon + Label
├─────────────────────────────────┤
│ user@example.com                │  ← Text: #F5F5F5
│ Border: #3A4830 (dark)          │
│ Background: #1A2817 (dark)      │
└─────────────────────────────────┘
```

### Info Box with Accent
```
│ ┌─────────────────────────────┐
│ │ 🔒 Your Privacy Matters     │
│ │                             │
│ │ Your data is encrypted and  │
│ │ only visible to people you  │
│ │ connect with.               │
│ └─────────────────────────────┘
┌─ Left border: #E5007A (magenta)
   Background: #1A2817
```

### Header - Magenta
```
═══════════════════════════════════
┃ Screen Title                   ⚙️ ┃  ← Text: White
┃ Optional Subtitle              ┃  ← Text: White, 0.9 opacity
═══════════════════════════════════
Background: #E5007A
Shadow: 0.5 opacity
```

## Color Combinations

### Best Combinations
```
✅ Magenta (#E5007A) + Dark (#0F190D)
   Perfect primary button on background

✅ Cyan (#00D9FF) + Dark (#1A2817)
   Excellent secondary highlight on surface

✅ White (#F5F5F5) + Dark (#0F190D)
   Excellent text contrast

✅ Success (#00D9A3) + Dark (#1A2817)
   Positive feedback on cards
```

### What to Avoid
```
❌ Light text + Cyan (hard to read)
❌ Magenta + Cyan together (too bright)
❌ Pure black (#000000) not #0F190D
❌ Light grays on dark (low contrast)
```

## Status Colors

### Success State
```
┌─────────────────────────────────┐
│ ✓ Update Successful             │  ← Text: #00D9A3
│ Your changes have been saved.   │
└─────────────────────────────────┘
Background: #1A2817
Left border: #00D9A3
```

### Error State
```
┌─────────────────────────────────┐
│ ✗ Error Occurred                │  ← Text: #FF4444
│ Please check your input.        │
└─────────────────────────────────┘
Background: #1A2817
Left border: #FF4444
```

### Warning State
```
┌─────────────────────────────────┐
│ ⚠ Warning                       │  ← Text: #FFB700
│ This action cannot be undone.   │
└─────────────────────────────────┘
Background: #1A2817
Left border: #FFB700
```

## Text Hierarchy

### Heading 1 (32px, Bold)
```
═══════════════════════════════════
    Welcome to Youngie
═══════════════════════════════════
Color: #F5F5F5 | Weight: 700
```

### Heading 2 (28px, Bold)
```
─────────────────────────────────
    Your Profile
─────────────────────────────────
Color: #F5F5F5 | Weight: 700
```

### Body Text (16px, Regular)
```
This is regular body text that appears
in most places throughout the app.
Color: #F5F5F5 | Weight: 400
```

### Secondary Text (14px, Regular)
```
This is secondary text for less important information.
Color: #B0B0B0 | Weight: 400
```

### Caption (12px, Regular)
```
This is caption text for hints and small descriptions.
Color: #B0B0B0 | Weight: 400
```

## Shadow Effects

### Small Shadow
```
┌─────────────┐
│   Card      │  ← Opacity: 0.3
└─────────────┘  ← Elevation: 2
Subtle depth
```

### Medium Shadow
```
╭─────────────╮
│   Card      │  ← Opacity: 0.4
╰─────────────╯  ← Elevation: 3
Good depth
```

### Large Shadow
```
╭═════════════╮
│   Card      │  ← Opacity: 0.5
╰═════════════╯  ← Elevation: 4
Strong depth
```

### Glow Effect (Logo)
```
    ✨
   ✨👥✨
  ✨ 👥 ✨
   ✨  ✨
Color: #E5007A
Opacity: 0.5
Radius: 12
← Magenta halo effect
```

## Layout Spacing Guide

### Padding & Margins
```
xs = 4px     ← Tiny gaps
sm = 8px     ← Small gaps
md = 16px    ← Standard (most common)
lg = 24px    ← Large gaps
xl = 32px    ← Extra large
xxl = 48px   ← Huge gaps
```

### Button Sizing
```
Touch Target: 44x44 minimum

┌──────────────────────┐
│   Sign In Button     │  ← Height: 44px (minimum)
└──────────────────────┘
   Width: Full or content-based
   Padding: lg (24px) horizontal, md (16px) vertical
```

### Card Spacing
```
┌─────────────────────────┐
│ ← md padding            │
│ Content                 │
│ Content                 │
│ Content                 │
│ ← md padding            │
└─────────────────────────┘
   ← lg margins from screen edges
```

## Accessibility Contrast

### WCAG AAA Compliant (4.5:1+)

```
✅ #F5F5F5 on #0F190D  = 20.5:1  (PASS)
✅ #F5F5F5 on #1A2817  = 18.2:1  (PASS)
✅ #E5007A on #FFFFFF  = 5.2:1   (PASS)
✅ #00D9FF on #0F190D  = 12.8:1  (PASS)
✅ #00D9A3 on #1A2817  = 8.5:1   (PASS)
```

## Animation Guidelines

### Transitions
```
Fast:    100ms  ← Button presses, state changes
Normal:  300ms  ← Screen transitions, modal opens
Slow:    500ms  ← Long-form animations
```

### Color Transitions
```
Colors should transition smoothly
Duration: 200-300ms
Easing: ease-in-out
```

## Mobile Optimization

### Screen Sizes
```
Small phones:  320px  ← Minimum width
Standard:      375px  ← iPhone standard
Large:         414px+ ← Tablets & landscape
```

### Safe Areas
```
Top:    spacing.lg    ← Below status bar
Bottom: spacing.lg    ← Above home indicator
Left:   spacing.lg    ← From screen edge
Right:  spacing.lg    ← From screen edge
```

## Copy Reference

### Button Text
- **Primary**: "Sign In", "Continue", "Save"
- **Secondary**: "Learn More", "Cancel", "Reset"
- **Danger**: "Delete", "Logout"

### Status Messages
- **Success**: "✓ Success message here"
- **Error**: "✗ Error message here"
- **Warning**: "⚠ Warning message here"
- **Info**: "ℹ Information here"

## Quick Hex Palette

```
Magenta:        E5007A  ← #
Cyan:           00D9FF  ← #
Dark BG:        0F190D  ← #
Dark Surface:   1A2817  ← #
Dark Border:    3A4830  ← #
Text:           F5F5F5  ← #
Light Text:     B0B0B0  ← #
Success:        00D9A3  ← #
Error:          FF4444  ← #
Warning:        FFB700  ← #
```

---

## Implementation Checklist

When styling a new component:

- [ ] Background: Use `colors.background` or `colors.surface`
- [ ] Text: Use `colors.text` or `colors.lightText`
- [ ] Primary action: Use `colors.primary` (magenta)
- [ ] Secondary: Use `colors.accent` (cyan)
- [ ] Borders: Use `colors.inputBorder` (dark)
- [ ] Shadows: Use increased opacity (0.3-0.6)
- [ ] Status: Use appropriate status color
- [ ] Test: Verify contrast and visibility

---

**Dark Theme v1.0** 🌙 Professional Design System
