export interface ProfileCompletionData {
  readonly avatarUrl: string | null;
  readonly bio: string | null;
  readonly city: string | null;
  readonly country: string | null;
  readonly headline: string | null;
  readonly instagram: string | null;
  readonly institution: string | null;
  readonly interests: readonly string[];
  readonly linkedin: string | null;
  readonly occupation: string | null;
  readonly website: string | null;
}

export const profileCompletionItems = (profile: ProfileCompletionData) => {
  const items = [
    {
      complete: Boolean(profile.occupation?.trim()),
      field: "occupation",
      label: "Profissão",
    },
    {
      complete: Boolean(profile.institution?.trim()),
      field: "institution",
      label: "Instituição",
    },
    {
      complete: Boolean(profile.city?.trim() && profile.country?.trim()),
      field: "city",
      label: "Localização",
    },
    { complete: Boolean(profile.bio?.trim()), field: "bio", label: "Bio" },
    {
      complete: Boolean(
        profile.website || profile.instagram || profile.linkedin
      ),
      field: "website",
      label: "Links",
    },
    {
      complete: Boolean(profile.avatarUrl),
      field: "avatar",
      label: "Foto de perfil",
    },
    {
      complete: Boolean(profile.headline?.trim()),
      field: "headline",
      label: "Identificação curta",
    },
    {
      complete: profile.interests.length > 0,
      field: "interests",
      label: "Interesses",
    },
  ] as const;

  const completedCount = items.filter(({ complete }) => complete).length;
  return {
    completedCount,
    items,
    percentage: Math.round((completedCount / items.length) * 100),
    total: items.length,
  };
};
