import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync } from "fs";

function copyStaticFiles() {
  return {
    name: "copy-static-files",
    writeBundle() {
      const dist = resolve(__dirname, "dist");

      // Copy manifest.json
      copyFileSync(resolve(__dirname, "manifest.json"), resolve(dist, "manifest.json"));

      // Copy blocker.css
      copyFileSync(
        resolve(__dirname, "src/content/blocker.css"),
        resolve(dist, "blocker.css"),
      );

      // Create placeholder icons directory
      const iconsDir = resolve(dist, "icons");
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyStaticFiles()],
  base: "",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        background: resolve(__dirname, "src/background/service-worker.ts"),
        content: resolve(__dirname, "src/content/blocker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "[name][extname]",
      },
    },
    target: "chrome100",
    minify: false,
    sourcemap: true,
  },
  css: {
    postcss: "./postcss.config.js",
  },
});
