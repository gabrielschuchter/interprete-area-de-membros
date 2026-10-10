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
- The profile editor validates on the server, keeps entered values after a
  validation response, and returns to the overview only after the profile
  transaction commits. Avatar upload has an independent pending state and
  blocks saving while the image is still transferring.
- A loading placeholder matches the final content's dimensions and is marked
  busy at the containing region. Replace it as soon as data is ready; do not
  hold ready content for an animation or minimum spinner duration.
- Dynamic links inside search, autocomplete, feeds, learning rails, and large
  card lists disable viewport prefetch. Only destinations reached by pointer or
  keyboard intent may prefetch, through the shared per-route request budget and
  network-preference checks.

## Library bookmark feedback

- `toast.library` is opt-in and leaves the existing toast API, placement, and
  timing unchanged for every other route. Its Library variant provides
  post-commit save/removal feedback, undo and saved-list actions, and a retry
  action for failed writes.
- The Library timer is five seconds and pauses independently while the notice
  contains keyboard focus or the pointer. Keep every action target at least
  44 px high; place the notice at the lower left on desktop and above the safe
  area on mobile.
- The bookmark control may show a reversible pending state while the server
  action runs. A failed or rejected mutation restores the previous state and
  exposes retry; a success toast follows the authorized, idempotent write.

## Exercise answer controls

- Keep answer feedback tied to the immutable session-question ID. When a
  response arrives after quick navigation, render it only on its matching
  question; never let a stale form state expose another question's answer or
  explanation.
- Preserve unsubmitted selections per question in session storage so question
  navigation and retry do not discard the draft. Clear a draft only after its
  answer commits or the member confirms leaving the session.
- Disable only the submitted fieldset while the answer is pending. Keep answer
  success/error status announced and retain the selected options after a network
  failure. Server correction remains authoritative for both single- and
  multiple-choice questions.
- On mobile, reserve space for the fixed bottom action and safe area, and use
  `visualViewport` to keep the action above the virtual keyboard. Focus the new
  question heading after navigation; desktop confirmation stays in document
  flow.
- Favorite toggles may respond optimistically because the state is reversible;
  reconcile with the server and roll back on failure. Keep the shared toast's
  undo action tied to the persisted mutation and expire it after five seconds.

## Profile badge artwork

- Show the local criterion artwork in a reserved 56 px box with `next/image`,
  `sizes="56px"`, and lazy loading. The adjacent medal title makes the image
  decorative, so its alt text stays empty.
- Use the bounded set of ten transparent 320 px WebP files (271,496 bytes
  total) rather than a request per award. Keep the criterion-to-image mapping
  local so repeated awards share browser and optimizer cache entries.

## Motion

- Keep motion short and use the shared `--motion-duration-fast`,
  `--motion-duration-normal`, and easing tokens for interaction feedback.
- Do not start route content hidden, stagger essential information, or use an
  animation as a substitute for loading feedback.
- Respect `prefers-reduced-motion`. The shared stylesheet disables animations,
  transitions, smooth scrolling, and hover movement for that preference.
- Check keyboard activation, screen-reader status, touch targets, and reduced
  motion when changing a shared control or motion utility.
