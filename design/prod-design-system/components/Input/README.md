# Input

Text fields, selects and search. Labels sit above the field in `label` style; hints and errors sit below in `caption` size.

- **Label** every field. Placeholders are examples ("Designer I met at the meetup"), never the label.
- **Hint** (`pd-hint`, muted-foreground) explains who sees the value, since visibility is Klick's main question: "Shown before and after a Klick."
- **Error** (`pd-error`, destructive with an icon) says what to do, not what went wrong: "Add your profile name after /in/." Set `aria-invalid="true"` on the field.
- **Focus** uses the `ring` token; invalid uses `destructive` with a `destructive-soft` halo.
- Fields stay neutral in every product. Never tint an input with `brand`.

The shadcn equivalents are `Input`, `Textarea`, `Select` and `Combobox`, restyled through the tokens only.

**Responsive.** Fields are fluid and fill their column. On touch they are 44px tall (`control-touch`). On phones the typed text is 16px, because iOS Safari zooms the whole page when a field with smaller text is focused. Two-column field layouts collapse to one column below `bp-md`.
