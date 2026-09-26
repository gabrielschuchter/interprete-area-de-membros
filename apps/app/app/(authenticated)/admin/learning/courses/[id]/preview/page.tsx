import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichDocument } from "@/components/learning/rich-document";
import { getAdminCourse } from "@/lib/admin-learning";

interface PreviewPageProperties {
  readonly params: Promise<{ id: string }>;
}

const PreviewPage = async ({ params }: PreviewPageProperties) => {
  const { id } = await params;
  const course = await getAdminCourse(id);

  if (!course) {
    notFound();
  }

  return (
    <main className="min-h-svh bg-background px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="brand-eyebrow">Preview privado · não publicado</p>
          <Button asChild variant="outline">
            <Link href={`/admin/learning/courses/${course.id}`}>
              Voltar ao editor
            </Link>
          </Button>
        </div>
        <h1 className="mt-10 font-display text-6xl leading-none">
          {course.title}
        </h1>
        {course.subtitle && (
          <p className="mt-4 font-display text-2xl text-muted-foreground leading-snug">
            {course.subtitle}
          </p>
        )}
        {course.description && (
          <p className="mt-6 font-display text-2xl text-muted-foreground leading-snug">
            {course.description}
          </p>
        )}
        <div className="mt-12 space-y-10">
          {course.modules.map((module) => (
            <section className="border-border border-t pt-6" key={module.id}>
              <p className="brand-eyebrow">{module.title}</p>
              {module.description && (
                <p className="mt-3 text-muted-foreground leading-7">
                  {module.description}
                </p>
              )}
              {module.objectives.length > 0 && (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
                  {module.objectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
              )}
              <div className="mt-5 space-y-6">
                {module.lessons.map((lesson) => (
                  <article className="paper-surface border p-6" key={lesson.id}>
                    <p className="brand-eyebrow">
                      {lesson.kind} · {lesson.status}
                    </p>
                    <h2 className="mt-2 font-display text-3xl">
                      {lesson.title}
                    </h2>
                    <p className="mt-3 text-muted-foreground leading-7">
                      {lesson.description}
                    </p>
                    {lesson.objectives.length > 0 && (
                      <ul className="mt-4 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
                        {lesson.objectives.map((objective) => (
                          <li key={objective}>{objective}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-6 border-t pt-6">
                      <RichDocument value={lesson.content} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
};

export default PreviewPage;
