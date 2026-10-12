import { GestaoActivityEditor } from "../activity-editor";

interface NewGestaoActivityPageProperties {
  readonly searchParams: Promise<{ readonly resultado?: string }>;
}

const NewGestaoActivityPage = async ({
  searchParams,
}: NewGestaoActivityPageProperties) => {
  const params = await searchParams;
  return <GestaoActivityEditor result={params.resultado} />;
};

export default NewGestaoActivityPage;
