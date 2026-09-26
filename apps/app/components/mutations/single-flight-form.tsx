"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

type ServerFormAction = (formData: FormData) => void | Promise<void>;

interface SingleFlightFormProperties
  extends Omit<React.ComponentProps<"form">, "action" | "onSubmit"> {
  readonly action: ServerFormAction;
  readonly onSettled?: () => void;
}

const FormStatusBridge = ({
  onSettled,
}: {
  readonly onSettled: () => void;
}) => {
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!pending) {
      onSettled();
    }
  }, [onSettled, pending]);
  return null;
};

export const SingleFlightForm = ({
  action,
  children,
  onSettled,
  ...props
}: SingleFlightFormProperties) => {
  const lockedRef = useRef(false);

  return (
    <form
      {...props}
      action={action}
      onSubmit={(event) => {
        if (lockedRef.current) {
          event.preventDefault();
          return;
        }
        lockedRef.current = true;
      }}
    >
      <FormStatusBridge
        onSettled={() => {
          lockedRef.current = false;
          onSettled?.();
        }}
      />
      {children}
    </form>
  );
};

interface SingleFlightSubmitProperties
  extends Omit<React.ComponentProps<typeof Button>, "children"> {
  readonly children: React.ReactNode;
  readonly pendingLabel?: React.ReactNode;
}

export const SingleFlightSubmit = ({
  children,
  disabled,
  pendingLabel = "Enviando…",
  ...props
}: SingleFlightSubmitProperties) => {
  const { pending } = useFormStatus();
  return (
    <Button {...props} disabled={disabled || pending} type="submit">
      {pending ? pendingLabel : children}
    </Button>
  );
};
