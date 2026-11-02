import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

const LegacyRecordingsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) {
        query.append(key, item);
      }
    }
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return permanentRedirect(`/comunidade/encontros/gravacoes${suffix}`);
};

export default LegacyRecordingsPage;
