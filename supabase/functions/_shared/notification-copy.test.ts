import { describe, expect, test } from "vitest";
import { type GoalRef, goalName, notificationCopy } from "./notification-copy.ts";

const DAY = "2026-10-03";
const run: GoalRef = { title: "Morning run", charm: "🏃", shared: true };
const read: GoalRef = { title: "Read 20 pages", charm: "📚", shared: false };
const save: GoalRef = { title: "Save $500", charm: null, shared: true };

describe("goalName", () => {
  test("puts the charm in front of the title", () => {
    expect(goalName(run)).toBe("🏃 Morning run");
  });

  test("drops a missing charm", () => {
    expect(goalName(save)).toBe("Save $500");
  });

  test("cuts a long title at 40 characters with an ellipsis", () => {
    const long = { title: "a".repeat(60), charm: null, shared: true };
    expect(goalName(long)).toBe(`${"a".repeat(39)}…`);
  });
});

describe("notificationCopy", () => {
  test("every message is titled CoupleGoal", () => {
    expect(notificationCopy({ kind: "partner_joined", actor: "Mia" }, DAY).title).toBe(
      "CoupleGoal",
    );
  });

  test("one shared paw", () => {
    expect(notificationCopy({ kind: "paws", actor: "Mia", goals: [run] }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "Mia pawed 🏃 Morning run for you both",
      url: "/den",
      tag: `paws-${DAY}`,
    });
  });

  test("one own paw has no pronoun", () => {
    expect(notificationCopy({ kind: "paws", actor: "Mia", goals: [read] }, DAY).body).toBe(
      "Mia pawed 📚 Read 20 pages",
    );
  });

  test("two paws name both", () => {
    expect(notificationCopy({ kind: "paws", actor: "Mia", goals: [run, read] }, DAY).body).toBe(
      "Mia pawed 2 goals: Morning run and Read 20 pages",
    );
  });

  test("three paws name all three", () => {
    expect(
      notificationCopy({ kind: "paws", actor: "Mia", goals: [run, read, save] }, DAY).body,
    ).toBe("Mia pawed 3 goals: Morning run, Read 20 pages and Save $500");
  });

  test("more than three paws name two and count the rest", () => {
    const extra = { title: "Stretch", charm: null, shared: true };
    const more = { title: "Water", charm: null, shared: true };
    expect(
      notificationCopy({ kind: "paws", actor: "Mia", goals: [run, read, extra, more] }, DAY).body,
    ).toBe("Mia pawed 4 goals: Morning run, Read 20 pages and 2 more");
  });

  test("a shared milestone celebrates both of you", () => {
    expect(notificationCopy({ kind: "milestone_done", actor: "Mia", goal: save }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "You two finished Save $500! 🎉",
      url: "/goals",
      tag: `milestone_done-${DAY}`,
    });
  });

  test("an own milestone names the actor", () => {
    const own = { ...save, shared: false };
    expect(notificationCopy({ kind: "milestone_done", actor: "Mia", goal: own }, DAY).body).toBe(
      "Mia finished Save $500! 🎉",
    );
  });

  test("heart", () => {
    expect(notificationCopy({ kind: "heart", actor: "Mia", goal: run }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "Mia ❤️ your 🏃 Morning run paw",
      url: "/den",
      tag: `heart-${DAY}`,
    });
  });

  test("seal", () => {
    expect(notificationCopy({ kind: "seal", actor: "Mia", goal: run }, DAY).body).toBe(
      "Mia sealed 🏃 Morning run",
    );
  });

  test("goal added, shared and own", () => {
    expect(notificationCopy({ kind: "goal_added", actor: "Mia", goal: run }, DAY).body).toBe(
      "Mia added 🏃 Morning run for you both",
    );
    expect(notificationCopy({ kind: "goal_added", actor: "Mia", goal: read }, DAY).body).toBe(
      "Mia added 📚 Read 20 pages",
    );
  });

  test("goal archived uses the app's own words", () => {
    expect(notificationCopy({ kind: "goal_archived", actor: "Mia", goal: run }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "Mia tucked away 🏃 Morning run",
      url: "/goals",
      tag: `goal_archived-${DAY}`,
    });
  });

  test("partner joined", () => {
    expect(notificationCopy({ kind: "partner_joined", actor: "Mia" }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "Mia joined your den 🐶",
      url: "/den",
      tag: `partner_joined-${DAY}`,
    });
  });

  test("reminder, one and many", () => {
    expect(notificationCopy({ kind: "reminder", open: 1 }, DAY)).toEqual({
      title: "CoupleGoal",
      body: "Today's paw is waiting — 1 left",
      url: "/den",
      tag: `reminder-${DAY}`,
    });
    expect(notificationCopy({ kind: "reminder", open: 3 }, DAY).body).toBe(
      "Today's paws are waiting — 3 left",
    );
  });
});
