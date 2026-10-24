import { GestaoActivityEditor } from "../activity-editor";

interface NewGestaoActivityPageProperties {
  readonly searchParams: Promise<{
    readonly resultado?: string;
    readonly turma?: string | string[];
  }>;
}

const NewGestaoActivityPage = async ({
  searchParams,
}: NewGestaoActivityPageProperties) => {
  const params = await searchParams;
  return (
    <GestaoActivityEditor
      defaultCohortId={
        typeof params.turma === "string" ? params.turma : undefined
      }
      result={params.resultado}
    />
  );
};

export default NewGestaoActivityPage;
