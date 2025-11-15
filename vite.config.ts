import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss({}),
    VitePWA({
      injectRegister: "auto",
      includeAssets: ["2fiat-topup.png", "mask-icon.svg"],
      manifest: {
        name: "2fiat Topup",
        short_name: "2fiat Topup",
        description: "Easily topup your 2fiat card",
        scope: "/",
        background_color: "#FFFFFF",
        theme_color: "#FFFFFF",
        display: "standalone",
        icons: [
          {
            src: "shortcut-icon.png",
            type: "image/png",
            sizes: "256x256", // TODO: replace with 512x512 image
          },
        ],
      },
    }),
  ],
  base: "/2fiat-topup",
  server: {
    allowedHosts: true,
  },
});
