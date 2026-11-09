/**
 * RoB 2 (Cochrane) para ensaios randomizados de grupos paralelos, efeito da
 * atribuição à intervenção (intenção de tratar). Perguntas sinalizadoras e
 * algoritmos de julgamento sugerido conforme a orientação oficial do RoB 2
 * (Sterne et al., BMJ 2019; guia detalhado de 22/08/2019). O julgamento final
 * de cada domínio pode ser ajustado pela pessoa, com justificativa.
 */

export const rob2Answers = ["Y", "PY", "PN", "N", "NI"] as const;
export type Rob2Answer = (typeof rob2Answers)[number];

export const rob2AnswerLabels: Record<Rob2Answer, string> = {
  Y: "Sim",
  PY: "Provavelmente sim",
  PN: "Provavelmente não",
  N: "Não",
  NI: "Sem informação",
};

export const rob2AnswerShortLabels: Record<Rob2Answer, string> = {
  Y: "S",
  PY: "PS",
  PN: "PN",
  N: "N",
  NI: "SI",
};

export const rob2Judgements = ["LOW", "SOME_CONCERNS", "HIGH"] as const;
export type Rob2Judgement = (typeof rob2Judgements)[number];

export const rob2JudgementLabels: Record<Rob2Judgement, string> = {
  LOW: "Baixo risco",
  SOME_CONCERNS: "Algumas preocupações",
  HIGH: "Alto risco",
};

export const rob2DomainIds = ["D1", "D2", "D3", "D4", "D5"] as const;
export type Rob2DomainId = (typeof rob2DomainIds)[number];

export type Rob2Answers = Partial<Record<string, Rob2Answer>>;

interface Rob2Question {
  /** Quando a pergunta deve ser respondida, dadas as anteriores. */
  readonly applies?: (answers: Rob2Answers) => boolean;
  readonly id: string;
  readonly text: string;
}

export interface Rob2Domain {
  readonly id: Rob2DomainId;
  readonly questions: readonly Rob2Question[];
  readonly title: string;
}

const yes = (answer: Rob2Answer | undefined) =>
  answer === "Y" || answer === "PY";
const no = (answer: Rob2Answer | undefined) =>
  answer === "N" || answer === "PN";
const noInformation = (answer: Rob2Answer | undefined) => answer === "NI";
const yesOrUnclear = (answer: Rob2Answer | undefined) =>
  yes(answer) || noInformation(answer);
const noOrUnclear = (answer: Rob2Answer | undefined) =>
  no(answer) || noInformation(answer);

export const rob2Domains: readonly Rob2Domain[] = [
  {
    id: "D1",
    title: "Processo de randomização",
    questions: [
      { id: "1.1", text: "A sequência de alocação foi aleatória?" },
      {
        id: "1.2",
        text: "A sequência de alocação foi ocultada até que os participantes fossem incluídos e alocados?",
      },
      {
        id: "1.3",
        text: "As diferenças de linha de base entre os grupos sugerem problema no processo de randomização?",
      },
    ],
  },
  {
    id: "D2",
    title: "Desvios das intervenções pretendidas",
    questions: [
      {
        id: "2.1",
        text: "Os participantes sabiam a que intervenção foram alocados durante o estudo?",
      },
      {
        id: "2.2",
        text: "Cuidadores e quem aplicava as intervenções sabiam a alocação dos participantes durante o estudo?",
      },
      {
        id: "2.3",
        text: "Houve desvios da intervenção pretendida causados pelo contexto do estudo?",
        applies: (a) => yesOrUnclear(a["2.1"]) || yesOrUnclear(a["2.2"]),
      },
      {
        id: "2.4",
        text: "Esses desvios provavelmente afetaram o desfecho?",
        applies: (a) =>
          (yesOrUnclear(a["2.1"]) || yesOrUnclear(a["2.2"])) && yes(a["2.3"]),
      },
      {
        id: "2.5",
        text: "Esses desvios da intervenção pretendida foram equilibrados entre os grupos?",
        applies: (a) =>
          (yesOrUnclear(a["2.1"]) || yesOrUnclear(a["2.2"])) &&
          yes(a["2.3"]) &&
          yesOrUnclear(a["2.4"]),
      },
      {
        id: "2.6",
        text: "Foi usada análise apropriada para estimar o efeito da atribuição à intervenção?",
      },
      {
        id: "2.7",
        text: "Analisar participantes fora do grupo para o qual foram randomizados pode ter tido impacto substancial no resultado?",
        applies: (a) => noOrUnclear(a["2.6"]),
      },
    ],
  },
  {
    id: "D3",
    title: "Dados faltantes do desfecho",
    questions: [
      {
        id: "3.1",
        text: "Havia dados do desfecho para todos, ou quase todos, os participantes randomizados?",
      },
      {
        id: "3.2",
        text: "Há evidência de que o resultado não foi enviesado pelos dados faltantes?",
        applies: (a) => noOrUnclear(a["3.1"]),
      },
      {
        id: "3.3",
        text: "A ausência dos dados pode depender do valor verdadeiro do desfecho?",
        applies: (a) => noOrUnclear(a["3.1"]) && noOrUnclear(a["3.2"]),
      },
      {
        id: "3.4",
        text: "É provável que a ausência dos dados tenha dependido do valor verdadeiro do desfecho?",
        applies: (a) =>
          noOrUnclear(a["3.1"]) &&
          noOrUnclear(a["3.2"]) &&
          yesOrUnclear(a["3.3"]),
      },
    ],
  },
  {
    id: "D4",
    title: "Mensuração do desfecho",
    questions: [
      {
        id: "4.1",
        text: "O método de mensuração do desfecho foi inadequado?",
      },
      {
        id: "4.2",
        text: "A mensuração ou verificação do desfecho pode ter sido diferente entre os grupos?",
      },
      {
        id: "4.3",
        text: "Os avaliadores do desfecho sabiam qual intervenção os participantes receberam?",
        applies: (a) => noOrUnclear(a["4.1"]) && noOrUnclear(a["4.2"]),
      },
      {
        id: "4.4",
        text: "Saber a intervenção recebida pode ter influenciado a avaliação do desfecho?",
        applies: (a) =>
          noOrUnclear(a["4.1"]) &&
          noOrUnclear(a["4.2"]) &&
          yesOrUnclear(a["4.3"]),
      },
      {
        id: "4.5",
        text: "É provável que saber a intervenção recebida tenha influenciado a avaliação do desfecho?",
        applies: (a) =>
          noOrUnclear(a["4.1"]) &&
          noOrUnclear(a["4.2"]) &&
          yesOrUnclear(a["4.3"]) &&
          yesOrUnclear(a["4.4"]),
      },
    ],
  },
  {
    id: "D5",
    title: "Seleção do resultado relatado",
    questions: [
      {
        id: "5.1",
        text: "Os dados foram analisados conforme um plano pré-especificado, finalizado antes de os dados não cegados estarem disponíveis?",
      },
      {
        id: "5.2",
        text: "O resultado numérico avaliado provavelmente foi escolhido, com base nos resultados, entre várias medidas elegíveis do desfecho?",
      },
      {
        id: "5.3",
        text: "O resultado numérico avaliado provavelmente foi escolhido, com base nos resultados, entre várias análises elegíveis dos dados?",
      },
    ],
  },
];

export const rob2QuestionIds = rob2Domains.flatMap((domain) =>
  domain.questions.map((question) => question.id)
) as unknown as readonly [string, ...string[]];

export const rob2QuestionApplies = (
  question: Rob2Question,
  answers: Rob2Answers
) => (question.applies ? question.applies(answers) : true);

/** Perguntas que se aplicam e ainda não foram respondidas. */
export const rob2PendingQuestions = (
  domain: Rob2Domain,
  answers: Rob2Answers
) =>
  domain.questions.filter(
    (question) =>
      rob2QuestionApplies(question, answers) && !answers[question.id]
  );

/** Remove respostas de perguntas que deixaram de se aplicar. */
export const pruneRob2Answers = (answers: Rob2Answers): Rob2Answers => {
  const result: Rob2Answers = {};
  for (const domain of rob2Domains) {
    for (const question of domain.questions) {
      const answer = answers[question.id];
      if (answer && rob2QuestionApplies(question, result)) {
        result[question.id] = answer;
      }
    }
  }
  return result;
};

const judgeD1 = (a: Rob2Answers): Rob2Judgement => {
  if (no(a["1.2"]) || (noInformation(a["1.2"]) && yes(a["1.3"]))) {
    return "HIGH";
  }
  if (yes(a["1.2"]) && yesOrUnclear(a["1.1"]) && noOrUnclear(a["1.3"])) {
    return "LOW";
  }
  return "SOME_CONCERNS";
};

const judgeD2PartAssignment = (a: Rob2Answers): Rob2Judgement => {
  if ((no(a["2.1"]) && no(a["2.2"])) || no(a["2.3"])) {
    return "LOW";
  }
  if (yes(a["2.3"]) && yesOrUnclear(a["2.4"]) && noOrUnclear(a["2.5"])) {
    return "HIGH";
  }
  return "SOME_CONCERNS";
};

const judgeD2PartAnalysis = (a: Rob2Answers): Rob2Judgement => {
  if (yes(a["2.6"])) {
    return "LOW";
  }
  return no(a["2.7"]) ? "SOME_CONCERNS" : "HIGH";
};

const combine = (...judgements: readonly Rob2Judgement[]): Rob2Judgement => {
  if (judgements.includes("HIGH")) {
    return "HIGH";
  }
  return judgements.every((judgement) => judgement === "LOW")
    ? "LOW"
    : "SOME_CONCERNS";
};

const judgeD2 = (a: Rob2Answers) =>
  combine(judgeD2PartAssignment(a), judgeD2PartAnalysis(a));

const judgeD3 = (a: Rob2Answers): Rob2Judgement => {
  if (yes(a["3.1"]) || yes(a["3.2"]) || no(a["3.3"])) {
    return "LOW";
  }
  return no(a["3.4"]) ? "SOME_CONCERNS" : "HIGH";
};

const judgeD4 = (a: Rob2Answers): Rob2Judgement => {
  if (yes(a["4.1"]) || yes(a["4.2"])) {
    return "HIGH";
  }
  if (no(a["4.3"]) || no(a["4.4"])) {
    return noInformation(a["4.2"]) ? "SOME_CONCERNS" : "LOW";
  }
  return no(a["4.5"]) ? "SOME_CONCERNS" : "HIGH";
};

const judgeD5 = (a: Rob2Answers): Rob2Judgement => {
  if (yes(a["5.2"]) || yes(a["5.3"])) {
    return "HIGH";
  }
  if (no(a["5.2"]) && no(a["5.3"]) && yes(a["5.1"])) {
    return "LOW";
  }
  return "SOME_CONCERNS";
};

const judges: Record<Rob2DomainId, (answers: Rob2Answers) => Rob2Judgement> = {
  D1: judgeD1,
  D2: judgeD2,
  D3: judgeD3,
  D4: judgeD4,
  D5: judgeD5,
};

/** Julgamento sugerido do domínio; `null` enquanto faltar resposta. */
export const suggestRob2DomainJudgement = (
  domainId: Rob2DomainId,
  answers: Rob2Answers
): Rob2Judgement | null => {
  const domain = rob2Domains.find(({ id }) => id === domainId);
  if (!domain || rob2PendingQuestions(domain, answers).length > 0) {
    return null;
  }
  return judges[domainId](answers);
};

export interface Rob2DomainOverride {
  readonly judgement: Rob2Judgement;
  readonly reason: string;
}

export type Rob2Overrides = Partial<Record<Rob2DomainId, Rob2DomainOverride>>;

export const rob2DomainJudgement = (
  domainId: Rob2DomainId,
  answers: Rob2Answers,
  overrides: Rob2Overrides
): Rob2Judgement | null => {
  const suggested = suggestRob2DomainJudgement(domainId, answers);
  if (!suggested) {
    return null;
  }
  return overrides[domainId]?.judgement ?? suggested;
};

/**
 * Julgamento geral: baixo se todos os domínios forem baixos, alto se algum
 * for alto e algumas preocupações nos demais casos. A pessoa pode elevar para
 * alto risco quando várias preocupações, somadas, reduzem muito a confiança.
 */
export const rob2OverallJudgement = (
  answers: Rob2Answers,
  overrides: Rob2Overrides,
  overallOverride?: Rob2Judgement | null
): Rob2Judgement | null => {
  const judgements = rob2DomainIds.map((id) =>
    rob2DomainJudgement(id, answers, overrides)
  );
  if (judgements.some((judgement) => judgement === null)) {
    return null;
  }
  const suggested = combine(...(judgements as Rob2Judgement[]));
  if (overallOverride === "HIGH" && suggested === "SOME_CONCERNS") {
    return "HIGH";
  }
  return suggested;
};
