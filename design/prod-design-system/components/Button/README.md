# Button

Neutral by default; the `brand` variant is the product's one signature action per screen.

| Variant | Class | Use |
|---|---|---|
| brand | `pd-btn--brand` | The action the screen exists for: Request a Klick, Scan a QR code, Accept and share. At most one visible at a time. Uses `brand-fill`: a deeper red or blue with a white label, or the bright block with a black label on yellow and green. Passes AA in every product. |
| brand strong | `pd-btn--strong` | The same signature action with white text in every colour except yellow, including green (green 800). Use it only if a green product wants white labels. |
| primary | `pd-btn--primary` | Every other main action: Save changes, Add a memory. Black in light, near-white in dark. |
| secondary | `pd-btn--secondary` | Grey. Supporting actions: Save for event, Skip for now. |
| outline | `pd-btn--outline` | Tertiary actions inside cards and banners: Review fields, Reconnect, Retry. |
| ghost | `pd-btn--ghost` | Low-stakes or dismissive: Dismiss, Undo, Cancel. |
| destructive | `pd-btn--destructive` | Remove connection, Block, Delete memory. Always behind a confirmation. |
| link | `pd-btn--link` | Inline navigation in text: Why this match. |

**With icons.** Any variant takes an icon before the label ("icon + text") or a trailing icon after it. Put the `pd-i` svg directly inside the button; padding tightens on the icon side automatically.

- **Leading icon** when the icon makes the action faster to recognise: Scan a QR code, Add a voice note, Add to calendar, Delete memory. One icon, never two.
- **Trailing chevron down** means the button opens a menu or picker (set `aria-haspopup="menu"`). Use it for a choice that changes in place, like participation: "Planning to attend".
- **Trailing chevron right** means it goes somewhere: "See all matches". Usually ghost or link.
- For a main action with alternatives beside it, use SplitButton.

Sizes: default 40px, `pd-btn--sm` 32px, `pd-btn--lg` 48px (full-width mobile CTAs), `pd-btn--icon` square (always give it an `aria-label`).

**On touch screens** (`pointer: coarse`) buttons grow to `control-touch` (44px); small buttons become 36px, and small and icon buttons get an invisible 44px hit area. On phones, the main action of a screen or sheet is usually `pd-btn--lg` and full width at the bottom, within thumb reach. Hover effects only apply on devices that can hover.

**States.** Buttons are flat, with no edge or shadow. On press they scale to 98%. Loading sets `aria-busy="true"`, hides the label but keeps its width, and shows a spinner. Disabled is 45% opacity and not focusable by pointer.

**Copy.** Verb first, sentence case, says exactly what happens: "Request a Klick", not "Submit". Keep the same verb through the flow: the button "Accept and share" produces the toast "Shared".

In code this is `components/ui/button.tsx` (shadcn) with `variant="brand"` and a `loading` prop.
