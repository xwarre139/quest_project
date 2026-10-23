// check.js: the Spec Check panel. Reads questDB and compares it with the DATA SPEC.
// It never changes your data. You do NOT need to change (or understand) this file.

const SPEC = {
  heroes: {
    level: 1,
    keyPath: "name",
    autoIncrement: false,
    fields: {
      name: "string", heroClass: "string", level: "number", xp: "number", hp: "number",
      maxHp: "number", gold: "number", attributes: "object", createdAt: "date",
    },
  },
  inventory: {
    level: 1,
    keyPath: "id",
    autoIncrement: false,
    fields: { id: "string", hero: "string", itemId: "string", name: "string", type: "string", icon: "string", qty: "number" },
    id: (r) => r.hero + "-" + r.itemId,
  },
  powers: {
    level: 1,
    keyPath: "id",
    autoIncrement: false,
    fields: { id: "string", hero: "string", powerId: "string", name: "string", description: "string", learnAt: "number" },
    id: (r) => r.hero + "-" + r.powerId,
  },
  journal: {
    level: 2,
    keyPath: "id",
    autoIncrement: true,
    fields: { id: "number", hero: "string", text: "string", createdAt: "date" },
  },
};

const checkButton = document.querySelector("#check-button");
const checkResults = document.querySelector("#check-results");

function typeOf(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

// Problems in one record. Gives back a list of sentences.
function recordProblems(store, record, heroNames) {
  const spec = SPEC[store];
  const problems = [];
  const key = record[spec.keyPath];

  for (const [field, type] of Object.entries(spec.fields)) {
    const value = record[field];
    if (value === undefined) {
      problems.push(`missing field "${field}"`);
    } else if (type === "date") {
      if (typeof value !== "string" || isNaN(new Date(value))) problems.push(`"${field}" should be a date as text, like ${new Date().toISOString()}`);
    } else if (typeOf(value) !== type) {
      problems.push(`"${field}" should be a ${type}, but it's a ${typeOf(value)} (${JSON.stringify(value)})`);
    }
  }
  for (const field of Object.keys(record)) {
    if (!(field in spec.fields)) problems.push(`extra field "${field}" is not in the spec (spelling?)`);
  }

  if (spec.id && record.id !== undefined && record.id !== spec.id(record)) {
    problems.push(`id should be "${spec.id(record)}", but it's "${record.id}"`);
  }
  if (store === "heroes" && typeOf(record.attributes) === "object") {
    for (const a of ATTRIBUTES) {
      if (typeof record.attributes[a] !== "number") problems.push(`attributes.${a} should be a number`);
    }
    if (record.heroClass !== undefined && !(record.heroClass in CLASSES)) problems.push(`heroClass "${record.heroClass}" isn't a class`);
  }
  if (store === "inventory" && typeof record.qty === "number" && record.qty < 1) {
    problems.push(`qty is ${record.qty}: at 0 the item should leave the bag`);
  }
  if (store !== "heroes" && typeof record.hero === "string" && !heroNames.includes(record.hero)) {
    problems.push(`belongs to "${record.hero}", but there is no hero by that name (left behind by deleteHero?)`);
  }
  return problems.map((p) => `${store} › ${JSON.stringify(key)}: ${p}`);
}

function result(ok, text) {
  return `<li class="${ok ? "pass" : "fail"}">${ok ? "✓" : "✗"} ${text}</li>`;
}

async function runCheck() {
  const out = [];

  const list = await indexedDB.databases();
  const found = list.find((d) => d.name === DB_NAME);
  if (DB_NAME !== "questDB") out.push(result(false, `DB_NAME is "${DB_NAME}". The spec says "questDB".`));
  if (!found) {
    out.push(result(false, `No database named "${DB_NAME}" yet. Build openDB, then refresh.`));
    checkResults.innerHTML = out.join("");
    return;
  }

  // Open whatever version is there. No version number, so this never upgrades anything.
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  try {
    out.push(result(true, `Found <b>${db.name}</b>, version <b>${db.version}</b>.`));
    const stores = Array.from(db.objectStoreNames);
    const wanted = Object.keys(SPEC).filter((s) => SPEC[s].level <= db.version);
    for (const s of stores) {
      if (!(s in SPEC)) out.push(result(false, `Store "${s}" is not in the spec (spelling?).`));
    }
    if (db.version >= 2 && !stores.includes("journal")) out.push(result(false, `Version ${db.version}, but there's no journal store.`));

    // Read every store first, so we know which heroes exist.
    const data = {};
    for (const s of wanted) {
      if (!stores.includes(s)) {
        out.push(result(false, `Missing store "${s}".`));
        continue;
      }
      const store = db.transaction(s).objectStore(s);
      data[s] = { store, records: await promisify(store.getAll()) };
    }
    const heroNames = data.heroes ? data.heroes.records.map((h) => h.name) : [];

    for (const s of wanted) {
      if (!data[s]) continue;
      const { store, records } = data[s];
      const spec = SPEC[s];
      const keyOk = store.keyPath === spec.keyPath;
      const autoOk = store.autoIncrement === spec.autoIncrement;
      if (!keyOk) out.push(result(false, `${s}: the key should be "${spec.keyPath}", but it's ${JSON.stringify(store.keyPath)}.`));
      if (!autoOk) out.push(result(false, spec.autoIncrement ? `${s}: the database should make the id numbers for you.` : `${s}: the key comes from the record, not a number the database makes.`));

      const problems = records.flatMap((r) => recordProblems(s, r, heroNames));
      if (keyOk && autoOk && problems.length === 0) {
        out.push(result(true, `<b>${s}</b>: ${records.length} record${records.length === 1 ? "" : "s"}, all match the spec.`));
      } else if (problems.length > 0) {
        out.push(result(false, `<b>${s}</b>: ${problems.length} problem${problems.length === 1 ? "" : "s"} in ${records.length} records.`));
        problems.slice(0, 6).forEach((p) => out.push(`<li class="detail">${p}</li>`));
        if (problems.length > 6) out.push(`<li class="detail">...and ${problems.length - 6} more.</li>`);
      }
    }
    if (db.version < 2) out.push(`<li class="detail">Level 3 adds the journal store in version 2.</li>`);
  } finally {
    db.close(); // so it never blocks your openDB from upgrading
  }
  checkResults.innerHTML = out.join("");
}

checkButton.addEventListener("click", async () => {
  checkResults.innerHTML = `<li class="detail">Checking...</li>`;
  try {
    await runCheck();
  } catch (error) {
    console.error(error);
    checkResults.innerHTML = result(false, `${error.name}: ${error.message}`);
  }
});
