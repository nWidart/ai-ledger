// Writes dist/source-hash.txt: the hash of the sources the build came from. tests/test_web_build.py recomputes it the same way,
// so a commit with changed sources and a stale dist/ fails the Python tests.
// Inputs: every file under src/ (except src/__fixtures__/, which tests regenerate and the build never reads, and dotfiles),
// plus index.html, package-lock.json and vite.config.ts. Paths are relative to web/ with "/" separators, sorted by code unit.
// sha256 over, for each file in order: path, NUL, byte length in decimal, NUL, the file's bytes.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["src/__fixtures__"]);

function walk(dir, out) {
  for (const e of readdirSync(join(web, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.name.startsWith(".") || SKIP.has(rel)) continue;
    if (e.isDirectory()) walk(rel, out);
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

export function sourceHash() {
  const files = [...walk("src", []), "index.html", "package-lock.json", "vite.config.ts"].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const h = createHash("sha256");
  for (const f of files) {
    const data = readFileSync(join(web, f));
    h.update(`${f}\0${data.length}\0`);
    h.update(data);
  }
  return h.digest("hex");
}

if (process.argv[1] && relative(process.argv[1], fileURLToPath(import.meta.url)) === "") {
  writeFileSync(join(web, "dist", "source-hash.txt"), sourceHash() + "\n");
  console.log(`dist${sep}source-hash.txt written`);
}
