// Production Vite config for Docker deployment (no Cloudflare)
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
});
