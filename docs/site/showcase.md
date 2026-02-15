---
title: Showcase
---

<script setup>
import { onMounted } from "vue";
import { useRouter } from "vitepress";

const router = useRouter();

onMounted(() => {
  router.go("/playground");
});
</script>

# Showcase moved

The showcase now lives at [Playground](/playground).
