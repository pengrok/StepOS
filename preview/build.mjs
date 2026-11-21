// 미리보기용 HTML 한 파일을 만든다: node preview/build.mjs <출력 파일>
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = process.argv[2] ?? "stepos-preview.html";
const tmp = mkdtempSync(join(tmpdir(), "stepos-"));
const shim = (f) => new URL(`./shims/${f}`, import.meta.url).pathname;

const js = await build({
  entryPoints: [new URL("./main.tsx", import.meta.url).pathname],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  target: "es2020",
  alias: {
    "react/jsx-runtime": shim("jsx-runtime.ts"),
    react: shim("react.ts"),
    "react-dom/client": shim("react-dom-client.ts"),
    "next/link": shim("link.tsx"),
    "next/navigation": shim("navigation.ts"),
  },
  define: { "process.env.NODE_ENV": '"production"' },
});

execFileSync("npx", ["@tailwindcss/cli", "-i", "src/app/globals.css", "-o", join(tmp, "app.css"), "--minify"], {
  stdio: "inherit",
});
const css = readFileSync(join(tmp, "app.css"), "utf8");

const html = `<title>스텝OS</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap">
<style>:root{--font-plex:"IBM Plex Sans KR";color-scheme:light}${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js.outputFiles[0].text.replace(/<\/script/g, "<\\/script")}</script>
`;
writeFileSync(out, html);
console.log(`${out} (${Math.round(html.length / 1024)} KB)`);
