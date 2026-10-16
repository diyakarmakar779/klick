# AppShell

How a Klick screen is laid out on phone, tablet and desktop. Design mobile first, then add.

| | Phone (below `bp-md`) | Tablet (`bp-md`–`bp-lg`) | Desktop (from `bp-lg`) |
|---|---|---|---|
| Navigation | BottomNav, QR raised in the centre | Sidebar rail (72px) | Full Sidebar (264px) with My QR |
| Gutter | `gutter-mobile` 16 | `gutter-tablet` 24 | `gutter-desktop` 32 |
| Card lists | 1 column | 2 columns | 2 columns, 3 from `bp-xl` |
| Width | Full | Full | Capped at `content-wide` 1200; reading screens at `content-narrow` 640 |
| Short decisions | Bottom sheet | Dialog | Dialog |
| Type | display, title | display, title | display-lg, title-lg |
| Toasts | Bottom, above the nav | Bottom centre | Bottom right |

**Rules that hold everywhere**

- Content scrolls; navigation stays put. On phones pad the bottom of the scroll area by `bottom-nav-height` plus the safe-area inset.
- Respect safe areas on phones: top for the header, bottom for the nav and sheets (`env(safe-area-inset-*)`).
- Touch screens get 44px controls (`control-touch`) and 44px hit areas, whatever the window width. A tablet with a keyboard and trackpad gets the 40px pointer sizes. Detect this with `pointer: coarse`, not with width.
- Hover effects only apply where hover exists (`hover: hover`). Every hover state also needs a visible focus and pressed state.
- Inputs use 16px text on phones so iOS does not zoom.
- Chat, a memory, settings and onboarding are single-column reading flows at `content-narrow`, even on desktop. On desktop, Chat can show the thread list and the open thread side by side.
- Test at 360, 390, 768, 1024 and 1440px.

In code: `.pd-page` / Tailwind `mx-auto max-w-[1200px] px-4 md:px-6 lg:px-8`, `.pd-cards` / `grid gap-4 md:grid-cols-2 xl:grid-cols-3`.
