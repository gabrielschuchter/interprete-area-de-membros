import { expect, test } from "vitest";
import { profileCompletionItems } from "./profile-completion";

const emptyProfile = {
  avatarUrl: null,
  bio: null,
  city: null,
  country: null,
  headline: null,
  institution: null,
  interests: [],
  instagram: null,
  linkedin: null,
  occupation: null,
  website: null,
};

test("profile completion uses the eight visible editorial fields", () => {
  const result = profileCompletionItems(emptyProfile);
  expect(result.total).toBe(8);
  expect(result.completedCount).toBe(0);
  expect(result.percentage).toBe(0);
});

test("location requires both city and country and any social link is enough", () => {
  const result = profileCompletionItems({
    ...emptyProfile,
    city: "São Paulo",
    linkedin: "https://linkedin.com/in/member",
  });
  expect(result.items.find(({ field }) => field === "city")?.complete).toBe(
    false
  );
  expect(result.items.find(({ field }) => field === "website")?.complete).toBe(
    true
  );
});
