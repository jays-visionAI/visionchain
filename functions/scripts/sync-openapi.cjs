/**
 * Bring public/openapi.json up to the gateway's catalog.
 *
 * The catalog (functions/agentCatalog.js, served by GET /agentGateway) is
 * authoritative. This adds an `x-actions` entry for every catalog action the
 * document lacks, generated from the catalog's own params/response lists, and
 * rewrites the action/domain counts. Hand-written entries are left alone, so
 * their richer schemas survive; generated ones carry `x-generated` and are
 * refreshed on every run.
 *
 * test/agentGatewayPolicy.test.cjs fails when the two drift apart.
 *
 * Run: node functions/scripts/sync-openapi.cjs
 */

const fs = require("node:fs");
const path = require("node:path");
const { AGENT_CATALOG_DOMAINS, summarizeCatalog } = require("../agentCatalog");

const FILE = path.join(__dirname, "..", "..", "public", "openapi.json");
const GENERATED = "from the GET /agentGateway catalog (functions/agentCatalog.js); regenerate with functions/scripts/sync-openapi.cjs";

/** A catalog param description ("required (array of ...)") as a JSON Schema property. */
function paramSchema(text) {
  const schema = {};
  if (/\barray\b/i.test(text)) schema.type = "array";
  else if (/\bboolean\b/i.test(text)) schema.type = "boolean";
  schema.description = text;
  return schema;
}

/** A catalog entry as an `x-actions` entry. */
function generatedEntry(domain, entry) {
  const params = entry.params || {};
  const required = ["action", ...Object.keys(params).filter((k) => /^required\b/.test(params[k]))];
  const properties = { action: { const: entry.action } };
  for (const [name, text] of Object.entries(params)) properties[name] = paramSchema(text);
  const response = {};
  for (const field of entry.response || []) {
    const name = field.replace(/\[\]$/, "").replace(/\s*\(.*\)$/, "");
    response[name] = field.endsWith("[]") ? { type: "array" } : {};
  }
  return {
    "domain": domain,
    "auth": entry.auth,
    "tier": entry.tier,
    "cost": `${entry.cost} VCN`,
    "description": entry.desc,
    "request": { required, properties },
    "response": { properties: response },
    "x-generated": GENERATED,
  };
}

function sync(doc) {
  const summary = summarizeCatalog(AGENT_CATALOG_DOMAINS);
  const counts = `${summary.totalActions} actions across ${summary.totalDomains} domains`;

  doc.info.description = doc.info.description.replace(/\d+ actions across \d+ domains/, counts);
  if (!doc.info.description.includes(counts)) doc.info.description += ` ${counts}.`;
  doc.info["x-catalog"] = "GET /agentGateway is the authoritative action catalog; x-actions is kept in step with it by functions/scripts/sync-openapi.cjs.";

  const post = doc.paths["/agentGateway"].post;
  const get = doc.paths["/agentGateway"].get;
  get.description = get.description.replace(/all \d+ actions/, `all ${summary.totalActions} actions`);
  post.description = post.description.replace(/all \d+ actions/, `all ${summary.totalActions} actions`);

  const actions = doc["x-actions"];
  for (const [domain, def] of Object.entries(AGENT_CATALOG_DOMAINS)) {
    for (const entry of def.actions) {
      if (!actions[entry.action] || actions[entry.action]["x-generated"]) {
        actions[entry.action] = generatedEntry(domain, entry);
      }
    }
  }
  return doc;
}

if (require.main === module) {
  const doc = sync(JSON.parse(fs.readFileSync(FILE, "utf8")));
  fs.writeFileSync(FILE, JSON.stringify(doc, null, 4));
  console.log(`openapi.json: ${Object.keys(doc["x-actions"]).length} x-actions; ${doc.info.description}`);
}

module.exports = { sync };
