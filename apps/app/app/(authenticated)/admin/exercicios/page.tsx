import { ContentStatus, database } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { requireStaff } from "@/lib/authorization";
import { createExercisePack } from "../../exercicios/actions";

interface AdminExercisesPageProperties {
  readonly searchParams: Promise<{ readonly resultado?: string }>;
}

const optionLabels = ["A", "B", "C", "D", "E"];

const statusLabel = (status: ContentStatus) => {
  if (status === ContentStatus.PUBLISHED) {
    return "Publicado";
  }
  if (status === ContentStatus.ARCHIVED) {
    return "Arquivado";
  }
  return "Rascunho";
};

const AdminExercisesPage = async ({
  searchParams,
}: AdminExercisesPageProperties) => {
  await requireStaff();
  const [query, banks] = await Promise.all([
    searchParams,
    database.exerciseBank.findMany({
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        lists: {
          orderBy: [{ position: "asc" }, { title: "asc" }],
          take: 30,
          select: {
            id: true,
            title: true,
            status: true,
            _count: { select: { items: true } },
          },
        },
      },
    }),
  ]);
  let resultMessage: string | null = null;
  if (query.resultado === "created") {
    resultMessage = "Banco, lista e primeira questão salvos.";
  } else if (query.resultado === "invalid") {
    resultMessage = "Revise os campos e marque as respostas corretas.";
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
        href="/admin"
      >
        ← Área do professor
      </Link>
      <header className="mt-8 max-w-3xl">
        <p className="brand-eyebrow">Gestão acadêmica</p>
        <h1 className="mt-3 font-display text-5xl leading-none">
          Bancos de exercícios
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Organize listas e questões com versões imutáveis. Respostas corretas
          ficam no servidor e só são reveladas depois da tentativa.
        </p>
      </header>

      {resultMessage && (
        <output className="mt-6 block rounded-md border bg-card p-4 text-sm">
          {resultMessage}
        </output>
      )}

      <section
        aria-labelledby="create-exercise-title"
        className="mt-10 rounded-xl border bg-card p-5 sm:p-8"
      >
        <h2 className="font-display text-3xl" id="create-exercise-title">
          Criar banco, lista e questão
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
          Comece um banco e uma lista com a primeira questão. Depois você pode
          adicionar questões, categorias e novas versões pela página da lista.
        </p>
        <form action={createExercisePack} className="mt-6 grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm" htmlFor="exercise-bank-title">
              <span className="font-medium">Nome do banco</span>
              <Input
                id="exercise-bank-title"
                maxLength={160}
                name="bankTitle"
                required
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="exercise-list-title">
              <span className="font-medium">Nome da lista</span>
              <Input
                id="exercise-list-title"
                maxLength={160}
                name="listTitle"
                required
              />
            </label>
          </div>
          <label
            className="grid gap-2 text-sm"
            htmlFor="exercise-list-description"
          >
            <span className="font-medium">Descrição da lista</span>
            <Textarea
              id="exercise-list-description"
              maxLength={2000}
              name="listDescription"
              rows={3}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm" htmlFor="exercise-list-cover">
              <span className="font-medium">Capa por URL HTTPS (opcional)</span>
              <Input
                id="exercise-list-cover"
                name="coverUrl"
                placeholder="https://…"
                type="url"
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="exercise-category">
              <span className="font-medium">Categoria inicial (opcional)</span>
              <Input
                id="exercise-category"
                maxLength={100}
                name="categoryTitle"
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm" htmlFor="exercise-statement">
            <span className="font-medium">Enunciado</span>
            <Textarea
              id="exercise-statement"
              maxLength={20_000}
              minLength={5}
              name="statement"
              required
              rows={5}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label
              className="grid gap-2 text-sm"
              htmlFor="exercise-question-type"
            >
              <span className="font-medium">Formato</span>
              <select
                className="h-10 rounded-md border bg-background px-3"
                id="exercise-question-type"
                name="questionType"
              >
                <option value="SINGLE_CHOICE">Escolha única</option>
                <option value="MULTIPLE_CHOICE">Múltipla escolha</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm" htmlFor="exercise-tags">
              <span className="font-medium">Tags (separadas por vírgula)</span>
              <Input id="exercise-tags" maxLength={1000} name="tags" />
            </label>
          </div>
          <fieldset className="grid gap-3">
            <legend className="mb-1 font-medium text-sm">
              Alternativas e gabarito
            </legend>
            {optionLabels.map((label) => (
              <div
                className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]"
                key={label}
              >
                <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input
                    className="accent-primary"
                    name="correctOption"
                    type="checkbox"
                    value={label}
                  />
                  Correta {label}
                </label>
                <Input
                  aria-label={`Alternativa ${label}`}
                  id={`exercise-option-${label}`}
                  maxLength={8000}
                  name={`option-${label}`}
                />
              </div>
            ))}
          </fieldset>
          <label className="grid gap-2 text-sm" htmlFor="exercise-explanation">
            <span className="font-medium">Explicação (opcional)</span>
            <Textarea
              id="exercise-explanation"
              maxLength={20_000}
              name="explanation"
              rows={4}
            />
          </label>
          <label className="flex items-start gap-3 rounded-md border p-4 text-sm leading-6">
            <input
              className="mt-1 accent-primary"
              name="publish"
              type="checkbox"
              value="true"
            />
            <span>
              Publicar banco e lista ao salvar. Se desmarcado, tudo permanece em
              rascunho até a publicação posterior.
            </span>
          </label>
          <Button className="w-fit" type="submit">
            Salvar exercício
          </Button>
        </form>
      </section>

      <section aria-labelledby="exercise-bank-list" className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="brand-eyebrow">Acervo persistido</p>
            <h2 className="mt-2 font-display text-3xl" id="exercise-bank-list">
              Bancos e listas
            </h2>
          </div>
          <Badge variant="outline">Somente equipe pode editar</Badge>
        </div>
        {banks.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {banks.map((bank) => (
              <article className="rounded-xl border bg-card p-5" key={bank.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-2xl">{bank.title}</h3>
                  <Badge
                    variant={
                      bank.status === ContentStatus.PUBLISHED
                        ? "default"
                        : "secondary"
                    }
                  >
                    {statusLabel(bank.status)}
                  </Badge>
                </div>
                <ul className="mt-4 divide-y">
                  {bank.lists.map((list) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                      key={list.id}
                    >
                      <div>
                        <p className="font-medium">{list.title}</p>
                        <p className="mt-1 text-muted-foreground text-xs">
                          {list._count.items} questões ·{" "}
                          {statusLabel(list.status)}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/exercicios/${list.id}`}>
                          Gerenciar lista
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
            Nenhum banco foi criado ainda.
          </p>
        )}
      </section>
    </main>
  );
};

export default AdminExercisesPage;
