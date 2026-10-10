import type { ReactNode } from "react";

export const ExerciseEyebrow = ({
  children,
  className = "",
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) => (
  <div
    className={`flex flex-wrap items-center gap-x-3 gap-y-[6px] ${className}`.trim()}
  >
    <p className="m-0 font-data font-medium text-[11px] text-[var(--text-secondary)] uppercase leading-[1.3] tracking-[.14em]">
      {children}
    </p>
    <svg
      aria-hidden="true"
      className="h-[10px] w-16 shrink-0"
      fill="none"
      viewBox="0 0 96 10"
    >
      <path d="M0 5H34M62 5H96" stroke="#BFA9A3" strokeWidth="1" />
      <path d="M48 1L52 5L48 9L44 5Z" fill="#BFA9A3" />
      <circle cx="38" cy="5" fill="#BFA9A3" r="1.2" />
      <circle cx="58" cy="5" fill="#BFA9A3" r="1.2" />
    </svg>
  </div>
);
