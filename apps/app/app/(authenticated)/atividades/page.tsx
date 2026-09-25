import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon, CheckCircle2Icon, Clock3Icon } from "lucide-react";
import Link from "next/link";
import { getPublishedActivities } from "@/lib/activities";
import { requireMemberId } from "@/lib/learning";
import { MemberHeader } from "../components/member-header";

const formatDueDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeZone: "America/Sao_Paulo",
      }).format(value)
    : "Sem prazo definido";

type PublishedActivity = Awaited<
  ReturnType<typeof getPublishedActivities>
>[number];

const ActivityRow = ({
  activity,
}: {
  readonly activity: PublishedActivity;
}) => {
  const submission = activity.submissions[0];
  const reviewed = submission?.status === "REVIEWED";
  const submitted = submission?.status === "SUBMITTED";
  const overdue = Boolean(
    activity.dueAt && activity.dueAt < new Date() && !reviewed
  );
  let statusLabel = "Pendente";
  let actionLabel = "Abrir prática";
  let badgeVariant: "default" | "destructive" | "outline" = "outline";

  if (reviewed) {
    statusLabel = "Feedback disponível";
    actionLabel = "Ler feedback";
    badgeVariant = "default";
  } else if (submitted) {
    statusLabel = "Enviada";
    actionLabel = "Revisar envio";
  } else if (overdue) {
    statusLabel = "Atrasada";
    badgeVariant = "destructive";
  }

  return (
    <article
      className="paper-surface border p-6 transition-[border-color,transform] duration-180 hover:-translate-y-0.5 hover:border-brand-action sm:p-8"
      key={activity.id}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariant}>{statusLabel}</Badge>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
              <Clock3Icon aria-hidden="true" className="size-3.5" />{" "}
              {formatDueDate(activity.dueAt)}
            </span>
          </div>
          <h3 className="mt-4 font-display text-3xl leading-tight">
            {activity.title}
          </h3>
          <p className="mt-3 text-muted-foreground leading-7">
            {activity.prompt}
          </p>
          {activity.course && (
            <p className="brand-eyebrow mt-4">{activity.course.title}</p>
          )}
        </div>
        <Button asChild variant="outline">
          <Link href={`/atividades/${activity.slug}`}>
            {actionLabel}
            {reviewed ? (
              <CheckCircle2Icon aria-hidden="true" />
            ) : (
              <ArrowRightIcon aria-hidden="true" />
            )}
          </Link>
        </Button>
      </div>
    </article>
  );
};

const ActivitiesPage = async () => {
  const memberId = await requireMemberId();
  const activities = await getPublishedActivities(memberId);

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Atividades" />
      <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <header className="max-w-3xl">
          <p className="brand-eyebrow">Prática guiada · caderno de campo</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
            Pensar também é praticar.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-7 sm:text-lg">
            Responda perguntas que aproximam o método da sua prática. O que você
            escreve fica disponível para revisão e feedback.
          </p>
        </header>

        <section aria-labelledby="activities-heading" className="mt-14">
          <div className="flex items-end justify-between gap-4 border-border border-b pb-4">
            <div>
              <p className="brand-eyebrow">Agora</p>
              <h2
                className="mt-2 font-display text-3xl"
                id="activities-heading"
              >
                Seu caderno de prática
              </h2>
            </div>
            <span className="font-data text-muted-foreground text-xs">
              {activities.length.toString().padStart(2, "0")} práticas
            </span>
          </div>

          {activities.length === 0 ? (
            <div className="paper-surface mt-6 border p-8 sm:p-12">
              <p className="brand-eyebrow">Sem atividade aberta</p>
              <h3 className="mt-4 font-display text-3xl">
                A próxima pergunta ainda está sendo preparada.
              </h3>
              <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
                Enquanto isso, continue uma aula em Aprender. A prática aparece
                aqui quando houver uma atividade publicada para a sua turma.
              </p>
              <Button asChild className="mt-7" variant="outline">
                <Link href="/aprender">
                  Voltar para Aprender <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {activities.map((activity) => (
                <ActivityRow activity={activity} key={activity.id} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default ActivitiesPage;
