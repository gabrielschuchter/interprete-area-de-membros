import { NextResponse } from "next/server";
import { getAccessibleAsset } from "@/lib/content-access";
import { requireMemberId } from "@/lib/learning";
import { createLearningAssetSignedUrl } from "@/lib/learning-storage";

export const dynamic = "force-dynamic";

interface AssetRouteProperties {
  readonly params: Promise<{ assetId: string }>;
}

const safeExternalUrl = (value: string | null) => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

export const GET = async (
  request: Request,
  { params }: AssetRouteProperties
) => {
  const { assetId } = await params;
  const memberId = await requireMemberId();
  const asset = await getAccessibleAsset(assetId, memberId);

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (asset.storagePath) {
    const signedUrl = await createLearningAssetSignedUrl(asset.storagePath);

    if (!signedUrl) {
      return NextResponse.json(
        { error: "Private storage is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const upstream = await fetch(signedUrl, {
      cache: "no-store",
      headers: request.headers.get("range")
        ? { Range: request.headers.get("range") as string }
        : undefined,
    });

    if (!(upstream.ok || upstream.status === 206)) {
      return NextResponse.json(
        { error: "Private asset could not be read" },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });

    for (const header of [
      "accept-ranges",
      "content-length",
      "content-range",
      "content-type",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  }

  const externalUrl = safeExternalUrl(asset.externalUrl);
  if (externalUrl) {
    return NextResponse.redirect(externalUrl, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return NextResponse.json(
    { error: "Asset is awaiting storage import" },
    { status: 409, headers: { "Cache-Control": "no-store" } }
  );
};
