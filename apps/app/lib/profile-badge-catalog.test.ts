import type { BadgeCriterion } from "@repo/database";
import { expect, test } from "vitest";
import {
  orderProfileBadges,
  splitProfileBadges,
} from "./profile-badge-catalog";

test("orders profile badges in the handoff sequence", () => {
  const badges = [
    { criterion: "MEETINGS_ATTENDED" as BadgeCriterion, title: "Encontros" },
    { criterion: "STUDY_GOALS_MET" as BadgeCriterion, title: "Metas" },
    { criterion: "STUDY_MINUTES" as BadgeCriterion, title: "Estudo" },
    { criterion: "LESSONS_COMPLETED" as BadgeCriterion, title: "Aulas" },
  ];

  expect(orderProfileBadges(badges).map(({ criterion }) => criterion)).toEqual([
    "STUDY_MINUTES",
    "LESSONS_COMPLETED",
    "STUDY_GOALS_MET",
    "MEETINGS_ATTENDED",
  ]);
});

test("keeps earned definitions out of the available catalog by badge id", () => {
  const studyMinutes = "STUDY_MINUTES" as BadgeCriterion;
  const awardedAt = new Date("2026-10-08T12:00:00.000Z");
  const earnedDefinition = {
    criterion: studyMinutes,
    description: "Some cinco horas de estudo.",
    id: "badge-five-hours",
    title: "Cinco horas de estudo",
  };
  const nextDefinition = {
    criterion: studyMinutes,
    description: "Some dez horas de estudo.",
    id: "badge-ten-hours",
    title: "Dez horas de estudo",
  };

  const result = splitProfileBadges(
    [
      {
        badgeId: earnedDefinition.id,
        definitionRevision: {
          criterion: earnedDefinition.criterion,
          description: earnedDefinition.description,
          title: earnedDefinition.title,
        },
        id: "award-five-hours",
        awardedAt,
      },
    ],
    [earnedDefinition, nextDefinition]
  );

  expect(result.earned).toEqual([
    {
      ...earnedDefinition,
      id: "award-five-hours",
      awardedAt,
    },
  ]);
  expect(result.available).toEqual([nextDefinition]);
});
