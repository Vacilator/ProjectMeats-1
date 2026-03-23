# Shared Styled Components

This directory contains the unified styled-components library for ProjectMeats frontend.

## Purpose

Provides semantic, reusable styled components with descriptive display names, replacing auto-generated classnames (sc-XXXXX) for better debugging and maintainability.

## Configuration

### Babel Plugin (vite.config.ts)

The `babel-plugin-styled-components` is configured with:
- **displayName**: `true` - Adds readable component names to DOM
- **fileName**: `true` - Includes file location for debugging
- **ssr**: `false` - Client-side only
- **minify**: `true` - Removes whitespace in production
- **transpileTemplateLiterals**: `true` - Optimizes template literals
- **pure**: `true` - Enables dead code elimination

### Benefits

1. **Better Debugging**: CSS class names match component names in DevTools
2. **Easier Maintenance**: Find components quickly by searching for class names
3. **Performance**: Tree-shaking removes unused components
4. **Type Safety**: Full TypeScript support with generic props

## Usage

### Import Components

```typescript
import { FlexContainer, Button, Card, Badge } from '@/styles/shared';
```

### Basic Examples

```typescript
// Layout
<FlexContainer $direction="column" $gap="16px">
  <Card $shadow>Content</Card>
</FlexContainer>

// Buttons
<Button $variant="primary" $size="lg">Save</Button>
<Button $variant="danger" $size="sm">Delete</Button>

// Inputs
<Input $error={hasError} placeholder="Enter text" />

// Badges
<Badge $variant="success">Active</Badge>
<Badge $variant="error">Failed</Badge>
```

## Available Components

### Layout
- `FlexContainer` - Flexible box layout with direction, gap, align, justify
- `GridContainer` - CSS grid layout with columns, rows, gap
- `Card` - Content card with optional shadow
- `Panel` - Bordered panel with variant colors

### Buttons
- `Button` - Standard button with variants (primary, secondary, ghost, danger)

### Forms
- `Input` - Text input with error state
- `Badge` - Status badge with color variants

## Transient Props ($prefix)

All props starting with `$` are **transient props** - they don't pass through to the DOM, preventing React warnings. Always use `$` prefix for styled-component props.

```typescript
// ✅ Correct
<Button $variant="primary">Click</Button>

// ❌ Wrong (React warning)
<Button variant="primary">Click</Button>
```

## Migration Guide

### Before (Inline Styles)
```typescript
const MyButton = styled.button`
  background: blue;
  color: white;
`;
```

### After (Shared Component)
```typescript
import { Button } from '@/styles/shared';

<Button $variant="primary">Click</Button>
```

## Best Practices

1. **Use Shared Components First**: Check if a shared component exists before creating inline styles
2. **Extend When Needed**: Use styled() to extend shared components for specific use cases
3. **Keep Props Semantic**: Use descriptive prop names ($variant, $size, $error)
4. **Follow Theme Variables**: Use CSS custom properties (--color-primary) for colors

## Adding New Components

When adding new shared components:

1. Add to `shared.ts` with proper TypeScript types
2. Use transient props ($prefix) for all styled props
3. Follow existing naming conventions
4. Add JSDoc comments
5. Update this README with usage examples

## Performance Considerations

- Components are tree-shaken in production builds
- Minification removes all unnecessary whitespace
- Pure annotations enable better code elimination
- Display names only add ~1-2% to bundle size
