<script setup lang="ts">
// Single consistent 1.5px-stroke SVG icon set — zero decorative emojis in UI chrome.
defineProps<{
  name:
    | "plus"
    | "folder-plus"
    | "folder"
    | "file"
    | "search"
    | "settings"
    | "stack"
    | "study"
    | "grid"
    | "graph"
    | "zen"
    | "sun"
    | "moon"
    | "link"
    | "unlink"
    | "arrow-right"
    | "arrow-left"
    | "chevron-right"
    | "chevron-down"
    | "sparkles"
    | "trash"
    | "check"
    | "x"
    | "copy"
    | "download"
    | "upload"
    | "external"
    | "refresh"
    | "sliders"
    | "eye"
    | "eye-off"
    | "bridge"
    | "keyboard"
    | "database"
    | "palette"
    | "info"
    | "target"
    | "alert";
  size?: number;
}>();
</script>

<template>
  <svg
    :width="size ?? 15"
    :height="size ?? 15"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
  >
    <template v-if="name === 'plus'">
      <path d="M8 3v10M3 8h10" />
    </template>
    <template v-else-if="name === 'folder-plus'">
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.7l1.3 1.5h5A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4.5Z" />
      <path d="M8 7v4M6 9h4" />
    </template>
    <template v-else-if="name === 'folder'">
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.7l1.3 1.5h5A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4.5Z" />
    </template>
    <template v-else-if="name === 'file'">
      <path d="M4 2.5h5.5L12.5 5.5v8a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" />
      <path d="M9.5 2.5v3h3" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="7.25" cy="7.25" r="4.25" />
      <path d="m10.5 10.5 3 3" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="8" cy="8" r="2.25" />
      <path d="M8 2v1.4M8 12.6V14M2 8h1.4M12.6 8H14M3.76 3.76l1 1M11.24 11.24l1 1M12.24 3.76l-1 1M4.76 11.24l-1 1" />
    </template>
    <template v-else-if="name === 'stack'">
      <rect x="2.5" y="3" width="11" height="7.5" rx="1.5" />
      <path d="M4.5 13h7" />
    </template>
    <template v-else-if="name === 'study'">
      <path d="M2.5 4.25c1.7-.7 3.8-.7 5.5.5 1.7-1.2 3.8-1.2 5.5-.5v8.25c-1.7-.7-3.8-.7-5.5.5-1.7-1.2-3.8-1.2-5.5-.5V4.25Z" />
      <path d="M8 4.75V13" />
    </template>
    <template v-else-if="name === 'grid'">
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </template>
    <template v-else-if="name === 'graph'">
      <circle cx="4" cy="4.5" r="1.75" />
      <circle cx="12" cy="4.5" r="1.75" />
      <circle cx="8" cy="12" r="1.75" />
      <path d="M5.5 5.4 7.1 10.4M10.5 5.4 8.9 10.4M5.8 4.5h4.4" />
    </template>
    <template v-else-if="name === 'zen'">
      <path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10" />
    </template>
    <template v-else-if="name === 'sun'">
      <circle cx="8" cy="8" r="2.75" />
      <path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M12.4 3.6l-1.05 1.05M4.65 11.35 3.6 12.4" />
    </template>
    <template v-else-if="name === 'moon'">
      <path d="M12.7 9.9A5.25 5.25 0 0 1 6.1 3.3a5.5 5.5 0 1 0 6.6 6.6Z" />
    </template>
    <template v-else-if="name === 'link'">
      <path d="M6.7 9.3a3 3 0 0 0 4.24 0l1.6-1.6a3 3 0 0 0-4.24-4.24l-.9.9" />
      <path d="M9.3 6.7a3 3 0 0 0-4.24 0l-1.6 1.6a3 3 0 1 0 4.24 4.24l.9-.9" />
    </template>
    <template v-else-if="name === 'unlink'">
      <path d="m10.5 5.5 2-2M3.5 12.5l2-2M6.2 3.2v1.6M3.2 6.2h1.6M9.8 11.2v1.6M11.2 9.8h1.6" />
      <path d="M5.5 7.5 4 9a2.5 2.5 0 0 0 3.5 3.5l1.5-1.5M10.5 8.5 12 7a2.5 2.5 0 0 0-3.5-3.5L7 5" />
    </template>
    <template v-else-if="name === 'arrow-right'">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </template>
    <template v-else-if="name === 'arrow-left'">
      <path d="M13 8H3M7 4 3 8l4 4" />
    </template>
    <template v-else-if="name === 'chevron-right'">
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="m3.5 6 4.5 4.5L12.5 6" />
    </template>
    <template v-else-if="name === 'sparkles'">
      <path d="M8 2.2 9.2 6l3.8 1.2L9.2 8.4 8 12.2 6.8 8.4 3 7.2 6.8 6 8 2.2Z" />
      <path d="M12.5 11.2v2.2M11.4 12.3h2.2" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.6 8.3a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8.3" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m3.2 8.4 3.1 3.1 6.5-6.8" />
    </template>
    <template v-else-if="name === 'x'">
      <path d="m4 4 8 8M12 4l-8 8" />
    </template>
    <template v-else-if="name === 'copy'">
      <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.2" />
      <path d="M10.5 5.5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h1.5" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M8 2.5v7.5M5 7.5 8 10.5l3-3M2.5 12.5h11" />
    </template>
    <template v-else-if="name === 'upload'">
      <path d="M8 10V2.5M5 5.5 8 2.5l3 3M2.5 12.5h11" />
    </template>
    <template v-else-if="name === 'external'">
      <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M6.5 3.5H4a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 4 13.5h7a1.5 1.5 0 0 0 1.5-1.5V9.5" />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M13 8a5 5 0 1 1-1.3-3.4M13 2.8v2.5h-2.5" />
    </template>
    <template v-else-if="name === 'sliders'">
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
      <circle cx="5.5" cy="4.5" r="1.2" fill="currentColor" />
      <circle cx="10.5" cy="8" r="1.2" fill="currentColor" />
      <circle cx="6.5" cy="11.5" r="1.2" fill="currentColor" />
    </template>
    <template v-else-if="name === 'eye'">
      <path d="M1.8 8s2.2-4 6.2-4 6.2 4 6.2 4-2.2 4-6.2 4-6.2-4-6.2-4Z" />
      <circle cx="8" cy="8" r="1.75" />
    </template>
    <template v-else-if="name === 'eye-off'">
      <path d="M2.5 2.5 13.5 13.5M6.7 6.7a1.75 1.75 0 0 0 2.6 2.6" />
      <path d="M4.2 4.9C2.7 6 1.8 8 1.8 8s2.2 4 6.2 4c1.2 0 2.3-.3 3.2-.9M12.4 10.6c1.1-1 1.8-2.6 1.8-2.6S12 4 8 4c-.6 0-1.2.1-1.7.2" />
    </template>
    <template v-else-if="name === 'bridge'">
      <path d="M2 11.5h12M3.5 11.5V7.5a4.5 4.5 0 0 1 9 0v4M6 11.5V9.2a2 2 0 0 1 4 0v2.3" />
    </template>
    <template v-else-if="name === 'keyboard'">
      <rect x="1.8" y="4" width="12.4" height="8" rx="1.5" />
      <path d="M4.5 6.8h.8M7.6 6.8h.8M10.7 6.8h.8M5 9.5h6" />
    </template>
    <template v-else-if="name === 'database'">
      <ellipse cx="8" cy="4" rx="5" ry="1.8" />
      <path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4" />
      <path d="M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" />
    </template>
    <template v-else-if="name === 'palette'">
      <path d="M8 2.2a5.8 5.8 0 1 0 0 11.6c1 0 1.4-.6 1.4-1.2 0-.4-.2-.7-.2-1.1 0-.6.5-1 1.1-1h1.3A2.4 2.4 0 0 0 14 8.1 5.9 5.9 0 0 0 8 2.2Z" />
      <circle cx="5.2" cy="7" r=".7" fill="currentColor" stroke="none" />
      <circle cx="7.4" cy="5.1" r=".7" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="6.1" r=".7" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'info'">
      <circle cx="8" cy="8" r="5.8" />
      <path d="M8 7.5v3.5M8 5.2v.1" />
    </template>
    <template v-else-if="name === 'target'">
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.5" />
    </template>
    <template v-else-if="name === 'alert'">
      <path d="M8 2.4 13.8 12.8H2.2L8 2.4Z" />
      <path d="M8 6.2v3M8 11v.1" />
    </template>
  </svg>
</template>
