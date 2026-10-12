"use client";

import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CourseOpenAccessResult } from "../../access-actions";

export interface CourseAccessPerson {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly id: string;
  readonly profile: { readonly username: string | null } | null;
}

export interface CourseAccessCohort {
  readonly endsAt: Date | null;
  readonly id: string;
  readonly name: string;
  readonly startsAt: Date;
  readonly version: number;
}

export interface ActiveCourseCohortAccess {
  readonly cohort: CourseAccessCohort & { readonly studentCount: number };
  readonly id: string;
  readonly releaseMode: "ALL_AT_ONCE" | "SCHEDULE";
  readonly startsAt: Date | null;
}

export interface IndividualCourseGrant {
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly id: string;
  readonly kind: "SOURCE" | "LEGACY";
  readonly member: CourseAccessPerson;
}

export type CourseAccessMutation = (
  input: unknown
) => Promise<CourseOpenAccessResult>;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const dateTimeInputFormatter = new Intl.DateTimeFormat("sv-SE", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
  year: "numeric",
});
const whitespace = /\s+/;

export const courseAccessDate = (value: Date) => dateFormatter.format(value);

export const courseAccessPeriod = (startsAt: Date, endsAt: Date | null) =>
  `${courseAccessDate(startsAt)} a ${endsAt ? courseAccessDate(endsAt) : "sem término"}`;

export const courseAccessExpiration = (expiresAt: Date | null) =>
  expiresAt
    ? `Acesso individual · expira em ${courseAccessDate(expiresAt)}`
    : "Acesso individual · sem expiração";

export const courseAccessPersonName = (person: CourseAccessPerson) =>
  person.displayName?.trim() ||
  person.email ||
  person.profile?.username ||
  "Membro";

export const courseAccessDateTimeValue = (value: Date | null) =>
  value ? dateTimeInputFormatter.format(value).replace(" ", "T") : "";

export const courseAccessInitials = (name: string) =>
  name
    .trim()
    .split(whitespace)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "")
    .join("");

export const courseCohortStatus = (
  access: ActiveCourseCohortAccess,
  now: number
) => {
  if (access.cohort.endsAt && access.cohort.endsAt.getTime() <= now) {
    return { label: "Encerrada", state: "ended" };
  }
  const releaseAt = access.startsAt ?? access.cohort.startsAt;
  return releaseAt.getTime() > now
    ? { label: "Não iniciada", state: "pending" }
    : { label: "Em andamento", state: "active" };
};

export const useCourseAccessMutation = () => {
  const router = useRouter();
  const operationKeys = useRef(
    new Map<string, { readonly fingerprint: string; readonly key: string }>()
  );
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CourseOpenAccessResult | null>(null);

  const run = (
    operation: string,
    action: CourseAccessMutation,
    values: Record<string, unknown>
  ) => {
    const fingerprint = JSON.stringify(values);
    let stored = operationKeys.current.get(operation);
    if (!stored || stored.fingerprint !== fingerprint) {
      stored = { fingerprint, key: crypto.randomUUID() };
      operationKeys.current.set(operation, stored);
    }
    setResult(null);
    startTransition(async () => {
      let response: CourseOpenAccessResult;
      try {
        response = await action({ ...values, idempotencyKey: stored.key });
      } catch {
        response = {
          ok: false,
          code: "unavailable",
          message:
            "A conexão falhou. Tente novamente para confirmar o resultado.",
        };
      }
      setResult(response);
      if (response.ok) {
        if (operationKeys.current.get(operation)?.key === stored.key) {
          operationKeys.current.delete(operation);
        }
        router.refresh();
      }
    });
  };

  return { pending, result, run };
};

export const buildCourseAccessHref = (
  pathname: string,
  current: URLSearchParams,
  field: string,
  page: number
) => {
  const next = new URLSearchParams(current);
  if (page <= 1) {
    next.delete(field);
  } else {
    next.set(field, String(page));
  }
  const query = next.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
};

export const CourseAccessPager = ({
  field,
  label,
  page,
  totalPages,
}: {
  readonly field: string;
  readonly label: string;
  readonly page: number;
  readonly totalPages: number;
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (totalPages <= 1) {
    return null;
  }
  const href = (nextPage: number) =>
    buildCourseAccessHref(
      pathname,
      new URLSearchParams(searchParams.toString()),
      field,
      nextPage
    );
  return (
    <nav aria-label={label} className="gca-pager">
      <span>
        Página {page} de {totalPages}
      </span>
      <div>
        <Link
          aria-disabled={page <= 1}
          aria-label="Página anterior"
          className={page <= 1 ? "is-disabled" : undefined}
          href={href(page - 1)}
          prefetch={false}
          tabIndex={page <= 1 ? -1 : undefined}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Link>
        <Link
          aria-disabled={page >= totalPages}
          aria-label="Próxima página"
          className={page >= totalPages ? "is-disabled" : undefined}
          href={href(page + 1)}
          prefetch={false}
          tabIndex={page >= totalPages ? -1 : undefined}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
};

export const CourseAccessSearch = ({
  action,
  label,
  name,
  pageField,
  value,
}: {
  readonly action: string;
  readonly label: string;
  readonly name: string;
  readonly pageField?: string;
  readonly value: string;
}) => (
  <form action={action} className="gca-search-form" method="get">
    {pageField ? <input name={pageField} type="hidden" value="1" /> : null}
    <label>
      <SearchIcon aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        autoComplete="off"
        defaultValue={value}
        maxLength={120}
        name={name}
        placeholder={label}
        type="search"
      />
    </label>
    <button className="gca-outline-button" type="submit">
      Buscar
    </button>
  </form>
);

export const CourseAccessFeedback = ({
  result,
}: {
  readonly result: CourseOpenAccessResult | null;
}) => {
  if (!result) {
    return null;
  }
  return result.ok ? (
    <output className="gca-feedback is-success">Alteração salva.</output>
  ) : (
    <p className="gca-feedback is-error" role="alert">
      {result.message}
    </p>
  );
};

export const CourseAccessConfirmDialog = ({
  confirmLabel = "Confirmar",
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  readonly confirmLabel?: string;
  readonly description: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly open: boolean;
  readonly title: string;
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
    } else if (!open && dialog.current?.open) {
      dialog.current.close();
    }
  }, [open]);

  return (
    <dialog
      aria-describedby="gca-confirm-description"
      aria-labelledby="gca-confirm-title"
      className="gca-confirm-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialog}
    >
      <h2 id="gca-confirm-title">{title}</h2>
      <p id="gca-confirm-description">{description}</p>
      <div className="gca-confirm-actions">
        <button className="gca-outline-button" onClick={onCancel} type="button">
          Cancelar
        </button>
        <button
          className="gca-primary-button"
          onClick={onConfirm}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
};
