import type { Metadata } from "next";
import { NotFoundState } from "@/components/not-found-state";

export const metadata: Metadata = {
  title: "Página não encontrada | Interprete",
};

const NotFound = () => (
  <div className="min-h-svh bg-background">
    <NotFoundState />
  </div>
);

export default NotFound;
