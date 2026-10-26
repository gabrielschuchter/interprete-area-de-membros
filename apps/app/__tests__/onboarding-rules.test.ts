import { describe, expect, it } from "vitest";
import {
  isGenericDisplayName,
  isGenericUsername,
  localUsernameStatus,
  usernameFromName,
  usernameSuggestions,
  validDisplayName,
} from "@/lib/onboarding/identity";
import {
  displayProfileLink,
  normalizeProfileLink,
} from "@/lib/onboarding/links";
import {
  essentialNotificationPreferences,
  presetFor,
  presetPreferences,
} from "@/lib/onboarding/notification-presets";
import {
  clampStepIndex,
  onboardingStepPath,
  onboardingSteps,
  stepIndex,
} from "@/lib/onboarding/steps";

describe("onboarding identity rules", () => {
  it("treats provisioning placeholders as empty", () => {
    expect(isGenericDisplayName("Membro")).toBe(true);
    expect(isGenericDisplayName("  ")).toBe(true);
    expect(isGenericDisplayName("Marina Souza")).toBe(false);
    expect(isGenericUsername("membro")).toBe(true);
    expect(isGenericUsername("membro-a1b2c3")).toBe(true);
    expect(isGenericUsername("membro-membro")).toBe(true);
    expect(isGenericUsername("marina.souza")).toBe(false);
    expect(isGenericUsername("membros-do-grupo")).toBe(false);
  });

  it("builds a username from the name without accents or spaces", () => {
    expect(usernameFromName("Gabriel Schuchter")).toBe("gabriel-schuchter");
    expect(usernameFromName("João da Conceição")).toBe("joao-da-conceicao");
  });

  it("classifies usernames before asking the server", () => {
    expect(localUsernameStatus("")).toBe("empty");
    expect(localUsernameStatus("ab")).toBe("short");
    expect(localUsernameStatus("Ab_cd")).toBe("invalid");
    expect(localUsernameStatus("admin")).toBe("reserved");
    expect(localUsernameStatus("marina-souza")).toBe("ok");
  });

  it("offers valid, distinct suggestions", () => {
    const suggestions = usernameSuggestions("marina", "Marina Souza", 2026);
    expect(suggestions).toEqual(["marina-pbe", "marina-s", "marina-2026"]);
  });

  it("requires a real display name", () => {
    expect(validDisplayName("Ma")).toBe(true);
    expect(validDisplayName("M")).toBe(false);
    expect(validDisplayName("Membro")).toBe(false);
    expect(validDisplayName("x".repeat(61))).toBe(false);
  });
});

describe("onboarding links", () => {
  it("normalizes accepted forms to http(s) URLs", () => {
    expect(normalizeProfileLink("instagram", "@gabriel.nutri")).toBe(
      "https://instagram.com/gabriel.nutri"
    );
    expect(normalizeProfileLink("linkedin", "linkedin.com/in/gabriel")).toBe(
      "https://linkedin.com/in/gabriel"
    );
    expect(normalizeProfileLink("website", "https://meusite.com.br")).toBe(
      "https://meusite.com.br/"
    );
    expect(normalizeProfileLink("website", "")).toBe("");
  });

  it("rejects what is not a link", () => {
    expect(normalizeProfileLink("website", "meu site")).toBeNull();
    expect(normalizeProfileLink("website", "javascript:alert(1)")).toBeNull();
    expect(normalizeProfileLink("website", "ftp://x.com")).toBeNull();
  });

  it("shows Instagram URLs back as handles", () => {
    expect(
      displayProfileLink("instagram", "https://instagram.com/gabriel")
    ).toBe("@gabriel");
  });
});

describe("notification presets", () => {
  it("turns every switch on for 'tudo'", () => {
    expect(Object.values(presetPreferences("tudo")).every(Boolean)).toBe(true);
  });

  it("keeps only mentions, replies, deadlines and announcements for 'essencial'", () => {
    const enabled = Object.entries(presetPreferences("essencial"))
      .filter(([, on]) => on)
      .map(([key]) => key)
      .sort();
    expect(enabled).toEqual([
      "activityDeadline",
      "announcements",
      "commentReplies",
      "mentions",
    ]);
  });

  it("recognizes the preset a member already has, otherwise 'um'", () => {
    expect(presetFor(presetPreferences("tudo"))).toBe("tudo");
    expect(presetFor(essentialNotificationPreferences)).toBe("essencial");
    expect(presetFor({ ...presetPreferences("tudo"), groupPosts: false })).toBe(
      "um"
    );
  });
});

describe("onboarding steps", () => {
  it("keeps the persisted order and exposes skip only on optional steps", () => {
    expect(onboardingSteps.map((step) => step.slug)).toEqual([
      "boas-vindas",
      "identidade",
      "foto",
      "sobre",
      "interesses",
      "avisos",
      "conclusao",
    ]);
    expect(
      onboardingSteps.filter((step) => step.skippable).map((step) => step.slug)
    ).toEqual(["foto", "sobre", "interesses", "avisos"]);
  });

  it("clamps stored indexes and builds paths", () => {
    expect(clampStepIndex(-3)).toBe(0);
    expect(clampStepIndex(99)).toBe(6);
    expect(onboardingStepPath(2)).toBe("/onboarding/foto");
    expect(stepIndex("nao-existe")).toBe(-1);
  });
});
