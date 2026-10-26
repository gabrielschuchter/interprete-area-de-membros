import "server-only";
import { database } from "@repo/database";
import { cache } from "react";
import { getUpcomingMeetings } from "./meetings";
import {
  autoPortalNote,
  type CursosBlockConfig,
  cursosSettingKey,
  type PortalNoteConfig,
  parseCursosBlocks,
  parsePortalNote,
  portalNoteSettingKey,
} from "./personalization-domain";

const readSetting = cache(async (key: string) => {
  const row = await database.productSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  return row?.value ?? null;
});

export const getCursosBlocks = async (): Promise<CursosBlockConfig[]> =>
  parseCursosBlocks(await readSetting(cursosSettingKey));

export const getPortalNoteConfig = async (): Promise<PortalNoteConfig> =>
  parsePortalNote(await readSetting(portalNoteSettingKey));

/** Texto exibido no portal do aluno, ou null quando não há nota a mostrar. */
export const getPortalNoteText = async (memberId: string) => {
  const note = await getPortalNoteConfig();
  if (!note.enabled) {
    return null;
  }
  if (note.mode === "manual") {
    return note.text || null;
  }
  const [next] = await getUpcomingMeetings(memberId);
  return autoPortalNote(next ?? null, new Date());
};
