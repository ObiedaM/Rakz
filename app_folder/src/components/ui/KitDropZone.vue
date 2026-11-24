<script setup lang="ts">
// Drag-drop zone for .mns / .rkz vaults & curated subject kits.
import { ref } from "vue";
import { useLibrary } from "@/composables/library";
import Icon from "@/components/ui/Icon.vue";

const { importVaultText } = useLibrary();
const over = ref(false);
const status = ref<{ ok: boolean; text: string } | null>(null);

function handleFile(file: File | null | undefined): void {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const ok = importVaultText(String(reader.result));
    status.value = ok
      ? { ok: true, text: `Imported "${file.name}" into vault.` }
      : { ok: false, text: `"${file.name}" is not a valid RAKZ file (.mns or .rkz).` };
  };
  reader.readAsText(file);
}

function onDrop(e: DragEvent): void {
  e.preventDefault();
  over.value = false;
  handleFile(e.dataTransfer?.files?.[0]);
}
</script>

<template>
  <div>
    <div
      class="drop-zone select-none"
      :class="{ 'is-over': over }"
      @dragover.prevent="over = true"
      @dragleave="over = false"
      @drop="onDrop"
    >
      <Icon name="upload" :size="18" class="drop-icon" />
      <div class="drop-title">
        Drop a <code class="font-mono-meta">.mns</code> or <code class="font-mono-meta">.rkz</code> study kit here
      </div>
      <div class="drop-sub">or use Import Vault below</div>
    </div>

    <p v-if="status" class="drop-status" :class="status.ok ? 'is-ok' : 'is-err'">
      <Icon :name="status.ok ? 'check' : 'alert'" :size="13" />
      <span>{{ status.text }}</span>
    </p>
  </div>
</template>

<style scoped>
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 20px 16px;
  border-radius: var(--radius-md);
  border: 1.5px dashed var(--border-strong);
  background-color: var(--bg-input);
  text-align: center;
  transition: border-color var(--ease-fast), background-color var(--ease-fast);
}

.drop-zone.is-over {
  border-color: var(--accent);
  background-color: var(--accent-subtle);
}

.drop-icon {
  color: var(--text-muted);
}

.drop-zone.is-over .drop-icon {
  color: var(--accent);
}

.drop-title {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.drop-sub {
  font-size: 11.5px;
  color: var(--text-muted);
}

.drop-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  font-size: 12px;
}

.drop-status.is-ok {
  color: var(--ok);
}

.drop-status.is-err {
  color: var(--danger);
}
</style>
