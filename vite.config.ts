import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig(async ({ command }) => {
  const plugins = [
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    react(),
  ];

  // Add Cloudflare Workers plugin only when NOT building for Vercel.
  // Vercel sets process.env.VERCEL=1 in its build environment.
  // scripts/build-vercel.mjs also sets VERCEL=1 for local Vercel builds.
  const isVercel = !!process.env.VERCEL;
  if (command === "build" && !isVercel) {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(cloudflare({ viteEnvironment: { name: "ssr" } }));
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
  };
});
