"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useCallback, useRef } from "react";
import { useFormStatus } from "react-dom";

type ServerFormAction =
  | ((formData: FormData) => void)
  | ((formData: FormData) => Promise<unknown>);

interface SingleFlightFormProperties
  extends Omit<React.ComponentProps<"form">, "action" | "onSubmit"> {
  readonly action: ServerFormAction;
  readonly onActionError?: () => void;
  readonly onResult?: (result: unknown) => void;
  readonly onSettled?: () => void;
}

export const SingleFlightForm = ({
  action,
  children,
  onActionError,
  onResult,
  onSettled,
  ...props
}: SingleFlightFormProperties) => {
  const lockedRef = useRef(false);
  const runAction = useCallback(
    async (formData: FormData) => {
      try {
        const result = await action(formData);
        onResult?.(result);
      } catch (error) {
        onActionError?.();
        throw error;
      } finally {
        lockedRef.current = false;
        onSettled?.();
      }
    },
    [action, onActionError, onResult, onSettled]
  );

  return (
    <form
      {...props}
      action={runAction}
      onSubmit={(event) => {
        if (lockedRef.current) {
          event.preventDefault();
          return;
        }
        lockedRef.current = true;
      }}
    >
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
