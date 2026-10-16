# Switch

An immediate on/off setting, used for discoverability and per-field sharing.

- On is `primary` (black), never `brand`: a switch is a control, not identity.
- Put it on the right of a setting row (`pd-setting`). The row's title says what is on; the line under it says the consequence in plain words ("Matches can see you before a Klick").
- Switches apply immediately. If a change needs review first, use a checkbox inside a form instead.
- Give each switch an `aria-label` matching its row title.

**Touch.** The visible switch is 40×24, but it carries a 44px-tall hit area, and on touch the whole setting row should toggle it too.

**Dark mode.** The off thumb is always light (`switch-thumb`) on an `input` track, so an off switch stays visible on dark backgrounds. On, the track is `primary` and the thumb `primary-foreground`.
