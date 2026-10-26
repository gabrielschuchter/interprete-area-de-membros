"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface LessonRowShellProperties {
  readonly checkClassName: string;
  readonly checked: boolean;
  readonly checkLabel: string;
  readonly children: ReactNode;
  readonly className: string;
  readonly current: boolean;
  readonly dataFlash?: boolean;
  readonly dataOff?: boolean;
  readonly disabled: boolean;
  readonly href: string | null;
  readonly id?: string;
  readonly linkAriaCurrent?: "page" | "true";
  readonly linkClassName: string;
  readonly onToggle: (completed: boolean) => void;
  readonly rowAriaCurrent?: "true";
}

// Estrutura comum da linha de aula (caixa de conclusão + link ou texto
// bloqueado), usada em Cursos e na sala. Cada superfície traz o próprio miolo
// e as próprias classes, mas o comportamento da linha é um só.
export const LessonRowShell = ({
  checkClassName,
  checkLabel,
  checked,
  children,
  className,
  current,
  dataFlash,
  dataOff,
  disabled,
  href,
  id,
  linkAriaCurrent,
  linkClassName,
  onToggle,
  rowAriaCurrent,
}: LessonRowShellProperties) => (
  <li
    aria-current={rowAriaCurrent}
    className={className}
    data-current={current ? "true" : undefined}
    data-flash={dataFlash ? "true" : undefined}
    data-off={dataOff ? "true" : undefined}
    id={id}
  >
    <label className={checkClassName}>
      <input
        aria-label={checkLabel}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onToggle(event.target.checked)}
        type="checkbox"
      />
    </label>
    {href ? (
      <Link
        aria-current={linkAriaCurrent}
        className={linkClassName}
        href={href}
      >
        {children}
      </Link>
    ) : (
      <span className={linkClassName}>{children}</span>
    )}
  </li>
);
