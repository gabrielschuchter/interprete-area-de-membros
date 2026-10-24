import "@/app/(authenticated)/cursos/room.css";
import { forbidden, notFound, redirect } from "next/navigation";
import { RichDocument } from "@/components/learning/rich-document";
import { StudyHeartbeat } from "@/components/learning/study-heartbeat";
import { getCourseExperience, requireMemberId } from "@/lib/learning";
import { getRoomLesson } from "@/lib/room";
import { RoomView } from "./room-view";

interface RoomLessonPageProperties {
  readonly params: Promise<{ lessonSlug: string; slug: string }>;
  readonly searchParams?: Promise<{ t?: string | string[] }>;
}

const hasDocumentContent = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const content = (value as { content?: unknown }).content;
  return Array.isArray(content) && content.length > 0;
};

export const RoomLessonPage = async ({
  params,
  searchParams,
}: RoomLessonPageProperties) => {
  const [{ lessonSlug, slug }, query, memberId] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({ t: undefined }),
    requireMemberId(),
  ]);
  const experience = await getCourseExperience(slug);
  if (experience?.experience === "RECORDING_ARCHIVE") {
    redirect("/encontros/gravacoes");
  }

  const result = await getRoomLesson({
    courseSlug: slug,
    lessonSlug,
    memberId,
    startAt: query.t,
  });
  if (result.status === "not_found") {
    notFound();
  }
  if (result.status === "forbidden") {
    forbidden();
  }

  const { room } = result;
  const moduleNumber =
    room.outline.groups.findIndex(({ id }) => id === room.module.id) + 1;

  return (
    <>
      {room.locked ? null : (
        <StudyHeartbeat activityKind="LESSON" resourceId={room.id} />
      )}
      <RoomView
        document={
          hasDocumentContent(room.content) ? (
            <div className="lesson-document">
              <RichDocument currentMemberId={memberId} value={room.content} />
            </div>
          ) : null
        }
        key={room.id}
        moduleNumber={Math.max(1, moduleNumber)}
        room={room}
      />
    </>
  );
};
