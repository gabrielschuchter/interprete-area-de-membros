import type { Metadata } from "next";
import { NotFoundState } from "@/components/not-found-state";

export const metadata: Metadata = {
  title: "Página não encontrada | Interprete",
};

const MemberNotFound = () => <NotFoundState />;

export default MemberNotFound;
