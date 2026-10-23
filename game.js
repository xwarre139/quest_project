// game.js: runs WM Quest and calls the database functions you write in db.js.
// You do NOT need to change this file. Read it to see WHEN each db.js function runs
// and WHAT it hands you. Search for "Level 1", "Level 2", and "Level 3".

const $ = (selector) => document.querySelector(selector);

const dbStatus = $("#db-status");
const menuButton = $("#menu-button");
const screens = { menu: $("#menu-screen"), create: $("#create-screen"), game: $("#game-screen") };

// ---------- Small helpers ----------
function roll(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

// dice: [how many, sides], like [2, 6] for 2d6.
function rollDice(dice) {
  let total = 0;
  for (let i = 0; i < dice[0]; i++) total = total + roll(dice[1]);
  return total;
}

// "a Goblin", "an Orc"
function aOrAn(name) {
  return ("AEIOU".includes(name[0]) ? "an " : "a ") + name;
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function between(range) {
  return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
}

// "+2", "+0", "-1"
function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function signed(number) {
  return number >= 0 ? "+" + number : String(number);
}

// Shows a value from the database. If it's missing, says so in red,
// so a misspelled field name is easy to spot.
function show(value) {
  return value === undefined ? `<span class="missing">missing!</span>` : value;
}

function showScreen(name) {
  for (const [key, screen] of Object.entries(screens)) screen.hidden = key !== name;
  menuButton.hidden = name === "menu";
  window.scrollTo(0, 0);
}

menuButton.addEventListener("click", () => openMenu());

// ---------- Database status (Level 1: openDB) ----------
async function renderStatus() {
  try {
    const db = await openDB();
    const stores = Array.from(db.objectStoreNames).join(", ");
    dbStatus.innerHTML = `Connected to <b>${db.name}</b>, version <b>${db.version}</b>. Stores: <b>${stores}</b>`;
    dbStatus.classList.add("connected");
  } catch (error) {
    dbStatus.textContent = `Database not connected: ${error.message}`;
    dbStatus.classList.remove("connected");
  }
}

// =====================================================================
// SCREEN 1: Main menu (Level 1: getAllHeroes. Level 2: deleteHero)
// =====================================================================
const heroCards = $("#hero-cards");

async function openMenu() {
  battle = null;
  showScreen("menu");
  await renderStatus();
  try {
    const heroes = await getAllHeroes(); // Level 1
    heroCards.innerHTML = heroes.length === 0
      ? `<li class="muted">No heroes yet. Make one!</li>`
      : heroes.map((h) => {
        const c = CLASSES[h.heroClass] || { icon: "❓", label: "?" };
        return `
          <li class="hero-card">
            <span class="hero-icon">${c.icon}</span>
            <div class="grow">
              <p class="hero-card-name">${show(h.name)}</p>
              <p class="muted">Level ${show(h.level)} ${c.label} · 🪙 ${show(h.gold)} · ❤️ ${show(h.hp)}/${show(h.maxHp)}</p>
            </div>
            <button type="button" class="btn btn-small" data-play="${h.name}">Play »</button>
            <button type="button" class="btn btn-small btn-ghost" data-delete="${h.name}">Delete</button>
          </li>`;
      }).join("");
  } catch (error) {
    heroCards.innerHTML = `<li class="error">${error.message}</li>`;
  }
}

heroCards.addEventListener("click", async (event) => {
  const play = event.target.closest("[data-play]");
  const del = event.target.closest("[data-delete]");
  if (play) enterGame(play.dataset.play);

  // Delete takes two clicks, so nobody loses a hero by accident.
  if (del && del.dataset.sure !== "yes") {
    del.dataset.sure = "yes";
    del.textContent = "Sure? Delete";
    setTimeout(() => { del.dataset.sure = ""; del.textContent = "Delete"; }, 3000);
  } else if (del) {
    try {
      await deleteHero(del.dataset.delete); // Level 2
    } catch (error) {
      console.error(error);
      heroCards.insertAdjacentHTML("afterbegin", `<li class="error">${error.message}</li>`);
      return;
    }
    openMenu();
  }
});

$("#new-hero-button").addEventListener("click", () => openCreate());

// =====================================================================
// SCREEN 2: Make a hero (Level 1: createHero. Level 2: addItem, learnPower)
// =====================================================================
const nameInput = $("#new-name");
const classCards = $("#class-cards");
const dicePool = $("#dice-pool");
const statSlots = $("#stat-slots");
const suggestButton = $("#suggest-button");
const createButton = $("#create-button");
const createError = $("#create-error");
const createPreview = $("#create-preview");

// The order each class wants its stats in (best number first).
const SUGGESTED = {
  fighter: ["strength", "constitution", "dexterity", "wisdom", "charisma", "intelligence"],
  rogue: ["dexterity", "constitution", "charisma", "wisdom", "intelligence", "strength"],
  wizard: ["intelligence", "constitution", "dexterity", "wisdom", "charisma", "strength"],
  cleric: ["wisdom", "constitution", "strength", "dexterity", "charisma", "intelligence"],
};

let draft = null; // { heroClass, dice: [{ id, value }], placed: { strength: dieId, ... } }
let selectedDie = null;

function openCreate() {
  draft = { heroClass: "fighter", dice: [], placed: {} };
  selectedDie = null;
  nameInput.value = "";
  createError.textContent = "";
  showScreen("create");
  renderCreate();
  nameInput.focus();
}

$("#back-button").addEventListener("click", () => openMenu());

// 4 six-sided dice, drop the lowest, add the rest (the D&D way).
function rollStat() {
  const dice = [roll(6), roll(6), roll(6), roll(6)].sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}

$("#roll-button").addEventListener("click", () => {
  draft.dice = [0, 1, 2, 3, 4, 5].map((id) => ({ id, value: rollStat() }));
  draft.placed = {};
  selectedDie = null;
  renderCreate();
});

suggestButton.addEventListener("click", () => {
  const best = [...draft.dice].sort((a, b) => b.value - a.value);
  draft.placed = {};
  SUGGESTED[draft.heroClass].forEach((attribute, i) => { draft.placed[attribute] = best[i].id; });
  selectedDie = null;
  renderCreate();
});

nameInput.addEventListener("input", renderPreview);

classCards.addEventListener("click", (event) => {
  const card = event.target.closest("[data-class]");
  if (!card) return;
  draft.heroClass = card.dataset.class;
  renderCreate();
});

function dieById(id) {
  return draft.dice.find((d) => d.id === id);
}

// Which attribute is this die placed on? (or undefined if it's in the pool)
function slotOf(dieId) {
  return ATTRIBUTES.find((a) => draft.placed[a] === dieId);
}

// Put a die on an attribute. If the attribute already has one, they swap.
function place(dieId, attribute) {
  const from = slotOf(dieId);
  const old = draft.placed[attribute];
  if (from) delete draft.placed[from];
  draft.placed[attribute] = dieId;
  if (old !== undefined && old !== dieId && from) draft.placed[from] = old;
  selectedDie = null;
  renderCreate();
}

function unplace(dieId) {
  const from = slotOf(dieId);
  if (from) delete draft.placed[from];
  selectedDie = null;
  renderCreate();
}

function chip(die) {
  return `<button type="button" class="die ${selectedDie === die.id ? "selected" : ""}" draggable="true" data-die="${die.id}">${die.value}</button>`;
}

function renderCreate() {
  const c = CLASSES[draft.heroClass];
  classCards.innerHTML = Object.entries(CLASSES).map(([id, k]) => `
    <button type="button" class="class-card ${id === draft.heroClass ? "chosen" : ""}" data-class="${id}">
      <span class="class-icon">${k.icon}</span>
      <b>${k.label}</b>
      <small>${k.blurb}</small>
      <small class="main-stat">Main stat: ${k.main}</small>
    </button>`).join("");

  const loose = draft.dice.filter((d) => slotOf(d.id) === undefined);
  dicePool.innerHTML = draft.dice.length === 0
    ? `<p class="muted">Press Roll stats.</p>`
    : (loose.length === 0 ? `<p class="muted">All placed. Drag one back here to take it off.</p>` : loose.map(chip).join(""));
  suggestButton.disabled = draft.dice.length === 0;

  statSlots.innerHTML = ATTRIBUTES.map((a) => {
    const die = draft.placed[a] === undefined ? null : dieById(draft.placed[a]);
    return `
      <div class="slot ${a === c.main ? "main" : ""}" data-slot="${a}">
        <div class="slot-label"><b>${a}</b><small>${ATTRIBUTE_HELP[a]}</small></div>
        <div class="slot-drop">${die ? chip(die) : `<span class="slot-empty">drop here</span>`}</div>
        <span class="slot-mod">${die ? signed(modifier(die.value)) : ""}</span>
      </div>`;
  }).join("");
  renderPreview();
}

function renderPreview() {
  const done = draft.dice.length === 6 && ATTRIBUTES.every((a) => draft.placed[a] !== undefined);
  createButton.disabled = !done || !nameInput.value.trim();
  if (!done) {
    createPreview.innerHTML = `<p class="muted">Pick a class and place all 6 stats.</p>`;
    return;
  }
  const c = CLASSES[draft.heroClass];
  const value = (a) => dieById(draft.placed[a]).value;
  const powers = c.powers.filter((p) => p.learnAt === 1).map((p) => p.name).join(", ");
  createPreview.innerHTML = `
    <p class="preview-name">${c.icon} ${nameInput.value.trim() || "Your hero"}, level 1 ${c.label}</p>
    <p>❤️ HP <b>${10 + modifier(value("constitution"))}</b> · 🛡️ AC <b>${10 + modifier(value("dexterity"))}</b> · 🪙 <b>10</b> gold</p>
    <p>${c.powerWord}: <b>${powers}</b></p>
    <p>Bag: <b>${c.startingItems.map((i) => ITEMS[i].icon + " " + ITEMS[i].name).join(", ")}</b></p>`;
}

// Drag and drop: drag a die onto a slot (or back to the pool).
document.addEventListener("dragstart", (event) => {
  const die = event.target.closest("[data-die]");
  if (die) event.dataTransfer.setData("text/plain", die.dataset.die);
});
for (const zone of [statSlots, dicePool]) {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    const slot = event.target.closest(".slot");
    document.querySelectorAll(".slot.over").forEach((s) => s.classList.remove("over"));
    if (slot) slot.classList.add("over");
  });
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    const dieId = Number(event.dataTransfer.getData("text/plain"));
    const slot = event.target.closest("[data-slot]");
    if (slot) place(dieId, slot.dataset.slot);
    else unplace(dieId);
  });
}

// Click to place: click a die, then click a slot. Works on phones too.
statSlots.addEventListener("click", (event) => {
  const die = event.target.closest("[data-die]");
  const slot = event.target.closest("[data-slot]");
  if (die && selectedDie === null) {
    selectedDie = Number(die.dataset.die);
    renderCreate();
  } else if (slot && selectedDie !== null) {
    place(selectedDie, slot.dataset.slot);
  }
});
dicePool.addEventListener("click", (event) => {
  const die = event.target.closest("[data-die]");
  if (die) {
    selectedDie = selectedDie === Number(die.dataset.die) ? null : Number(die.dataset.die);
    renderCreate();
  } else if (selectedDie !== null) {
    unplace(selectedDie);
  }
});

createButton.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const heroClass = draft.heroClass;
  const attributes = {};
  ATTRIBUTES.forEach((a) => { attributes[a] = dieById(draft.placed[a]).value; });

  try {
    await createHero(name, heroClass, attributes); // Level 1
  } catch (error) {
    console.error(error);
    createError.textContent = `${error.name}: ${error.message}`;
    return;
  }

  // The starting kit: the class's items and level 1 powers.
  try {
    for (const itemId of CLASSES[heroClass].startingItems) {
      await addItem(name, ITEMS[itemId]); // Level 2
    }
    for (const power of CLASSES[heroClass].powers) {
      if (power.learnAt === 1) await learnPower(name, power); // Level 2
    }
  } catch (error) {
    console.error(error);
  }
  await log(name, `${name} the ${CLASSES[heroClass].label} begins their quest.`);
  enterGame(name);
});

// =====================================================================
// SCREEN 3: The game
// Level 1: getHero, updateHero. Level 2: getInventory, getPowers, addItem,
// removeItem, learnPower. Level 3: addJournal, getJournal.
// =====================================================================
const sheet = $("#sheet");
const story = $("#story");
const actions = $("#actions");
const sceneTitle = $("#scene-title");
const monsterBox = $("#monster");

let heroName = "";
let hero = null; // the hero record, as it came from getHero
let inventory = []; // from getInventory
let powers = []; // from getPowers
let room = { name: "", searched: false };
let battle = null; // { monster, hp, guard, used: [powerIds] } while fighting
let submenu = ""; // "", "powers", or "items"
let lastGold = null;

async function enterGame(name) {
  heroName = name;
  battle = null;
  submenu = "";
  lastGold = null;
  story.innerHTML = "";
  showScreen("game");
  await renderStatus();
  room = { name: "the dungeon entrance", searched: true };
  sceneTitle.textContent = "The dungeon entrance";
  say(`${name} stands at the dungeon entrance. Stairs lead down into the dark.`);
  await refresh();
}

// Adds a line to the story. kind: "", "hit", "hurt", "loot", "gold", "level", "error"
function say(text, kind) {
  story.insertAdjacentHTML("beforeend", `<li class="${kind || ""}">${text}</li>`);
  while (story.children.length > 60) story.firstElementChild.remove();
  story.parentElement.scrollTop = story.parentElement.scrollHeight;
}

// Saves to the journal (Level 3). Until the journal is built, the game keeps going without it.
async function log(name, text) {
  try {
    await addJournal(name, text); // Level 3
  } catch (error) {
    // Level 3 isn't built yet.
  }
}

// Saves the hero, then reads everything back from the database.
async function save() {
  try {
    await updateHero(hero); // Level 1
  } catch (error) {
    console.error(error);
    say(`Not saved: ${error.message}`, "error");
  }
  await refresh();
}

async function refresh() {
  try {
    hero = await getHero(heroName); // Level 1
  } catch (error) {
    hero = null;
    sheet.innerHTML = `<p class="error">${error.message}</p>`;
    actions.innerHTML = "";
    return;
  }
  if (!hero) {
    sheet.innerHTML = `<p class="muted">${heroName} isn't in the database.</p>`;
    actions.innerHTML = "";
    return;
  }
  try {
    inventory = await getInventory(heroName); // Level 2
  } catch (error) {
    inventory = error;
  }
  try {
    powers = await getPowers(heroName); // Level 2
  } catch (error) {
    powers = error;
  }
  await renderSheet();
  renderMonster();
  renderActions();
}

// ---------- The character sheet ----------
function heroClass() {
  return CLASSES[hero.heroClass] || CLASSES.fighter;
}

function mainMod() {
  return modifier(hero.attributes[heroClass().main]);
}

function has(itemId) {
  return Array.isArray(inventory) && inventory.some((item) => item.itemId === itemId);
}

function armorClass() {
  return 10 + modifier(hero.attributes.dexterity) + (has("shield") ? 2 : 0) + (battle ? battle.guard : 0);
}

function sellPrice(item) {
  return Math.max(1, Math.round(item.value * (1 + modifier(hero.attributes.charisma) * 0.1)));
}

async function renderSheet() {
  const c = heroClass();
  const attrs = hero.attributes || {};
  const hpPercent = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100)) || 0;
  const xpPercent = Math.max(0, Math.min(100, hero.xp % 100)) || 0;
  const goldChange = lastGold === null ? 0 : hero.gold - lastGold;
  lastGold = hero.gold;

  let powerHtml;
  if (!Array.isArray(powers)) powerHtml = `<li class="error">${powers.message}</li>`;
  else if (powers.length === 0) powerHtml = `<li class="muted">None yet.</li>`;
  else powerHtml = powers.map((p) => `<li><b>${show(p.name)}</b><br><span class="muted">${show(p.description)}</span></li>`).join("");

  let itemHtml;
  if (!Array.isArray(inventory)) itemHtml = `<li class="error">${inventory.message}</li>`;
  else if (inventory.length === 0) itemHtml = `<li class="muted">Your bag is empty.</li>`;
  else itemHtml = inventory.map((item) => `
    <li>
      <span class="item-icon">${show(item.icon)}</span>
      <span class="grow">${show(item.name)} <b>×${show(item.qty)}</b></span>
      ${itemButton(item)}
    </li>`).join("");

  let journalHtml = "";
  try {
    const entries = await getJournal(heroName); // Level 3
    journalHtml = entries.length === 0
      ? `<li class="muted">No entries yet.</li>`
      : entries.slice(0, 6).map((e) => `<li>${show(e.text)}</li>`).join("");
  } catch (error) {
    journalHtml = `<li class="muted">${error.message}</li>`;
  }

  sheet.innerHTML = `
    <div class="sheet-head">
      <span class="hero-icon">${c.icon}</span>
      <div class="grow">
        <h2 class="hero-name">${show(hero.name)}</h2>
        <p class="muted">Level ${show(hero.level)} ${c.label}</p>
      </div>
    </div>

    <div class="trackers">
      <p class="gold-tracker">🪙 <b>${show(hero.gold)}</b> gold ${goldChange > 0 ? `<span class="gold-pop">+${goldChange}</span>` : ""}</p>
      <p class="ac-tracker">🛡️ AC <b>${armorClass()}</b></p>
    </div>

    <p class="bar-label">❤️ HP ${show(hero.hp)} / ${show(hero.maxHp)}</p>
    <div class="bar"><div class="bar-fill hp" style="width: ${hpPercent}%"></div></div>
    <p class="bar-label">⭐ XP ${show(hero.xp)} · next level at ${hero.level * 100}</p>
    <div class="bar"><div class="bar-fill xp" style="width: ${xpPercent}%"></div></div>

    <div class="attr-grid">
      ${ATTRIBUTES.map((a) => `
        <div class="attr ${a === c.main ? "main" : ""}" title="${ATTRIBUTE_HELP[a]}">
          <span>${a.slice(0, 3)}</span>
          <b>${show(attrs[a])}</b>
          <small>${attrs[a] === undefined ? "" : signed(modifier(attrs[a]))}</small>
        </div>`).join("")}
    </div>

    <h3>${c.powerWord}</h3>
    <ul class="power-list">${powerHtml}</ul>

    <h3>Inventory</h3>
    <ul class="item-list">${itemHtml}</ul>

    <h3>Journal</h3>
    <ol class="journal">${journalHtml}</ol>
  `;
}

// The button next to each item in the bag. In a battle, use the Items menu instead.
function itemButton(item) {
  const info = ITEMS[item.itemId];
  if (!info || battle) return "";
  if (info.type === "potion") return `<button type="button" data-drink="${item.itemId}" class="btn btn-tiny">Drink</button>`;
  if (info.type === "treasure") return `<button type="button" data-sell="${item.itemId}" class="btn btn-tiny">Sell ${sellPrice(info)}</button>`;
  return `<button type="button" data-drop="${item.itemId}" class="btn btn-tiny btn-ghost">Drop</button>`;
}

sheet.addEventListener("click", async (event) => {
  const drink = event.target.closest("[data-drink]");
  const sell = event.target.closest("[data-sell]");
  const drop = event.target.closest("[data-drop]");
  if (drink) {
    await usePotion(drink.dataset.drink);
    await save();
  }
  if (sell) await sellItem(sell.dataset.sell);
  if (drop) {
    if (!(await takeItem(drop.dataset.drop))) return;
    say(`You drop the ${ITEMS[drop.dataset.drop].name}.`);
    await refresh();
  }
});

// Takes one of an item out of the bag (Level 2). Gives back false if it didn't work.
async function takeItem(itemId) {
  try {
    await removeItem(heroName, itemId); // Level 2
    return true;
  } catch (error) {
    console.error(error);
    say(error.message, "error");
    return false;
  }
}

async function sellItem(itemId) {
  const info = ITEMS[itemId];
  if (!(await takeItem(itemId))) return;
  const price = sellPrice(info);
  hero.gold = hero.gold + price;
  say(`You sell the ${info.icon} ${info.name} for ${price} gold.`, "gold");
  await save();
}

// ---------- The monster ----------
function renderMonster() {
  if (!battle) {
    monsterBox.hidden = true;
    return;
  }
  const m = battle.monster;
  monsterBox.hidden = false;
  monsterBox.innerHTML = `
    <span class="monster-icon">${m.icon}</span>
    <div class="grow">
      <p class="monster-name">${m.name} <small>AC ${m.ac}</small></p>
      <div class="bar"><div class="bar-fill enemy" style="width: ${Math.max(0, (battle.hp / m.hp) * 100)}%"></div></div>
      <p class="muted">HP ${Math.max(0, battle.hp)} / ${m.hp}</p>
    </div>`;
}

// ---------- Your choices ----------
function button(label, action, o) {
  o = o || {};
  return `<button type="button" class="choice ${o.kind || ""}" data-action="${action}" ${o.disabled ? "disabled" : ""}>${label}${o.note ? `<small>${o.note}</small>` : ""}</button>`;
}

function renderActions() {
  const c = heroClass();
  let html = "";

  if (submenu === "powers") {
    const known = Array.isArray(powers) ? powers : [];
    html = known.map((p) => {
      const rule = c.powers.find((r) => r.powerId === p.powerId);
      const used = battle && battle.used.includes(p.powerId);
      return button(`✨ ${p.name}`, "power:" + p.powerId, { note: used ? "Used this battle" : p.description, disabled: used || !rule });
    }).join("") || `<p class="muted">No ${c.powerWord.toLowerCase()} saved yet.</p>`;
    html += button("« Back", "back", { kind: "back" });
  } else if (submenu === "items") {
    const bag = Array.isArray(inventory) ? inventory : [];
    const usable = bag.filter((item) => ITEMS[item.itemId] && (ITEMS[item.itemId].type === "potion" || (battle && ITEMS[item.itemId].type === "throwable")));
    html = usable.map((item) => {
      const info = ITEMS[item.itemId];
      const verb = info.type === "potion" ? "Drink" : "Use";
      return button(`${info.icon} ${verb} ${info.name}`, "item:" + item.itemId, { note: `You have ${item.qty}` });
    }).join("") || `<p class="muted">Nothing you can use right now.</p>`;
    html += button("« Back", "back", { kind: "back" });
  } else if (battle) {
    html = button("⚔️ Attack", "attack", { kind: "main", note: `d20 ${signed(mainMod() + hero.level)} to hit` })
      + button(`✨ ${c.powerWord}`, "powers", { note: "Choose one" })
      + button("🎒 Items", "items", { note: "Potions, flasks, bombs" })
      + button("🏃 Retreat", "retreat", { note: "Dexterity roll" });
  } else {
    html = button("🕯️ Go deeper", "deeper", { kind: "main", note: "Find the next room" })
      + button("🔍 Search the room", "search", { disabled: room.searched, note: room.searched ? "Already searched" : "Maybe treasure, maybe a trap" })
      + button("🏕️ Rest", "rest", { note: "Heal to full. Something might find you" })
      + button("🎒 Items", "items", { note: "Drink a potion" });
  }
  actions.innerHTML = html;
}

actions.addEventListener("click", async (event) => {
  const choice = event.target.closest("[data-action]");
  if (!choice || !hero) return;
  const action = choice.dataset.action;
  actions.querySelectorAll("button").forEach((b) => { b.disabled = true; });

  if (action === "back") submenu = "";
  else if (action === "powers" || action === "items") submenu = action;
  else if (action === "deeper") await goDeeper();
  else if (action === "search") await searchRoom();
  else if (action === "rest") await rest();
  else if (action === "attack") await attack();
  else if (action === "retreat") await retreat();
  else if (action.startsWith("power:")) await usePower(action.slice(6));
  else if (action.startsWith("item:")) await useItem(action.slice(5));

  if (action === "back" || action === "powers" || action === "items") renderActions();
});

// ---------- Exploring ----------
async function goDeeper() {
  room = { name: pick(ROOMS), searched: false };
  sceneTitle.textContent = capital(room.name);
  say(`You walk into ${room.name}.`, "room");
  const chance = Math.random();
  if (chance < 0.6) {
    await startBattle();
  } else if (chance < 0.75) {
    const gold = between([5, 20]);
    const info = ITEMS[pick(SEARCH_LOOT)];
    hero.gold = hero.gold + gold;
    say(`📦 A treasure chest! Inside: ${gold} gold and ${info.icon} ${info.name}.`, "loot");
    await giveLoot([info]);
    await save();
  } else {
    say("It's quiet. Too quiet.");
    await refresh();
  }
}

async function searchRoom() {
  room.searched = true;
  const chance = Math.random();
  if (chance < 0.45) {
    const info = ITEMS[pick(SEARCH_LOOT)];
    say(`🔍 You search carefully and find ${info.icon} ${info.name}.`, "loot");
    await giveLoot([info]);
    await refresh();
  } else if (chance < 0.6) {
    const hurt = roll(4);
    hero.hp = Math.max(1, hero.hp - hurt);
    say(`🪤 A trap! A dart hits you for ${hurt} damage.`, "hurt");
    await save();
  } else {
    say("🔍 You search every corner. Nothing.");
    await refresh();
  }
}

async function rest() {
  if (Math.random() < 0.25) {
    say("🏕️ You start to rest, but something heard you...", "hurt");
    await startBattle();
    return;
  }
  hero.hp = hero.maxHp;
  say("🏕️ You rest. HP is full.");
  await log(heroName, "Rested. HP full.");
  await save();
}

// Puts items in the bag (Level 2).
async function giveLoot(items) {
  for (const info of items) {
    try {
      await addItem(heroName, info); // Level 2
    } catch (error) {
      console.error(error);
      say(`The ${info.name} couldn't go in your bag: ${error.message}`, "error");
    }
  }
}

// ---------- Battle ----------
async function startBattle() {
  const choices = MONSTERS.filter((m) => m.minLevel <= hero.level);
  const monster = pick(choices);
  battle = { monster, hp: monster.hp, guard: 0, used: [] };
  submenu = "";
  say(`${monster.icon} ${capital(aOrAn(monster.name))} attacks!`, "hurt");
  await refresh();
}

// Your attack. bonus: added to the d20. dice: damage dice.
function heroAttack(name, dice, alwaysHits) {
  const m = battle.monster;
  const bonus = mainMod() + hero.level;
  const d20 = roll(20);
  if (!alwaysHits && d20 !== 20 && d20 + bonus < m.ac) {
    say(`${name}: You roll ${d20} ${signed(bonus)} = ${d20 + bonus} vs AC ${m.ac}. Miss!`);
    return;
  }
  const critical = d20 === 20 && !alwaysHits;
  let damage = rollDice(dice) + mainMod();
  if (critical) damage = damage + rollDice(dice);
  damage = Math.max(1, damage);
  battle.hp = battle.hp - damage;
  const rollText = alwaysHits ? "It can't miss" : `You roll ${d20} ${signed(bonus)} = ${d20 + bonus}`;
  say(`${name}: ${rollText}. ${critical ? "CRITICAL HIT! " : ""}${damage} damage.`, "hit");
}

async function attack() {
  heroAttack("⚔️ Attack", [1, 8], false);
  await afterTurn();
}

async function usePower(powerId) {
  const rule = heroClass().powers.find((p) => p.powerId === powerId);
  submenu = "";
  if (!rule) return;
  const e = rule.effect;

  if (e.kind === "heal") {
    const healed = Math.max(1, rollDice(e.dice) + mainMod());
    hero.hp = Math.min(hero.maxHp, hero.hp + healed);
    say(`✨ ${rule.name}: you heal ${healed} HP.`, "loot");
  } else if (e.kind === "guard") {
    battle.guard = battle.guard + e.ac;
    say(`✨ ${rule.name}: +${e.ac} AC for this battle.`, "loot");
  } else if (e.kind === "escape") {
    say(`✨ ${rule.name}: you're gone before the ${battle.monster.name} can blink.`);
    battle = null;
    await save();
    return;
  } else {
    heroAttack(`✨ ${rule.name}`, e.dice, e.hit);
  }
  if (battle) battle.used.push(powerId);
  await afterTurn();
}

async function usePotion(itemId) {
  const info = ITEMS[itemId];
  if (!(await takeItem(itemId))) return;
  const healed = itemId === "greater-potion" ? rollDice([4, 4]) + 4 : rollDice([2, 4]) + 2;
  hero.hp = Math.min(hero.maxHp, hero.hp + healed);
  say(`${info.icon} You drink the ${info.name} and heal ${healed} HP.`, "loot");
}

async function useItem(itemId) {
  const info = ITEMS[itemId];
  submenu = "";
  if (info.type === "potion") {
    await usePotion(itemId);
  } else if (itemId === "fire-flask") {
    if (!(await takeItem(itemId))) return refresh();
    const damage = rollDice([2, 6]);
    battle.hp = battle.hp - damage;
    say(`🍶 You throw the Fire Flask. It bursts into flame: ${damage} damage.`, "hit");
  } else if (itemId === "smoke-bomb") {
    if (!(await takeItem(itemId))) return refresh();
    say("💨 Smoke fills the room. You slip away.");
    battle = null;
    return save();
  }
  if (battle) await afterTurn();
  else await save();
}

async function retreat() {
  const d20 = roll(20);
  const bonus = modifier(hero.attributes.dexterity);
  if (d20 + bonus >= 10) {
    say(`🏃 You roll ${d20} ${signed(bonus)} = ${d20 + bonus}. You get away!`);
    battle = null;
    await save();
    return;
  }
  say(`🏃 You roll ${d20} ${signed(bonus)} = ${d20 + bonus}. You can't get away!`, "hurt");
  await afterTurn();
}

// After you act: did the monster fall? If not, it attacks.
async function afterTurn() {
  if (battle && battle.hp <= 0) return victory();
  if (battle) {
    const m = battle.monster;
    const d20 = roll(20);
    const ac = armorClass();
    if (d20 + m.hit >= ac || d20 === 20) {
      const hurt = rollDice(m.damage);
      hero.hp = hero.hp - hurt;
      say(`${m.icon} The ${m.name} rolls ${d20 + m.hit} vs your AC ${ac}. It hits you for ${hurt}!`, "hurt");
    } else {
      say(`${m.icon} The ${m.name} rolls ${d20 + m.hit} vs your AC ${ac}. It misses.`);
    }
    if (hero.hp <= 0) return defeat();
  }
  await save();
}

async function victory() {
  const m = battle.monster;
  battle = null;
  const gold = between(m.gold);
  hero.xp = hero.xp + m.xp;
  hero.gold = hero.gold + gold;

  // Loot: always one item, sometimes two.
  const loot = [ITEMS[pick(m.loot)]];
  if (Math.random() < 0.3) loot.push(ITEMS[pick(m.loot)]);

  say(`🏆 The ${m.name} falls! +${m.xp} XP`, "level");
  say(`🪙 You pick up ${gold} gold.`, "gold");
  say(`🎁 Loot: ${loot.map((i) => i.icon + " " + i.name).join(", ")}`, "loot");
  await giveLoot(loot);
  await log(heroName, `Beat ${aOrAn(m.name)}: +${m.xp} XP, +${gold} gold, ${loot.map((i) => i.name).join(", ")}.`);
  await levelUp();
  await save();
}

async function defeat() {
  const m = battle.monster;
  battle = null;
  const lost = Math.floor(hero.gold / 4);
  hero.gold = hero.gold - lost;
  hero.hp = Math.ceil(hero.maxHp / 2);
  room = { name: "the dungeon entrance", searched: true };
  sceneTitle.textContent = "The dungeon entrance";
  say(`💀 The ${m.name} knocks you out...`, "hurt");
  say(`You wake up at the dungeon entrance with ${hero.hp} HP. ${lost} gold is missing from your pouch.`, "hurt");
  await log(heroName, `Knocked out by ${aOrAn(m.name)}. Lost ${lost} gold.`);
  await save();
}

// Every 100 XP is a new level: more HP, full heal, and maybe a new power (Level 2: learnPower).
async function levelUp() {
  while (hero.xp >= hero.level * 100) {
    hero.level = hero.level + 1;
    hero.maxHp = hero.maxHp + Math.max(1, 5 + modifier(hero.attributes.constitution));
    hero.hp = hero.maxHp;
    say(`⭐ LEVEL UP! ${hero.name} is now level ${hero.level}. HP is full.`, "level");
    await log(heroName, `Reached level ${hero.level}.`);
    for (const power of heroClass().powers) {
      if (power.learnAt === hero.level) {
        try {
          await learnPower(heroName, power); // Level 2
          say(`⭐ New ${heroClass().powerWord.toLowerCase().slice(0, -1)}: ${power.name}. ${power.description}`, "level");
        } catch (error) {
          say(`Couldn't learn ${power.name}: ${error.message}`, "error");
        }
      }
    }
  }
}

// ---------- Start ----------
openMenu();
