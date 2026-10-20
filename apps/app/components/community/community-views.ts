export type CommunityView =
  | "explore"
  | "groups"
  | "meetings"
  | "saved"
  | "mine";

export const communityViews = [
  {
    description: "Feed da comunidade",
    href: "/comunidade",
    label: "Explorar",
    value: "explore",
  },
  {
    description: "Meus grupos e descoberta",
    href: "/comunidade/grupos",
    label: "Grupos de estudo",
    value: "groups",
  },
  {
    description: "Próximos e gravações",
    href: "/comunidade/encontros",
    label: "Encontros",
    value: "meetings",
  },
  {
    description: "Só da Comunidade",
    href: "/comunidade/salvos",
    label: "Salvos",
    value: "saved",
  },
  {
    description: "Publicadas, rascunhos e arquivadas",
    href: "/comunidade/minhas-publicacoes",
    label: "Minhas publicações",
    value: "mine",
  },
] as const satisfies readonly {
  readonly description: string;
  readonly href: string;
  readonly label: string;
  readonly value: CommunityView;
}[];
