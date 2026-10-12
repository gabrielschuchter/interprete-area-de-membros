import { Badge } from "@repo/design-system/components/ui/badge";
import { ArrowLeftIcon, EyeIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGestaoActivityPreviewData } from "@/lib/gestao-activities";

interface GestaoActivityPreviewPageProperties {
  readonly params: Promise<{ readonly id: string }>;
}

const deliveryLabels: Record<string, string> = {
  TEXT: "Resposta em texto",
  FILE: "Arquivo",
  TEXT_AND_FILE: "Texto e arquivo",
};

const GestaoActivityPreviewPage = async ({
  params,
}: GestaoActivityPreviewPageProperties) => {
  const { id } = await params;
  const activity = await getGestaoActivityPreviewData(id);
  if (!activity) {
    notFound();
  }

  return (
    <section className="gestao-page-content ga-activity-preview">
      <Link className="ga-back-link" href={`/gestao/ensino/atividades/${id}`}>
        <ArrowLeftIcon aria-hidden="true" /> Voltar ao editor
      </Link>
      <header>
        <p className="gestao-eyebrow">
          <EyeIcon aria-hidden="true" /> Prévia como aluno
        </p>
        <h1>{activity.title}</h1>
        <div className="ga-preview-meta">
          <Badge variant="outline">
            {deliveryLabels[activity.deliveryKind]}
          </Badge>
          {activity.course ? <span>{activity.course.title}</span> : null}
          {activity.lesson ? <span>{activity.lesson.title}</span> : null}
          {activity.dueAt ? (
            <span>
              Entrega até{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/Sao_Paulo",
              }).format(activity.dueAt)}
            </span>
          ) : (
            <span>Sem prazo definido</span>
          )}
        </div>
      </header>
      <article className="ga-preview-paper">
        <h2>Proposta</h2>
        <p className="ga-preview-copy">{activity.prompt}</p>
        {activity.instructions ? (
          <div className="ga-preview-instructions">
            <h3>Orientações</h3>
            <p>{activity.instructions}</p>
          </div>
        ) : null}
        {activity.relatedLibraryItem ? (
          <p className="ga-preview-material">
            Material de apoio · {activity.relatedLibraryItem.title}
          </p>
        ) : null}
        {activity.criteria.length ? (
          <div className="ga-preview-rubric">
            <h3>Como sua resposta será avaliada</h3>
            <ul>
              {activity.criteria.map((criterion) => (
                <li key={criterion.id}>
                  <span>{criterion.title}</span>
                  <strong>{criterion.weight}%</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>
      <p className="ga-preview-note" role="note">
        Esta prévia não registra visualização, progresso ou entrega do aluno.
      </p>
    </section>
  );
};

export default GestaoActivityPreviewPage;
