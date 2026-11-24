<script setup lang="ts">
// Precision 1px hairline panel splitter inside a comfortable 6px pointer target.
import { ref } from "vue";

const props = withDefaults(defineProps<{ scale?: number }>(), { scale: 1 });
const emit = defineEmits<{ resize: [delta: number] }>();

const active = ref(false);

function onDown(e: MouseEvent): void {
  e.preventDefault();
  active.value = true;
  let prev = e.clientX;
  const mm = (ev: MouseEvent) => {
    emit("resize", (ev.clientX - prev) / props.scale);
    prev = ev.clientX;
  };
  const mu = () => {
    active.value = false;
    window.removeEventListener("mousemove", mm);
    window.removeEventListener("mouseup", mu);
  };
  window.addEventListener("mousemove", mm);
  window.addEventListener("mouseup", mu);
}
</script>

<template>
  <div
    class="resizer"
    :class="{ 'is-active': active }"
    role="separator"
    aria-orientation="vertical"
    @mousedown="onDown"
  >
    <div class="resizer-line" />
  </div>
</template>

<style scoped>
.resizer {
  position: relative;
  width: 5px;
  height: 100%;
  flex-shrink: 0;
  cursor: col-resize;
  display: flex;
  align-items: stretch;
  justify-content: center;
  margin: 0 -2px;
  z-index: 10;
}

.resizer-line {
  width: 1px;
  height: 100%;
  background-color: var(--border-subtle);
  transition: background-color var(--ease-fast), width var(--ease-fast);
}

.resizer:hover .resizer-line,
.resizer.is-active .resizer-line {
  width: 2px;
  background-color: var(--accent);
}
</style>
