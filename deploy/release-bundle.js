import {
  cpSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve, join, relative, sep, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { release } from "../shared/release.js";
const roots = [
  "dist",
  "server",
  "shared",
  "deploy",
  "docs",
  "package.json",
  "package-lock.json",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
];
function files(root) {
  const result = [];
  const visit = (path) => {
    const info = lstatSync(path);
    if (info.isSymbolicLink()) throw Error("Release cannot contain symlinks");
    if (info.isDirectory())
      for (const name of readdirSync(path).sort()) visit(join(path, name));
    else if (info.isFile())
      result.push(relative(root, path).split(sep).join("/"));
    else throw Error("Unsupported release file");
  };
  for (const name of roots) visit(join(root, name));
  return result.sort();
}
const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
function frontendMatches(root, id) {
  const assets = join(root, "dist", "assets");
  if (
    !existsSync(join(root, "dist", "index.html")) ||
    !existsSync(assets) ||
    !readdirSync(assets)
      .filter((n) => n.endsWith(".js"))
      .some((n) => readFileSync(join(assets, n), "utf8").includes(id))
  )
    throw Error(
      "Build the current frontend first: release ID absent from dist",
    );
}
export function verifyRelease(root) {
  root = resolve(root);
  const m = JSON.parse(
    readFileSync(join(root, "release-manifest.json"), "utf8"),
  );
  if (
    m.schema !== 1 ||
    m.release !== release.id ||
    !Array.isArray(m.files) ||
    !m.files.length
  )
    throw Error("Invalid or incompatible release manifest");
  const actual = files(root),
    expected = m.files.map((f) => f.path);
  if (
    new Set(expected).size !== expected.length ||
    JSON.stringify(actual) !== JSON.stringify([...expected].sort())
  )
    throw Error("Release file inventory differs from manifest");
  for (const f of m.files) {
    if (!actual.includes(f.path) || hash(join(root, f.path)) !== f.sha256)
      throw Error(`Release integrity check failed: ${f.path}`);
  }
  frontendMatches(root, m.release);
  return m;
}
export function packRelease(root, output) {
  root = resolve(root);
  output = resolve(output);
  frontendMatches(root, release.id);
  const staging = mkdtempSync(join(tmpdir(), "tunebox-release-"));
  try {
    for (const name of roots)
      cpSync(join(root, name), join(staging, name), {
        recursive: true,
        dereference: false,
        filter: path => !path.split(sep).includes('__pycache__') && !path.endsWith('.pyc'),
      });
    // Source workspaces can use restrictive umasks; the service user must read deployed code.
    files(staging); // Reject links/special files before changing any permissions.
    const normalise = (path) => {
      const directory=lstatSync(path).isDirectory();
      chmodSync(path,directory?0o755:0o644);
      if(directory)for(const name of readdirSync(path))normalise(join(path,name));
    };
    roots.forEach(name=>normalise(join(staging,name)));
    const manifest = {
      schema: 1,
      release: release.id,
      createdAt: new Date().toISOString(),
      files: files(staging).map((path) => ({
        path,
        sha256: hash(join(staging, path)),
      })),
    };
    writeFileSync(
      join(staging, "release-manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    chmodSync(join(staging, "release-manifest.json"),0o644);
    verifyRelease(staging);
    execFileSync("tar", [
      "-czf",
      output,
      "-C",
      staging,
      ...roots,
      "release-manifest.json",
    ]);
    return output;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (process.argv[2] === "verify") {
      const m = verifyRelease(process.argv[3] || process.cwd());
      console.log(`Verified release ${m.release}: ${m.files.length} files`);
    } else if (process.argv[2] === "pack")
      console.log(
        packRelease(
          dirname(dirname(fileURLToPath(import.meta.url))),
          process.argv[3] || "tunebox-release.tar.gz",
        ),
      );
    else
      throw Error(
        "Usage: node deploy/release-bundle.js pack [output.tar.gz] | verify [directory]",
      );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
