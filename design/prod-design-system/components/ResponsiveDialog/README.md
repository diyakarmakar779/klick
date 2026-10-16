# ResponsiveDialog

One piece of content, two containers: a bottom sheet on phones and a centred dialog from `bp-md`.

- **Phones (below 768px):** `pd-sheet` slides up from the bottom, with a grab handle, `radius-2xl` top corners, and room for the home-indicator safe area. Actions stack full width, primary on top, so the thumb reaches it. It never grows past `sheet-max-height` (90vh) and scrolls inside.
- **md and up:** `pd-dialog`, `dialog-width` (480px), centred, actions right-aligned with the primary last.
- Same title, copy and order of fields in both. Only the container and action layout change.
- Use for short decisions: share fields, confirm a Klick, a destructive confirmation, a quick capture. Long forms get their own page.
- In code: shadcn `Drawer` below md and `Dialog` from md, switched with a `useMediaQuery("(min-width: 768px)")` hook.
