import { defineConfig } from "tsup";

export default defineConfig({
  // Object form pins each entry to a flat output path. The previous array form
  // (["src/index.ts", "cli/bin.ts"]) preserved source paths in dist/, so the
  // build emitted dist/src/index.js and dist/cli/bin.js — but package.json
  // declares main:"./dist/index.js" and bin:"./dist/cli/bin.js", so every
  // `npm install @agento-nexus/sdk` followed by `import` resolved to a path
  // that didn't exist and threw ERR_MODULE_NOT_FOUND on the first line.
  // See PR description for the npm-side trace.
  entry: {
    index: "src/index.ts",
    "cli/bin": "cli/bin.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  splitting: true,
});
