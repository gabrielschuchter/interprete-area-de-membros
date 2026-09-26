import { auth } from "@repo/auth/server";
import { ContentStatus, database } from "@repo/database";
import { NextResponse } from "next/server";

export const POST = async (request: Request) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const payload = (await request.json()) as {
      muted?: unknown;
      topicId?: unknown;
    };
    if (typeof payload.topicId !== "string" || !payload.topicId) {
      return NextResponse.json(
        { error: "Discussão inválida." },
        { status: 400 }
      );
    }
    const topic = await database.communityPost.findFirst({
      where: {
        id: payload.topicId,
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!topic) {
      return NextResponse.json(
        { error: "Discussão não encontrada." },
        { status: 404 }
      );
    }
    const muted = payload.muted !== false;
    await database.topicFollow.upsert({
      where: { userId_topicId: { userId, topicId: topic.id } },
      create: { userId, topicId: topic.id, mutedAt: muted ? new Date() : null },
      update: { mutedAt: muted ? new Date() : null },
    });
    return NextResponse.json({ ok: true, muted });
  } catch (error) {
    console.error("Notification mute failed", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar o acompanhamento." },
      { status: 500 }
    );
  }
};
