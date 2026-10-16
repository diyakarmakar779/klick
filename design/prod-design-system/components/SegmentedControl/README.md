# SegmentedControl

Switches between views of the same list: Upcoming, Past, Saved.

Use for two to four peer views. The selected thumb is `background` on a `muted` track; text goes from `muted-foreground` to `foreground`. For more than four options, or options that aren't peers, use a select. This is shadcn `Tabs` with the list styled as a segmented control.

**Responsive.** On touch, segments are 38px tall inside the 44px control. With four segments on a 360px phone, keep labels to one short word; if they don't fit, use a select.
