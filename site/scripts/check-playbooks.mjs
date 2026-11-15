// Fails when a playbook in src/content/docs/improve/ does not have exactly the template's
// `##` headings, in order (design D8). Names the file and the heading.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const template = ["Goal", "Signs you need it", "Diagnose", "Act", "Verify", "Related"];
const dir = fileURLToPath(new URL("../src/content/docs/improve/", import.meta.url));

// `##` headings outside fenced code blocks.
function headings(text) {
  const found = [];
  let fence = null;
  for (const line of text.split("\n")) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (marker && (!fence || marker[0] === fence[0])) {
      fence = fence ? null : marker;
      continue;
    }
    const heading = !fence && line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (heading) found.push(heading[1]);
  }
  return found;
}

function problems(found) {
  const missing = template.filter((name) => !found.includes(name)).map((name) => `missing "## ${name}"`);
  const extra = found
    .filter((name, i) => !template.includes(name) || found.indexOf(name) !== i)
    .map((name) => `extra "## ${name}"`);
  if (missing.length || extra.length) return [...missing, ...extra];
  const i = found.findIndex((name, j) => name !== template[j]);
  return i === -1 ? [] : [`"## ${found[i]}" is out of order; expected "## ${template[i]}" there`];
}

const files = (await readdir(dir)).filter((name) => /\.mdx?$/.test(name)).sort();
if (!files.length) {
  console.error(`check-playbooks: no playbooks in ${dir}`);
  process.exit(1);
}
let failed = false;
for (const file of files) {
  for (const problem of problems(headings(await readFile(dir + file, "utf8")))) {
    console.error(`check-playbooks: improve/${file}: ${problem}`);
    failed = true;
  }
}
if (failed) {
  console.error(`check-playbooks: each playbook needs exactly: ${template.map((name) => `## ${name}`).join(", ")}`);
  process.exit(1);
}
console.log(`check-playbooks: ${files.length} playbooks follow the template`);
