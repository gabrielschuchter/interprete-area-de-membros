import "@/app/(authenticated)/cursos/room.css";
import { CompassIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { roomText } from "./room-copy";

// Full-page answers of the room (404 and 403), in the room's own visual.
export const RoomPageState = ({
  kind,
}: {
  readonly kind: "forbidden" | "not_found";
}) => {
  const forbidden = kind === "forbidden";
  return (
    <div className="room">
      <main className="room__main">
        <div className="room-state">
          <span aria-hidden="true" className="room-state__icon">
            {forbidden ? <LockIcon size={22} /> : <CompassIcon size={22} />}
          </span>
          <span aria-hidden="true" className="room-state__meander" />
          <h1 className="room-state__title">
            {roomText(forbidden ? "forbiddenTitle" : "notFoundTitle")}
          </h1>
          <p className="room-state__body">
            {roomText(forbidden ? "forbiddenBody" : "notFoundBody")}
          </p>
          <div className="room-state__actions">
            <Link className="room-button room-button--primary" href="/cursos">
              {roomText(forbidden ? "forbiddenCta" : "notFoundCta")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
