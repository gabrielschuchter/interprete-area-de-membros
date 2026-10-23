import "@/app/(authenticated)/cursos/room.css";
import { forbidden, notFound } from "next/navigation";
import { StudyHeartbeat } from "@/components/learning/study-heartbeat";
import { requireMemberId } from "@/lib/learning";
import { getRoomRecording } from "@/lib/room-recording";
import { RoomView } from "./room-view";

interface RoomRecordingPageProperties {
  readonly params: Promise<{ assetId: string }>;
  readonly searchParams?: Promise<{ t?: string | string[] }>;
}

export const RoomRecordingPage = async ({
  params,
  searchParams,
}: RoomRecordingPageProperties) => {
  const [{ assetId }, query, memberId] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({ t: undefined }),
    requireMemberId(),
  ]);

  const result = await getRoomRecording({
    assetId,
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
  return (
    <>
      <StudyHeartbeat activityKind="RECORDING" resourceId={room.id} />
      <RoomView document={null} key={room.id} moduleNumber={1} room={room} />
    </>
  );
};
