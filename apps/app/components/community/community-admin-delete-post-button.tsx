"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { useState } from "react";
import { softDeletePost } from "@/app/(authenticated)/comunidade/actions";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";

interface CommunityAdminDeletePostButtonProperties {
  readonly postId: string;
  readonly spaceSlug: string;
}

export function CommunityAdminDeletePostButton({
  postId,
  spaceSlug,
}: CommunityAdminDeletePostButtonProperties) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          Remover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir publicação?</AlertDialogTitle>
          <AlertDialogDescription>
            A equipe poderá recuperar esta publicação por até 30 dias.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <SingleFlightForm
            action={softDeletePost}
            onSettled={() => setOpen(false)}
          >
            <input name="postId" type="hidden" value={postId} />
            <input name="returnTo" type="hidden" value="/admin/community" />
            <input name="spaceSlug" type="hidden" value={spaceSlug} />
            <SingleFlightSubmit pendingLabel="Excluindo…" variant="destructive">
              Excluir
            </SingleFlightSubmit>
          </SingleFlightForm>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
