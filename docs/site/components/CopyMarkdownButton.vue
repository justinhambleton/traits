<template>
  <button
    v-if="rawMarkdown"
    class="copy-md-pill"
    type="button"
    @click="copyMarkdown"
  >
    {{ copied ? "Copied!" : "Copy as Markdown" }}
  </button>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useData } from "vitepress";

const { page } = useData();
const copied = ref(false);

const rawMarkdown = computed(() => {
  const b64 = page.value.rawMarkdownB64;
  if (!b64) return "";
  try { return atob(b64); } catch { return ""; }
});

watch(() => page.value.relativePath, () => {
  copied.value = false;
});

async function copyMarkdown() {
  if (!rawMarkdown.value) return;
  try {
    await navigator.clipboard.writeText(rawMarkdown.value);
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 1600);
  } catch {
    copied.value = false;
  }
}
</script>

<style scoped>
.copy-md-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  justify-content: center;
  margin-bottom: 12px;
  padding: 6px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 0;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  white-space: nowrap;
}

.copy-md-pill:hover {
  border-color: #2563eb;
  color: #2563eb;
}

:global(.dark) .copy-md-pill:hover {
  border-color: #60a5fa;
  color: #60a5fa;
}
</style>
