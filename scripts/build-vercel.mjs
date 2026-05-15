import { renameSync, existsSync } from "fs";
import { execSync } from "child_process";

// TanStack Start switches to Cloudflare Workers output when wrangler.jsonc is
// present in the project root. For Vercel we need the standard Node.js output
// at dist/server/server.js. We hide the file for the duration of the build.

const src = "wrangler.jsonc";
const tmp = "wrangler.jsonc.__vercel_bak";

let renamed = false;
try {
  if (existsSync(src)) {
    renameSync(src, tmp);
    renamed = true;
  }
  // VERCEL=1 tells vite.config.ts to skip @cloudflare/vite-plugin
  execSync("npx vite build", {
    stdio: "inherit",
    env: { ...process.env, VERCEL: "1" },
  });
} finally {
  if (renamed && existsSync(tmp)) {
    renameSync(tmp, src);
  }
}
