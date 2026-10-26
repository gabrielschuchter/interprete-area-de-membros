import { requireGestaoAction } from "@/lib/gestao-authorization";
import { getGestaoNoticeEditor } from "@/lib/gestao-notices";
import {
  gestaoNoticeAudienceKind,
  gestaoNoticeDateInput,
  gestaoNoticeState,
} from "@/lib/gestao-notices-domain";
import { GestaoCrumbTail } from "../../gestao-crumbs";
import { NoticeEditor } from "./notice-editor";

export const GestaoNoticeEditorPage = async ({
  noticeId,
}: {
  readonly noticeId: string | null;
}) => {
  const { actor } = await requireGestaoAction("community.moderate");
  const data = await getGestaoNoticeEditor(actor, noticeId);
  const { notice } = data;
  if (noticeId && !notice) {
    return null;
  }
  return (
    <section className="gt-page gk-activities">
      <GestaoCrumbTail items={[{ label: notice?.title ?? "Novo aviso" }]} />
      <NoticeEditor
        activeMembers={data.activeMembers}
        cohortIds={data.cohortIds}
        cohorts={data.cohorts}
        links={data.links}
        notice={
          notice
            ? {
                body: notice.body,
                endsAt: gestaoNoticeDateInput(notice.endsAt),
                href: notice.href ?? "",
                id: notice.id,
                isPinned: notice.isPinned,
                mode: gestaoNoticeAudienceKind({
                  audience: notice.audience,
                  cohortNames: data.cohortIds,
                }),
                startsAt: gestaoNoticeDateInput(notice.startsAt),
                state: gestaoNoticeState(notice),
                title: notice.title,
              }
            : null
        }
        people={data.people}
      />
    </section>
  );
};
