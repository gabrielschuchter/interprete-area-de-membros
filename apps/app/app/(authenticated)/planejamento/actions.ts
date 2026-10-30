"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedMemberId as requireMemberId } from "@/lib/authorization";
import {
  changePlannerTaskStatus,
  deletePlannerEvent,
  deletePlannerTask,
  duplicatePlannerEvent,
  duplicatePlannerTask,
  getPlannerDashboard,
  restorePlannerTask,
  restorePlannerTaskOccurrence,
  savePlannerColumn,
  savePlannerEvent,
  savePlannerEventOccurrence,
  savePlannerGoal,
  savePlannerTask,
  savePlannerTaskOccurrence,
  setPlannerTimezone,
} from "@/lib/planner";
import { saveStudyGoalTopics } from "@/lib/study-goal-topics";

export const loadPlannerAction = async (range?: {
  start?: string;
  end?: string;
}) => getPlannerDashboard(await requireMemberId(), range);

const refreshPlannerViews = () => {
  revalidatePath("/planejamento");
  revalidatePath("/");
  revalidatePath("/ferramentas");
};

export const saveStudyGoalTopicsAction = async (input: {
  period: "WEEKLY" | "MONTHLY";
  topics: { topic: string; sharePercent: number }[];
}) => {
  const result = await saveStudyGoalTopics(await requireMemberId(), input);
  revalidatePath("/planejamento");
  return result;
};

export const savePlannerGoalAction = async (input: {
  period: "WEEKLY" | "MONTHLY";
  targetMinutes: number;
}) => {
  const result = await savePlannerGoal(await requireMemberId(), input);
  refreshPlannerViews();
  return result;
};

export const savePlannerTaskAction = async (input: unknown) => {
  const result = await savePlannerTask(await requireMemberId(), input);
  refreshPlannerViews();
  return result;
};

export const changePlannerTaskStatusAction = async (input: {
  id: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  occurrenceAt?: string;
}) => {
  const result = await changePlannerTaskStatus(await requireMemberId(), input);
  refreshPlannerViews();
  return result;
};

export const deletePlannerTaskAction = async (input: {
  id: string;
  occurrenceAt?: string;
}) => {
  const result = await deletePlannerTask(await requireMemberId(), input);
  refreshPlannerViews();
  return result;
};

export const restorePlannerTaskAction = async (id: string) => {
  const result = await restorePlannerTask(await requireMemberId(), id);
  refreshPlannerViews();
  return result;
};

export const restorePlannerTaskOccurrenceAction = async (input: {
  id: string;
  occurrenceAt: string;
}) => {
  const result = await restorePlannerTaskOccurrence(
    await requireMemberId(),
    input
  );
  refreshPlannerViews();
  return result;
};

export const duplicatePlannerTaskAction = async (id: string) => {
  const result = await duplicatePlannerTask(await requireMemberId(), id);
  refreshPlannerViews();
  return result;
};

export const savePlannerColumnAction = async (input: {
  status: "TODO" | "IN_PROGRESS" | "DONE";
  label: string;
  color: string;
}) => {
  const result = await savePlannerColumn(await requireMemberId(), input);
  refreshPlannerViews();
  return result;
};

export const savePlannerEventAction = async (input: unknown) => {
  const result = await savePlannerEvent(await requireMemberId(), input);
  refreshPlannerViews();
  return result;
};

export const savePlannerTaskOccurrenceAction = async (input: unknown) => {
  const result = await savePlannerTaskOccurrence(
    await requireMemberId(),
    input
  );
  refreshPlannerViews();
  return result;
};

export const savePlannerEventOccurrenceAction = async (input: unknown) => {
  const result = await savePlannerEventOccurrence(
    await requireMemberId(),
    input
  );
  refreshPlannerViews();
  return result;
};

export const deletePlannerEventAction = async (input: {
  id: string;
  occurrenceAt?: string;
}) => {
  const result = await deletePlannerEvent(await requireMemberId(), input);
  refreshPlannerViews();
  return result;
};

export const duplicatePlannerEventAction = async (id: string) => {
  const result = await duplicatePlannerEvent(await requireMemberId(), id);
  refreshPlannerViews();
  return result;
};

export const setPlannerTimezoneAction = async (timezone: string) => {
  const result = await setPlannerTimezone(await requireMemberId(), timezone);
  refreshPlannerViews();
  return result;
};
