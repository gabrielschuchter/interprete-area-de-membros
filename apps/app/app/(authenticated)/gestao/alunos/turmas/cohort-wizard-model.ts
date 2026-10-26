import {
  type CohortActionResult,
  createGestaoCohort,
  createGestaoCohortInvite,
  importGestaoCohortMembers,
  setGestaoCohortCourses,
} from "./actions";

export interface TeacherOption {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly id: string;
}
export interface CourseOption {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}
export type StudentMode = "later" | "csv" | "invite";
export type ReleaseMode = "ALL_AT_ONCE" | "SCHEDULE";
export type LateJoin = "ALL_ACTIVE" | "FROM_JOIN";

export interface ParsedEmails {
  readonly emails: readonly string[];
  readonly invalid: number;
  readonly rows: number;
}

export interface WizardDraft {
  courseIds: readonly string[];
  csv: ParsedEmails | null;
  csvName: string;
  endsAt: string;
  lateJoin: LateJoin;
  name: string;
  releaseMode: ReleaseMode;
  startsAt: string;
  studentMode: StudentMode;
  teacherIds: readonly string[];
}

export type WizardErrors = Readonly<Record<string, string>>;

const whitespacePattern = /\s+/;
const lineBreakPattern = /\r\n?/gu;
const quotePattern = /^"(.*)"$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const emailHeaders = new Set(["email", "e-mail", "e_mail"]);

export const initialsOf = (name: string) =>
  name
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR") || "?";

const detectDelimiter = (firstLine: string) =>
  [",", ";", "\t"].sort(
    (a, b) => firstLine.split(b).length - firstLine.split(a).length
  )[0] ?? ",";

export const parseEmails = (text: string): ParsedEmails => {
  const lines = text
    .replace(lineBreakPattern, "\n")
    .split("\n")
    .filter((line) => line.trim());
  const delimiter = detectDelimiter(lines[0] ?? "");
  const rows = lines.map((line) =>
    line.split(delimiter).map((cell) => cell.trim().replace(quotePattern, "$1"))
  );
  const header = rows[0]?.map((cell) => cell.toLocaleLowerCase("pt-BR")) ?? [];
  const column = header.findIndex((cell) => emailHeaders.has(cell));
  const cells =
    column >= 0
      ? rows.slice(1).map((row) => row[column] ?? "")
      : rows.map((row) => row.find((cell) => emailPattern.test(cell)) ?? "");
  const valid = cells.filter((cell) => emailPattern.test(cell));
  return {
    emails: [...new Set(valid.map((cell) => cell.toLocaleLowerCase("pt-BR")))],
    invalid: cells.length - valid.length,
    rows: cells.length,
  };
};

const validateData = (draft: WizardDraft) => {
  const next: Record<string, string> = {};
  if (draft.name.trim().length < 3) {
    next.name = "Use ao menos 3 caracteres.";
  }
  if (!draft.startsAt) {
    next.startsAt = "Informe a data de início.";
  }
  if (draft.endsAt && draft.startsAt && draft.endsAt <= draft.startsAt) {
    next.endsAt = "A data final deve ser posterior à inicial.";
  }
  return next;
};

const validatePeople = (draft: WizardDraft) => {
  const next: Record<string, string> = {};
  if (draft.teacherIds.length === 0) {
    next.teachers = "Escolha ao menos um responsável.";
  }
  if (draft.studentMode === "csv" && !draft.csv?.emails.length) {
    next.csv = "Escolha um arquivo CSV com ao menos um e-mail válido.";
  }
  return next;
};

/** Primeiro passo com erro, ou -1 quando o rascunho inteiro é válido. */
export const firstInvalidStep = (draft: WizardDraft) => {
  const checks = [validateData(draft), {}, validatePeople(draft)];
  return checks.findIndex((errors) => Object.keys(errors).length > 0);
};

export const validateStep = (
  step: number,
  draft: WizardDraft
): WizardErrors => {
  if (step === 0) {
    return validateData(draft);
  }
  return step === 2 ? validatePeople(draft) : {};
};

export interface WizardKeys {
  readonly cohort: string;
  readonly courses: string;
  readonly import: string;
  readonly invite: string;
}
export const newWizardKeys = (): WizardKeys => ({
  cohort: crypto.randomUUID(),
  courses: crypto.randomUUID(),
  import: crypto.randomUUID(),
  invite: crypto.randomUUID(),
});

export type WizardOutcome =
  | { readonly kind: "done"; readonly destination: string }
  | {
      readonly kind: "partial";
      readonly added: number;
      readonly cohortId: string;
      readonly skipped: readonly string[];
    }
  | {
      readonly kind: "failed";
      readonly cohortId: string | null;
      readonly fields?: WizardErrors;
      readonly message: string;
    };

const failed = (
  result: CohortActionResult,
  cohortId: string | null,
  fallback: string
): WizardOutcome => ({
  kind: "failed",
  cohortId,
  fields: result.ok ? undefined : result.fields,
  message: result.ok ? fallback : result.message,
});

/**
 * Cria a turma e aplica, em ordem, cursos e pessoas. Cada etapa tem chave de
 * idempotência própria e a turma já criada é reaproveitada se o usuário tentar
 * de novo depois de uma falha parcial.
 */
export const runCreateFlow = async (
  draft: WizardDraft,
  keys: WizardKeys,
  existingCohortId: string | null
): Promise<WizardOutcome> => {
  let cohortId = existingCohortId;
  if (!cohortId) {
    const created = await createGestaoCohort({
      name: draft.name,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      lateJoinPolicy: draft.lateJoin,
      teacherIds: draft.teacherIds,
      idempotencyKey: keys.cohort,
    });
    if (!(created.ok && created.cohortId)) {
      return failed(created, null, "Não foi possível criar a turma.");
    }
    cohortId = created.cohortId;
  }
  if (draft.courseIds.length > 0) {
    const linked = await setGestaoCohortCourses({
      cohortId,
      expectedVersion: 1,
      courseIds: draft.courseIds,
      releaseMode: draft.releaseMode,
      startsAt: draft.releaseMode === "SCHEDULE" ? draft.startsAt : "",
      idempotencyKey: keys.courses,
    });
    if (!linked.ok) {
      return failed(
        linked,
        cohortId,
        "A turma foi criada, mas os cursos não foram liberados."
      );
    }
  }
  const base = `/gestao/alunos/turmas/${cohortId}`;
  if (draft.studentMode === "csv" && draft.csv?.emails.length) {
    const imported = await importGestaoCohortMembers({
      cohortId,
      emails: draft.csv.emails,
      idempotencyKey: keys.import,
    });
    if (!imported.ok) {
      return failed(
        imported,
        cohortId,
        "A turma foi criada, mas a planilha não foi importada."
      );
    }
    if (imported.skippedEmails?.length) {
      return {
        kind: "partial",
        added: imported.invitedCount ?? 0,
        cohortId,
        skipped: imported.skippedEmails,
      };
    }
    return { kind: "done", destination: `${base}/alunos` };
  }
  if (draft.studentMode === "invite") {
    const invited = await createGestaoCohortInvite({
      cohortId,
      maxUses: 100,
      expiresInDays: 14,
      idempotencyKey: keys.invite,
    });
    if (!invited.ok) {
      return failed(
        invited,
        cohortId,
        "A turma foi criada, mas o convite não foi gerado."
      );
    }
    return { kind: "done", destination: `${base}/alunos` };
  }
  return { kind: "done", destination: base };
};
