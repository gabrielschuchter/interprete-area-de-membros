"use client";

import Link from "next/link";
import {
  LessonTimerCard,
  SessionReviewDialog,
  useLessonTimer,
} from "../lesson-tools-drawer";
import { roomText } from "./room-copy";

// The room reuses the lesson timer of the old tools drawer as is: same
// /api/focus-timer session, same review step, same link to the lesson.
export const RoomTimePanel = ({ lessonId }: { readonly lessonId: string }) => {
  const timer = useLessonTimer(lessonId, true);

  return (
    <div className="room-time">
      <LessonTimerCard
        active={timer.active}
        activeFromOtherDevice={timer.activeFromOtherDevice}
        clientId={timer.clientId}
        lessonId={lessonId}
        linkedOnStart={timer.linkedOnStart}
        loading={timer.timerLoading}
        onAction={timer.sendTimerAction}
        pending={timer.pending}
        reviewPending={Boolean(timer.review)}
        seconds={timer.seconds}
        setLinkedOnStart={timer.setLinkedOnStart}
      />
      <p className="room-time__hint">
        {roomText("tempoMoreModes")}{" "}
        <Link className="room-panel__link" href="/ferramentas?view=timer">
          {roomText("tempoOpenTools")}
        </Link>
      </p>
      <SessionReviewDialog
        note={timer.reviewNote}
        pending={timer.pending}
        review={timer.review}
        reviewSession={timer.reviewSession}
        setNote={timer.setReviewNote}
      />
    </div>
  );
};
