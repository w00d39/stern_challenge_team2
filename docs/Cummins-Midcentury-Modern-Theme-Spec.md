# Cummins Midcentury Modern Theme — Full Specification

**For use in ChatGPT, PowerPoint design, or design handoff.**

---

## Concept & Inspiration

The theme draws from **Columbus, Indiana** — the Cummins headquarters region — and its midcentury modern (MCM) architectural heritage. It blends:

- **Cummins industrial identity** (engine red, graphite, steel)
- **Columbus civic architecture** (Irwin Union Bank stone, Girard textiles, Saarinen buildings)
- **MCM design language** (warm neutrals, mustard/amber accents, teal and olive)

Tagline: *"Cummins iron and Saarinen curves"*

---

## Primary Color Palette (Default)

| Token Name | Hex | RGB | Use |
|------------|-----|-----|-----|
| **Cummins Red** | `#9B2335` | rgb(155, 35, 53) | Primary actions, CTAs, active states, role badges |
| **Cummins Red Deep** | `#6E1423` | rgb(110, 20, 35) | Hover on primary, danger, emphasis |
| **Irwin Stone** | `#D4C5A9` | rgb(212, 197, 169) | Borders, form outlines, subtle dividers |
| **Irwin Sand** | `#E8DCC8` | rgb(232, 220, 200) | Card borders, dividers, secondary surfaces |
| **MCM Mustard** | `#B8872E` | rgb(184, 135, 46) | Warnings, accents, urgency, secondary CTAs |
| **MCM Amber** | `#D4A843` | rgb(212, 168, 67) | Hover on mustard, highlights |
| **Girard Teal** | `#1F5C5C` | rgb(31, 92, 92) | Success, links, secondary actions |
| **Girard Teal Light** | `#2D7A7A` | rgb(45, 122, 122) | Hover on teal |
| **Engine Graphite** | `#1E1E20` | rgb(30, 30, 32) | Navbar, primary text, headings |
| **Engine Steel** | `#3C3C3E` | rgb(60, 60, 62) | Secondary text, muted labels |
| **Civic Concrete** | `#767068` | rgb(118, 112, 104) | Tertiary text, disabled states |
| **Civic Warm** | `#C4BAA8` | rgb(196, 186, 168) | Navbar subtitle, light text on dark |
| **Saarinen Cream** | `#FAF5EB` | rgb(250, 245, 235) | Page background, card background |
| **Saarinen Linen** | `#F2EBD9` | rgb(242, 235, 217) | Secondary background, dropdowns |
| **Girard Olive** | `#4A5A3A` | rgb(74, 90, 58) | Accent, tertiary actions |

---

## Typography

| Role | Font Stack | Weights | Use |
|------|------------|---------|-----|
| **Display** | `'Outfit', 'Helvetica Neue', sans-serif` | 400, 500, 600, 700 | Hero titles, large headings |
| **Heading** | `'DM Sans', 'Helvetica Neue', sans-serif` | 400, 500, 600, 700 | Section headings, buttons, nav |
| **Body** | `'Atkinson Hyperlegible', 'Verdana', sans-serif` | 400, 700, italic | Body copy, forms |
| **Mono** | `'IBM Plex Mono', 'Courier New', monospace` | 400, 500 | Code, hex values, data |

**Google Fonts URL:**
```
https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap
```

**Typographic scale:**
- Display (hero): 38px, 600
- Page title: 26px, 600
- Card title: 24px, 600
- Section heading: 18px, 600
- Subheading: 16px, 600
- Body: 14–16px, 400
- Small labels: 11–12px, 600–700, uppercase, letter-spacing 0.06–0.15em

---

## Girard Strip (Signature Accent)

A horizontal color bar inspired by Alexander Girard textiles. Use as a navbar accent, card header, or section divider.

**Gradient (linear, left to right):**
```
Cummins Red 0%–40% | MCM Mustard 40%–60% | Girard Teal 60%–80% | Girard Olive 80%–100%
```

**CSS:**
```css
background: linear-gradient(90deg, 
  #9B2335 0%, #9B2335 40%, 
  #B8872E 40%, #B8872E 60%, 
  #1F5C5C 60%, #1F5C5C 80%, 
  #4A5A3A 80%);
```

**Alternative multi-segment strip (8 segments):**
Red | Mustard | Teal | Olive | Red Deep | Amber | Teal Light | Concrete

---

## Component Styles

### Navbar
- Background: Engine Graphite `#1E1E20`
- Text: Saarinen Cream `#FAF5EB`
- Subtitle: Civic Warm `#C4BAA8`
- Role badge: Cummins Red `#9B2335`, cream text
- Border buttons: 1.5px solid Civic Concrete
- Height: 56px
- Shadow: `0 2px 8px rgba(30, 30, 32, 0.18)`

### Primary Button
- Background: Cummins Red `#9B2335`
- Text: Saarinen Cream `#FAF5EB`
- Font: DM Sans, 13px, 600, uppercase, letter-spacing 0.04em
- Padding: 10px 22px, min-height 42px
- Border-radius: 3px
- Hover: Red Deep, `box-shadow: 0 3px 10px rgba(155, 35, 53, 0.2)`

### Success / Teal Button
- Background: Girard Teal `#1F5C5C`
- Hover: Girard Teal Light `#2D7A7A`

### Warning / Mustard Button
- Background: MCM Mustard `#B8872E`
- Hover: MCM Amber `#D4A843`

### Card
- Background: Saarinen Cream `#FAF5EB`
- Border: 1px solid Irwin Sand `#E8DCC8`
- Border-radius: 4px
- Shadow: `0 2px 8px rgba(30, 30, 32, 0.05)` or `0 4px 16px rgba(30,30,32,0.08)`
- Optional top accent: Girard strip gradient (6px height)

### Form Inputs
- Border: 1px solid Irwin Stone `#D4C5A9`
- Background: Saarinen Cream
- Focus: border Girard Teal, `box-shadow: 0 0 0 2px rgba(31, 92, 92, 0.15)`

### Badges / Tags
- **High priority:** `rgba(155, 35, 53, 0.1)` bg, Cummins Red text
- **Medium priority:** `rgba(184, 135, 46, 0.12)` bg, MCM Mustard text
- **Monitor / Teal:** `rgba(31, 92, 92, 0.1)` bg, Girard Teal text
- Border-radius: 3px, padding 3px 10px

---

## Color Vision Deficiency (CVD) Palettes

For accessibility, the theme supports alternate palettes that remain distinguishable under different types of color blindness.

### Deuteranopia (red-green, ~6% males)
- Cummins Red → `#7B3B1A` (warm brown)
- Red Deep → `#5A2810`
- Mustard → `#C49000` (brighter gold)
- Teal → `#1A4B7A` (deep blue)
- Teal Light → `#2A6699`
- Olive → `#3E4F6A` (slate blue-gray)

### Protanopia (red-blind, ~2% males)
- Cummins Red → `#6B4020` (dark umber)
- Red Deep → `#4A2C14`
- Mustard → `#C08C00`
- Teal → `#1B4A78`
- Teal Light → `#286198`
- Olive → `#3C4E68`

### Tritanopia (blue-yellow, rare)
- Red stays `#9B2335`
- Mustard → `#A86848` (warm rose-tan)
- Amber → `#C08868`
- Teal → `#5C2A5C` (magenta-plum)
- Teal Light → `#7A3D7A`
- Olive → `#5C3E3A` (brown-rose)

### High Contrast
- Red → `#8B0000`, Red Deep → `#5C0000`
- Mustard → `#996600`, Amber → `#CC9933`
- Teal → `#004040`, Teal Light → `#006060`
- Graphite → `#0A0A0A`, Steel → `#2A2A2A`
- Cream → `#FFFFFF`, Linen → `#F5F0E4`
- Olive → `#2A3A1A`

---

## Decorative Elements

- **Hero radial glow:** `radial-gradient(circle at top right, #9B233522, transparent 70%)` on dark header
- **Decorative circle:** 1.5px border MCM Mustard at 20% opacity, 120px diameter, bottom-left of hero
- **Section divider:** 1px `linear-gradient(90deg, Civic Concrete, transparent)`

---

## WCAG Contrast Reference

- Cummins Red on Cream: ~4.5:1 (AA)
- Girard Teal on Cream: ~4.5:1 (AA)
- Engine Graphite on Cream: ~12:1 (AAA)
- Cream on Graphite: ~12:1 (AAA)

---

## One-Line Summary for ChatGPT

*"Use a Columbus Indiana / Cummins midcentury modern palette: primary red #9B2335, teal #1F5C5C, mustard #B8872E, cream background #FAF5EB, graphite text #1E1E20. Fonts: Outfit (display), DM Sans (headings), Atkinson Hyperlegible (body). Include a horizontal Girard strip gradient: red → mustard → teal → olive. Industrial-meets-MCM aesthetic."*
