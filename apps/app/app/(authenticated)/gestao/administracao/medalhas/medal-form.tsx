"use client";

import type { BadgeCriterion } from "@repo/database";
import { useActionState } from "react";
import { medalCriterionLabels } from "@/lib/gestao-medals-domain";
import { GestaoIcon } from "../../gestao-icon";
import { type MedalFormState, saveGestaoMedal } from "./actions";

const idle: MedalFormState = { error: null };

export const MedalForm = ({
  awards,
  initial,
}: {
  readonly awards: number;
  readonly initial: {
    readonly criterion: BadgeCriterion;
    readonly description: string;
    readonly id: string | null;
    readonly threshold: number;
    readonly title: string;
  };
}) => {
  const [state, formAction, pending] = useActionState(saveGestaoMedal, idle);
  return (
    <form action={formAction} className="gk-card gk-form-card">
      <h2 className="gk-card-title">Dados da medalha</h2>
      <input name="id" type="hidden" value={initial.id ?? ""} />
      <label className="gk-label">
        <span>Nome *</span>
        <input
          className="gk-input"
          defaultValue={initial.title}
          maxLength={120}
          name="title"
          required
        />
      </label>
      <label className="gk-label">
        <span>Critério</span>
        <select
          className="gk-input"
          defaultValue={initial.criterion}
          name="criterion"
        >
          {(Object.keys(medalCriterionLabels) as BadgeCriterion[]).map(
            (criterion) => (
              <option key={criterion} value={criterion}>
                {medalCriterionLabels[criterion]}
              </option>
            )
          )}
        </select>
      </label>
      <label className="gk-label">
        <span>Quantidade necessária</span>
        <input
          className="gk-input"
          defaultValue={initial.threshold}
          max={1_000_000}
          min={1}
          name="threshold"
          required
          type="number"
        />
        <small className="gk-hint">
          A regra é avaliada no servidor. Cada membro recebe a medalha uma única
          vez.
        </small>
      </label>
      <label className="gk-label">
        <span>Descrição</span>
        <textarea
          className="gk-input gk-textarea"
          defaultValue={initial.description}
          maxLength={1000}
          name="description"
          required
          rows={3}
        />
      </label>
      {initial.id && awards > 0 ? (
        <div className="gk-info-box gk-info-box--danger">
          <GestaoIcon name="alert-circle" size={20} />
          <div>
            <strong>Mudar o critério cria uma nova versão.</strong>
            <span>
              {awards}{" "}
              {awards === 1
                ? "conquista já registrada continua"
                : "conquistas já registradas continuam"}{" "}
              válidas na versão anterior.
            </span>
          </div>
        </div>
      ) : null}
      {state.error ? (
        <p className="gk-error-box" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="gk-link-actions">
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending}
          type="submit"
        >
          {initial.id ? "Salvar alterações" : "Criar como rascunho"}
        </button>
      </div>
    </form>
  );
};
