<script setup lang="ts">
// Vault explorer — mirrors the on-disk .mns tree.
// Zero decorative emojis; hover-reveal actions; Escape-cancellable context menu & arm→confirm delete.

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useLibrary } from "@/composables/library";
import type { CardLocation, Memonic } from "@/composables/library";
import Icon from "@/components/ui/Icon.vue";

interface TreeNode {
  path: string;
  cards: Memonic[];
  children: Map<string, TreeNode>;
}

interface CardMenu {
  x: number;
  y: number;
  sid: number;
  title: string;
  loc: CardLocation | null;
  confirmDel: boolean;
}

type ExplorerRow =
  | { type: "folder"; key: string; name: string; depth: number; count: number }
  | { type: "file"; key: string; name: string; node: TreeNode; depth: number; count: number; color: string }
  | { type: "subject"; key: string; id: string; depth: number; count: number; color: string }
  | { type: "card"; key: string; m: Memonic; depth: number };

const props = defineProps<{ query?: string }>();
const emit = defineEmits<{ "clear-query": []; "card-opened": [] }>();

const {
  memonics,
  subjects,
  activeSid,
  select,
  create,
  remove,
  locateCard,
  openVaultFolder,
  isDesktop,
  selectedSids,
  toggleSelected,
  openCardFile,
  isCardDue,
} = useLibrary();

const collapsed = ref<Record<string, boolean>>({});
const menu = ref<CardMenu | null>(null);
let menuConfirmTimer: ReturnType<typeof setTimeout> | null = null;

function onRowClick(e: MouseEvent, m: Memonic): void {
  if (e.ctrlKey || e.metaKey) {
    toggleSelected(m.sid);
  } else {
    select(m.sid);
    emit("card-opened");
  }
}

function toggle(key: string): void {
  collapsed.value = { ...collapsed.value, [key]: !collapsed.value[key] };
}

function openMenu(e: MouseEvent, m: Memonic): void {
  clearTimeout(menuConfirmTimer ?? undefined);
  menu.value = {
    x: Math.max(8, Math.min(e.clientX, window.innerWidth - 252)),
    y: Math.max(8, Math.min(e.clientY, window.innerHeight - 210)),
    sid: m.sid,
    title: m.title,
    loc: locateCard(m.sid),
    confirmDel: false,
  };
}

function closeMenu(): void {
  clearTimeout(menuConfirmTimer ?? undefined);
  menu.value = null;
}

function menuOpenCard(): void {
  if (!menu.value) return;
  select(menu.value.sid);
  emit("card-opened");
  closeMenu();
}

function menuToggleSelect(): void {
  if (!menu.value) return;
  toggleSelected(menu.value.sid);
  closeMenu();
}

async function menuOpenFile(): Promise<void> {
  if (!menu.value) return;
  const sid = menu.value.sid;
  closeMenu();
  await openCardFile(sid);
}

function menuReveal(): void {
  void openVaultFolder();
  closeMenu();
}

function menuDelete(): void {
  if (!menu.value) return;
  if (!menu.value.confirmDel) {
    menu.value = { ...menu.value, confirmDel: true };
    clearTimeout(menuConfirmTimer ?? undefined);
    menuConfirmTimer = setTimeout(() => {
      if (menu.value) menu.value = { ...menu.value, confirmDel: false };
    }, 3200);
    return;
  }
  const sid = menu.value.sid;
  closeMenu();
  remove(sid);
}

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape" && menu.value) {
    e.stopPropagation();
    if (menu.value.confirmDel) {
      menu.value = { ...menu.value, confirmDel: false };
    } else {
      closeMenu();
    }
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => {
  clearTimeout(menuConfirmTimer ?? undefined);
  window.removeEventListener("keydown", onKey);
});

const q = computed(() => (props.query ?? "").trim().toLowerCase());

function matches(m: Memonic): boolean {
  return !q.value || `${m.title} ${m.context} ${m.id} ${m.tags.join(" ")}`.toLowerCase().includes(q.value);
}

function colorOf(id: string): string {
  return subjects.value.find((s) => s.id === id)?.color ?? "var(--text-muted)";
}

function effPath(m: Memonic): string {
  return m.hierarchy || m.id || "vault";
}

const rows = computed(() => {
  const root = new Map<string, TreeNode>();
  for (const m of memonics.value) {
    let level = root;
    let path = "";
    const segs = effPath(m).split("/");
    let node: TreeNode | undefined;
    for (const seg of segs) {
      path = path ? `${path}/${seg}` : seg;
      if (!level.has(seg)) level.set(seg, { path, cards: [], children: new Map() });
      node = level.get(seg)!;
      level = node.children;
    }
    node!.cards.push(m);
  }

  const subtreeMatch = (node: TreeNode): boolean =>
    node.cards.some(matches) || [...node.children.values()].some(subtreeMatch);
  const subtreeCount = (node: TreeNode): number =>
    node.cards.length + [...node.children.values()].reduce((n, c) => n + subtreeCount(c), 0);

  const out: ExplorerRow[] = [];
  const pushFileContents = (node: TreeNode, depth: number) => {
    const cards = node.cards.filter(matches);
    const ids = [...new Set(node.cards.map((m) => m.id))];
    const seg = node.path.split("/").pop()!;
    if (ids.length === 1 && ids[0] === seg) {
      for (const m of cards) out.push({ type: "card", key: `c${m.sid}`, m, depth });
      return;
    }
    for (const id of ids) {
      const subjectCards = cards.filter((m) => m.id === id);
      if (q.value && !subjectCards.length) continue;
      const key = `S:${node.path}|${id}`;
      out.push({
        type: "subject",
        key,
        id,
        color: colorOf(id),
        depth,
        count: node.cards.filter((m) => m.id === id).length,
      });
      if (!q.value && collapsed.value[key]) continue;
      for (const m of subjectCards) out.push({ type: "card", key: `c${m.sid}`, m, depth: depth + 1 });
    }
  };

  const walk = (level: Map<string, TreeNode>, depth: number) => {
    for (const seg of [...level.keys()].sort((a, b) => a.localeCompare(b))) {
      const node = level.get(seg)!;
      if (q.value && !subtreeMatch(node)) continue;
      const isFolder = node.children.size > 0;
      if (isFolder) {
        const key = `f:${node.path}`;
        out.push({ type: "folder", key, name: seg, depth, count: subtreeCount(node) });
        if (!q.value && collapsed.value[key]) continue;
        if (node.cards.length) {
          const fkey = `d:${node.path}`;
          out.push({
            type: "file",
            key: fkey,
            name: seg,
            node,
            depth: depth + 1,
            count: node.cards.length,
            color: colorOf(node.cards[0]!.id),
          });
          if (q.value || !collapsed.value[fkey]) pushFileContents(node, depth + 2);
        }
        walk(node.children, depth + 1);
      } else {
        const key = `d:${node.path}`;
        out.push({
          type: "file",
          key,
          name: seg,
          node,
          depth,
          count: node.cards.length,
          color: colorOf(node.cards[0]?.id ?? ""),
        });
        if (q.value || !collapsed.value[key]) pushFileContents(node, depth + 1);
      }
    }
  };
  walk(root, 0);
  return out;
});

function addToFile(node: TreeNode): void {
  const first = node.cards[0];
  if (first) {
    create(first.id, first.hierarchy || "");
    emit("card-opened");
  }
}
</script>

<template>
  <div class="tree-root" role="tree" aria-label="Vault explorer">
    <template v-if="rows.length > 0">
      <template v-for="row in rows" :key="row.key">
        <!-- Folder row -->
        <div
          v-if="row.type === 'folder'"
          role="treeitem"
          class="tree-row tree-group-row"
          :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
          @click="toggle(row.key)"
        >
          <Icon
            name="chevron-right"
            :size="12"
            class="chevron"
            :class="{ 'is-open': q || !collapsed[row.key] }"
          />
          <Icon name="folder" :size="13" class="folder-icon" />
          <span class="row-title is-folder">{{ row.name }}</span>
          <span class="row-count tabular">{{ row.count }}</span>
        </div>

        <!-- .mns file / subject root row -->
        <div
          v-else-if="row.type === 'file'"
          role="treeitem"
          class="tree-row tree-group-row"
          :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
          @click="toggle(row.key)"
        >
          <Icon
            name="chevron-right"
            :size="12"
            class="chevron"
            :class="{ 'is-open': q || !collapsed[row.key] }"
          />
          <span class="subj-swatch" :style="{ backgroundColor: row.color }" />
          <span class="row-title is-file">{{ row.name }}</span>
          <span class="row-count tabular">{{ row.count }}</span>
          <button
            type="button"
            title="New mnemonic in this subject"
            aria-label="New mnemonic in this subject"
            class="row-add-btn"
            @click.stop="addToFile(row.node)"
          >
            <Icon name="plus" :size="12" />
          </button>
        </div>

        <!-- Mixed-file subject row -->
        <div
          v-else-if="row.type === 'subject'"
          role="treeitem"
          class="tree-row tree-group-row"
          :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
          @click="toggle(row.key)"
        >
          <Icon
            name="chevron-right"
            :size="11"
            class="chevron"
            :class="{ 'is-open': q || !collapsed[row.key] }"
          />
          <span class="subj-dot" :style="{ backgroundColor: row.color }" />
          <span class="row-title is-subject">{{ row.id }}</span>
          <span class="row-count tabular">{{ row.count }}</span>
        </div>

        <!-- Mnemonic card row -->
        <div
          v-else
          role="treeitem"
          tabindex="0"
          class="tree-row tree-card-row"
          :class="{
            'is-active': row.m.sid === activeSid,
            'is-selected': selectedSids.includes(row.m.sid),
          }"
          :style="{ paddingLeft: `${16 + row.depth * 14}px` }"
          @click="onRowClick($event, row.m)"
          @keydown.enter.prevent="select(row.m.sid); emit('card-opened')"
          @contextmenu.prevent="openMenu($event, row.m)"
        >
          <span v-if="selectedSids.includes(row.m.sid)" class="bulk-check" aria-hidden="true">
            <Icon name="check" :size="11" />
          </span>
          <span dir="auto" class="card-label">{{ row.m.title || "Untitled mnemonic" }}</span>
          <span
            v-if="isCardDue(row.m)"
            class="due-dot"
            title="Due for active recall review"
          />
        </div>
      </template>
    </template>

    <!-- Search empty state -->
    <div v-else class="tree-empty">
      <p class="empty-msg">
        {{ q ? `No matches for "${props.query}"` : "No mnemonics yet." }}
      </p>
      <button v-if="q" type="button" class="rkz-btn" @click="emit('clear-query')">
        Clear search
      </button>
    </div>

    <!-- Context menu -->
    <Teleport to="body">
      <template v-if="menu">
        <div class="ctx-backdrop" @click="closeMenu" @contextmenu.prevent="closeMenu" />
        <div
          class="ctx-menu select-none"
          role="menu"
          :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
        >
          <div class="ctx-title">{{ menu.title || "Untitled mnemonic" }}</div>

          <button type="button" role="menuitem" class="ctx-item" @click="menuOpenCard">
            <Icon name="stack" :size="13" />
            <span>Open card</span>
          </button>

          <button type="button" role="menuitem" class="ctx-item" @click="menuToggleSelect">
            <Icon name="check" :size="13" />
            <span>{{ selectedSids.includes(menu.sid) ? "Remove from selection" : "Select for bulk action" }}</span>
          </button>

          <div v-if="menu.loc" class="ctx-divider" />
          <div v-if="menu.loc" class="ctx-loc font-mono-meta">
            <Icon name="file" :size="12" />
            <span>{{ menu.loc.file }}:{{ menu.loc.line }}</span>
          </div>

          <button
            v-if="isDesktop && menu.loc"
            type="button"
            role="menuitem"
            class="ctx-item"
            @click="menuOpenFile"
          >
            <Icon name="external" :size="13" />
            <span>Open .mns file</span>
          </button>

          <button
            v-if="isDesktop"
            type="button"
            role="menuitem"
            class="ctx-item"
            @click="menuReveal"
          >
            <Icon name="folder" :size="13" />
            <span>Reveal vault folder</span>
          </button>

          <div class="ctx-divider" />

          <button
            type="button"
            role="menuitem"
            class="ctx-item ctx-danger"
            :class="{ 'is-armed': menu.confirmDel }"
            @click.stop="menuDelete"
          >
            <Icon :name="menu.confirmDel ? 'alert' : 'trash'" :size="13" />
            <span>{{ menu.confirmDel ? "Confirm delete? (Esc cancels)" : "Delete card" }}</span>
          </button>
        </div>
      </template>
    </Teleport>
  </div>
</template>

<style scoped>
.tree-root {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0 6px;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding-right: 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast);
}

.tree-row:hover {
  background-color: var(--bg-hover);
}

.chevron {
  color: var(--text-muted);
  transition: transform var(--ease-fast);
  flex-shrink: 0;
}

.chevron.is-open {
  transform: rotate(90deg);
}

.folder-icon {
  color: var(--text-muted);
}

.subj-swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

.subj-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}

.row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-title.is-folder {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.row-title.is-file {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.row-title.is-subject {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.row-count {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.row-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--ease-fast), background-color var(--ease-fast), color var(--ease-fast);
}

.tree-group-row:hover .row-add-btn,
.row-add-btn:focus-visible {
  opacity: 1;
}

.row-add-btn:hover {
  background-color: var(--bg-active);
  color: var(--text-primary);
}

.tree-card-row {
  position: relative;
  border-left: 2px solid transparent;
  color: var(--text-secondary);
}

.tree-card-row.is-active {
  background-color: var(--bg-active);
  border-left-color: var(--accent);
  color: var(--text-primary);
  font-weight: 500;
}

.tree-card-row.is-selected {
  background-color: var(--accent-subtle);
  color: var(--text-primary);
}

.bulk-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 4px;
  background-color: var(--accent);
  color: var(--accent-fg);
  flex-shrink: 0;
}

.card-label {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.due-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background-color: var(--bridge);
  opacity: 0.75;
  flex-shrink: 0;
}

.tree-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 12px;
  text-align: center;
}

.empty-msg {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
}

.ctx-menu {
  position: fixed;
  z-index: 2001;
  min-width: 228px;
  padding: 5px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background-color: var(--bg-overlay);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ctx-title {
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ctx-loc {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 10.5px;
  color: var(--text-muted);
}

.ctx-divider {
  height: 1px;
  margin: 3px 4px;
  background-color: var(--border-subtle);
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast);
}

.ctx-item:hover {
  background-color: var(--bg-hover);
}

.ctx-danger {
  color: var(--danger);
}

.ctx-danger:hover {
  background-color: var(--danger-subtle);
}

.ctx-danger.is-armed {
  background-color: var(--danger-solid);
  color: var(--danger-fg);
  font-weight: 600;
}
</style>
