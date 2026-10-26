"use client";

import type { ComponentProps } from "react";

/** GET form that applies a filter as soon as a select changes; the text field still submits on Enter. */
export const CommunitySelectSubmitForm = (
  properties: Omit<ComponentProps<"form">, "onChange">
) => (
  <form
    {...properties}
    onChange={(event) => {
      if (event.target instanceof HTMLSelectElement) {
        event.currentTarget.requestSubmit();
      }
    }}
  />
);
