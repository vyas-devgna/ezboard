import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  define: { "process.env.IS_PREACT": JSON.stringify("false") },
  build: { target: "es2022", sourcemap: true },
});
