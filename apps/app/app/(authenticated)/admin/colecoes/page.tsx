import { CollectionItemType } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { requireStaff } from "@/lib/authorization";
import {
  collectionItemLabel,
  getAdminCollections,
  getCollectionResources,
} from "@/lib/content-collections";
import {
  addCollectionItem,
  createCollection,
  removeCollectionItem,
  setCollectionStatus,
  updateCollection,
} from "./actions";

interface CollectionsPageProperties {
  readonly searchParams: Promise<{ message?: string; status?: string }>;
}

const statusLabel = (status: string) => {
  if (status === "PUBLISHED") {
    return "Publicado";
  }
  if (status === "ARCHIVED") {
    return "Arquivado";
  }
  return "Rascunho";
};

const CollectionsPage = async ({ searchParams }: CollectionsPageProperties) => {
  await requireStaff();
  const [{ message, status }, collections, resources] = await Promise.all([
    searchParams,
    getAdminCollections(),
    getCollectionResources(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        href="/admin"
      >
        ← Área do professor
      </Link>
      <header className="mt-10 max-w-3xl">
        <p className="brand-eyebrow">Professor · coleções</p>
        <span aria-hidden="true" className="brand-rule mt-4" />
        <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          Reúna o que merece uma segunda passagem.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Coleções são listas editoriais reais para organizar aulas, referências
          e gravações preservadas. O recurso continua pertencendo à sua origem.
        </p>
      </header>

      {message && (
        <p
          className={`mt-8 border px-4 py-3 text-sm ${status === "error" ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-brand-action/40 bg-brand-action/5"}`}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="collections-heading">
          <div className="flex items-end justify-between border-b pb-3">
            <div>
              <p className="brand-eyebrow">Curadoria</p>
              <h2
                className="mt-2 font-display text-3xl"
                id="collections-heading"
              >
                {collections.length} coleções
              </h2>
            </div>
          </div>
          <div className="mt-5 space-y-6">
            {collections.length === 0 ? (
              <p className="paper-surface border p-8 text-muted-foreground">
                Nenhuma coleção criada ainda.
              </p>
            ) : (
              collections.map((collection) => (
                <article
                  className="paper-surface border p-6 sm:p-8"
                  key={collection.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <Badge
                        variant={
                          collection.status === "PUBLISHED"
                            ? "default"
                            : "outline"
                        }
                      >
                        {statusLabel(collection.status)}
                      </Badge>
                      <h3 className="mt-3 font-display text-3xl">
                        {collection.title}
                      </h3>
                      <p className="mt-1 text-muted-foreground text-sm">
                        /{collection.slug} · {collection.items.length} item
                        {collection.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {collection.status !== "PUBLISHED" && (
                        <form action={setCollectionStatus}>
                          <input
                            name="id"
                            type="hidden"
                            value={collection.id}
                          />
                          <input
                            name="status"
                            type="hidden"
                            value="PUBLISHED"
                          />
                          <Button size="sm" type="submit">
                            Publicar
                          </Button>
                        </form>
                      )}
                      {collection.status === "PUBLISHED" && (
                        <form action={setCollectionStatus}>
                          <input
                            name="id"
                            type="hidden"
                            value={collection.id}
                          />
                          <input name="status" type="hidden" value="ARCHIVED" />
                          <Button size="sm" type="submit" variant="outline">
                            Arquivar
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                  <p className="mt-4 text-muted-foreground leading-6">
                    {collection.description ?? "Sem descrição editorial."}
                  </p>
                  <div className="mt-6 divide-y border-y">
                    {collection.items.length === 0 ? (
                      <p className="py-4 text-muted-foreground text-sm">
                        Adicione uma aula, gravação ou referência.
                      </p>
                    ) : (
                      collection.items.map((item) => (
                        <div
                          className="flex items-center justify-between gap-4 py-4"
                          key={item.id}
                        >
                          <p className="min-w-0 truncate text-sm">
                            {collectionItemLabel(item)}
                          </p>
                          <form action={removeCollectionItem}>
                            <input name="id" type="hidden" value={item.id} />
                            <Button size="sm" type="submit" variant="ghost">
                              Remover
                            </Button>
                          </form>
                        </div>
                      ))
                    )}
                  </div>
                  <form
                    action={addCollectionItem}
                    className="mt-6 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto]"
                  >
                    <input
                      name="collectionId"
                      type="hidden"
                      value={collection.id}
                    />
                    <select
                      className="h-10 border bg-background px-3 text-sm"
                      defaultValue={CollectionItemType.LESSON}
                      name="itemType"
                    >
                      <option value={CollectionItemType.LESSON}>Aula</option>
                      <option value={CollectionItemType.RECORDING}>
                        Gravação
                      </option>
                      <option value={CollectionItemType.LIBRARY_ITEM}>
                        Biblioteca
                      </option>
                    </select>
                    <select
                      className="h-10 min-w-0 border bg-background px-3 text-sm"
                      name="resourceId"
                      required
                    >
                      <option value="">Escolha um recurso</option>
                      <optgroup label="Aulas assíncronas">
                        {resources.lessons.map((lesson) => (
                          <option key={lesson.id} value={lesson.id}>
                            {lesson.module.course.title} · {lesson.title}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Gravações históricas">
                        {resources.recordings.map((recording) => (
                          <option key={recording.id} value={recording.id}>
                            {recording.importedRecording?.group
                              .legacyStudentName ?? "Arquivo"}{" "}
                            · {recording.title}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Biblioteca">
                        {resources.libraryItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <Button size="sm" type="submit">
                      Adicionar
                    </Button>
                  </form>
                  <details className="mt-6 border-t pt-5">
                    <summary className="cursor-pointer text-muted-foreground text-sm underline underline-offset-4">
                      Editar coleção
                    </summary>
                    <form action={updateCollection} className="mt-4 grid gap-3">
                      <input name="id" type="hidden" value={collection.id} />
                      <Input
                        defaultValue={collection.title}
                        name="title"
                        required
                      />
                      <Input
                        defaultValue={collection.slug}
                        name="slug"
                        required
                      />
                      <Input
                        defaultValue={collection.position}
                        name="position"
                        type="number"
                      />
                      <Textarea
                        defaultValue={collection.description ?? ""}
                        name="description"
                      />
                      <Button size="sm" type="submit">
                        Salvar coleção
                      </Button>
                    </form>
                  </details>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="paper-surface border p-6 lg:sticky lg:top-24">
          <p className="brand-eyebrow">Nova coleção</p>
          <h2 className="mt-3 font-display text-2xl">Comece uma curadoria</h2>
          <form action={createCollection} className="mt-6 space-y-4">
            <Input
              name="title"
              placeholder="Ex.: Para a próxima conversa"
              required
            />
            <Input name="slug" placeholder="para-a-proxima-conversa" required />
            <Input defaultValue={0} name="position" type="number" />
            <Textarea
              name="description"
              placeholder="O fio que conecta estes materiais"
            />
            <Button className="w-full" type="submit">
              Criar rascunho
            </Button>
          </form>
        </aside>
      </div>
    </main>
  );
};

export default CollectionsPage;
