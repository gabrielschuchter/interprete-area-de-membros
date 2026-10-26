"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useActionState } from "react";
import { GestaoIcon } from "../../gestao-icon";
import {
  type GestaoAttendanceState,
  saveGestaoMeetingAttendance,
} from "./actions";

const initial: GestaoAttendanceState = { error: null, saved: false };

export const MeetingAttendanceDialog = ({
  attendees,
  meetingId,
  onClose,
}: {
  readonly attendees: readonly {
    readonly id: string;
    readonly name: string;
    readonly present: boolean;
  }[];
  readonly meetingId: string;
  readonly onClose: () => void;
}) => {
  const [state, action, pending] = useActionState(
    saveGestaoMeetingAttendance,
    initial
  );
  return (
    <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
      <DialogContent
        className="gk-modal"
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <form action={action}>
          <input name="meetingId" type="hidden" value={meetingId} />
          <div className="gk-modal-head">
            <div>
              <DialogTitle className="gk-modal-title">
                Presença confirmada
              </DialogTitle>
              <DialogDescription className="gk-modal-sub">
                Marque quem esteve presente. O registro é feito pela equipe e
                não é inferido ao abrir o link do encontro.
              </DialogDescription>
            </div>
          </div>
          <div className="gk-modal-body">
            {attendees.length === 0 ? (
              <p className="gk-hint">
                Este encontro não tem participantes definidos. Escolha turmas ou
                alunos no editor para registrar a presença.
              </p>
            ) : (
              <fieldset className="gk-attendlist">
                <legend className="sr-only">Participantes</legend>
                {attendees.map((attendee) => (
                  <label className="gk-attendrow" key={attendee.id}>
                    <input
                      defaultChecked={attendee.present}
                      name="attendeeId"
                      type="checkbox"
                      value={attendee.id}
                    />
                    <span>{attendee.name}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {state.error ? (
              <p className="gk-error-box" role="alert">
                <GestaoIcon name="alert-circle" size={16} /> {state.error}
              </p>
            ) : null}
            {state.saved ? (
              <output className="gk-result">Presença registrada.</output>
            ) : null}
          </div>
          <div className="gk-modal-foot">
            <span className="gk-spacer" />
            <button className="gk-btn" onClick={onClose} type="button">
              Fechar
            </button>
            {attendees.length === 0 ? null : (
              <button
                className="gk-btn gk-btn--primary"
                disabled={pending}
                type="submit"
              >
                Salvar presença
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
