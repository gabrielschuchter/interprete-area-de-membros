import { type NextRequest, NextResponse } from "next/server";
import { legacyLearningPathname } from "@/lib/legacy-learning-path";

export const dynamic = "force-dynamic";

interface LegacyLearningRouteContext {
  readonly params: Promise<{ path?: string[] }>;
}

const redirectToCourses = async (
  request: NextRequest,
  { params }: LegacyLearningRouteContext
) => {
  const { path = [] } = await params;
  const target = new URL(legacyLearningPathname(path), request.nextUrl);
  target.search = request.nextUrl.search;

  return NextResponse.redirect(target, 308);
};

export const GET = redirectToCourses;
export const HEAD = redirectToCourses;
