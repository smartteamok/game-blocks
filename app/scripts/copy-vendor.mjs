import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(scriptDir, "..");
const srcRoot = join(appRoot, "node_modules", "scratch-blocks");
const vendorRoot = join(appRoot, "public", "vendor", "scratch-blocks");

await mkdir(vendorRoot, { recursive: true });
await cp(
  join(srcRoot, "blockly_compressed_horizontal.js"),
  join(vendorRoot, "blockly_compressed_horizontal.js"),
  { force: true }
);
await cp(
  join(srcRoot, "blocks_compressed_horizontal.js"),
  join(vendorRoot, "blocks_compressed_horizontal.js"),
  { force: true }
);
await mkdir(join(vendorRoot, "msg", "js"), { recursive: true });
await cp(join(srcRoot, "msg", "js", "en.js"), join(vendorRoot, "msg", "js", "en.js"), {
  force: true
});
await cp(join(srcRoot, "media"), join(vendorRoot, "media"), {
  recursive: true,
  force: true
});

console.log("scratch-blocks vendor files copied to public/vendor/scratch-blocks");
