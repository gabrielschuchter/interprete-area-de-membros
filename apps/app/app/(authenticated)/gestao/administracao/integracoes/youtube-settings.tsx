"use client";

import { useActionState, useState } from "react";
import {
  type YouTubePolicy,
  type YouTubeSchedule,
  youtubeScheduleLabels,
} from "@/lib/integrations-domain";
import { GestaoSwitch } from "../../gestao-switch";
import {
  saveGestaoYouTubeSettings,
  type YouTubeSettingsState,
} from "./actions";

const idle: YouTubeSettingsState = { error: null };

export const YouTubeSettings = ({
  initial,
}: {
  readonly initial: YouTubePolicy;
}) => {
  const [draft, setDraft] = useState(initial);
  const [state, formAction, pending] = useActionState(
    saveGestaoYouTubeSettings,
    idle
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = (patch: Partial<YouTubePolicy>) =>
    setDraft((current) => ({ ...current, ...patch }));
  return (
    <form action={formAction} className="gk-int-settings">
      <input name="payload" type="hidden" value={JSON.stringify(draft)} />
      <GestaoSwitch
        checked={draft.unlistedOnly}
        description="Vídeos públicos são recusados ao salvar a aula; privados já são sempre recusados."
        label="Aceitar apenas vídeos não listados"
        onChange={(value) => set({ unlistedOnly: value })}
      />
      <GestaoSwitch
        checked={draft.notifyUnavailable}
        description="Notificação para os responsáveis pelo curso quando a verificação automática rodar."
        label="Avisar se um vídeo ficar indisponível"
        onChange={(value) => set({ notifyUnavailable: value })}
      />
      <label className="gk-label">
        <span>Verificar a disponibilidade dos vídeos</span>
        <select
          className="gk-input"
          onChange={(event) =>
            set({ schedule: event.target.value as YouTubeSchedule })
          }
          value={draft.schedule}
        >
          {(Object.keys(youtubeScheduleLabels) as YouTubeSchedule[]).map(
            (key) => (
              <option key={key} value={key}>
                {youtubeScheduleLabels[key]}
              </option>
            )
          )}
        </select>
        <small className="gk-hint">
          Guardado para a verificação automática. Enquanto ela não estiver
          ligada, a checagem acontece ao salvar ou publicar cada aula.
        </small>
      </label>
      <GestaoSwitch
        checked={draft.allowUpload}
        description="Mantém o envio direto de arquivo como alternativa ao YouTube."
        label="Permitir também enviar arquivos de vídeo"
        onChange={(value) => set({ allowUpload: value })}
      />
      {state.error ? (
        <p className="gk-error-box" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="gk-link-actions">
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending || !dirty}
          type="submit"
        >
          {pending ? "Salvando…" : "Salvar regras"}
        </button>
        {dirty ? (
          <button
            className="gk-btn"
            onClick={() => setDraft(initial)}
            type="button"
          >
            Descartar
          </button>
        ) : null}
      </div>
    </form>
  );
};
