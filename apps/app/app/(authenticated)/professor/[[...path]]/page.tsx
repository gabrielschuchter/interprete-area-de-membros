import { redirect } from "next/navigation";
import { env } from "@/env";
import { requireStaff } from "@/lib/authorization";
import {
  professorDestination,
  type RedirectSearchParams,
} from "@/lib/gestao-navigation";

const ProfessorCompatibilityPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly path?: string[] }>;
  readonly searchParams: Promise<RedirectSearchParams>;
}) => {
  await requireStaff();
  const [{ path }, query] = await Promise.all([params, searchParams]);
  redirect(professorDestination(path, env.GESTAO_V2_ENABLED === "true", query));
};

export default ProfessorCompatibilityPage;
