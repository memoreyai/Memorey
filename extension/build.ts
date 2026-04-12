import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(__dirname, "dist");
const isWatch = process.argv.includes("--watch");

mkdirSync(outdir, { recursive: true });

const sharedConfig: esbuild.BuildOptions = {
  bundle: true,
  platform: "browser",
  target: "chrome120",
  format: "esm",
  sourcemap: true,
  outdir,
  logLevel: "info",
};

async function build() {
  // Background service worker
  await esbuild.build({
    ...sharedConfig,
    entryPoints: [resolve(__dirname, "background.ts")],
    format: "iife",
  });

  // Content script
  await esbuild.build({
    ...sharedConfig,
    entryPoints: [resolve(__dirname, "content.ts")],
    format: "iife",
  });

  // Sidebar React app
  await esbuild.build({
    ...sharedConfig,
    entryPoints: [resolve(__dirname, "sidebar/index.tsx")],
    outfile: resolve(outdir, "sidebar/index.js"),
    outdir: undefined,
    format: "iife",
    loader: { ".tsx": "tsx", ".ts": "ts", ".css": "css" },
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });

  // Copy static assets to dist
  cpSync(
    resolve(__dirname, "sidebar/index.html"),
    resolve(outdir, "sidebar/index.html")
  );

  console.log("Build complete!");
}

async function watch() {
  const ctx = await esbuild.context({
    ...sharedConfig,
    entryPoints: [
      resolve(__dirname, "background.ts"),
      resolve(__dirname, "content.ts"),
    ],
    format: "iife",
  });

  const sidebarCtx = await esbuild.context({
    ...sharedConfig,
    entryPoints: [resolve(__dirname, "sidebar/index.tsx")],
    outfile: resolve(outdir, "sidebar/index.js"),
    outdir: undefined,
    format: "iife",
    loader: { ".tsx": "tsx", ".ts": "ts", ".css": "css" },
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });

  await ctx.watch();
  await sidebarCtx.watch();
  console.log("Watching for changes...");
}

if (isWatch) {
  watch();
} else {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
