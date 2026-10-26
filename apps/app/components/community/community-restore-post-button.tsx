"use client";

import { useActionState } from "react";
import { restoreCommunityPost } from "@/app/(authenticated)/comunidade/actions";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";

interface RestoreState {
  readonly error: string;
  readonly ok: boolean;
}

const initialState: RestoreState = { error: "", ok: true };

const restoreAction = async (
  _previousState: RestoreState,
  formData: FormData
): Promise<RestoreState> => {
  const result = await restoreCommunityPost(formData);
  if (result?.ok === false) {
    return { error: result.error, ok: false };
  }
  return initialState;
};

export const CommunityRestorePostButton = ({
  postId,
}: {
  readonly postId: string;
}) => {
  const [state, formAction] = useActionState(restoreAction, initialState);

  return (
    <div className="flex flex-col items-start gap-2">
      <SingleFlightForm action={formAction}>
        <input name="postId" type="hidden" value={postId} />
        <SingleFlightSubmit size="sm" variant="outline">
          Recuperar
        </SingleFlightSubmit>
      </SingleFlightForm>
      {state.ok ? null : (
        <p className="max-w-56 text-destructive text-xs" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
};
