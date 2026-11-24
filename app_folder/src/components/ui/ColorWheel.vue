<script setup lang="ts">
// HSV color wheel (hue ring + value slider) used in Appearance settings.
import { computed, ref, watch } from "vue";
import { hexToHsv, hsvToHex } from "@/lib/utils";

const SIZE = 152;
const R = SIZE / 2;

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [hex: string] }>();

const initial = hexToHsv(props.modelValue);
const h = ref(initial.h);
const s = ref(initial.s);
const v = ref(initial.v);
let dragging = false;

watch(
  () => props.modelValue,
  (hex) => {
    const c = hexToHsv(hex);
    h.value = c.h;
    s.value = c.s;
    v.value = c.v;
  },
);

const hex = computed(() => hsvToHex(h.value, s.value, v.value));

function commit(): void {
  emit("update:modelValue", hex.value);
}

function pick(e: MouseEvent): void {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX - rect.left - R;
  const y = e.clientY - rect.top - R;
  const dist = Math.min(Math.sqrt(x * x + y * y), R);
  h.value = (Math.atan2(y, x) * 180) / Math.PI;
  if (h.value < 0) h.value += 360;
  s.value = dist / R;
  commit();
}

function onDown(e: MouseEvent): void {
  dragging = true;
  pick(e);
  const mu = () => {
    dragging = false;
    window.removeEventListener("mouseup", mu);
  };
  window.addEventListener("mouseup", mu);
}

function onMove(e: MouseEvent): void {
  if (dragging) pick(e);
}

const dotStyle = computed(() => {
  const rad = (h.value * Math.PI) / 180;
  return {
    left: `${R + Math.cos(rad) * s.value * R - 7}px`,
    top: `${R + Math.sin(rad) * s.value * R - 7}px`,
  };
});
</script>

<template>
  <div class="wheel-wrap select-none">
    <div
      class="wheel-disc"
      :style="{
        width: `${SIZE}px`,
        height: `${SIZE}px`,
        filter: `brightness(${0.4 + v * 0.6})`,
      }"
      @mousedown="onDown"
      @mousemove="onMove"
    >
      <div class="wheel-dot" :style="dotStyle" />
    </div>

    <div class="wheel-meta">
      <input
        type="range"
        min="0"
        max="100"
        :value="Math.round(v * 100)"
        aria-label="Color brightness"
        class="wheel-slider"
        :style="{ accentColor: hex }"
        @input="
          v = Number(($event.target as HTMLInputElement).value) / 100;
          commit();
        "
      />
      <div class="hex-readout">
        <span class="hex-swatch" :style="{ backgroundColor: hex }" />
        <span class="hex-code font-mono-meta">{{ hex.toUpperCase() }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wheel-wrap {
  display: flex;
  align-items: center;
  gap: 18px;
}

.wheel-disc {
  position: relative;
  border-radius: 999px;
  cursor: crosshair;
  border: 1px solid var(--border-default);
  background: radial-gradient(circle, #fff 0%, transparent 70%),
    conic-gradient(from 90deg, red, yellow, lime, cyan, blue, magenta, red);
  flex-shrink: 0;
}

.wheel-dot {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid #ffffff;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.wheel-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.wheel-slider {
  width: 100%;
  max-width: 170px;
}

.hex-readout {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hex-swatch {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-default);
}

.hex-code {
  font-size: 12.5px;
  color: var(--text-primary);
}
</style>
