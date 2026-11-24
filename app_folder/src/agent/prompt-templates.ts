// ========== src/agent/prompt-templates.ts ==========
// Evidence-backed Restrained AI Co-Pilot scaffolds (protecting the Generation
// Effect & avoiding cognitive offloading — Slamecka & Graf 1978; Bjork 1994;
// Dunlosky 2013; Gerlich 2025). The co-pilot scaffolds thinking; it never
// writes cards into the vault on the learner's behalf.

import type { Memonic } from "@/composables/library";

export type CopilotModeId = "quiz" | "bridges" | "critique" | "why" | "ask";

export interface CopilotMode {
  id: CopilotModeId;
  label: string;
  shortDesc: string;
  placeholder: string;
  defaultPrompt: string;
  systemAddendum: string;
}

export const COPILOT_MODES: CopilotMode[] = [
  {
    id: "quiz",
    label: "Quiz Me",
    shortDesc: "Active retrieval check without giving away the answer first.",
    placeholder: "Optional focus (or leave blank to generate a retrieval question)…",
    defaultPrompt:
      "Test my recall of {{title}} with ONE concrete, novel application question. Do NOT reveal the answer yet — wait for my response.",
    systemAddendum:
      "Role: Retrieval-practice coach. Ask ONE crisp application or recall question based on the card(s) without giving away the explanation. If the learner provides an attempt, evaluate it specifically and point out any missing link.",
  },
  {
    id: "bridges",
    label: "Find Bridges",
    shortDesc: "Suggest cross-subject analogies and structural #tags.",
    placeholder: "Optional target subject (e.g. Physics, Economics, CS)…",
    defaultPrompt:
      "Suggest 2–3 cross-subject structural bridges for '{{title}}' (current tags: {{tags}}). For each bridge, name a shared underlying principle, a concise #tag, and ONE question that helps me connect it myself.",
    systemAddendum:
      "Role: Cross-subject bridge architect. Propose non-obvious structural parallels across distinct academic disciplines. Keep suggestions concise and give the learner a prompt to articulate the link in their own words rather than writing full cards for them.",
  },
  {
    id: "critique",
    label: "Critique Hook",
    shortDesc: "Evaluate clarity and vividness so you strengthen it yourself.",
    placeholder: "Optional note on what feels hard to remember…",
    defaultPrompt:
      "Critique my mnemonic hook '{{title}}' ({{type}}) against its explanation. Tell me what is strong, what could fade after a week, and ask 2 targeted questions so I can sharpen it myself.",
    systemAddendum:
      "Role: Memory-science editor. Preserve the generation effect: NEVER rewrite the entire mnemonic for the learner. Give brief diagnostic feedback (vividness, accuracy, retrievability) and 2 guiding prompts so the learner refines it themselves.",
  },
  {
    id: "why",
    label: "Ask Why",
    shortDesc: "Elaborative interrogation to deepen understanding beyond rote.",
    placeholder: "Write your own explanation of why this holds, or leave blank for a prompt…",
    defaultPrompt:
      "Ask me one sharp 'Why does this hold?' elaborative interrogation question about '{{title}}' that connects mechanism to outcome.",
    systemAddendum:
      "Role: Socratic tutor practicing elaborative interrogation (Dunlosky 2013). Push past surface memorization toward causal mechanism. Keep responses short, concrete, and structured.",
  },
  {
    id: "ask",
    label: "Ask",
    shortDesc: "Direct concise question grounded in your selected cards.",
    placeholder: "Ask a specific question about the selected card(s)…",
    defaultPrompt: "",
    systemAddendum:
      "Role: Concise study assistant. Reference the learner's cards by title, stay concrete, and favor conceptual clarity over verbosity.",
  },
];

export function getCopilotMode(id: CopilotModeId): CopilotMode {
  return COPILOT_MODES.find((m) => m.id === id) ?? COPILOT_MODES[0]!;
}

export function fillPromptTemplate(
  template: string,
  memonic: Memonic,
  selectionText: string,
): string {
  return template
    .replace(/\{\{context\}\}/g, memonic.context)
    .replace(/\{\{summary\}\}/g, memonic.context)
    .replace(/\{\{title\}\}/g, memonic.title)
    .replace(/\{\{selection\}\}/g, selectionText)
    .replace(/\{\{tags\}\}/g, memonic.tags.join(", ") || "none")
    .replace(/\{\{type\}\}/g, memonic.type)
    .replace(/\{\{importance\}\}/g, String(memonic.importance));
}
