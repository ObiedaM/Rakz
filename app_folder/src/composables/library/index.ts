// ─────────────────────────────────────────────────────────────────────────────
// useLibrary() — THE data-layer facade. UI components import THIS composable
// and nothing lower-level: every read/write of vault data flows through the
// API returned here. Only the library/* modules import the engine (@engine/*)
// and the Tauri API — that seam is the architectural contract.
// ─────────────────────────────────────────────────────────────────────────────

// ========== 1. IMPORTS ==========
import * as state from "./state";
import * as persistence from "./persistence";
import { load } from "./boot";
import * as actions from "./actions";
import * as selection from "./selection";
import * as settings from "./settings";
import * as study from "./study";

// ========== 2. TYPES ==========
export type { Memonic, Link } from "@engine/types";
export type { Subject, ResolvedSuggestion, ResolvedLink, ThemeMode, SaveStatus } from "./state";
export type { CardLocation } from "./persistence";
export type {
  RecallGrade,
  CardMemoryState,
  ReviewRecord,
  StudyStats,
  DayActivity,
  SustainedMetrics,
} from "./study";

// ========== 3. CONSTANTS ==========
// (none)

// ========== 4. STATE ==========
// (module singletons live in ./state)

// ========== 5. LOGIC ==========

export function useLibrary() {
  return {
    // state
    memonics: state.memonics,
    activeSid: state.activeSid,
    active: state.active,
    subjects: state.subjects,
    activeSubject: state.activeSubject,
    deck: state.deck,
    totalLinks: state.totalLinks,
    crossSubjectLinkCount: state.crossSubjectLinkCount,
    suggestions: state.suggestions,
    activeSuggestions: state.activeSuggestions,
    activeLinks: state.activeLinks,
    activeBacklinks: state.activeBacklinks,
    vaultPath: state.vaultPath,
    isDesktop: state.isTauri,
    saveStatus: state.saveStatus,
    lastSaveError: state.lastSaveError,
    lastImportFailed: state.lastImportFailed,
    theme: state.theme,
    // reads
    memonicsBySubject: state.memonicsBySubject,
    linkCount: state.linkCount,
    // writes
    load,
    select: actions.select,
    create: actions.create,
    editField: actions.editField,
    setTags: actions.setTags,
    remove: actions.remove,
    link: actions.link,
    unlink: actions.unlink,
    renameLink: actions.renameLink,
    locateCard: persistence.locateCard,
    setSubjectColor: settings.setSubjectColor,
    setTheme: settings.setTheme,
    toggleTheme: settings.toggleTheme,
    // vault I/O
    exportVault: actions.exportVault,
    importVault: selection.importVault,
    importVaultText: actions.importVaultText,
    clearImportFailure: actions.clearImportFailure,
    saveNow: persistence.saveNow,
    openVaultFolder: persistence.openVaultFolder,
    copyToClipboard: persistence.copyToClipboard,
    // settings/stats
    vaultStats: settings.vaultStats,
    estimateVaultBytes: settings.estimateVaultBytes,
    exportSettings: settings.exportSettings,
    importSettings: settings.importSettings,
    // bulk selection
    selectedSids: state.selectedSids,
    toggleSelected: selection.toggleSelected,
    clearSelected: selection.clearSelected,
    bulkMove: selection.bulkMove,
    bulkDelete: selection.bulkDelete,
    copySelection: selection.copySelection,
    exportSelection: selection.exportSelection,
    openCardFile: selection.openCardFile,
    // spaced repetition / active recall / sustained learning loop
    studyRecords: study.studyRecords,
    dueCards: study.dueCards,
    studyStats: study.studyStats,
    sustainedMetrics: study.sustainedMetrics,
    getReviewRecord: study.getReviewRecord,
    getCardMemoryState: study.getCardMemoryState,
    isCardDue: study.isCardDue,
    recordReview: study.recordReview,
    previewIntervals: study.previewIntervals,
    formatInterval: study.formatInterval,
    getDeepRoots: study.getDeepRoots,
    setDeepRoots: study.setDeepRoots,
    cardDepthLevel: study.cardDepthLevel,
    cardCrossBridgeCount: study.cardCrossBridgeCount,
  };
}
