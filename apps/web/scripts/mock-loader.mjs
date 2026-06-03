import { pathToFileURL } from "node:url";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/headers") {
    return {
      shortCircuit: true,
      url: pathToFileURL(resolvePath(__dirname, "mocks/next-headers.mjs")).href,
    };
  }
  return nextResolve(specifier, context);
}
