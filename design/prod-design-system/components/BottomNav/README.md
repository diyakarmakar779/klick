# BottomNav

Mobile navigation: Home, Events, QR, Chat, Profile, with QR raised in the centre as the brand block.

- The QR button is the only brand fill in the nav; it opens My QR with the scanner one tap away.
- Current page is `foreground`, the rest `muted-foreground`. Labels are always visible.
- From `bp-md` the same items move into Sidebar.
- The hierarchy follows the suggestion in the Klick UI checklist; navigation is still an open product decision there.

**Responsive.** BottomNav is for phones only, below `bp-md` (768px); add `pd-nav--app` so it hides from there and Sidebar takes over. It is `bottom-nav-height` (64px) plus the bottom safe-area inset, so it clears the iPhone home indicator. Pad scrolling content by the same amount.
