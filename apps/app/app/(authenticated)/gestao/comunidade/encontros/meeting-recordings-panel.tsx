import { database } from "@repo/database";
import {
  linkMeetingRecording,
  unlinkMeetingRecording,
} from "./recording-link-actions";

const dateLabel = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeZone: "America/Sao_Paulo",
      }).format(value)
    : "sem data";

/**
 * Gravações importadas ligadas a este encontro. Quem tem acesso ao encontro
 * as vê em Minhas gravações e na página do encontro.
 */
export const MeetingRecordingsPanel = async ({
  meetingId,
}: {
  readonly meetingId: string;
}) => {
  const [linked, candidates] = await Promise.all([
    database.importedRecording.findMany({
      where: { meetingId },
      orderBy: [{ meetingDate: "desc" }, { id: "asc" }],
      select: { id: true, meetingDate: true, originalTitle: true },
    }),
    database.importedRecording.findMany({
      where: { OR: [{ meetingId: null }, { meetingId: { not: meetingId } }] },
      orderBy: [{ meetingDate: "desc" }, { id: "asc" }],
      take: 150,
      select: {
        id: true,
        meetingDate: true,
        meetingId: true,
        originalTitle: true,
      },
    }),
  ]);
  return (
    <section
      aria-label="Gravações do encontro"
      className="gk-card gk-form-card"
    >
      <h2 className="gk-card-title">Gravações importadas</h2>
      <p className="gk-hint">
        Ligue aqui uma gravação histórica a este encontro. Quem participa do
        encontro passa a vê-la em Minhas gravações.
      </p>
      {linked.length === 0 ? (
        <p className="gk-hint">Nenhuma gravação ligada.</p>
      ) : (
        <ul className="gk-history">
          {linked.map((recording) => (
            <li key={recording.id}>
              <form action={unlinkMeetingRecording}>
                <input name="meetingId" type="hidden" value={meetingId} />
                <input name="recordingId" type="hidden" value={recording.id} />
                {recording.originalTitle ?? "Gravação"} ·{" "}
                {dateLabel(recording.meetingDate)}{" "}
                <button className="gk-link-btn" type="submit">
                  Desvincular
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 ? (
        <form action={linkMeetingRecording} className="gk-recording-link">
          <input name="meetingId" type="hidden" value={meetingId} />
          <select className="gk-input" name="recordingId" required>
            <option value="">Escolha uma gravação</option>
            {candidates.map((recording) => (
              <option key={recording.id} value={recording.id}>
                {recording.originalTitle ?? "Gravação"} ·{" "}
                {dateLabel(recording.meetingDate)}
                {recording.meetingId ? " · já ligada a outro encontro" : ""}
              </option>
            ))}
          </select>
          <button className="gk-btn" type="submit">
            Vincular gravação
          </button>
        </form>
      ) : null}
    </section>
  );
};
