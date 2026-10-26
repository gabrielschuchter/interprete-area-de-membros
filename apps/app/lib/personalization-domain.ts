export type CursosBlockId = "collections" | "recordings" | "resume";

export interface CursosBlockConfig {
  readonly enabled: boolean;
  readonly id: CursosBlockId;
  readonly subtitle: string | null;
  readonly title: string | null;
}

export interface PortalNoteConfig {
  readonly enabled: boolean;
  readonly mode: "auto" | "manual";
  readonly text: string;
}

export const cursosSettingKey = "cursosBlocks";
export const portalNoteSettingKey = "portalNote";

export const maxBlockTitle = 80;
export const maxBlockSubtitle = 200;
export const maxNoteText = 140;

export interface CursosBlockMeta {
  readonly defaultTitle: string;
  readonly description: string;
  readonly editable: boolean;
  readonly fixedTop: boolean;
  readonly label: string;
}

export const cursosBlockMeta: Record<CursosBlockId, CursosBlockMeta> = {
  resume: {
    defaultTitle: "Continue de onde parou",
    description: "A aula em andamento do aluno · sempre no topo",
    editable: false,
    fixedTop: true,
    label: "Continue de onde parou",
  },
  recordings: {
    defaultTitle: "Continue assistindo",
    description: "Gravações que o aluno começou e não terminou",
    editable: true,
    fixedTop: false,
    label: "Continue assistindo",
  },
  collections: {
    defaultTitle: "Coleções em destaque",
    description: "Curadorias publicadas pela equipe",
    editable: false,
    fixedTop: false,
    label: "Coleções em destaque",
  },
};

export const defaultCursosBlocks: readonly CursosBlockConfig[] = [
  { enabled: true, id: "resume", subtitle: null, title: null },
  { enabled: true, id: "recordings", subtitle: null, title: null },
  { enabled: true, id: "collections", subtitle: null, title: null },
];

export const defaultPortalNote: PortalNoteConfig = {
  enabled: false,
  mode: "auto",
  text: "",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cleanText = (value: unknown, max: number) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
};

const isBlockId = (value: unknown): value is CursosBlockId =>
  value === "resume" || value === "recordings" || value === "collections";

/**
 * Lê a configuração salva sem confiar nela: ids desconhecidos somem, ids
 * ausentes voltam ao padrão e "Continue de onde parou" fica sempre no topo.
 */
export const parseCursosBlocks = (value: unknown): CursosBlockConfig[] => {
  const seen = new Set<CursosBlockId>();
  const parsed: CursosBlockConfig[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    if (!(isRecord(item) && isBlockId(item.id)) || seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    parsed.push({
      enabled: item.enabled !== false,
      id: item.id,
      subtitle: cleanText(item.subtitle, maxBlockSubtitle),
      title: cleanText(item.title, maxBlockTitle),
    });
  }
  for (const fallback of defaultCursosBlocks) {
    if (!seen.has(fallback.id)) {
      parsed.push(fallback);
    }
  }
  const [resume, others] = [
    parsed.filter((block) => block.id === "resume"),
    parsed.filter((block) => block.id !== "resume"),
  ];
  return [...resume, ...others];
};

export const parsePortalNote = (value: unknown): PortalNoteConfig => {
  if (!isRecord(value)) {
    return defaultPortalNote;
  }
  return {
    enabled: value.enabled === true,
    mode: value.mode === "manual" ? "manual" : "auto",
    text: (cleanText(value.text, maxNoteText) ?? "").trim(),
  };
};

export const sameCursosBlocks = (
  left: readonly CursosBlockConfig[],
  right: readonly CursosBlockConfig[]
) => JSON.stringify(left) === JSON.stringify(right);

/** Texto automático: o encontro de hoje ou de amanhã, se houver. */
export const autoPortalNote = (
  meeting: { readonly startsAt: Date; readonly title: string } | null,
  now: Date,
  timeZone = "America/Sao_Paulo"
) => {
  if (!meeting) {
    return null;
  }
  const dayOf = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
  const today = dayOf(now);
  const tomorrow = dayOf(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const day = dayOf(meeting.startsAt);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone,
  })
    .format(meeting.startsAt)
    .replace(":", "h");
  if (day === today) {
    return `Encontro hoje, ${time}.`;
  }
  return day === tomorrow ? `Encontro amanhã, ${time}.` : null;
};
