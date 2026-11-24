<script setup lang="ts">
// Interactive Knowledge Graph — theme-aware Canvas force simulation with:
// • Cross-subject bridge highlighting (terracotta) vs same-subject edges
// • Hover neighborhood spotlight (dims unrelated nodes)
// • Idle-sleep render loop (zero battery/CPU drain once settled)
// • Tag filter integration, zoom-to-fit, reactive grab cursor, double-click open

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useLibrary } from "@/composables/library";
import Icon from "@/components/ui/Icon.vue";

interface Node {
  sid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Edge {
  a: number;
  b: number;
  t: string;
  cross: boolean;
}

interface WorldPoint {
  x: number;
  y: number;
}

const props = withDefaults(defineProps<{ filterTag?: string }>(), { filterTag: "" });
const emit = defineEmits<{ "open-stack": [] }>();

const { memonics, subjects, activeSid, select, selectedSids, toggleSelected, theme } = useLibrary();

const wrapEl = ref<HTMLDivElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

const panelOpen = ref(false);
const showLabels = ref(true);
const showEdgeLabels = ref(true);
const running = ref(true);
const repulsion = ref(1800);
const linkDist = ref(165);
const isDragging = ref(false);
const hoveredSid = ref<number | null>(null);

const nodes = new Map<number, Node>();
let edges: Edge[] = [];
const view = { x: 0, y: 0, k: 1 };
let ctx: CanvasRenderingContext2D | null = null;
let W = 0;
let H = 0;
let dpr = 1;
let raf = 0;
let dragging: Node | null = null;
let panning: { sx: number; sy: number; ox: number; oy: number } | null = null;
let downAt: { x: number; y: number } | null = null;
let ro: ResizeObserver | null = null;
let settledFrames = 0;

const filteredCards = computed(() => {
  const f = props.filterTag.trim().toLowerCase().replace(/^#/, "");
  if (!f) return memonics.value;
  return memonics.value.filter((m) => m.tags.some((t) => t.toLowerCase().includes(f)));
});

const hoveredCard = computed(() =>
  hoveredSid.value != null ? memonics.value.find((m) => m.sid === hoveredSid.value) ?? null : null,
);

const crossBridgeCount = computed(() => edges.filter((e) => e.cross).length);

function readPalette() {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--bg-root", "#111214"),
    gridDot: v("--border-subtle", "#23262e"),
    edgeSame: v("--border-strong", "#3f4554"),
    edgeCross: v("--bridge", "#e07a5f"),
    accent: v("--accent", "#5b82f6"),
    label: v("--text-primary", "#eff1f5"),
    labelMuted: v("--text-secondary", "#a6acb9"),
    pillBg: v("--bg-surface", "#1b1d22"),
  };
}

let palette = {
  bg: "#111214",
  gridDot: "#23262e",
  edgeSame: "#3f4554",
  edgeCross: "#e07a5f",
  accent: "#5b82f6",
  label: "#eff1f5",
  labelMuted: "#6e7485",
  pillBg: "#1b1d22",
};

function colorOf(id: string): string {
  return subjects.value.find((s) => s.id === id)?.color ?? palette.accent;
}

function wake(): void {
  settledFrames = 0;
  if (!raf && ctx) {
    raf = requestAnimationFrame(loop);
  }
}

function syncData(): void {
  const cards = filteredCards.value;
  const bySid = new Map(cards.map((m) => [m.sid, m]));
  const seen = new Set<number>();
  const N = cards.length || 1;
  cards.forEach((m, i) => {
    seen.add(m.sid);
    if (!nodes.has(m.sid)) {
      const a = (i / N) * Math.PI * 2;
      const r = 70 + (i % 6) * 32;
      nodes.set(m.sid, { sid: m.sid, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0 });
    }
  });
  for (const sid of [...nodes.keys()]) {
    if (!seen.has(sid)) nodes.delete(sid);
  }
  edges = [];
  for (const m of cards) {
    for (const l of m.links) {
      const target = bySid.get(l.targetSID);
      if (target) {
        edges.push({ a: m.sid, b: l.targetSID, t: l.title, cross: target.id !== m.id });
      }
    }
  }
  wake();
}

watch([filteredCards, subjects], syncData, { immediate: true });
watch([theme, activeSid, selectedSids, showLabels, showEdgeLabels, running, repulsion, linkDist], async () => {
  await nextTick();
  if (typeof document !== "undefined") palette = readPalette();
  draw();
  wake();
});

function degreeOf(sid: number): number {
  let n = 0;
  for (const e of edges) if (e.a === sid || e.b === sid) n++;
  return n;
}

function radiusOf(sid: number): number {
  return 6 + Math.min(degreeOf(sid) * 1.8, 10);
}

function rescatter(): void {
  const N = nodes.size || 1;
  let i = 0;
  for (const n of nodes.values()) {
    const a = (i++ / N) * Math.PI * 2;
    const r = 65 + Math.random() * 160;
    n.x = Math.cos(a) * r;
    n.y = Math.sin(a) * r;
    n.vx = 0;
    n.vy = 0;
  }
  wake();
}

function fitToView(): void {
  if (!nodes.size || !W || !H) {
    view.x = 0;
    view.y = 0;
    view.k = 1;
    wake();
    return;
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes.values()) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  const spanX = Math.max(140, maxX - minX + 120);
  const spanY = Math.max(140, maxY - minY + 120);
  view.k = Math.max(0.35, Math.min(1.6, Math.min(W / spanX, H / spanY) * 0.85));
  view.x = -((minX + maxX) / 2) * view.k;
  view.y = -((minY + maxY) / 2) * view.k;
  wake();
}

function zoomBy(factor: number): void {
  view.k = Math.min(3, Math.max(0.25, view.k * factor));
  wake();
}

function step(): number {
  const ns = [...nodes.values()];
  for (let i = 0; i < ns.length; i++) {
    for (let j = i + 1; j < ns.length; j++) {
      const A = ns[i]!;
      const B = ns[j]!;
      let dx = B.x - A.x;
      let dy = B.y - A.y;
      const d2 = dx * dx + dy * dy || 1;
      const d = Math.sqrt(d2);
      const f = repulsion.value / d2;
      dx /= d;
      dy /= d;
      A.vx -= dx * f;
      A.vy -= dy * f;
      B.vx += dx * f;
      B.vy += dy * f;
    }
  }
  for (const e of edges) {
    const A = nodes.get(e.a);
    const B = nodes.get(e.b);
    if (!A || !B) continue;
    let dx = B.x - A.x;
    let dy = B.y - A.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - linkDist.value) * 0.024;
    dx /= d;
    dy /= d;
    A.vx += dx * f;
    A.vy += dy * f;
    B.vx -= dx * f;
    B.vy -= dy * f;
  }
  let energy = 0;
  for (const n of ns) {
    n.vx -= n.x * 0.0045;
    n.vy -= n.y * 0.0045;
    n.vx *= 0.84;
    n.vy *= 0.84;
    if (dragging?.sid !== n.sid) {
      n.x += n.vx;
      n.y += n.vy;
    }
    energy += Math.abs(n.vx) + Math.abs(n.vy);
  }
  return energy;
}

function draw(): void {
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle architectural dot grid
  const spacing = 28 * view.k;
  if (spacing >= 12) {
    ctx.fillStyle = palette.gridDot;
    const ox = ((W / 2 + view.x) % spacing + spacing) % spacing;
    const oy = ((H / 2 + view.y) % spacing + spacing) % spacing;
    for (let x = ox; x < W; x += spacing) {
      for (let y = oy; y < H; y += spacing) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  ctx.save();
  ctx.translate(W / 2 + view.x, H / 2 + view.y);
  ctx.scale(view.k, view.k);

  const focusSid = hoveredSid.value;
  const neighbors = new Set<number>();
  if (focusSid != null) {
    neighbors.add(focusSid);
    for (const e of edges) {
      if (e.a === focusSid) neighbors.add(e.b);
      if (e.b === focusSid) neighbors.add(e.a);
    }
  }

  // 1. Edges
  for (const e of edges) {
    const A = nodes.get(e.a);
    const B = nodes.get(e.b);
    if (!A || !B) continue;
    const focused = focusSid == null || e.a === focusSid || e.b === focusSid;
    ctx.save();
    ctx.globalAlpha = focused ? (e.cross ? 0.9 : 0.65) : 0.14;
    ctx.strokeStyle = e.cross ? palette.edgeCross : palette.edgeSame;
    ctx.lineWidth = (e.cross ? 1.8 : 1.1) / view.k;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();

    if (showEdgeLabels.value && focused) {
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      ctx.font = `500 ${10 / view.k}px "Cascadia Mono", Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = `#${e.t}`;
      const padX = 5 / view.k;
      const padY = 2.5 / view.k;
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = palette.pillBg;
      ctx.fillRect(mx - tw / 2 - padX, my - 6 / view.k - padY, tw + padX * 2, 12 / view.k + padY * 2);
      ctx.fillStyle = e.cross ? palette.edgeCross : palette.labelMuted;
      ctx.fillText(text, mx, my);
    }
    ctx.restore();
  }

  // 2. Nodes
  for (const m of filteredCards.value) {
    const n = nodes.get(m.sid);
    if (!n) continue;
    const r = radiusOf(m.sid);
    const focused = focusSid == null || neighbors.has(m.sid);
    ctx.save();
    ctx.globalAlpha = focused ? 1 : 0.22;

    if (m.sid === activeSid.value) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 4.5 / view.k, 0, Math.PI * 2);
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2 / view.k;
      ctx.stroke();
    }

    if (selectedSids.value.includes(m.sid)) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 8.5 / view.k, 0, Math.PI * 2);
      ctx.setLineDash([4 / view.k, 3 / view.k]);
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.4 / view.k;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = colorOf(m.id);
    ctx.fill();
    ctx.restore();
  }

  // 3. Node Labels
  if (showLabels.value) {
    ctx.font = `500 ${11.5 / view.k}px "Segoe UI Variable", "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const m of filteredCards.value) {
      const n = nodes.get(m.sid);
      if (!n) continue;
      const focused = focusSid == null || neighbors.has(m.sid);
      ctx.save();
      ctx.globalAlpha = focused ? 0.95 : 0.2;
      ctx.fillStyle = m.sid === activeSid.value ? palette.label : palette.labelMuted;
      const title = m.title.length > 38 ? `${m.title.slice(0, 37)}…` : m.title || "Untitled";
      ctx.fillText(title, n.x, n.y + radiusOf(m.sid) + 8 / view.k);
      ctx.restore();
    }
  }

  ctx.restore();
}

function loop(): void {
  raf = 0;
  let energy = 0;
  if (running.value) energy = step();
  draw();
  const stillMoving = running.value && (energy > 0.15 || dragging !== null);
  if (stillMoving || panning !== null) {
    settledFrames = 0;
    raf = requestAnimationFrame(loop);
  } else if (settledFrames < 10) {
    settledFrames++;
    raf = requestAnimationFrame(loop);
  }
}

function resize(): void {
  if (!wrapEl.value || !canvasEl.value) return;
  W = wrapEl.value.clientWidth;
  H = wrapEl.value.clientHeight;
  dpr = window.devicePixelRatio || 1;
  canvasEl.value.width = W * dpr;
  canvasEl.value.height = H * dpr;
  canvasEl.value.style.width = `${W}px`;
  canvasEl.value.style.height = `${H}px`;
  draw();
  wake();
}

function toWorld(e: MouseEvent): WorldPoint {
  const rect = canvasEl.value!.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - W / 2 - view.x) / view.k,
    y: (e.clientY - rect.top - H / 2 - view.y) / view.k,
  };
}

function nodeAt(p: WorldPoint): Node | null {
  for (const m of [...filteredCards.value].reverse()) {
    const n = nodes.get(m.sid);
    if (!n) continue;
    const r = radiusOf(m.sid) + 5 / view.k;
    if ((p.x - n.x) ** 2 + (p.y - n.y) ** 2 <= r * r) return n;
  }
  return null;
}

function onDown(e: MouseEvent): void {
  const p = toWorld(e);
  downAt = { x: e.clientX, y: e.clientY };
  const n = nodeAt(p);
  if (n) {
    dragging = n;
    isDragging.value = true;
  } else {
    panning = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
    isDragging.value = true;
  }
  wake();
}

function onMove(e: MouseEvent): void {
  const p = toWorld(e);
  if (dragging) {
    dragging.x = p.x;
    dragging.y = p.y;
    dragging.vx = 0;
    dragging.vy = 0;
    wake();
    return;
  }
  if (panning) {
    view.x = panning.ox + (e.clientX - panning.sx);
    view.y = panning.oy + (e.clientY - panning.sy);
    wake();
    return;
  }
  const hit = nodeAt(p);
  const nextHover = hit ? hit.sid : null;
  if (nextHover !== hoveredSid.value) {
    hoveredSid.value = nextHover;
    wake();
  }
}

function onUp(e: MouseEvent): void {
  const moved = downAt && Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y) > 4;
  if (dragging && !moved) {
    if (e.ctrlKey || e.metaKey) toggleSelected(dragging.sid);
    else select(dragging.sid);
  }
  dragging = null;
  panning = null;
  downAt = null;
  isDragging.value = false;
  wake();
}

function onDblClick(e: MouseEvent): void {
  const hit = nodeAt(toWorld(e));
  if (hit) {
    select(hit.sid);
    emit("open-stack");
  }
}

function onWheel(e: WheelEvent): void {
  zoomBy(e.deltaY < 0 ? 1.12 : 0.89);
}

onMounted(() => {
  ctx = canvasEl.value?.getContext("2d") ?? null;
  palette = readPalette();
  resize();
  ro = new ResizeObserver(resize);
  if (wrapEl.value) ro.observe(wrapEl.value);
  wake();
});

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf);
  ro?.disconnect();
});
</script>

<template>
  <div ref="wrapEl" class="graph-wrap select-none">
    <canvas
      ref="canvasEl"
      class="graph-canvas"
      :class="{ 'is-grabbing': isDragging, 'is-pointer': !isDragging && hoveredSid != null }"
      @mousedown="onDown"
      @mousemove="onMove"
      @mouseup="onUp"
      @mouseleave="hoveredSid = null; onUp($event)"
      @dblclick="onDblClick"
      @wheel.prevent="onWheel"
    />

    <!-- Legend / Stats pill top-left -->
    <div class="graph-legend tabular">
      <span>{{ filteredCards.length }} nodes</span>
      <span class="leg-sep">·</span>
      <span class="leg-bridge">
        <span class="leg-swatch" />
        {{ crossBridgeCount }} cross-subject {{ crossBridgeCount === 1 ? "bridge" : "bridges" }}
      </span>
    </div>

    <!-- Compact floating controls top-right -->
    <div class="graph-controls">
      <div class="ctrl-bar">
        <button type="button" class="ctrl-btn" title="Zoom in" @click="zoomBy(1.2)">+</button>
        <button type="button" class="ctrl-btn" title="Zoom out" @click="zoomBy(0.84)">−</button>
        <button type="button" class="ctrl-btn" title="Fit graph to view" @click="fitToView">
          <Icon name="target" :size="13" />
        </button>
        <button type="button" class="ctrl-btn" title="Re-scatter nodes" @click="rescatter">
          <Icon name="refresh" :size="13" />
        </button>
        <button
          type="button"
          class="ctrl-btn"
          :class="{ 'is-active': panelOpen }"
          title="Graph physics & display options"
          @click="panelOpen = !panelOpen"
        >
          <Icon name="sliders" :size="13" />
        </button>
      </div>

      <div v-if="panelOpen" class="ctrl-drawer">
        <label class="chk-row">
          <input v-model="showLabels" type="checkbox" />
          <span>Card titles</span>
        </label>
        <label class="chk-row">
          <input v-model="showEdgeLabels" type="checkbox" />
          <span>Bridge labels</span>
        </label>
        <label class="chk-row">
          <input v-model="running" type="checkbox" />
          <span>Force physics</span>
        </label>
        <label class="range-row">
          <span>Repulsion</span>
          <input v-model.number="repulsion" type="range" min="400" max="4000" step="100" />
        </label>
        <label class="range-row">
          <span>Link distance</span>
          <input v-model.number="linkDist" type="range" min="60" max="280" step="10" />
        </label>
      </div>
    </div>

    <!-- Hovered node preview chip bottom-left -->
    <div v-if="hoveredCard" class="hover-chip">
      <span class="hover-subj">{{ hoveredCard.id }}</span>
      <span class="hover-title">{{ hoveredCard.title }}</span>
      <span class="hover-hint">Double-click to open</span>
    </div>

    <!-- Empty State -->
    <div v-if="filteredCards.length === 0" class="graph-empty">
      <Icon name="graph" :size="24" />
      <p>No cards match this filter in Graph view.</p>
    </div>
  </div>
</template>

<style scoped>
.graph-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background-color: var(--bg-root);
}

.graph-canvas {
  position: absolute;
  inset: 0;
  display: block;
  cursor: grab;
}

.graph-canvas.is-grabbing {
  cursor: grabbing;
}

.graph-canvas.is-pointer {
  cursor: pointer;
}

.graph-legend {
  position: absolute;
  top: 12px;
  left: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 11.5px;
  box-shadow: var(--shadow-sm);
}

.leg-sep {
  opacity: 0.4;
}

.leg-bridge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--bridge);
  font-weight: 600;
}

.leg-swatch {
  width: 10px;
  height: 2px;
  border-radius: 2px;
  background-color: var(--bridge);
}

.graph-controls {
  position: absolute;
  top: 12px;
  right: 14px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.ctrl-bar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background-color: var(--bg-surface);
  box-shadow: var(--shadow-sm);
}

.ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast);
}

.ctrl-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.ctrl-btn.is-active {
  background-color: var(--accent-subtle);
  color: var(--accent);
}

.ctrl-drawer {
  width: 196px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background-color: var(--bg-overlay);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.chk-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
}

.chk-row input {
  accent-color: var(--accent);
}

.range-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
}

.range-row input {
  width: 100%;
  accent-color: var(--accent);
}

.hover-chip {
  position: absolute;
  left: 14px;
  bottom: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 420px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background-color: var(--bg-overlay);
  box-shadow: var(--shadow-md);
  font-size: 12px;
}

.hover-subj {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--accent);
}

.hover-title {
  color: var(--text-primary);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hover-hint {
  font-size: 10.5px;
  color: var(--text-muted);
  white-space: nowrap;
}

.graph-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
