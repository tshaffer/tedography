# Tedography Button / Toggle Style Guide

## Purpose

This guide defines a consistent control-state system for Tedography so the UI stays photo-first, compact, and predictable.

Tedography has two main control families:

1. **Action buttons**
   - perform an operation immediately
   - examples: `Select`, `Pending`, `Reject`, `Unreviewed`, `+Album`, `-Album`, `Slide`, `Clear`

2. **Toggle / segmented controls**
   - switch a mode or persistent state
   - examples: `Review / Library / Search`, `Flat / Time / Albums`, `Grid / Loupe`, `Merged / Grouped`, `XS / S / M / L / XL`

These families should not share identical visual treatment.

---

## Core principles

- **Photos are primary.** Controls should be compact and visually restrained.
- **Selected/toggled-on must be obvious.** Users should not have to guess the current mode.
- **Disabled must look unavailable.** No ambiguity.
- **Pressed state should exist.** Buttons should feel responsive.
- **Do not overload color.** Avoid using several competing border colors for different meanings.
- **One meaning per visual signal.**

---

## State model

### For action buttons

Each action button should support:
- Enabled (default)
- Hover
- Active / pressed
- Disabled

### For toggle / segmented controls

Each toggle should support:
- Enabled but unselected
- Hover
- Active / pressed
- Selected / toggled-on
- Disabled

---

## Visual semantics

### Action buttons

#### Enabled
- Neutral background or subtle tinted background
- Clear border
- High readability
- Pointer cursor
- Small radius
- Modest shadow only if needed

#### Hover
- Slightly stronger border or slightly darker/lighter background
- No dramatic motion

#### Active / pressed
- Slight pressed effect
- Optional `translateY(1px)`
- Slightly darker background
- Reduced shadow

#### Disabled
- Muted text
- Muted background
- Muted border
- No shadow
- No pressed effect
- `not-allowed` cursor on desktop
- Non-interactive

### Toggle / segmented controls

#### Enabled, unselected
- Neutral background
- Clear outline
- Normal text contrast

#### Hover
- Slightly stronger border / subtle tint

#### Active / pressed
- Light pressed effect

#### Selected / toggled-on
- Strongest persistent state for the control
- Distinct border color
- Light tinted background fill
- Text contrast remains strong

#### Disabled
- Muted and unavailable
- Must not resemble selected state

---

## Tedography-specific visual mapping

### Recommended color meaning

- **Blue**: selected/toggled UI control or selected asset
- **Neutral gray**: enabled but not selected
- **Muted gray**: disabled/unavailable
- **Do not use red/green large borders** for general UI control state

### Asset grid visual mapping

#### Selected asset
- Strong blue border
- Corner checkmark badge

#### Active/focused asset
- Additional inner ring or subtle secondary accent
- Must be distinct from selected, but not louder than selected

#### Photo state
- Small badge/chip only
- Not a large border color

---

## Control families and recommendations

### 1. Top toolbar action buttons
Examples:
- `Select`
- `Pending`
- `Reject`
- `Unreviewed`
- `+Album`
- `-Album`
- `Slide`
- `Clear`

Recommendations:
- Use compact action-button styling
- Keep labels short but explicit
- Disable clearly when no selection exists
- Avoid making every button look “primary”

### 2. Area and mode segmented controls
Examples:
- `Review / Library / Search`
- `Flat / Time / Albums`
- `Grid / Loupe`
- `Merged / Grouped`
- `XS / S / M / L / XL`

Recommendations:
- Use segmented/toggle styling
- Selected option must be obvious at a glance
- Unselected options must still look interactive
- Disabled option must be visibly unavailable

### 3. Panel toggles
Examples:
- left panel show/hide
- right panel show/hide
- inspector show/hide

Recommendations:
- Small icon-forward controls are acceptable
- Use selected/toggled styling if the panel is “on”
- Disabled state should still be consistent with the general system

---

## Recommended CSS class structure

Suggested class naming:

- `.btn`
- `.btn-action`
- `.btn-primary`
- `.btn-toggle`
- `.is-selected`
- `.is-disabled`

Example semantic usage:

- `.btn.btn-action`
- `.btn.btn-action.btn-primary`
- `.btn.btn-toggle`
- `.btn.btn-toggle.is-selected`

If native `button:disabled` is used, prefer that over a custom disabled class where possible.

---

## Example CSS direction

```css
.btn {
  padding: 8px 14px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid #c7c7c7;
  background: #ffffff;
  color: #222222;
  cursor: pointer;
  transition: background-color 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease, transform 0.08s ease;
}

.btn:hover:not(:disabled) {
  border-color: #9aa7b8;
  background: #f7faff;
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn:disabled {
  background: #f1f1f1;
  color: #9a9a9a;
  border-color: #d3d3d3;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-toggle.is-selected,
.btn-toggle[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eaf2ff;
  color: #173f99;
}

.btn-primary {
  border-color: #2f6fed;
  background: #2f6fed;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #255ed0;
  border-color: #255ed0;
}
```

This is a starting point, not a mandate. Tedography should adapt it to its existing UI tokens and layout.

---

## Behavioral rules

### Disabled controls
When a control cannot currently act, disable it.

Examples:
- No selected assets → disable selection-based toolbar actions
- Unsupported feature → hide or disable, but do not leave it looking active

### Selected controls
When a mode is active, the corresponding segmented button must show selected state.

Examples:
- `Library` selected in area switcher
- `Time` selected in browse mode
- `Loupe` selected in view mode

### Pressed state
Pressed state should be subtle but present. Avoid over-animated effects.

---

## Accessibility guidance

- Do not rely on color alone to convey state
- Use shape, fill, border weight, and icon/badge where useful
- Ensure contrast remains sufficient in disabled vs enabled vs selected states
- Prefer `aria-pressed` for toggle buttons where applicable
- Preserve visible keyboard focus styles

---

## What to avoid

- Several competing large border colors representing different meanings
- Selected state that is only barely different from enabled state
- Disabled controls that still look clickable
- Repeating strong “primary button” styling on too many controls
- Dense control rows where every control demands equal attention

---

## Tedography implementation priority

When standardizing controls, prioritize these groups first:

1. Top toolbar selection-based action buttons
2. Area/mode segmented controls
3. Thumbnail size controls
4. Panel toggles
5. Secondary album-management buttons

---

## Done criteria

Tedography button/toggle styling is in a good state when:

- selected mode is obvious at a glance
- disabled controls clearly look unavailable
- pressed state is consistent
- action buttons and toggle buttons no longer look like the same control type
- the UI feels compact and photo-first rather than loud and control-heavy

