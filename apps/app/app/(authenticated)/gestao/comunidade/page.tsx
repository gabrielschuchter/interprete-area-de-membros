import { notFound, redirect } from "next/navigation";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { gestaoCommunityDestination } from "@/lib/gestao-navigation";

const GestaoCommunityPage = async () => {
  await requireGestaoAction("community.moderate");
  const destination = gestaoCommunityDestination(["publicacoes"]);
  if (!destination) {
    notFound();
  }
  redirect(destination);
};

export default GestaoCommunityPage;
