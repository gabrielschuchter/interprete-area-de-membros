"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  type Rob2Answer,
  type Rob2Answers,
  type Rob2DomainId,
  type Rob2Judgement,
  type Rob2Overrides,
  rob2AnswerLabels,
  rob2AnswerShortLabels,
  rob2Answers,
  rob2DomainJudgement,
  rob2Domains,
  rob2JudgementLabels,
  rob2Judgements,
  rob2OverallJudgement,
  rob2QuestionApplies,
  suggestRob2DomainJudgement,
} from "@/lib/evidence-rob2";
import {
  deleteEvidenceAssessmentAction,
  saveRob2AssessmentAction,
} from "./evidence-actions";
import {
  EvidenceActionBar,
  EvidenceList,
  type EvidenceListItem,
  type EvidenceStatus,
  evidenceHref,
  JudgementBadge,
  JudgementDot,
} from "./evidence-shared";

export interface Rob2Selected {
  readonly context: string | null;
  readonly data: {
    readonly answers?: Rob2Answers;
    readonly comparator?: string | null;
    readonly domainNotes?: Partial<Record<Rob2DomainId, string>>;
    readonly experimental?: string | null;
    readonly numericalResult?: string | null;
    readonly overallOverride?: "HIGH" | null;
    readonly overrides?: Rob2Overrides;
  };
  readonly id: string;
  readonly title: string;
  readonly version: number;
}

const judgementLabel = (judgement: string | null) =>
  judgement && judgement in rob2JudgementLabels
    ? rob2JudgementLabels[judgement as Rob2Judgement]
    : "Em andamento";

const Intro = () => (
  <div className="ev-intro">
    <h2 className="ev-card__title">Risco de viés com o RoB 2</h2>
    <p>
      Avalie um resultado de um ensaio randomizado de grupos paralelos,
      considerando o efeito da atribuição à intervenção (intenção de tratar).
      Responda às perguntas sinalizadoras de cada domínio; o julgamento sugerido
      segue o algoritmo oficial do RoB 2 e você pode ajustá-lo com
      justificativa.
    </p>
    <ol>
      <li>Identifique o estudo, o desfecho e o resultado numérico avaliado.</li>
      <li>
        Responda aos cinco domínios. Só aparecem as perguntas que se aplicam.
      </li>
      <li>
        Salve. A avaliação fica disponível para compor o GRADE do desfecho.
      </li>
    </ol>
  </div>
);

const Question = ({
  answer,
  disabled,
  id,
  onChange,
  text,
}: {
  readonly answer: Rob2Answer | undefined;
  readonly disabled: boolean;
  readonly id: string;
  readonly onChange: (value: Rob2Answer) => void;
  readonly text: string;
}) => (
  <fieldset className="ev-question">
    <legend>
      <span className="ev-question__id">{id}</span>
      {text}
    </legend>
    <div className="ev-choices">
      {rob2Answers.map((value) => (
        <label
          className="ev-choice"
          key={value}
          title={rob2AnswerLabels[value]}
        >
          <input
            checked={answer === value}
            disabled={disabled}
            name={`rob2-${id}`}
            onChange={() => onChange(value)}
            type="radio"
            value={value}
          />
          <span>
            <span aria-hidden="true">{rob2AnswerShortLabels[value]}</span>
            <span className="sr-only">{rob2AnswerLabels[value]}</span>
          </span>
        </label>
      ))}
    </div>
  </fieldset>
);

const Editor = ({ selected }: { readonly selected: Rob2Selected | null }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const data = selected?.data ?? {};
  const [title, setTitle] = useState(selected?.title ?? "");
  const [context, setContext] = useState(selected?.context ?? "");
  const [experimental, setExperimental] = useState(data.experimental ?? "");
  const [comparator, setComparator] = useState(data.comparator ?? "");
  const [numericalResult, setNumericalResult] = useState(
    data.numericalResult ?? ""
  );
  const [answers, setAnswers] = useState<Rob2Answers>(data.answers ?? {});
  const [notes, setNotes] = useState<Partial<Record<Rob2DomainId, string>>>(
    data.domainNotes ?? {}
  );
  const [overrides, setOverrides] = useState<Rob2Overrides>(
    data.overrides ?? {}
  );
  const [raiseOverall, setRaiseOverall] = useState(
    data.overallOverride === "HIGH"
  );
  const [status, setStatus] = useState<EvidenceStatus | null>(null);

  const overall = useMemo(
    () =>
      rob2OverallJudgement(answers, overrides, raiseOverall ? "HIGH" : null),
    [answers, overrides, raiseOverall]
  );
  const suggestedOverall = rob2OverallJudgement(answers, overrides);

  const setAnswer = (id: string, value: Rob2Answer) =>
    setAnswers((current) => ({ ...current, [id]: value }));

  const save = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await saveRob2AssessmentAction({
        id: selected?.id,
        version: selected?.version,
        title,
        context,
        experimental,
        comparator,
        numericalResult,
        answers,
        domainNotes: notes,
        overrides,
        overallOverride:
          raiseOverall && suggestedOverall === "SOME_CONCERNS" ? "HIGH" : null,
      });
      if (!result.ok) {
        setStatus({ text: result.error, tone: "error" });
        return;
      }
      setStatus({ text: "Avaliação salva.", tone: "info" });
      router.replace(evidenceHref("rob2", result.id), { scroll: false });
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
        tool: "ROB2",
      });
      if (!result.ok) {
        setStatus({
          text: result.error ?? "Não foi possível excluir.",
          tone: "error",
        });
        return;
      }
      router.replace(evidenceHref("rob2"), { scroll: false });
      router.refresh();
    });
  };

  return (
    <div className="ev-main">
      <section aria-labelledby="rob2-study" className="ev-card">
        <h2 className="ev-card__title" id="rob2-study">
          {selected ? "Estudo avaliado" : "Nova avaliação RoB 2"}
        </h2>
        <p className="ev-card__lede">
          Ensaio randomizado de grupos paralelos · efeito da atribuição à
          intervenção (intenção de tratar).
        </p>
        <div className="ev-fields">
          <label className="ev-field ev-field--wide">
            Estudo
            <input
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Silva et al., 2021"
              required
              value={title}
            />
          </label>
          <label className="ev-field">
            Intervenção experimental
            <input
              maxLength={200}
              onChange={(event) => setExperimental(event.target.value)}
              value={experimental}
            />
          </label>
          <label className="ev-field">
            Comparador
            <input
              maxLength={200}
              onChange={(event) => setComparator(event.target.value)}
              value={comparator}
            />
          </label>
          <label className="ev-field">
            Desfecho avaliado
            <input
              maxLength={300}
              onChange={(event) => setContext(event.target.value)}
              placeholder="Ex.: HbA1c em 12 semanas"
              value={context}
            />
          </label>
          <label className="ev-field">
            Resultado numérico
            <input
              maxLength={200}
              onChange={(event) => setNumericalResult(event.target.value)}
              placeholder="Ex.: DM −0,4% (IC 95% −0,7 a −0,1)"
              value={numericalResult}
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="rob2-summary" className="ev-card">
        <h2 className="ev-card__title" id="rob2-summary">
          Resumo por domínio
        </h2>
        <div className="ev-traffic">
          {rob2Domains.map((domain) => {
            const judgement = rob2DomainJudgement(
              domain.id,
              answers,
              overrides
            );
            return (
              <div className="ev-traffic__cell" key={domain.id}>
                <JudgementDot judgement={judgement} />
                <span>
                  {domain.id}
                  <span className="sr-only">
                    {" "}
                    {domain.title}: {judgementLabel(judgement)}
                  </span>
                </span>
              </div>
            );
          })}
          <div className="ev-traffic__cell ev-traffic__cell--overall">
            <JudgementDot judgement={overall} />
            <span>
              Geral
              <span className="sr-only">: {judgementLabel(overall)}</span>
            </span>
          </div>
        </div>
        <p className="ev-note">
          + baixo risco · − algumas preocupações · × alto risco · ? faltam
          respostas
        </p>
        <p className="ev-note">
          Respostas: S sim · PS provavelmente sim · PN provavelmente não · N não
          · SI sem informação
        </p>
      </section>

      {rob2Domains.map((domain) => {
        const suggested = suggestRob2DomainJudgement(domain.id, answers);
        const override = overrides[domain.id];
        return (
          <section
            aria-labelledby={`rob2-${domain.id}`}
            className="ev-card"
            key={domain.id}
          >
            <h2 className="ev-card__title" id={`rob2-${domain.id}`}>
              {domain.id} · {domain.title}
            </h2>
            <div>
              {domain.questions
                .filter((question) => rob2QuestionApplies(question, answers))
                .map((question) => (
                  <Question
                    answer={answers[question.id]}
                    disabled={pending}
                    id={question.id}
                    key={question.id}
                    onChange={(value) => setAnswer(question.id, value)}
                    text={question.text}
                  />
                ))}
            </div>
            <div className="ev-domain__footer">
              <div className="ev-field">
                Julgamento sugerido
                <JudgementBadge
                  judgement={suggested}
                  label={
                    suggested
                      ? rob2JudgementLabels[suggested]
                      : "Responda às perguntas"
                  }
                />
              </div>
              <label className="ev-field">
                Julgamento final
                <select
                  disabled={!suggested || pending}
                  onChange={(event) => {
                    const value = event.target.value as Rob2Judgement | "";
                    setOverrides((current) => {
                      const next = { ...current };
                      if (!value || value === suggested) {
                        delete next[domain.id];
                      } else {
                        next[domain.id] = {
                          judgement: value,
                          reason: current[domain.id]?.reason ?? "",
                        };
                      }
                      return next;
                    });
                  }}
                  value={override?.judgement ?? ""}
                >
                  <option value="">Seguir a sugestão</option>
                  {rob2Judgements
                    .filter((judgement) => judgement !== suggested)
                    .map((judgement) => (
                      <option key={judgement} value={judgement}>
                        {rob2JudgementLabels[judgement]}
                      </option>
                    ))}
                </select>
              </label>
              {override ? (
                <label className="ev-field ev-field--wide">
                  Por que mudar o julgamento?
                  <textarea
                    maxLength={1500}
                    onChange={(event) =>
                      setOverrides((current) => ({
                        ...current,
                        [domain.id]: {
                          judgement: override.judgement,
                          reason: event.target.value,
                        },
                      }))
                    }
                    required
                    value={override.reason}
                  />
                </label>
              ) : null}
              <label className="ev-field ev-field--wide">
                Justificativa e trechos do estudo
                <textarea
                  maxLength={1500}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [domain.id]: event.target.value,
                    }))
                  }
                  placeholder="Cite o que no artigo apoia as respostas."
                  value={notes[domain.id] ?? ""}
                />
              </label>
            </div>
          </section>
        );
      })}

      <section aria-labelledby="rob2-overall" className="ev-card">
        <h2 className="ev-card__title" id="rob2-overall">
          Julgamento geral
        </h2>
        <JudgementBadge judgement={overall} label={judgementLabel(overall)} />
        {suggestedOverall === "SOME_CONCERNS" ? (
          <label className="ev-check">
            <input
              checked={raiseOverall}
              onChange={(event) => setRaiseOverall(event.target.checked)}
              type="checkbox"
            />
            Elevar para alto risco: as preocupações em vários domínios, somadas,
            reduzem muito a confiança no resultado.
          </label>
        ) : null}
      </section>

      <EvidenceActionBar
        idleText={
          overall
            ? `Geral: ${rob2JudgementLabels[overall]}`
            : "Você pode salvar e terminar depois."
        }
        onDelete={selected ? remove : undefined}
        onSave={save}
        pending={pending}
        status={status}
      />
    </div>
  );
};

export const Rob2Workspace = ({
  creating,
  items,
  selected,
}: {
  readonly creating: boolean;
  readonly items: readonly EvidenceListItem[];
  readonly selected: Rob2Selected | null;
}) => (
  <div className="ev" data-evidence-tool="rob2">
    <EvidenceList
      emptyText="Nenhum estudo avaliado ainda. Comece por um ensaio que você está lendo."
      items={items}
      resultLabel={judgementLabel}
      selectedId={selected?.id ?? null}
      title="Seus estudos"
      view="rob2"
    />
    {selected || creating ? (
      <Editor
        key={selected ? `${selected.id}:${selected.version}` : "nova"}
        selected={selected}
      />
    ) : (
      <Intro />
    )}
  </div>
);
