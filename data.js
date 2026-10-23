// data.js: the rules of the game (classes, powers, items, monsters).
// You do NOT need to change this file.

// The six attributes, in order.
const ATTRIBUTES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

// What each attribute does in this game.
const ATTRIBUTE_HELP = {
  strength: "Fighter attacks and damage",
  dexterity: "Rogue attacks, your armor (AC), and retreating",
  constitution: "Your hit points (HP)",
  intelligence: "Wizard spells",
  wisdom: "Cleric spells",
  charisma: "Better prices when you sell treasure",
};

// Each class: its main attribute, starting items, and powers.
// learnAt: the level the hero learns that power.
// effect (used by game.js in battle):
//   kind "attack": deal dice damage (+ your main attribute's modifier). hit: true means it never misses.
//   kind "heal":   heal dice HP (+ your main attribute's modifier).
//   kind "guard":  +ac to your armor for the rest of the battle.
//   kind "escape": leave the battle, no roll needed.
// Every power works once per battle.
const CLASSES = {
  fighter: {
    label: "Fighter",
    icon: "🛡️",
    main: "strength",
    powerWord: "Skills",
    blurb: "Tough and strong. Hits hard, takes hits.",
    startingItems: ["longsword", "shield", "healing-potion", "healing-potion"],
    powers: [
      { powerId: "power-strike", name: "Power Strike", description: "A huge swing: 2d8 damage.", learnAt: 1, effect: { kind: "attack", dice: [2, 8] } },
      { powerId: "second-wind", name: "Second Wind", description: "Catch your breath: heal 1d10.", learnAt: 1, effect: { kind: "heal", dice: [1, 10] } },
      { powerId: "shield-wall", name: "Shield Wall", description: "Raise your shield: +4 AC this battle.", learnAt: 2, effect: { kind: "guard", ac: 4 } },
      { powerId: "cleave", name: "Cleave", description: "A sweeping blow that can't miss: 3d6 damage.", learnAt: 3, effect: { kind: "attack", dice: [3, 6], hit: true } },
    ],
  },
  rogue: {
    label: "Rogue",
    icon: "🗡️",
    main: "dexterity",
    powerWord: "Skills",
    blurb: "Quick and sneaky. Big hits, easy escapes.",
    startingItems: ["dagger", "thieves-tools", "smoke-bomb", "healing-potion"],
    powers: [
      { powerId: "sneak-attack", name: "Sneak Attack", description: "Strike a weak spot: 3d6 damage.", learnAt: 1, effect: { kind: "attack", dice: [3, 6] } },
      { powerId: "dodge", name: "Dodge", description: "Stay light on your feet: +4 AC this battle.", learnAt: 1, effect: { kind: "guard", ac: 4 } },
      { powerId: "vanish", name: "Vanish", description: "Disappear and get away. Always works.", learnAt: 2, effect: { kind: "escape" } },
      { powerId: "shadow-strike", name: "Shadow Strike", description: "Appear behind them. Can't miss: 4d6 damage.", learnAt: 3, effect: { kind: "attack", dice: [4, 6], hit: true } },
    ],
  },
  wizard: {
    label: "Wizard",
    icon: "🔮",
    main: "intelligence",
    powerWord: "Spells",
    blurb: "Fragile, but the spells are huge.",
    startingItems: ["staff", "spellbook", "healing-potion", "healing-potion"],
    powers: [
      { powerId: "magic-missile", name: "Magic Missile", description: "Three darts of light that never miss: 3d4 damage.", learnAt: 1, effect: { kind: "attack", dice: [3, 4], hit: true } },
      { powerId: "shield-spell", name: "Shield", description: "An invisible wall: +5 AC this battle.", learnAt: 1, effect: { kind: "guard", ac: 5 } },
      { powerId: "fireball", name: "Fireball", description: "A blast of flame: 6d6 damage.", learnAt: 2, effect: { kind: "attack", dice: [6, 6] } },
      { powerId: "misty-step", name: "Misty Step", description: "Teleport away. Always works.", learnAt: 3, effect: { kind: "escape" } },
    ],
  },
  cleric: {
    label: "Cleric",
    icon: "✨",
    main: "wisdom",
    powerWord: "Spells",
    blurb: "Heals and holy fire. Hard to put down.",
    startingItems: ["mace", "holy-symbol", "healing-potion", "healing-potion"],
    powers: [
      { powerId: "sacred-flame", name: "Sacred Flame", description: "Holy fire that never misses: 2d8 damage.", learnAt: 1, effect: { kind: "attack", dice: [2, 8], hit: true } },
      { powerId: "healing-word", name: "Healing Word", description: "A quick prayer: heal 2d6.", learnAt: 1, effect: { kind: "heal", dice: [2, 6] } },
      { powerId: "bless", name: "Bless", description: "A holy glow: +3 AC this battle.", learnAt: 2, effect: { kind: "guard", ac: 3 } },
      { powerId: "guiding-bolt", name: "Guiding Bolt", description: "A flash of light: 4d6 damage.", learnAt: 3, effect: { kind: "attack", dice: [4, 6] } },
    ],
  },
};

// Every item in the game.
// type: "weapon", "armor", "tool", "potion", "throwable", or "treasure". value: gold when you sell it.
const ITEMS = {
  "longsword": { itemId: "longsword", name: "Longsword", type: "weapon", icon: "⚔️", value: 15 },
  "dagger": { itemId: "dagger", name: "Dagger", type: "weapon", icon: "🗡️", value: 2 },
  "staff": { itemId: "staff", name: "Staff", type: "weapon", icon: "🪄", value: 5 },
  "mace": { itemId: "mace", name: "Mace", type: "weapon", icon: "🔨", value: 5 },
  "shield": { itemId: "shield", name: "Shield", type: "armor", icon: "🛡️", value: 10 },
  "thieves-tools": { itemId: "thieves-tools", name: "Thieves' Tools", type: "tool", icon: "🔧", value: 25 },
  "spellbook": { itemId: "spellbook", name: "Spellbook", type: "tool", icon: "📘", value: 50 },
  "holy-symbol": { itemId: "holy-symbol", name: "Holy Symbol", type: "tool", icon: "📿", value: 5 },
  "torch": { itemId: "torch", name: "Torch", type: "tool", icon: "🔥", value: 1 },
  "rope": { itemId: "rope", name: "Rope", type: "tool", icon: "🪢", value: 1 },
  "healing-potion": { itemId: "healing-potion", name: "Healing Potion", type: "potion", icon: "🧪", value: 25 },
  "greater-potion": { itemId: "greater-potion", name: "Greater Healing Potion", type: "potion", icon: "⚗️", value: 60 },
  "fire-flask": { itemId: "fire-flask", name: "Fire Flask", type: "throwable", icon: "🍶", value: 20 },
  "smoke-bomb": { itemId: "smoke-bomb", name: "Smoke Bomb", type: "throwable", icon: "💨", value: 15 },
  "old-coin": { itemId: "old-coin", name: "Old Coin", type: "treasure", icon: "🪙", value: 8 },
  "silver-ring": { itemId: "silver-ring", name: "Silver Ring", type: "treasure", icon: "💍", value: 30 },
  "ruby": { itemId: "ruby", name: "Ruby", type: "treasure", icon: "💎", value: 50 },
  "dragon-scale": { itemId: "dragon-scale", name: "Dragon Scale", type: "treasure", icon: "🐉", value: 120 },
};

// What you can find when you search a room.
const SEARCH_LOOT = ["healing-potion", "torch", "rope", "old-coin", "old-coin", "fire-flask", "smoke-bomb", "silver-ring"];

// Monsters. minLevel: the hero level they start showing up.
// hp: their hit points. ac: what your attack roll has to reach. hit: added to their attack roll.
// damage: [how many dice, sides]. gold: [least, most]. loot: what they can drop.
const MONSTERS = [
  { name: "Giant Rat", icon: "🐀", minLevel: 1, hp: 7, ac: 10, hit: 2, damage: [1, 4], xp: 20, gold: [1, 4], loot: ["old-coin", "torch", "healing-potion"] },
  { name: "Goblin", icon: "👺", minLevel: 1, hp: 10, ac: 12, hit: 3, damage: [1, 6], xp: 30, gold: [3, 10], loot: ["healing-potion", "old-coin", "smoke-bomb", "rope"] },
  { name: "Skeleton", icon: "💀", minLevel: 1, hp: 13, ac: 13, hit: 4, damage: [1, 6], xp: 40, gold: [2, 12], loot: ["old-coin", "silver-ring", "fire-flask"] },
  { name: "Wolf", icon: "🐺", minLevel: 2, hp: 15, ac: 13, hit: 4, damage: [2, 4], xp: 50, gold: [0, 5], loot: ["healing-potion", "fire-flask"] },
  { name: "Orc", icon: "👹", minLevel: 2, hp: 20, ac: 13, hit: 5, damage: [1, 10], xp: 70, gold: [8, 20], loot: ["healing-potion", "fire-flask", "silver-ring", "greater-potion"] },
  { name: "Ogre", icon: "🧌", minLevel: 3, hp: 32, ac: 11, hit: 6, damage: [2, 8], xp: 110, gold: [15, 35], loot: ["greater-potion", "ruby", "silver-ring"] },
  { name: "Young Dragon", icon: "🐲", minLevel: 4, hp: 45, ac: 16, hit: 7, damage: [2, 10], xp: 200, gold: [40, 90], loot: ["dragon-scale", "ruby", "greater-potion"] },
];

// Rooms you walk into when you go deeper.
const ROOMS = [
  "a damp stone hallway lit by a single torch",
  "a collapsed library, books everywhere",
  "a cave with a cold underground stream",
  "an old armory with empty weapon racks",
  "a round room with a cracked statue in the middle",
  "a mushroom cave that glows faint blue",
  "a crypt lined with dusty coffins",
  "a bridge over a dark chasm",
];

// D&D modifier: 10 or 11 is +0, every 2 points above is +1, every 2 below is -1.
function modifier(score) {
  return Math.floor((score - 10) / 2);
}
