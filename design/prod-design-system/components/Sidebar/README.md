# Sidebar

Desktop and tablet navigation: the same items as BottomNav, moved to the left edge.

| Screen | Shows |
|---|---|
| Below `bp-md` (768px) | Nothing. BottomNav is the navigation. |
| `bp-md` to `bp-lg` (768–1023px) | The icon rail (`pd-sidebar--rail`, 72px). Every item needs an `aria-label` and a tooltip. |
| From `bp-lg` (1024px) | The full sidebar (`pd-sidebar`, 264px) with labels. |

- Items: Home, Events, Klicks, Chat, Profile, with Settings pinned to the bottom. The current page uses `sidebar-accent`.
- **My QR** becomes a brand button under the items, the desktop counterpart of the raised QR in BottomNav. It is the only brand fill in the sidebar.
- The product block sits at the top as the app mark.
- In code: shadcn `Sidebar` with `collapsible="icon"`, using the `sidebar-*` tokens.
