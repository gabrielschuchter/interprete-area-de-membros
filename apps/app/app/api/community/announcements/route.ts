import { NextResponse } from "next/server";
import { getCommunityAnnouncements } from "@/lib/community-announcements";
import { requireMemberId } from "@/lib/learning";

export const dynamic = "force-dynamic";

export const GET = async () => {
  try {
    const memberId = await requireMemberId();
    const announcements = await getCommunityAnnouncements(memberId, 100);
    return NextResponse.json(announcements, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json(
      { error: "Acesso não autorizado." },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  }
};
