"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { GradeWorkspace as GradeWorkspaceComponent } from "./grade-workspace";
import type { PlannerWorkspace as PlannerWorkspaceComponent } from "./planner-workspace";
import type { Rob2Workspace as Rob2WorkspaceComponent } from "./rob2-workspace";
import type { ToolsWorkspace as ToolsWorkspaceComponent } from "./tools-workspace";

// Metas/Calendário, Cronômetro, RoB 2 e GRADE são pacotes grandes; cada aba
// baixa só o seu.
const PlannerWorkspace = dynamic(() =>
  import("./planner-workspace").then((module) => module.PlannerWorkspace)
);
const ToolsWorkspace = dynamic(() =>
  import("./tools-workspace").then((module) => module.ToolsWorkspace)
);
const Rob2Workspace = dynamic(() =>
  import("./rob2-workspace").then((module) => module.Rob2Workspace)
);
const GradeWorkspace = dynamic(() =>
  import("./grade-workspace").then((module) => module.GradeWorkspace)
);

export const PlannerView = (
  props: ComponentProps<typeof PlannerWorkspaceComponent>
) => <PlannerWorkspace {...props} />;

export const TimerView = (
  props: ComponentProps<typeof ToolsWorkspaceComponent>
) => <ToolsWorkspace {...props} />;

export const Rob2View = (
  props: ComponentProps<typeof Rob2WorkspaceComponent>
) => <Rob2Workspace {...props} />;

export const GradeView = (
  props: ComponentProps<typeof GradeWorkspaceComponent>
) => <GradeWorkspace {...props} />;
