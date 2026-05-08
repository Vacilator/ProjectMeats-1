# Keyboard Shortcuts

> **Authority**: This file is the single source of truth for all keyboard shortcuts in Meats Central.

## Global Shortcuts

These work anywhere in the application (except when focused on text inputs).

| Shortcut | Action | Component |
|----------|--------|-----------|
| `Ctrl+K` / `⌘K` | Open Command Palette (universal search) | `CommandPalette` |
| `Ctrl+Shift+K` / `⌘⇧K` | Open AI Command Center (Omnibox) | `AICommandCenter` |
| `Ctrl+J` / `⌘J` | Toggle AI Assistant widget | `AIAgentWidget` |
| `/` | Quick-open Command Palette | `CommandPalette` |

## Command Palette

When the Command Palette is open:

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate results |
| `Enter` | Select highlighted result |
| `Escape` | Close palette |

### Search Operators

Type these prefixes in the Command Palette for scoped search:

| Operator | Example | Searches |
|----------|---------|----------|
| `supplier:` | `supplier:acme` | Suppliers |
| `customer:` | `customer:texas` | Customers |
| `po:` | `po:226052` | Purchase Orders |
| `so:` | `so:1001` | Sales Orders |

## Workflow Editor (Flow Editor)

When the workflow editor is active:

| Shortcut | Action |
|----------|--------|
| `Arrow keys` | Navigate between nodes |
| `Tab` / `Shift+Tab` | Move focus forward / backward |
| `Enter` / `Space` | Activate (open) selected node |
| `Escape` | Dismiss / deselect |
| `Home` | Jump to first node |
| `End` | Jump to last node |
| `Ctrl+Z` / `⌘Z` | Undo |
| `Ctrl+Shift+Z` / `⌘⇧Z` | Redo |
| `Delete` / `Backspace` | Delete selected node |
| `Ctrl+A` / `⌘A` | Select all nodes |
| `Ctrl+C` / `⌘C` | Copy selected nodes |
| `Ctrl+V` / `⌘V` | Paste nodes |

## Cockpit Dashboard

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `⌘K` | Focus search (same as global) |
| Click card | Open entity detail panel |

## Accessibility

All shortcuts follow WCAG 2.1 AAA guidelines:
- Every interactive element is keyboard-reachable
- Focus indicators are always visible
- No keyboard traps — `Escape` always dismisses overlays
- Arrow key navigation follows logical reading order

---

**Source files**: `useGlobalShortcuts.ts`, `useCommandPalette.ts`, `keyboardNavigation.ts`
**Last updated**: 2026-06-24
