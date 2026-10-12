"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useFormStatus } from "react-dom";

export const PathSubmitButton = ({
  label,
  pendingLabel,
  variant = "outline",
  size = "sm",
  ariaLabel,
  className,
  title,
}: {
  readonly label: string;
  readonly pendingLabel: string;
  readonly variant?: "default" | "outline";
  readonly size?: "sm" | "icon";
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly title?: string;
}) => {
  const { pending } = useFormStatus();
  return (
    <Button
      aria-busy={pending || undefined}
      aria-label={ariaLabel}
      className={className}
      disabled={pending}
      size={size}
      title={title}
      type="submit"
      variant={variant}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
};
