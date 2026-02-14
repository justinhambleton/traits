import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin/traits.ts"],
  format: ["esm"],
  clean: true,
  splitting: false,
  sourcemap: false
});
