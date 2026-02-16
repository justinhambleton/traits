<template>
  <LandingPage v-if="isLanding" />
  <DefaultTheme.Layout v-else>
    <template #aside-outline-before>
      <CopyMarkdownButton />
    </template>
  </DefaultTheme.Layout>
</template>

<script setup>
import { computed } from "vue";
import { useData } from "vitepress";
import DefaultTheme from "vitepress/theme";
import LandingPage from "../../site/components/LandingPage.vue";
import CopyMarkdownButton from "../../site/components/CopyMarkdownButton.vue";

const { page } = useData();
const isLanding = computed(() => page.value.relativePath === "index.md");
</script>
