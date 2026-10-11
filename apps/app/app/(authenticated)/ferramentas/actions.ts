"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedMemberId as requireMemberId } from "@/lib/authorization";
import {
  bulkUpdatePlannerNotes,
  createPlannerNote,
  createPlannerNoteFolder,
  deletePlannerNoteFolder,
  deletePlannerNoteForever,
  duplicatePlannerNote,
  exportPlannerNoteMarkdown,
  getPlannerNote,
  getPlannerNotes,
  movePlannerNote,
  movePlannerNoteToTrash,
  renamePlannerNoteFolder,
  restorePlannerNote,
  savePlannerNote,
  togglePlannerNotePin,
} from "@/lib/planner-notes";

const refreshTools = () => {
  revalidatePath("/ferramentas");
  revalidatePath("/");
};

export const loadPlannerNotesAction = async (options?: {
  folderId?: string | null;
  linkedLessons?: boolean;
  linkedResourceId?: string;
  limit?: number;
  pinnedOnly?: boolean;
  sort?: "RECENT" | "TITLE";
  tagId?: string;
  search?: string;
  trash?: boolean;
}) => getPlannerNotes(await requireMemberId(), options);

export const loadPlannerNoteAction = async (id: string) =>
  getPlannerNote(await requireMemberId(), id);

export const createPlannerNoteAction = async (folderId?: string | null) => {
  const note = await createPlannerNote(await requireMemberId(), folderId);
  refreshTools();
  return note;
};

export const createPlannerNoteForLessonAction = async (lessonId: string) => {
  const note = await createPlannerNote(await requireMemberId(), null, lessonId);
  refreshTools();
  return note;
};

export const duplicatePlannerNoteAction = async (id: string) => {
  const note = await duplicatePlannerNote(await requireMemberId(), id);
  refreshTools();
  return note;
};

export const savePlannerNoteAction = async (input: unknown) => {
  const note = await savePlannerNote(await requireMemberId(), input);
  refreshTools();
  return note;
};

export const movePlannerNoteAction = async (input: unknown) => {
  const result = await movePlannerNote(await requireMemberId(), input);
  refreshTools();
  return result;
};

export const bulkUpdatePlannerNotesAction = async (input: unknown) => {
  const result = await bulkUpdatePlannerNotes(await requireMemberId(), input);
  refreshTools();
  return result;
};

export const createPlannerNoteFolderAction = async (input: unknown) => {
  const folder = await createPlannerNoteFolder(await requireMemberId(), input);
  refreshTools();
  return folder;
};

export const renamePlannerNoteFolderAction = async (input: unknown) => {
  const folder = await renamePlannerNoteFolder(await requireMemberId(), input);
  refreshTools();
  return folder;
};

export const deletePlannerNoteFolderAction = async (id: string) => {
  const result = await deletePlannerNoteFolder(await requireMemberId(), id);
  refreshTools();
  return result;
};

export const movePlannerNoteToTrashAction = async (id: string) => {
  const result = await movePlannerNoteToTrash(await requireMemberId(), id);
  refreshTools();
  return result;
};

export const restorePlannerNoteAction = async (id: string) => {
  const result = await restorePlannerNote(await requireMemberId(), id);
  refreshTools();
  return result;
};

export const deletePlannerNoteForeverAction = async (id: string) => {
  const result = await deletePlannerNoteForever(await requireMemberId(), id);
  refreshTools();
  return result;
};

export const togglePlannerNotePinAction = async (id: string) => {
  const result = await togglePlannerNotePin(await requireMemberId(), id);
  refreshTools();
  return result;
};

export const exportPlannerNoteMarkdownAction = async (id: string) =>
  exportPlannerNoteMarkdown(await requireMemberId(), id);
