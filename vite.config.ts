import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";

const root = searchForWorkspaceRoot(process.cwd());

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/skaneleden/",
  server: {
    fs: {
      allow: [
        root,
        root + "/node_modules/hike-site/",
        "/home/per/Documents/Projects/hike-site/",
      ],
    },
  },
});
