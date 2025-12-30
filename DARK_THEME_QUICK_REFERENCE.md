# 🌙 Dark Theme Quick Reference

## Color Palette

```
PRIMARY:       #E5007A  ← Vibrant Magenta - Use for buttons, headers
ACCENT:        #00D9FF  ← Cyan - Use for highlights, secondary actions
BACKGROUND:   #0F190D  ← Dark Green-Black - App background
SURFACE:      #1A2817  ← Dark Surface - Cards, inputs, containers
SURFACE LIGHT: #2A3820  ← Lighter surface for subtle contrast

TEXT:          #F5F5F5  ← Almost white - Primary text
LIGHT TEXT:    #B0B0B0  ← Medium gray - Secondary text
LIGHTER TEXT:  #808080  ← Darker gray - Tertiary text

BORDER:        #3A4830  ← Dark border - Input borders, dividers
DIVIDER:       #2A3820  ← Dark divider - Subtle separators

STATUS:
- Success:     #00D9A3  ← Teal green
- Warning:     #FFB700  ← Golden amber
- Error:       #FF4444  ← Bright red
- Online:      #00D9A3  ← Green
- Offline:     #808080  ← Gray
- Away:        #FFB700  ← Amber
```

## Common Usage Patterns

### Primary Button
```typescript
backgroundColor: colors.primary,     // #E5007A
color: colors.white,
paddingVertical: spacing.md,
borderRadius: borderRadius.md,
shadowColor: colors.primary,
shadowOpacity: 0.4,
```

### Input Field
```typescript
backgroundColor: colors.inputBackground,  // #1A2817
borderColor: colors.inputBorder,
borderWidth: 1,
color: colors.text,
placeholderTextColor: colors.lightText,
```

### Card
```typescript
backgroundColor: colors.surface,     // #1A2817
borderRadius: borderRadius.lg,
shadowColor: colors.shadow,
shadowOpacity: 0.4,
elevation: 3,
```

### Glow Effect (Logo)
```typescript
shadowColor: colors.primary,         // #E5007A
shadowOpacity: 0.5,
shadowRadius: 12,
elevation: 4,
```

### Text
```typescript
// Primary text
color: colors.text,                  // #F5F5F5
fontSize: typography.sizes.body1,
fontWeight: 500,

// Secondary text
color: colors.lightText,             // #B0B0B0
fontSize: typography.sizes.body2,
fontWeight: 400,
```

### Header
```typescript
backgroundColor: colors.primary,     // #E5007A (magenta)
paddingVertical: spacing.md,
shadowOpacity: 0.5,
elevation: 3,
```

## Dark Theme Specific Tips

### Shadows in Dark Mode
- Increase opacity values (use 0.3-0.6 instead of 0.08-0.15)
- Keep elevation values normal or slightly higher
- Use actual black shadows, not tinted shadows
- Test on actual devices - simulators may show different results

### Text on Dark
- Use #F5F5F5 for primary text (not pure white)
- Use #B0B0B0 for secondary text
- Maintain sufficient contrast for WCAG AA/AAA
- Avoid light grays on dark surfaces

### Colors That Pop
- #E5007A Magenta - Perfect for buttons and accents
- #00D9FF Cyan - Great for secondary highlights
- #FFB700 Gold - Perfect for warnings/premium
- #FF4444 Red - Bright error states

### When to Use Each Color

**Primary (#E5007A) - Use for:**
- Main call-to-action buttons
- Header backgrounds
- Active state indicators
- Key interactive elements

**Accent (#00D9FF) - Use for:**
- Secondary buttons
- Link text
- Active tab indicators
- Highlight/special features

**Surface (#1A2817) - Use for:**
- Card backgrounds
- Input field backgrounds
- Modal backgrounds
- Any content container

**Status Colors - Use for:**
- Success: #00D9A3 (positive feedback)
- Error: #FF4444 (negative feedback)
- Warning: #FFB700 (attention needed)
- Online: #00D9A3 (user status)

## Component Examples

### Styled Button
```tsx
<TouchableOpacity style={{
  backgroundColor: colors.primary,
  paddingVertical: spacing.md,
  paddingHorizontal: spacing.lg,
  borderRadius: borderRadius.md,
  shadowColor: colors.primary,
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 3,
  alignItems: 'center',
}}>
  <ThemedText style={{
    color: colors.white,
    fontWeight: 600,
    fontSize: typography.sizes.body1,
  }}>
    Sign In
  </ThemedText>
</TouchableOpacity>
```

### Card Component
```tsx
<Card variant="elevated">
  <CardHeader>
    <ThemedText style={{
      fontSize: typography.sizes.title,
      fontWeight: 600,
      color: colors.text,
    }}>
      Card Title
    </ThemedText>
  </CardHeader>
  <CardContent>
    <ThemedText style={{ color: colors.lightText }}>
      Card content here
    </ThemedText>
  </CardContent>
</Card>
```

### Input Field
```tsx
<View style={{
  backgroundColor: colors.inputBackground,
  borderWidth: 1,
  borderColor: colors.inputBorder,
  borderRadius: borderRadius.md,
  paddingHorizontal: spacing.md,
  flexDirection: 'row',
  alignItems: 'center',
}}>
  <ThemedText style={{ fontSize: 18, marginRight: spacing.sm }}>✉️</ThemedText>
  <TextInput
    style={{
      flex: 1,
      color: colors.text,
      fontSize: typography.sizes.body1,
    }}
    placeholderTextColor={colors.lightText}
    placeholder="Email"
  />
</View>
```

### Accent Highlight
```tsx
<View style={{
  backgroundColor: colors.surface,
  borderLeftWidth: 4,
  borderLeftColor: colors.primary,  // Magenta accent
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  borderRadius: borderRadius.md,
}}>
  <ThemedText style={{ color: colors.text }}>
    Important message
  </ThemedText>
</View>
```

## Converting Screens to Dark Theme

1. **Background**: Set to `colors.background` (#0F190D)
2. **Cards**: Use `colors.surface` (#1A2817)
3. **Text**: Use `colors.text` (#F5F5F5)
4. **Buttons**: Use `colors.primary` (#E5007A)
5. **Accents**: Use `colors.accent` (#00D9FF)
6. **Shadows**: Increase opacity to 0.3-0.6
7. **Borders**: Use `colors.inputBorder` (#3A4830)

## Testing the Dark Theme

- [ ] Check text contrast (WCAG AA minimum)
- [ ] Verify shadows are visible on dark background
- [ ] Test buttons have sufficient padding
- [ ] Check input fields are easily clickable
- [ ] Verify icons/emojis are visible
- [ ] Test on actual device (simulator can differ)
- [ ] Check status colors (success, error, warning)
- [ ] Verify all links are clickable and obvious

## Accessibility Checklist

✅ Text contrast meets WCAG AAA (4.5:1 or higher)
✅ Buttons have adequate size (44x44 minimum)
✅ Touch targets have adequate spacing
✅ Color isn't used alone to convey information
✅ Focus states are visible
✅ All interactive elements are keyboard accessible

## Quick Hex Reference

```
Magenta:  #E5007A ← Primary CTA color
Cyan:     #00D9FF ← Secondary accent
Dark BG:  #0F190D ← App background
Dark FG:  #1A2817 ← Cards & surfaces
Text:     #F5F5F5 ← Primary text
Gray:     #B0B0B0 ← Secondary text
Border:   #3A4830 ← Input borders
Success:  #00D9A3 ← Positive feedback
Error:    #FF4444 ← Negative feedback
Warning:  #FFB700 ← Alert state
```

---

**Pro Tips:**
- Always test shadows on actual device
- Keep text at least #B0B0B0 for readability
- Use magenta sparingly for key actions
- Maintain consistent spacing with token system
- Remember: dark theme ≠ black theme (use #0F190D, not #000000)

---

**Dark Theme v1.0** ✨ Professional, Accessible, Production-Ready
