"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRef, useState } from "react";
import { setContentStatus } from "../../../../../admin/actions";
import { CourseAccessConfirmDialog } from "./course-access-ui";

export const CoursePublishControl = ({
  courseId,
}: {
  readonly courseId: string;
}) => {
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <form action={setContentStatus} ref={form}>
        <input name="entity" type="hidden" value="course" />
        <input name="id" type="hidden" value={courseId} />
        <input name="status" type="hidden" value="PUBLISHED" />
        <input name="gestaoReturn" type="hidden" value="GESTAO" />
        <Button onClick={() => setOpen(true)} size="sm" type="button">
          Publicar
        </Button>
      </form>
      <CourseAccessConfirmDialog
        confirmLabel="Publicar curso"
        description="O curso ficará disponível conforme as turmas, matrículas e demais acessos configurados."
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          form.current?.requestSubmit();
        }}
        open={open}
        title="Publicar este curso?"
      />
    </>
  );
};
