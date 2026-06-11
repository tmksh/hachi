#!/usr/bin/env node
/**
 * Converts a client page.tsx to server page + *-client.tsx pattern.
 * Usage: node scripts/convert-page-to-rsc.mjs <relative-path-from-(app)>
 * Example: node scripts/convert-page-to-rsc.mjs contracts/[id]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, "../src/app/(app)");

const rel = process.argv[2];
if (!rel) {
  console.error("Usage: node convert-page-to-rsc.mjs <path-under-(app)>");
  process.exit(1);
}

const dir = path.join(APP, rel);
const pagePath = path.join(dir, "page.tsx");
const baseName = rel.split("/").pop().replace(/[\[\]]/g, "");
const clientName = `${baseName}-client.tsx`;
const clientPath = path.join(dir, clientName);

if (!fs.existsSync(pagePath)) {
  console.error("Not found:", pagePath);
  process.exit(1);
}
if (fs.existsSync(clientPath)) {
  console.log("Skip (client exists):", rel);
  process.exit(0);
}

let content = fs.readFileSync(pagePath, "utf8");
if (!content.includes('"use client"')) {
  console.log("Skip (not client):", rel);
  process.exit(0);
}

// Derive export name from default function
const fnMatch = content.match(/export default function (\w+)/);
if (!fnMatch) {
  console.error("No default export function:", rel);
  process.exit(1);
}
const fnName = fnMatch[1];
const clientExport = fnName.replace(/Page$/, "Client");

content = content.replace(
  `export default function ${fnName}`,
  `export function ${clientExport}`,
);

fs.writeFileSync(clientPath, content);
console.log("Created:", clientPath);
