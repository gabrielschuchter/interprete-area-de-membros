import { describe, expect, it } from "vitest";
import {
  defaultYouTubePolicy,
  parseYouTubePolicy,
} from "./integrations-domain";

describe("política do YouTube", () => {
  it("usa o padrão quando nada foi salvo ou o valor está quebrado", () => {
    expect(parseYouTubePolicy(null)).toEqual(defaultYouTubePolicy);
    expect(parseYouTubePolicy("x")).toEqual(defaultYouTubePolicy);
  });

  it("lê só campos conhecidos e ignora valores inválidos", () => {
    expect(
      parseYouTubePolicy({
        allowUpload: "sim",
        schedule: "weekly",
        unlistedOnly: true,
      })
    ).toEqual({
      allowUpload: true,
      notifyUnavailable: true,
      schedule: "weekly",
      unlistedOnly: true,
    });
    expect(parseYouTubePolicy({ schedule: "hourly" }).schedule).toBe("daily");
  });
});
