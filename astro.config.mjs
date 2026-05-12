import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";

export default defineConfig({
  output: "server",
  adapter: netlify(),
  site: "https://cool-bienenstitch-6090eb.netlify.app",
});
