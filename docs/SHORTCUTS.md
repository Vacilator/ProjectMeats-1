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
| `?` | Open keyboard shortcuts cheatsheet | `ShortcutCheatsheet` |
| `Escape` | Close current modal / panel / overlay | Global |

## Navigation (vim-style)

Press `g` followed by a letter within 800ms to jump to a page:

| Shortcut | Destination |
|----------|-------------|
| `g` then `d` | Dashboard (`/cockpit/dashboard`) |
| `g` then `c` | Customers (`/customers`) |
| `g` then `s` | Suppliers (`/suppliers`) |
| `g` then `p` | Purchase Orders (`/purchase-orders`) |
| `g` then `o` | Sales Orders (`/sales-orders`) |
| `g` then `i` | Inquiries (`/inquiries`) |

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

## AI Command Center (`/command-center`)

These work when focus is NOT in a text field:

| Shortcut | Action |
|----------|--------|
| `N` | Open New Trade wizard |
| `R` | Refresh all data |
| `/` | Focus search input |
| `Alt+1` | Switch to Overview tab |
| `Alt+2` | Switch to Action Required tab |
| `Alt+3` | Switch to Live Pipeline tab |
| `Alt+4` | Switch to Workflows tab |
| `Alt+5` | Switch to History tab |
| `Escape` | Blur search / close modal |

## Accessibility

All shortcuts follow WCAG 2.1 AAA guidelines:
- Every interactive element is keyboard-reachable
- Focus indicators are always visible
- No keyboard traps — `Escape` always dismisses overlays
- Arrow key navigation follows logical reading order

---

**Source files**: `useGlobalShortcuts.ts` (canonical `SHORTCUT_REGISTRY`), `useCommandPalette.ts`, `keyboardNavigation.ts`, `AICommandCenter.tsx`, `ShortcutCheatsheet.tsx`  
**Last updated**: 2026-05-10
