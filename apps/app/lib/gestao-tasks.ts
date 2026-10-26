import "server-only";
import { database } from "@repo/database";
import type { GestaoActor } from "./gestao-authorization";
import {
  campaignState,
  parseTaskRecurrence,
  parseTaskState,
  type TaskRecurrence,
  taskState,
} from "./gestao-tasks-domain";
import { readCampaignContribution } from "./study-dashboard";
import { studyPeriodKey } from "./study-periods";

const pageSize = 20;

export interface GestaoTaskQuery {
  readonly frequency?: string;
  readonly page?: string;
  readonly query?: string;
  readonly state?: string;
}

export const getGestaoTasks = async (
  actor: GestaoActor,
  input: GestaoTaskQuery
) => {
  const now = new Date();
  const frequency = parseTaskRecurrence(input.frequency);
  const state = parseTaskState(input.state);
  const query = (input.query ?? "").trim().slice(0, 120).toLowerCase();
  const tasks = await database.learningTask.findMany({
    where: actor.role === "ADMIN" ? {} : { createdByMemberId: actor.userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 300,
    select: {
      id: true,
      title: true,
      recurrence: true,
      startsAt: true,
      dueAt: true,
      archivedAt: true,
      _count: { select: { recipients: true } },
    },
  });
  const keys = [
    ...new Set(
      (["DAILY", "MONTHLY", "ONCE", "WEEKLY"] as const).map((recurrence) =>
        studyPeriodKey(recurrence, now)
      )
    ),
  ];
  const completions = await database.learningTaskCompletion.groupBy({
    by: ["taskId", "periodKey"],
    where: {
      taskId: { in: tasks.map((task) => task.id) },
      periodKey: { in: keys },
    },
    _count: { _all: true },
  });
  const done = new Map(
    completions.map((row) => [
      `${row.taskId}:${row.periodKey}`,
      row._count._all,
    ])
  );
  const rows = tasks
    .map((task) => {
      const recurrence: TaskRecurrence = task.recurrence;
      return {
        completed:
          done.get(`${task.id}:${studyPeriodKey(recurrence, now)}`) ?? 0,
        dueAt: task.dueAt,
        id: task.id,
        recipients: task._count.recipients,
        recurrence,
        startsAt: task.startsAt,
        state: taskState(task, now),
        title: task.title,
      };
    })
    .filter(
      (row) =>
        (!frequency || row.recurrence === frequency) &&
        (!state || row.state.key === state) &&
        (!query || row.title.toLowerCase().includes(query))
    );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(
    pageCount,
    Math.max(1, Math.trunc(Number(input.page) || 1))
  );
  return {
    frequency,
    page,
    pageCount,
    pageSize,
    query,
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    state,
    total: rows.length,
  };
};

export const getGestaoCampaigns = async (limit: number) => {
  const now = new Date();
  const campaigns = await database.studyCampaign.findMany({
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      description: true,
      targetMinutes: true,
      startsAt: true,
      endsAt: true,
      publishedAt: true,
      archivedAt: true,
    },
  });
  return Promise.all(
    campaigns.map(async (campaign) => {
      const started = campaign.startsAt <= now;
      const seconds = started
        ? await readCampaignContribution(
            campaign.startsAt,
            campaign.endsAt < now ? campaign.endsAt : now
          )
        : [];
      const minutes = Math.floor(Number(seconds[0]?.seconds ?? 0) / 60);
      return {
        ...campaign,
        contributedMinutes: minutes,
        state: campaignState(campaign, now),
      };
    })
  );
};
