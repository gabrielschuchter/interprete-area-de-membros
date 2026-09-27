export interface CommunityPopularitySignals {
  readonly comments: number;
  readonly createdAt: Date;
  readonly now: Date;
  readonly participants: number;
  readonly publishedAt: Date | null;
  readonly votes: number;
}

export const communityPopularityScore = ({
  comments,
  createdAt,
  now,
  participants,
  publishedAt,
  votes,
}: CommunityPopularitySignals) => {
  const publishedOn = publishedAt ?? createdAt;
  const ageHours = Math.max(
    0,
    (now.getTime() - publishedOn.getTime()) / 3_600_000
  );
  const engagement =
    Math.log1p(votes) * 1.4 +
    Math.log1p(comments) * 2.2 +
    Math.log1p(participants) * 1.8;
  const decay = (1 + ageHours / 24) ** 0.65;

  return (1 + engagement) / decay;
};
