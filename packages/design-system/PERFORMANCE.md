# Interaction and motion guidance

The design system supports the member area's 100 ms feedback target. Every
control communicates activation immediately, including when its result depends
on a server request.

## Controls and actions

- Use the shared `Button` and input primitives so focus, contrast, disabled, and
  touch-target behavior stay consistent. Prefer the default 44 px button height
  for touch actions; compact controls must remain keyboard reachable.
- For server-action forms, use `useFormStatus` or `useActionState` to render a
  specific pending label or status as soon as submission starts. Disable only
  controls that conflict with that operation, and prevent duplicate submits.
- Expose status with `aria-live="polite"` or an appropriate status role. Keep
  focus stable and keep entered values when a request fails so the member can
  retry.
- Show success only after the primary write commits. Optimistic updates are
  reserved for reversible local changes and include authoritative
  reconciliation, rollback, idempotency, and protection from out-of-order
  responses.
- A loading placeholder matches the final content's dimensions and is marked
  busy at the containing region. Replace it as soon as data is ready; do not
  hold ready content for an animation or minimum spinner duration.

## Motion

- Keep motion short and use the shared `--motion-duration-fast`,
  `--motion-duration-normal`, and easing tokens for interaction feedback.
- Do not start route content hidden, stagger essential information, or use an
  animation as a substitute for loading feedback.
- Respect `prefers-reduced-motion`. The shared stylesheet disables animations,
  transitions, smooth scrolling, and hover movement for that preference.
- Check keyboard activation, screen-reader status, touch targets, and reduced
  motion when changing a shared control or motion utility.
