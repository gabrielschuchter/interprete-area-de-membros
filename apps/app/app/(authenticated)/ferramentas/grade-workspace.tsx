"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  emptyGradeDowngrades,
  emptyGradeUpgrades,
  type GradeCertainty,
  type GradeDesign,
  type GradeDowngrades,
  type GradeUpgrades,
  gradeCertainty,
  gradeCertaintyPresentation,
  gradeDesignLabels,
  gradeDesigns,
  gradeDowngradeDomains,
  gradeDowngradeLabels,
  gradeTotalDowngrade,
  gradeUpgradeAllowed,
  gradeUpgradeFactors,
  suggestGradeRiskOfBias,
} from "@/lib/evidence-grade";
import { type Rob2Judgement, rob2JudgementLabels } from "@/lib/evidence-rob2";
import {
  deleteEvidenceAssessmentAction,
  saveGradeAssessmentAction,
} from "./evidence-actions";
import {
  EvidenceActionBar,
  EvidenceList,
  type EvidenceListItem,
  type EvidenceStatus,
  evidenceHref,
  JudgementBadge,
} from "./evidence-shared";

export interface GradeSelected {
  readonly context: string | null;
  readonly data: {
    readonly design?: GradeDesign;
    readonly downgrades?: GradeDowngrades;
    readonly effect?: string | null;
    readonly participants?: number | null;
    readonly rob2Ids?: readonly string[];
    readonly studies?: number | null;
    readonly upgradeNote?: string;
    readonly upgrades?: GradeUpgrades;
  };
  readonly id: string;
  readonly title: string;
  readonly version: number;
}

const certaintyLabel = (result: string | null) =>
  result && result in gradeCertaintyPresentation
    ? `Certeza ${gradeCertaintyPresentation[result as GradeCertainty].label.toLowerCase()}`
    : "Em andamento";

const rob2Label = (result: string | null) =>
  result && result in rob2JudgementLabels
    ? rob2JudgementLabels[result as Rob2Judgement]
    : "RoB 2 em andamento";

const publicationBiasLabels = ["Não detectado", "Fortemente suspeito"];

const Levels = ({
  disabled = false,
  labels,
  name,
  onChange,
  value,
}: {
  readonly disabled?: boolean;
  readonly labels: readonly string[];
  readonly name: string;
  readonly onChange: (value: number) => void;
  readonly value: number;
}) => (
  <div className="ev-choices">
    {labels.map((label, level) => (
      <label className="ev-choice" key={label}>
        <input
          checked={value === level}
          disabled={disabled}
          name={name}
          onChange={() => onChange(level)}
          type="radio"
          value={level}
        />
        <span>{label}</span>
      </label>
    ))}
  </div>
);

const Intro = () => (
  <div className="ev-intro">
    <h2 className="ev-card__title">Certeza da evidência com o GRADE</h2>
    <p>
      Avalie a certeza da evidência para um desfecho. Ensaios randomizados
      começam com certeza alta e estudos observacionais, com baixa. Cada domínio
      pode rebaixar um ou dois níveis; sem rebaixamentos, estudos observacionais
      podem ser elevados.
    </p>
    <ol>
      <li>
        Descreva o desfecho e a pergunta (população, intervenção, comparador).
      </li>
      <li>
        Ligue os estudos que você avaliou com o RoB 2: eles sugerem o julgamento
        do risco de viés.
      </li>
      <li>Julgue os cinco domínios, justificando cada rebaixamento.</li>
    </ol>
  </div>
);

const numberOrNull = (value: string) => {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const RobLinksSection = ({
  currentLevel,
  onApply,
  onToggle,
  rob2Ids,
  rob2Items,
}: {
  readonly currentLevel: number;
  readonly onApply: (level: number) => void;
  readonly onToggle: (id: string, checked: boolean) => void;
  readonly rob2Ids: readonly string[];
  readonly rob2Items: readonly EvidenceListItem[];
}) => {
  const suggestion = suggestGradeRiskOfBias(
    rob2Items
      .filter((item) => rob2Ids.includes(item.id))
      .map((item) =>
        item.result && item.result in rob2JudgementLabels
          ? (item.result as Rob2Judgement)
          : null
      )
  );
  return (
    <section aria-labelledby="grade-rob2" className="ev-card">
      <h2 className="ev-card__title" id="grade-rob2">
        Estudos avaliados com RoB 2
      </h2>
      {rob2Items.length === 0 ? (
        <p className="ev-note">
          Você ainda não avaliou estudos no RoB 2. As avaliações salvas lá
          aparecem aqui para compor o risco de viés deste desfecho.
        </p>
      ) : (
        <ul className="ev-rob-links">
          {rob2Items.map((item) => (
            <li key={item.id}>
              <label>
                <input
                  checked={rob2Ids.includes(item.id)}
                  onChange={(event) => onToggle(item.id, event.target.checked)}
                  type="checkbox"
                />
                <span className="ev-rob-links__name">
                  {item.title}
                  {item.context ? ` · ${item.context}` : ""}
                </span>
                <JudgementBadge
                  judgement={item.result}
                  label={rob2Label(item.result)}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
      {suggestion === null ? null : (
        <div className="ev-suggestion">
          <span>
            Sugestão para risco de viés:{" "}
            <strong>{gradeDowngradeLabels[suggestion]}</strong>
          </span>
          {currentLevel === suggestion ? (
            <span className="ev-note">Já aplicada.</span>
          ) : (
            <button
              className="ev-button"
              onClick={() => onApply(suggestion)}
              type="button"
            >
              Aplicar sugestão
            </button>
          )}
        </div>
      )}
    </section>
  );
};

const UpgradesSection = ({
  allowed,
  note,
  onNote,
  onUpgrade,
  pending,
  upgrades,
}: {
  readonly allowed: boolean;
  readonly note: string;
  readonly onNote: (value: string) => void;
  readonly onUpgrade: (id: keyof GradeUpgrades, value: number) => void;
  readonly pending: boolean;
  readonly upgrades: GradeUpgrades;
}) => (
  <section aria-labelledby="grade-upgrades" className="ev-card">
    <h2 className="ev-card__title" id="grade-upgrades">
      Fatores para elevar
    </h2>
    {allowed ? null : (
      <p className="ev-note">
        Só é possível elevar quando nenhum domínio foi rebaixado.
      </p>
    )}
    <div>
      {gradeUpgradeFactors.map((factor) => (
        <fieldset className="ev-grade-row" key={factor.id}>
          <legend className="ev-grade-row__title">{factor.title}</legend>
          <Levels
            disabled={!allowed || pending}
            labels={
              factor.maxLevels === 2 ? ["Não", "+1", "+2"] : ["Não", "+1"]
            }
            name={`grade-up-${factor.id}`}
            onChange={(value) => onUpgrade(factor.id, value)}
            value={allowed ? upgrades[factor.id] : 0}
          />
        </fieldset>
      ))}
    </div>
    {allowed ? (
      <label className="ev-field">
        Justificativa da elevação
        <textarea
          maxLength={1500}
          onChange={(event) => onNote(event.target.value)}
          value={note}
        />
      </label>
    ) : null}
  </section>
);

const certaintyTrail = (
  design: GradeDesign,
  downgrades: GradeDowngrades,
  upgrades: GradeUpgrades
) => {
  const parts = [
    `Começa ${design === "RCT" ? "alta (ensaios)" : "baixa (observacionais)"}`,
  ];
  const down = gradeTotalDowngrade(downgrades);
  if (down > 0) {
    parts.push(`−${down} por rebaixamento`);
  }
  const up = gradeUpgradeAllowed(design, downgrades)
    ? gradeUpgradeFactors.reduce((sum, factor) => sum + upgrades[factor.id], 0)
    : 0;
  if (up > 0) {
    parts.push(`+${up} por elevação`);
  }
  return parts.join(" · ");
};

const CertaintySummary = ({
  design,
  downgrades,
  upgrades,
}: {
  readonly design: GradeDesign;
  readonly downgrades: GradeDowngrades;
  readonly upgrades: GradeUpgrades;
}) => {
  const presentation =
    gradeCertaintyPresentation[gradeCertainty(design, downgrades, upgrades)];
  return (
    <section aria-labelledby="grade-result" className="ev-certainty">
      <h2 className="ev-certainty__label" id="grade-result">
        Certeza da evidência
      </h2>
      <p className="ev-certainty__value">
        {presentation.label}
        <span aria-hidden="true" className="ev-certainty__symbols">
          {presentation.symbols}
        </span>
      </p>
      <p className="ev-certainty__meaning">{presentation.meaning}</p>
      <p className="ev-certainty__trail">
        {certaintyTrail(design, downgrades, upgrades)}
      </p>
    </section>
  );
};

const SummaryRow = ({
  certainty,
  design,
  effect,
  participants,
  studies,
  title,
}: {
  readonly certainty: GradeCertainty;
  readonly design: GradeDesign;
  readonly effect: string;
  readonly participants: string;
  readonly studies: string;
  readonly title: string;
}) => {
  const presentation = gradeCertaintyPresentation[certainty];
  const studiesLabel = [
    studies ? `${studies} ${studies === "1" ? "estudo" : "estudos"}` : null,
    participants ? `${participants} participantes` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section aria-labelledby="grade-sof" className="ev-card">
      <h2 className="ev-card__title" id="grade-sof">
        Linha da tabela de resumo
      </h2>
      <div className="ev-sof">
        <table>
          <thead>
            <tr>
              <th scope="col">Desfecho</th>
              <th scope="col">Estudos</th>
              <th scope="col">Efeito</th>
              <th scope="col">Certeza</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{title || "—"}</td>
              <td>
                {studiesLabel || "—"}
                <br />
                <span className="ev-note">{gradeDesignLabels[design]}</span>
              </td>
              <td>{effect || "—"}</td>
              <td>
                {presentation.symbols} {presentation.label}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};

const Editor = ({
  rob2Items,
  selected,
}: {
  readonly rob2Items: readonly EvidenceListItem[];
  readonly selected: GradeSelected | null;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const data = selected?.data ?? {};
  const [title, setTitle] = useState(selected?.title ?? "");
  const [context, setContext] = useState(selected?.context ?? "");
  const [design, setDesign] = useState<GradeDesign>(data.design ?? "RCT");
  const [studies, setStudies] = useState(data.studies?.toString() ?? "");
  const [participants, setParticipants] = useState(
    data.participants?.toString() ?? ""
  );
  const [effect, setEffect] = useState(data.effect ?? "");
  const [downgrades, setDowngrades] = useState<GradeDowngrades>(
    data.downgrades ?? emptyGradeDowngrades()
  );
  const [upgrades, setUpgrades] = useState<GradeUpgrades>(
    data.upgrades ?? emptyGradeUpgrades()
  );
  const [upgradeNote, setUpgradeNote] = useState(data.upgradeNote ?? "");
  const [rob2Ids, setRob2Ids] = useState<readonly string[]>(
    (data.rob2Ids ?? []).filter((id) =>
      rob2Items.some((item) => item.id === id)
    )
  );
  const [status, setStatus] = useState<EvidenceStatus | null>(null);

  const certainty = gradeCertainty(design, downgrades, upgrades);
  const presentation = gradeCertaintyPresentation[certainty];
  const upgradeAllowed = gradeUpgradeAllowed(design, downgrades);

  const setLevel = (id: keyof GradeDowngrades, levels: number) =>
    setDowngrades((current) => ({
      ...current,
      [id]: { ...current[id], levels },
    }));

  const save = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await saveGradeAssessmentAction({
        id: selected?.id,
        version: selected?.version,
        title,
        context,
        design,
        studies: numberOrNull(studies),
        participants: numberOrNull(participants),
        effect,
        downgrades,
        upgrades: upgradeAllowed ? upgrades : emptyGradeUpgrades(),
        upgradeNote,
        rob2Ids,
      });
      if (!result.ok) {
        setStatus({ text: result.error, tone: "error" });
        return;
      }
      setStatus({ text: "Avaliação salva.", tone: "info" });
      router.replace(evidenceHref("grade", result.id), { scroll: false });
      router.refresh();
    });
  };

  const remove = () => {
    if (!selected) {
      return;
    }
    startTransition(async () => {
      const result = await deleteEvidenceAssessmentAction({
        id: selected.id,
        tool: "GRADE",
      });
      if (!result.ok) {
        setStatus({
          text: result.error ?? "Não foi possível excluir.",
          tone: "error",
        });
        return;
      }
      router.replace(evidenceHref("grade"), { scroll: false });
      router.refresh();
    });
  };

  return (
    <div className="ev-main">
      <section aria-labelledby="grade-outcome" className="ev-card">
        <h2 className="ev-card__title" id="grade-outcome">
          {selected ? "Desfecho avaliado" : "Nova avaliação GRADE"}
        </h2>
        <div className="ev-fields">
          <label className="ev-field ev-field--wide">
            Desfecho
            <input
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Mortalidade em 12 meses"
              required
              value={title}
            />
          </label>
          <label className="ev-field ev-field--wide">
            Pergunta
            <input
              maxLength={300}
              onChange={(event) => setContext(event.target.value)}
              placeholder="Ex.: Em adultos com DM2, dieta low-carb comparada à dieta usual"
              value={context}
            />
          </label>
          <fieldset className="ev-field ev-field--wide ev-fieldset">
            <legend>Delineamento dos estudos</legend>
            <Levels
              labels={gradeDesigns.map((value) => gradeDesignLabels[value])}
              name="grade-design"
              onChange={(index) => setDesign(gradeDesigns[index] ?? "RCT")}
              value={gradeDesigns.indexOf(design)}
            />
          </fieldset>
          <label className="ev-field">
            Nº de estudos
            <input
              inputMode="numeric"
              onChange={(event) => setStudies(event.target.value)}
              value={studies}
            />
          </label>
          <label className="ev-field">
            Nº de participantes
            <input
              inputMode="numeric"
              onChange={(event) => setParticipants(event.target.value)}
              value={participants}
            />
          </label>
          <label className="ev-field ev-field--wide">
            Efeito (relativo e absoluto)
            <input
              maxLength={200}
              onChange={(event) => setEffect(event.target.value)}
              placeholder="Ex.: RR 0,80 (IC 95% 0,65 a 0,98) · 20 a menos por 1.000"
              value={effect}
            />
          </label>
        </div>
      </section>

      <RobLinksSection
        currentLevel={downgrades.riskOfBias.levels}
        onApply={(level) => setLevel("riskOfBias", level)}
        onToggle={(id, checked) =>
          setRob2Ids((current) =>
            checked ? [...current, id] : current.filter((item) => item !== id)
          )
        }
        rob2Ids={rob2Ids}
        rob2Items={rob2Items}
      />

      <section aria-labelledby="grade-domains" className="ev-card">
        <h2 className="ev-card__title" id="grade-domains">
          Domínios para rebaixar
        </h2>
        <div>
          {gradeDowngradeDomains.map((domain) => {
            const rating = downgrades[domain.id];
            return (
              <fieldset className="ev-grade-row" key={domain.id}>
                <div>
                  <legend className="ev-grade-row__title">
                    {domain.title}
                  </legend>
                  <p className="ev-grade-row__hint">{domain.hint}</p>
                </div>
                <Levels
                  disabled={pending}
                  labels={
                    domain.id === "publicationBias"
                      ? publicationBiasLabels
                      : gradeDowngradeLabels
                  }
                  name={`grade-${domain.id}`}
                  onChange={(value) => setLevel(domain.id, value)}
                  value={rating.levels}
                />
                {rating.levels > 0 ? (
                  <label className="ev-field">
                    Por que rebaixar?
                    <textarea
                      maxLength={1500}
                      onChange={(event) =>
                        setDowngrades((current) => ({
                          ...current,
                          [domain.id]: {
                            ...current[domain.id],
                            reason: event.target.value,
                          },
                        }))
                      }
                      required
                      value={rating.reason}
                    />
                  </label>
                ) : null}
              </fieldset>
            );
          })}
        </div>
      </section>

      {design === "OBSERVATIONAL" ? (
        <UpgradesSection
          allowed={upgradeAllowed}
          note={upgradeNote}
          onNote={setUpgradeNote}
          onUpgrade={(id, value) =>
            setUpgrades((current) => ({ ...current, [id]: value }))
          }
          pending={pending}
          upgrades={upgrades}
        />
      ) : null}

      <CertaintySummary
        design={design}
        downgrades={downgrades}
        upgrades={upgrades}
      />
      <SummaryRow
        certainty={certainty}
        design={design}
        effect={effect}
        participants={participants}
        studies={studies}
        title={title}
      />

      <EvidenceActionBar
        idleText={`Certeza ${presentation.label.toLowerCase()}`}
        onDelete={selected ? remove : undefined}
        onSave={save}
        pending={pending}
        status={status}
      />
    </div>
  );
};

export const GradeWorkspace = ({
  creating,
  items,
  rob2Items,
  selected,
}: {
  readonly creating: boolean;
  readonly items: readonly EvidenceListItem[];
  readonly rob2Items: readonly EvidenceListItem[];
  readonly selected: GradeSelected | null;
}) => (
  <div className="ev" data-evidence-tool="grade">
    <EvidenceList
      emptyText="Nenhum desfecho avaliado ainda."
      items={items}
      resultLabel={certaintyLabel}
      selectedId={selected?.id ?? null}
      title="Seus desfechos"
      view="grade"
    />
    {selected || creating ? (
      <Editor
        key={selected ? `${selected.id}:${selected.version}` : "nova"}
        rob2Items={rob2Items}
        selected={selected}
      />
    ) : (
      <Intro />
    )}
  </div>
);
