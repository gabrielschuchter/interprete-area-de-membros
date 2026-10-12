"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useFormStatus } from "react-dom";

export const PathSubmitButton = ({
  label,
  pendingLabel,
  variant = "outline",
  ariaLabel,
}: {
  readonly label: string;
  readonly pendingLabel: string;
  readonly variant?: "default" | "outline";
  readonly ariaLabel?: string;
}) => {
  const { pending } = useFormStatus();
  return (
    <Button
      aria-label={ariaLabel}
      disabled={pending}
      size="sm"
      type="submit"
      variant={variant}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
};
