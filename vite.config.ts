import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Amtliches Luftbild (LGLN) wie in Produktion über den eigenen Server anfragen.
// Auf dem Server übernimmt das der nginx-Proxy (siehe Deploy-Skill).
const lglnProxy = {
  "/lgln/dop": {
    target: "https://opendata.lgln.niedersachsen.de",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/lgln\/dop/, "/doorman/noauth/dop_wms"),
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: lglnProxy },
  preview: { proxy: lglnProxy },
});
