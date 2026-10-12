import { GestaoActivityEditor } from "../activity-editor";

interface GestaoActivityDetailPageProperties {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<{ readonly resultado?: string }>;
}

const GestaoActivityDetailPage = async ({
  params,
  searchParams,
}: GestaoActivityDetailPageProperties) => {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <GestaoActivityEditor activityId={id} result={query.resultado} />;
};

export default GestaoActivityDetailPage;
