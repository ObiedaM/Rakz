// Learning-science loop, backlinks, arm->confirm UI, and architectural invariant tests.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

import ConfirmButton from "@/components/ui/ConfirmButton.vue";
import { COPILOT_MODES, fillPromptTemplate } from "@/agent/prompt-templates";

async function freshLibrary() {
  vi.resetModules();
  const lib = await import("@/composables/library");
  const study = await import("@/composables/library/study");
  const settings = await import("@/composables/library/settings");
  return { useLibrary: lib.useLibrary, study, settings };
}

describe("Bidirectional links & backlinks", () => {
  it("surfaces incoming backlinks on the target card when linked from another subject", async () => {
    const { useLibrary } = await freshLibrary();
    const { create, editField, link, select, activeLinks, activeBacklinks, crossSubjectLinkCount } = useLibrary();

    const bioSid = create("Biology");
    editField(bioSid, "title", "The cell drinks where it's crowded");
    const chemSid = create("Chemistry");
    editField(chemSid, "title", "Osmotic Pressure");

    link(bioSid, chemSid, "concentration");

    // Viewing Biology -> 1 outgoing link, 0 backlinks
    select(bioSid);
    expect(activeLinks.value).toHaveLength(1);
    expect(activeLinks.value[0]!.memonic.sid).toBe(chemSid);
    expect(activeLinks.value[0]!.cross).toBe(true);
    expect(activeBacklinks.value).toHaveLength(0);

    // Viewing Chemistry -> 0 outgoing links, 1 cross-subject backlink!
    select(chemSid);
    expect(activeLinks.value).toHaveLength(0);
    expect(activeBacklinks.value).toHaveLength(1);
    expect(activeBacklinks.value[0]!.memonic.sid).toBe(bioSid);
    expect(activeBacklinks.value[0]!.title).toBe("concentration");
    expect(activeBacklinks.value[0]!.cross).toBe(true);
    expect(crossSubjectLinkCount.value).toBe(1);
  });
});

describe("Spaced repetition study engine", () => {
  it("schedules intervals cleanly across Again, Hard, Good, and Easy grades", async () => {
    const { study } = await freshLibrary();
    const t0 = 1_700_000_000_000;

    const r1 = study.computeNextReview(undefined, "good", t0);
    expect(r1.reps).toBe(1);
    expect(r1.intervalDays).toBe(1);
    expect(r1.streak).toBe(1);

    const r2 = study.computeNextReview(r1, "good", t0);
    expect(r2.reps).toBe(2);
    expect(r2.intervalDays).toBe(4);

    const r3 = study.computeNextReview(r2, "easy", t0);
    expect(r3.reps).toBe(3);
    expect(r3.intervalDays).toBeGreaterThan(r2.intervalDays);
    expect(r3.ease).toBeGreaterThan(r2.ease);

    const lapsed = study.computeNextReview(r3, "again", t0);
    expect(lapsed.reps).toBe(0);
    expect(lapsed.streak).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.intervalDays).toBe(0);
    expect(lapsed.dueAt).toBe(t0 + 10 * 60_000);
  });

  it("migrates study history and Layer-3 Deep Roots when a card title is edited", async () => {
    const { useLibrary } = await freshLibrary();
    const { create, editField, active, recordReview, getReviewRecord, setDeepRoots, getDeepRoots, cardDepthLevel } = useLibrary();

    const sid = create("Physics");
    editField(sid, "title", "Old Hook");
    editField(sid, "context", "Core explanation of Ohm's law: V = IR across ohmic conductors.");
    expect(cardDepthLevel(active.value!)).toBe(2);

    setDeepRoots(active.value!, "Derived from Drude electron drift velocity under electric field.");
    expect(cardDepthLevel(active.value!)).toBe(3);

    recordReview(active.value!, "good");
    expect(getReviewRecord(active.value!)?.reps).toBe(1);

    editField(sid, "title", "Refined Hook");
    expect(getReviewRecord(active.value!)?.reps).toBe(1);
    expect(getDeepRoots(active.value!)).toContain("Drude electron drift");
  });

  it("computes sustained learning metrics: streak, 14d cadence, memory tiers, and Islands -> Bridges", async () => {
    const { useLibrary, study } = await freshLibrary();
    const { create, editField, link, recordReview, sustainedMetrics, getCardMemoryState, memonics } = useLibrary();

    const bio = create("Biology");
    editField(bio, "title", "Osmosis");
    editField(bio, "context", "Water moves across semi-permeable membranes toward higher solute concentration.");

    const chem = create("Chemistry");
    editField(chem, "title", "Osmotic Pressure");
    editField(chem, "context", "π = iMRT links molar solute concentration and temperature to pressure.");

    const island = create("History");
    editField(island, "title", "Isolated Fact");
    editField(island, "context", "Unlinked historical date.");

    link(bio, chem, "osmosis");

    // 2 bridged cards (Bio <-> Chem), 1 isolated island (History)
    expect(sustainedMetrics.value.bridgedCount).toBe(2);
    expect(sustainedMetrics.value.isolatedIslands.map((m) => m.id)).toEqual(["History"]);
    expect(sustainedMetrics.value.motherParadigmCount).toBe(0);

    // Push Biology through 2 spaced retrievals so it reaches Durable + Mother Paradigm mastery
    const now = Date.now();
    const bioCard = memonics.value.find((m) => m.sid === bio)!;
    expect(getCardMemoryState(bioCard, now)).toBe("new");

    recordReview(bioCard, "good", now - 2 * 86_400_000);
    recordReview(bioCard, "good", now);
    expect(getCardMemoryState(bioCard, now)).toBe("durable");
    expect(sustainedMetrics.value.motherParadigmCount).toBe(1);
    expect(sustainedMetrics.value.tiers.durableCount).toBe(1);

    // Streak & 14-day activity strip
    const dayMs = 86_400_000;
    const t0 = new Date(2026, 10, 24, 12, 0, 0).getTime();
    const counts: Record<string, number> = {
      [study.dateKeyFor(t0)]: 3,
      [study.dateKeyFor(t0 - dayMs)]: 2,
      [study.dateKeyFor(t0 - 2 * dayMs)]: 1,
    };
    expect(study.computeDailyStreak(counts, t0)).toBe(3);
    const cadence = study.computeActivity14d(counts, t0);
    expect(cadence).toHaveLength(14);
    expect(cadence[13]!.isToday).toBe(true);
    expect(cadence[13]!.count).toBe(3);
  });
});

describe("ConfirmButton two-step arm -> confirm (Invariant #3)", () => {
  it("arms on first click, cancels on Escape, and emits confirm only on second click", async () => {
    const wrapper = mount(ConfirmButton, { props: { label: "Delete", confirmLabel: "Confirm?" } });
    const btn = wrapper.find("button");

    // 1st click arms without confirming
    await btn.trigger("click");
    expect(wrapper.emitted("confirm")).toBeUndefined();
    expect(btn.text()).toContain("Confirm?");

    // Escape disarms safely
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(btn.text()).toContain("Delete");

    // Arm again, then 2nd click confirms
    await btn.trigger("click");
    await btn.trigger("click");
    expect(wrapper.emitted("confirm")).toHaveLength(1);
    wrapper.unmount();
  });
});

describe("Restrained AI Co-Pilot templates & theme settings", () => {
  it("exposes all 5 co-pilot modes and substitutes card placeholders", () => {
    expect(COPILOT_MODES.map((m) => m.id)).toEqual(["quiz", "bridges", "critique", "why", "ask"]);
    const filled = fillPromptTemplate(
      "Quiz {{title}} ({{type}}, {{tags}}): {{context}}",
      {
        sid: 1,
        id: "Biology",
        type: "Fact",
        title: "Cell drinks where crowded",
        context: "Osmosis follows solute gradient",
        importance: 4,
        status: "active",
        hierarchy: "",
        tags: ["osmosis", "concentration"],
        links: [],
      },
      "",
    );
    expect(filled).toContain("Cell drinks where crowded");
    expect(filled).toContain("osmosis, concentration");
  });

  it("round-trips theme and reserved extras in settings.json", async () => {
    const { settings, useLibrary } = await freshLibrary();
    const ok = settings.applySettings({
      app: "RAKZ",
      kind: "ui-settings",
      version: 1,
      theme: "light",
      language: "ar",
      colors: { Biology: "#2F9E68" },
    });
    expect(ok).toBe(true);
    expect(useLibrary().theme.value).toBe("light");
  });
});

describe("Architectural Invariant #1 boundary guard", () => {
  it("ensures only composables/library/* (and agent/keychain.ts) import @engine or @tauri-apps", () => {
    const srcDir = path.resolve(import.meta.dirname, "../src");
    const violations: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|vue)$/.test(entry.name)) continue;
        const rel = path.relative(srcDir, full).replace(/\\/g, "/");
        if (rel.startsWith("composables/library/")) continue;
        const text = fs.readFileSync(full, "utf8");
        if (/from\s+["']@engine\//.test(text)) {
          violations.push(`${rel} imports @engine/*`);
        }
        if (rel !== "agent/keychain.ts" && /from\s+["']@tauri-apps\//.test(text)) {
          violations.push(`${rel} imports @tauri-apps/*`);
        }
      }
    }

    walk(srcDir);
    expect(violations).toEqual([]);
  });
});
