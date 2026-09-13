/* Shared game configuration and balance values. */
const RARITIES = {
    Common: { name: "Gewöhnlich", nameEn: "Common", code: "C", colorClass: "rarity-common", textClass: "rarity-common-text" },
    Uncommon: { name: "Ungewöhnlich", nameEn: "Uncommon", code: "U", colorClass: "rarity-uncommon", textClass: "rarity-uncommon-text" },
    Rare: { name: "Selten", nameEn: "Rare", code: "R", colorClass: "rarity-rare", textClass: "rarity-rare-text" },
    Epic: { name: "Episch", nameEn: "Epic", code: "E", colorClass: "rarity-epic", textClass: "rarity-epic-text" },
    Legendary: { name: "Legendär", nameEn: "Legendary", code: "L", colorClass: "rarity-legendary", textClass: "rarity-legendary-text" },
    Mythic: { name: "Mythisch", nameEn: "Mythic", code: "M", colorClass: "rarity-mythic", textClass: "rarity-mythic-text" }
};

const AMULET_DESIGN = {
    wood: { baseRate: 1.2, secRes: "berries", baseCost: { wood: 20, berries: 10 } },
    berries: { baseRate: 0.8, secRes: "berries", baseCost: { wood: 15, berries: 25 } },
    mushrooms: { baseRate: 0.5, secRes: "mushrooms", baseCost: { wood: 40, mushrooms: 70 } }
};

const ZONE_BACKGROUNDS = [
    "radial-gradient(circle at 30% 20%, rgba(74,222,128,0.14), transparent 60%), radial-gradient(circle at top, #123d26, #04140b)",
    "radial-gradient(circle at 30% 20%, rgba(251,191,36,0.20), transparent 60%), radial-gradient(circle at top, #3d2410, #1a0f06)",
    "radial-gradient(circle at 30% 20%, rgba(168,85,247,0.22), transparent 60%), radial-gradient(circle at top, #1a1033, #05030f)",
    "radial-gradient(circle at 30% 20%, rgba(253,224,71,0.22), transparent 60%), radial-gradient(circle at top, #3a2f10, #140f05)"
];

const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
const ANIMAL_YIELD_SECONDS = { Common: 60, Uncommon: 180, Rare: 600, Epic: 1800, Legendary: 7200 };
const ALBINO_CHANCE = 1 / 4096;
const ALBINO_MULTIPLIER = 10;

const TRAP_CONFIG = {
    Common: { cost: { wood: 80, berries: 40 }, catchSec: 10 * 60 },
    Uncommon: { cost: { wood: 220, berries: 120, mushrooms: 60 }, catchSec: 15 * 60 },
    Rare: { cost: { wood: 550, berries: 320, mushrooms: 220 }, catchSec: 20 * 60 },
    Epic: { cost: { wood: 1300, mushrooms: 700, crystals: 15 }, catchSec: 25 * 60 },
    Legendary: { cost: { wood: 3200, mushrooms: 1600, crystals: 50 }, catchSec: 30 * 60 }
};

const PLOT_UNLOCK_COSTS = [
    {},
    { wood: 150, berries: 50 },
    { wood: 1000, berries: 400 },
    { wood: 4000, berries: 1000, mushrooms: 400 },
    { wood: 12000, berries: 8000, mushrooms: 2000 },
    { wood: 30000, mushrooms: 10000, crystals: 5 },
    { wood: 50000, mushrooms: 25000, crystals: 10 },
    { wood: 120000, mushrooms: 60000, crystals: 20 },
    { wood: 1000000, mushrooms: 500000, crystals: 35 },
    { wood: 20000000, mushrooms: 12000000, crystals: 50 }
];

const ZONES = [
    { id: 0, name: "Flüsterwald", nameEn: "Whispering Forest", badge: "Zone 1", desc: "Ein ruhiger Hain voller dichter Bäume.", descEn: "A quiet grove with dense ancient trees.", icon: "fa-tree", req: null, crystalReward: 5, primaryRes: "wood", secondaryRes: "berries" },
    { id: 1, name: "Sonnenbeeren-Hain", nameEn: "Sunberry Grove", badge: "Zone 2", desc: "Lichtdurchflutetes Tal mit süßen Beerensträuchern.", descEn: "Sunlit valley filled with sweet berry bushes.", icon: "fa-apple-whole", req: { wood: 150, berries: 50 }, crystalReward: 10, primaryRes: "berries", secondaryRes: "wood" },
    { id: 2, name: "Leuchtpilz-Höhle", nameEn: "Glowshroom Cave", badge: "Zone 3", desc: "Dunkle Höhlen, erhellt von Leuchtpilzen.", descEn: "Dark caverns illuminated by glowing mushrooms.", icon: "lni lni-mushroom-1", req: { wood: 500, berries: 300 }, crystalReward: 25, primaryRes: "mushrooms", secondaryRes: "wood" },
    { id: 3, name: "Uraltes Sanktuarium", nameEn: "Ancient Sanctuary", badge: "Zone 4", desc: "Heiliger Ort voller Harmonie.", descEn: "Sacred place filled with pure magic.", icon: "fa-monument", req: { wood: 4000, berries: 2500, mushrooms: 1800 }, crystalReward: 75, primaryRes: "balanced", secondaryRes: "crystals" }
];
