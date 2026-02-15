---
title: Showcase
---

<script setup>
import { onMounted } from "vue";
import { useRouter, withBase } from "vitepress";

const router = useRouter();

onMounted(() => {
  router.go(withBase("/playground/"));
});
</script>

# Showcase moved

The showcase now lives at [Playground](/playground/).
