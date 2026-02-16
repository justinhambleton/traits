<template>
  <DefaultTheme.Layout>
    <template v-if="isLanding" #home-hero-before>
      <LandingPage />
    </template>
    <template v-if="!isLanding" #aside-outline-before>
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

<style>
.is-home .VPHome {
  margin-bottom: 0 !important;
  padding-bottom: 0 !important;
}

.is-home .VPHomeHero,
.is-home .VPHomeFeatures {
  display: none;
}

.is-home .VPContent.has-sidebar {
  padding-left: 0 !important;
  padding-right: 0 !important;
}
</style>
