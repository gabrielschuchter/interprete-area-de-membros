import "@/app/(authenticated)/cursos/room.css";
import { CompassIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { type RoomKind, roomTextFor } from "./room-copy";

// Full-page answers of the room (404 and 403), in the room's own visual.
export const RoomPageState = ({
  content = "lesson",
  kind,
}: {
  readonly content?: RoomKind;
  readonly kind: "forbidden" | "not_found";
}) => {
  const forbidden = kind === "forbidden";
  const text = (key: Parameters<typeof roomTextFor>[1]) =>
    roomTextFor(content, key);
  return (
    <div className="room">
      <main className="room__main">
        <div className="room-state">
          <span aria-hidden="true" className="room-state__icon">
            {forbidden ? <LockIcon size={22} /> : <CompassIcon size={22} />}
          </span>
          <span aria-hidden="true" className="room-state__meander" />
          <h1 className="room-state__title">
            {text(forbidden ? "forbiddenTitle" : "notFoundTitle")}
          </h1>
          <p className="room-state__body">
            {text(forbidden ? "forbiddenBody" : "notFoundBody")}
          </p>
          <div className="room-state__actions">
            <Link
              className="room-button room-button--primary"
              href={
                content === "recording" ? "/encontros/gravacoes" : "/cursos"
              }
            >
              {text(forbidden ? "forbiddenCta" : "notFoundCta")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
