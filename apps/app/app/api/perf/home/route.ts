import { getAuth } from "@/lib/auth";
import { getHomeData } from "@/lib/home";
import { getMemberRole } from "@/lib/authorization";
import { getOrCreateProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  const authStartedAt = performance.now();
  const { userId } = await getAuth();
  const authMs = performance.now() - authStartedAt;

  if (!userId) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const memberStartedAt = performance.now();
  await Promise.all([
    getMemberRole(userId),
    getOrCreateProfile(userId, false),
  ]);
  const memberMs = performance.now() - memberStartedAt;

  const homeStartedAt = performance.now();
  await getHomeData(userId);
  const homeMs = performance.now() - homeStartedAt;

  return Response.json({
    ok: true,
    authMs: Number(authMs.toFixed(1)),
    memberMs: Number(memberMs.toFixed(1)),
    homeMs: Number(homeMs.toFixed(1)),
    totalMs: Number((performance.now() - startedAt).toFixed(1)),
  });
}
