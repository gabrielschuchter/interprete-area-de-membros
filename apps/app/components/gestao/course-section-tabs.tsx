import Link from "next/link";

const tabs = [
  ["content", "Conteúdo"],
  ["access", "Turmas e acesso"],
  ["settings", "Configurações"],
  ["publication", "Publicação"],
] as const;

const tabHref = (key: (typeof tabs)[number][0], courseId: string) => {
  const base = `/gestao/ensino/cursos/${courseId}`;
  switch (key) {
    case "access":
      return `${base}/turmas`;
    case "settings":
      return `${base}#course-settings`;
    case "publication":
      return `${base}#course-publishing`;
    default:
      return `${base}#course-content`;
  }
};

export const CourseSectionTabs = ({
  active,
  courseId,
}: {
  readonly active: (typeof tabs)[number][0];
  readonly courseId: string;
}) => (
  <nav aria-label="Seções do curso" className="gca-course-tabs">
    {tabs.map(([key, label]) => (
      <Link
        aria-current={active === key ? "page" : undefined}
        className={active === key ? "is-active" : undefined}
        href={tabHref(key, courseId)}
        key={key}
        prefetch={false}
      >
        {label}
      </Link>
    ))}
  </nav>
);
