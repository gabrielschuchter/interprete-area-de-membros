"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setPostStatus } from "@/app/(authenticated)/comunidade/actions";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";

interface CommunityPublishDraftState {
  readonly message: string;
  readonly ok: boolean;
}

const initialState: CommunityPublishDraftState = { message: "", ok: true };

const publishDraft = async (
  _previousState: CommunityPublishDraftState,
  formData: FormData
): Promise<CommunityPublishDraftState> => {
  const result = await setPostStatus(formData);
  if (result?.ok === false) {
    return { message: result.error, ok: false };
  }
  return initialState;
};

interface CommunityPublishDraftButtonProperties {
  readonly confirmGroupMention?: boolean;
  readonly editHref: string;
  readonly postId: string;
  readonly spaceSlug: string;
}

export const CommunityPublishDraftButton = ({
  confirmGroupMention = false,
  editHref,
  postId,
  spaceSlug,
}: CommunityPublishDraftButtonProperties) => {
  const [state, formAction, isPending] = useActionState(
    publishDraft,
    initialState
  );

  return (
    <div className="flex flex-col items-start gap-2">
      <SingleFlightForm action={formAction}>
        <input name="postId" type="hidden" value={postId} />
        <input name="spaceSlug" type="hidden" value={spaceSlug} />
        <input name="status" type="hidden" value="PUBLISHED" />
        <input
          name="confirmGroupMention"
          type="hidden"
          value={confirmGroupMention ? "1" : "0"}
        />
        <SingleFlightSubmit size="sm">
          {isPending ? "Publicando…" : "Publicar"}
        </SingleFlightSubmit>
      </SingleFlightForm>
      {!state.ok && (
        <p className="max-w-56 text-destructive text-xs" role="alert">
          {state.message}{" "}
          <Link className="underline underline-offset-2" href={editHref}>
            Abrir editor
          </Link>
        </p>
      )}
    </div>
  );
};
