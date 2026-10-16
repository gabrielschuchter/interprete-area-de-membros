export type CommunityView =
  | "explore"
  | "groups"
  | "meetings"
  | "saved"
  | "mine";

export const communityViews = [
  { href: "/comunidade", label: "Explorar", value: "explore" },
  { href: "/comunidade/grupos", label: "Grupos de estudo", value: "groups" },
  { href: "/comunidade/encontros", label: "Encontros", value: "meetings" },
  { href: "/comunidade/salvos", label: "Salvos", value: "saved" },
  {
    href: "/comunidade/minhas-publicacoes",
    label: "Minhas publicações",
    value: "mine",
  },
] as const satisfies readonly {
  readonly href: string;
  readonly label: string;
  readonly value: CommunityView;
}[];
