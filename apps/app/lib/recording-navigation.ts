interface RecordingArchiveHrefOptions {
  readonly asset?: string;
  readonly cursor?: string;
  readonly query?: string;
  readonly year?: string;
}

export const recordingArchiveHref = ({
  asset,
  cursor,
  query,
  year,
}: RecordingArchiveHrefOptions) => {
  const parameters = new URLSearchParams();
  const normalizedQuery = query?.trim();

  if (normalizedQuery) {
    parameters.set("q", normalizedQuery);
  }
  if (year) {
    parameters.set("year", year);
  }
  if (asset) {
    parameters.set("asset", asset);
  }
  if (cursor) {
    parameters.set("cursor", cursor);
  }

  const search = parameters.toString();
  return `/encontros/gravacoes${search ? `?${search}` : ""}`;
};

export const resolveRecordingPlaybackSelection = <
  TRequested extends { readonly asset: { readonly id: string } },
  TContinue extends { readonly asset: { readonly id: string } },
>(
  requestedAssetId: string | undefined,
  requestedRecording: TRequested | null,
  continueWatching: readonly TContinue[]
) => {
  if (!requestedAssetId) {
    return continueWatching[0] ?? null;
  }
  if (requestedRecording?.asset.id === requestedAssetId) {
    return requestedRecording;
  }
  return (
    continueWatching.find(
      (recording) => recording.asset.id === requestedAssetId
    ) ?? null
  );
};
