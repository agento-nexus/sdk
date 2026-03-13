import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "cli/bin.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  splitting: true,
});
