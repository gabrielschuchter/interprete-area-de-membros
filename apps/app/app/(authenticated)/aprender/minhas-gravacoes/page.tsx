import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon, VideoIcon } from "lucide-react";
import Link from "next/link";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";
import { LessonPlayer } from "@/components/learning/lesson-player";
import { requireMemberId } from "@/lib/learning";
import { getMemberLearningAssets } from "@/lib/learning-assets";

export const dynamic = "force-dynamic";

const MyRecordingsPage = async () => {
  const memberId = await requireMemberId();
  const assets = await getMemberLearningAssets(memberId);

  return (
    <LearningPageFrame
      description="Gravações individuais e materiais associados ficam aqui, sempre dentro do acesso concedido à sua conta."
      eyebrow="Aprender · acesso individual"
      title="Minhas gravações."
    >
      {assets.length === 0 ? (
        <section className="paper-surface border p-8 sm:p-12">
          <VideoIcon aria-hidden="true" className="size-6 text-brand-action" />
          <p className="brand-eyebrow mt-8">Nada individual por enquanto</p>
          <h2 className="mt-3 font-display text-3xl">
            Suas gravações aparecerão quando forem liberadas.
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground leading-7">
            O conteúdo geral e os cursos aos quais você tem acesso continuam em
            Aprender. Uma gravação de outra pessoa nunca aparece nesta lista.
          </p>
          <Button asChild className="mt-7" variant="outline">
            <Link href="/aprender">
              Voltar para Aprender <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </section>
      ) : (
        <section className="space-y-8">
          <div className="border-b pb-4">
            <p className="brand-eyebrow">Conteúdo reservado</p>
            <h2 className="mt-3 font-display text-3xl">
              Aulas liberadas para você
            </h2>
          </div>
          <div className="grid gap-10">
            {assets.map((asset) => (
              <article
                className="paper-surface border p-5 sm:p-7"
                key={asset.id}
              >
                <div className="mb-5 flex flex-col gap-2 border-b pb-4">
                  <p className="font-data text-brand-action text-xs uppercase tracking-[0.12em]">
                    {asset.lesson.module.course.title} ·{" "}
                    {asset.lesson.module.title}
                  </p>
                  <h3 className="font-display text-2xl">
                    {asset.lesson.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">{asset.title}</p>
                </div>
                {asset.kind === "VIDEO" ? (
                  <LessonPlayer
                    assetId={asset.id}
                    mimeType={asset.mimeType}
                    title={asset.title}
                  />
                ) : (
                  <Button asChild variant="outline">
                    <a
                      href={`/api/learning/assets/${asset.id}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir material <ArrowRightIcon aria-hidden="true" />
                    </a>
                  </Button>
                )}
                <div className="mt-5 border-t pt-4">
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      href={`/aprender/cursos/${asset.lesson.module.course.slug}/${asset.lesson.slug}`}
                    >
                      Abrir aula <ArrowRightIcon aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </LearningPageFrame>
  );
};

export default MyRecordingsPage;
