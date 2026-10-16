# Toast

A brief confirmation after an action, with Undo where it's safe.

Name the result with the same verb as the button that caused it ("Save memory" leads to "Memory saved"). Offer Undo for reversible actions; never for sends. Errors that need action belong in an Alert, not a toast. This is shadcn `Sonner`, using `popover`, `border` and `shadow-pop`.

**Placement.** Phones: bottom, full width minus the gutter, above BottomNav. Tablet: bottom centre. Desktop: bottom right. Never cover the main action of a sheet or form.
