#!/usr/bin/env node
/**
 * Turns the Vite widget bundle into a Stripe-style release.
 *
 * dist/widget.js becomes a tiny loader (short cache).
 * The real bundle, engines and connectors are copied under
 * dist/releases/<release>/ and stay immutable.
 *
 * The loader hashes the shop domain. Shops in the first `cohort` percent
 * receive `beta`; the rest receive `stable`. data-version on the script tag
 * pins a release and skips the hash. No API call.
 */
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const config = JSON.parse(readFileSync(join(root, "loader.config.json"), "utf8"));

for (const key of ["cohort", "stable", "beta", "release"]) {
  if (config[key] === undefined || config[key] === "") {
    throw new Error(`loader.config.json missing ${key}`);
  }
}
const cohort = Number(config.cohort);
if (!Number.isInteger(cohort) || cohort < 0 || cohort > 100) {
  throw new Error("cohort must be an integer from 0 to 100");
}

const releaseDir = join(dist, "releases", config.release);
mkdirSync(releaseDir, { recursive: true });
cpSync(join(dist, "widget.js"), join(releaseDir, "widget.js"));
for (const folder of ["engines", "connectors"]) {
  const src = join(dist, folder);
  cpSync(src, join(releaseDir, folder), { recursive: true });
}
for (const name of readdirSync(dist)) {
  if (name.startsWith("cart-") && name.endsWith(".mjs")) {
    cpSync(join(dist, name), join(releaseDir, name));
  }
}

const loader = `/* Scenaro widget loader. Cache briefly. Release files are immutable. */
(function () {
  var COHORT = ${cohort};
  var STABLE = ${JSON.stringify(config.stable)};
  var BETA = ${JSON.stringify(config.beta)};
  var current = document.currentScript;
  if (!current || !current.src) return;
  var pin = (current.dataset.version || "").trim();
  var shop = (window.Shopify && window.Shopify.shop) || location.hostname;
  var version = pin && pin !== "auto" ? pin : (bucket(shop) < COHORT ? BETA : STABLE);
  var url = new URL(current.src, location.href);
  var dir = url.pathname.replace(/\\/[^/]*$/, "");
  var next = document.createElement("script");
  next.src = url.origin + dir + "/releases/" + encodeURIComponent(version) + "/widget.js";
  next.defer = true;
  for (var i = 0; i < current.attributes.length; i++) {
    var attr = current.attributes[i];
    if (attr.name.indexOf("data-") === 0) next.setAttribute(attr.name, attr.value);
  }
  current.parentNode.insertBefore(next, current.nextSibling);
  function bucket(value) {
    var hash = 5381;
    for (var i = 0; i < value.length; i++) hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    return (hash >>> 0) % 100;
  }
})();
`;

writeFileSync(join(dist, "widget.js"), loader);

const listed = new Set([config.stable, config.beta, config.release]);
const releasesPath = join(dist, "releases.json");
writeFileSync(
  releasesPath,
  JSON.stringify({
    cohort,
    stable: config.stable,
    beta: config.beta,
    releases: [...listed].sort(),
  }, null, 2) + "\n",
);

const digest = createHash("sha256").update(loader).digest("hex").slice(0, 12);
console.log(`loader ${digest} cohort=${cohort} stable=${config.stable} beta=${config.beta} release=${config.release}`);
