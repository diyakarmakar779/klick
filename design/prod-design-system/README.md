# Prod :D

Prod :D is one master brand for a family of products, built like a set of toy bricks: every product shares the same moulded-plastic system and is told apart by its block colour and stud count. Klick, the first product, is a connection and memory app for people who meet at events. This system is shadcn/ui underneath with Prod :D on top.

## How the system is built

Three token layers, so a new product changes a handful of brand values and nothing else.

| Layer | Tokens | Job |
|---|---|---|
| Palette | `blue-50` … `green-950` | Raw scales for the four blocks. Each 500 is the exact colour from the block matrix; the other steps are generated in OKLCH so lightness matches across hues. |
| Semantic | `background`, `foreground`, `primary`, `secondary`, `muted`, `border`, `destructive`, `success`, `warning`, `info`, `privacy` … | shadcn's roles. All neutral: black and grey chrome in every product. |
| Product | `brand`, `brand-fill`, `brand-foreground`, `brand-on-large`, `brand-strong`, `brand-strong-foreground`, `brand-soft`, `brand-text`, `brand-border`, `brand-edge` | What each product sets. Klick's colour isn't chosen yet, so the themes show it as every block. |

**Themes are product × mode**: Blue light, Blue dark, Red light, and so on. Blue is the placeholder default. In code a product sets one attribute, `<html data-product="blue">`, plus `class="dark"` for dark mode.

## Visual foundations

**Colour: neutral chrome, block-coloured identity.** Buttons, fields, switches, chat bubbles and text are black, white and grey in every product. The block colour is saved for what makes a product recognisable: its one signature action per screen (Request a Klick, Scan), the QR button, the Klick success moment, selection and progress. `brand-soft` tints carry it into headers and the "why this match" panel. Never use `brand` for page backgrounds or body text.

**Bright block for colour, deeper fill for text.** `brand` is the block colour at full value, used where nothing sits on it: the block and studs, highlights, progress, selection. Anything carrying text or an icon (brand buttons, solid badges, the date tab, the QR button, brand panels) uses `brand-fill` with `brand-foreground`, and every pairing passes AA:

| | Red | Blue | Yellow | Green |
|---|---|---|---|---|
| `brand-fill` | red 700 | blue 700 | yellow 500 (the block) | green 500 (the block) |
| `brand-foreground` on it | white 5.7:1 | white 6.8:1 | black 14.3:1 | black 8.1:1 |
| `brand-on-large`, text straight on the bright `brand` | black 5.9:1 | black 4.6:1 | black 14.3:1 | black 8.1:1 |
| `brand-strong` + `brand-strong-foreground` (white wherever possible) | white on 700 | white on 700 | black on 500 | white on 800, 6.4:1 |

For brand-coloured text on light surfaces use `brand-text`; it picks a different step per hue (700 for red and blue, 800 for green, 900 for yellow) so every product passes AA.

**Status is never a brand colour.** Red and green are blocks, so `destructive` is a deeper crimson and `success` a classic green, and both carry icons. `info` is neutral ink plus an info icon because blue is a block. `warning` is amber in light mode and orange in dark mode so it never sinks into the yellow block; always pair it with an icon.

**Privacy has its own colour.** Klick constantly tells people who can see something. `privacy` is violet, a hue none of the blocks use, and it means only that: Only you (lock), Mutual (people), Event-visible (eye), Revoked.

**Dark mode.** Every token has a dark value; the block colours stay the same so a product is recognisable in both. Surfaces step up in lightness as they float higher: page, then card, then popover and dialog, so layers read without relying on borders. Control outlines (`input`) and the focus ring stay at 3:1 or more against the background in both modes, and the switch thumb is always light so an off switch is still visible. Primary inverts to near-white in dark mode, following shadcn. Set `color-scheme` so native scrollbars, select menus and date pickers go dark too, and give logos a dark-background version where the company provides one.

**Type.** Plus Jakarta Sans for everything, from the wordmark to captions. Seven styles: `display` (40, 800) for one moment per screen, `title` (28, 700), `heading` (20, 700), `subheading` (16, 600), `body` (15, 400), `label` (14, 600) for buttons and fields, and `caption` (13) for hints and provenance in `muted-foreground`. Sentence case everywhere; no all-caps labels.

**Shape and depth: flat UI, the block carries the plastic.** Corners are soft and consistent: `radius-lg` (12) for controls, `radius-xl` (16) for cards, `radius-2xl` (22) for sheets and the composer, `radius-full` for badges and avatars. Buttons and surfaces are flat: no edge, no lift. Pressed buttons scale to 98%. The moulded edge and studs appear only on the product block itself (see Block). The one soft shadow, `shadow-pop`, is for toasts, menus and dialogs. No gradients, glows or glassy blur.

**The block.** The brick with 1, 4, 6 or 8 studs is the identity unit (see Block). In the UI it appears only at identity moments: the app mark, Klick success, empty states, and the Klick AI mark. Product-to-colour and stud-count mapping is still open.

**Spacing.** Tailwind's 4px scale, unchanged: `space-4` (16) inside cards, `space-5` (20) between cards, `space-8` (32) between groups.

## Responsive

Mobile first: base styles are the phone, and each breakpoint adds. Breakpoints are Tailwind's (`bp-sm` 640, `bp-md` 768, `bp-lg` 1024, `bp-xl` 1280), so they match the `sm:`/`md:`/`lg:`/`xl:` utilities.

| | Phone | Tablet, from 768 | Desktop, from 1024 |
|---|---|---|---|
| Navigation | BottomNav with the raised QR | Sidebar rail | Full Sidebar with My QR |
| Gutters | 16 | 24 | 32 |
| Card lists | 1 column | 2 columns | 2, then 3 from 1280 |
| Short decisions | Bottom sheet | Dialog | Dialog |
| Display and title | 40 and 28 | 40 and 28 | 56 and 32 (`display-lg`, `title-lg`) |

- **Touch is about the input, not the width.** Touch screens (`pointer: coarse`) get 44px controls and 44px hit areas; mouse and trackpad keep 40px. Hover styles only apply where hover exists.
- **Width caps.** Grids stop at `content-wide` (1200). Reading flows (chat, a memory, settings, onboarding) stay at `content-narrow` (640) on every screen.
- **Phones:** respect the safe areas, keep the main action at the bottom within thumb reach, and use 16px input text so iOS doesn't zoom.
- AppShell shows all three layouts; Sidebar and ResponsiveDialog are the pieces that change.

## Content

Klick's promise is "Meet someone. Klick with intention. Build a relationship worth remembering." The voice is calm, specific and on the member's side.

- **Plain verbs, sentence case.** "Request a Klick", "Add a memory", "Reconnect". One verb per action through the whole flow: the button "Accept and share" leads to the toast "Shared".
- **Say who sees it.** Any time something is captured or shared, say the audience: "She sees these after you both accept." "Notes stay private to you."
- **Explain recommendations as people would.** "You both want to meet early-stage founders", never a score.
- **Errors say what to do.** "Check your connection, then retry. Your recording is saved on this device." No apologies, no vague failures.
- **Never imply what isn't known.** Participation is Hosting, Invited, Planning to attend, or Attended only when verified.
- "Klick" is both the product and the act of connecting: "Request a Klick", "You and Meera Klicked".

## Iconography

Lucide, shadcn's default set: 2px stroke, round caps and joins, 16px inline, 20px in rows, 22–24px in navigation. Icons take the colour of their text, except status icons in alerts, which take the status colour. Fixed meanings: lock = only you, people = mutual, eye = event-visible, sparkle = a reason or AI, calendar = an event source, clock = due.

## Using it in code

The source of truth for the app is `app/globals.css` (Tailwind v4, every token above as a CSS variable and utility: `bg-brand`, `text-brand-text`, `bg-privacy-soft`, `text-title`) and `components/ui/button.tsx` (shadcn button with a `brand` variant and a `loading` prop). The component guidelines here describe the patterns those files implement; class names in the previews (`pd-*`) are for this reference only.

## Extending the system

- **A new component** uses only tokens and the existing classes, so it follows every product and mode automatically. Give it a phone and a desktop rule if its layout changes.
- **A new product** gets one of the four block colours and its own stud count. In code it is one more `data-product` value with the brand tokens set. With four colours, a fifth product shares a colour and is told apart by studs.
- **Themes here are full.** This page allows eight themes, and four colours × light/dark uses all eight. Adding a mode such as high contrast means moving to light/dark themes with products shown another way.

## Not settled yet

No final logo or wordmark exists; the system uses the name in Plus Jakarta Sans until one is chosen. Which product gets which colour and stud count is open, and so is Klick's own colour. The font is loaded from Google Fonts here; ship self-hosted files in the app.
