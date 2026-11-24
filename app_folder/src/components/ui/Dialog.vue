<script setup lang="ts">
// Crisp native desktop modal container — solid surface, hairline border, Escape to close.
import { onBeforeUnmount, onMounted } from "vue";

const props = withDefaults(defineProps<{ open?: boolean; width?: string }>(), {
  open: false,
  width: "640px",
});
const emit = defineEmits<{ close: [] }>();

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape" && props.open) {
    e.stopPropagation();
    emit("close");
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dlg-backdrop" @click.self="emit('close')">
      <div
        class="dlg-surface rkz-scroll"
        role="dialog"
        aria-modal="true"
        :style="{ width }"
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dlg-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--backdrop);
  backdrop-filter: blur(2px);
  padding: 20px;
}

.dlg-surface {
  max-width: 92vw;
  max-height: 88vh;
  overflow: auto;
  background-color: var(--bg-overlay);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}
</style>
