// The 13 notification switches and how Configurações groups them. The
// onboarding "Avisos" step applies presets over exactly these keys and shows
// the same list when the person prefers to adjust one by one.
export const notificationPreferenceKeys = [
  "mentions",
  "commentReplies",
  "topicComments",
  "followedTopicActivity",
  "groupInvitations",
  "groupPosts",
  "lessonAvailable",
  "moduleAvailable",
  "contentAssignments",
  "activityAssigned",
  "feedbackReceived",
  "activityDeadline",
  "announcements",
] as const;

export type NotificationPreferenceKey =
  (typeof notificationPreferenceKeys)[number];

export type NotificationPreferenceValues = Record<
  NotificationPreferenceKey,
  boolean
>;

export const notificationPreferenceGroups: readonly {
  readonly items: readonly {
    readonly key: NotificationPreferenceKey;
    readonly label: string;
  }[];
  readonly label: string;
}[] = [
  {
    label: "Comunidade",
    items: [
      { key: "mentions", label: "Menções" },
      { key: "commentReplies", label: "Respostas aos meus comentários" },
      { key: "topicComments", label: "Comentários nos meus tópicos" },
      {
        key: "followedTopicActivity",
        label: "Atualizações de discussões que sigo",
      },
      { key: "groupInvitations", label: "Convites para grupos de estudo" },
      { key: "groupPosts", label: "Novas publicações nos meus grupos" },
    ],
  },
  {
    label: "Aprendizado",
    items: [
      { key: "lessonAvailable", label: "Novas aulas disponíveis" },
      { key: "moduleAvailable", label: "Novos módulos disponíveis" },
      { key: "contentAssignments", label: "Conteúdos atribuídos a mim" },
    ],
  },
  {
    label: "Atividades",
    items: [
      { key: "activityAssigned", label: "Nova atividade" },
      { key: "feedbackReceived", label: "Feedback recebido" },
      { key: "activityDeadline", label: "Lembretes de prazo" },
    ],
  },
  {
    label: "Avisos",
    items: [{ key: "announcements", label: "Comunicados dos professores" }],
  },
];

export const allNotificationPreferencesOn: NotificationPreferenceValues = {
  activityAssigned: true,
  activityDeadline: true,
  announcements: true,
  commentReplies: true,
  contentAssignments: true,
  feedbackReceived: true,
  followedTopicActivity: true,
  groupInvitations: true,
  groupPosts: true,
  lessonAvailable: true,
  mentions: true,
  moduleAvailable: true,
  topicComments: true,
};
