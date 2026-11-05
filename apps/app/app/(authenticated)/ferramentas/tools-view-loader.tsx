"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { PlannerWorkspace as PlannerWorkspaceComponent } from "./planner-workspace";
import type { ToolsWorkspace as ToolsWorkspaceComponent } from "./tools-workspace";

// Metas/Calendário e Cronômetro são pacotes grandes; cada aba baixa só o seu.
const PlannerWorkspace = dynamic(() =>
  import("./planner-workspace").then((module) => module.PlannerWorkspace)
);
const ToolsWorkspace = dynamic(() =>
  import("./tools-workspace").then((module) => module.ToolsWorkspace)
);

export const PlannerView = (
  props: ComponentProps<typeof PlannerWorkspaceComponent>
) => <PlannerWorkspace {...props} />;

export const TimerView = (
  props: ComponentProps<typeof ToolsWorkspaceComponent>
) => <ToolsWorkspace {...props} />;
