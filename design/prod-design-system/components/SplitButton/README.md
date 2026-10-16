# SplitButton

A main action plus a chevron that opens related alternatives: icon + text | chevron.

- **Left part** does the most common thing in one tap: "Add a memory" starts a voice note. **Right part** opens a menu of the other ways to do it: text note, photo, follow-up.
- Use it only when the alternatives are versions of the same action. Different actions belong in an overflow menu instead.
- Works with every Button variant and size. The two parts share the variant; a 1px gap divides them (on outline, the borders overlap instead).
- The chevron part needs an `aria-label` naming the menu ("Other memory types") and `aria-haspopup="menu"`.
- Brand is allowed once per screen, like a normal brand button.

In code: shadcn `ButtonGroup`, or two `Button`s with a `DropdownMenu` on the second.
