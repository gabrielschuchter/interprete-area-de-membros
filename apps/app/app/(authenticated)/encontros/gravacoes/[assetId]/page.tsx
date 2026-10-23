import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomRecordingPage } from "@/components/learning/room/room-recording-page";
import { env } from "@/env";

export const dynamic = "force-dynamic";

interface RecordingRoomProperties {
  readonly params: Promise<{ assetId: string }>;
  readonly searchParams: Promise<{ t?: string | string[] }>;
}

// Sala de Aula (docs/sala-de-aula): the recording room only exists while
// ROOM_V2_ENABLED is on. Until then the archive keeps its inline player.
const roomEnabled = () => env.ROOM_V2_ENABLED === "true";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Gravação · Interprete",
};

const RecordingRoom = ({ params, searchParams }: RecordingRoomProperties) => {
  if (!roomEnabled()) {
    notFound();
  }
  return <RoomRecordingPage params={params} searchParams={searchParams} />;
};

export default RecordingRoom;
