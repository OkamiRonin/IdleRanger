/* Persistent state defaults. Loaded after the static configuration files. */
const DEFAULT_STATE = {
    resources: { wood: 0, berries: 0, mushrooms: 0, crystals: 0, basicPack: 0, mythicPack: 0 },
    stats: { totalWood: 0, totalBerries: 0, totalMushrooms: 0, totalCrystals: 0, totalBasicPack: 0, totalMythicPack: 0, totalClicks: 0 },
    currentZone: 0,
    unlockedZones: [0],
    lastSave: Date.now(),
    settings: {
        lang: "de",
        colorblind: false,
        sfxVolume: 80,
        bgmVolume: 50,
        sfxEnabled: true,
        bgmEnabled: false
    },
    account: {
        username: "",
        isLoggedIn: false
    },
    packs: {
        basic: 0,
        magic: 0
    },
    wildArea: {
        highestTrapRarity: null,
        plots: [
            { unlocked: true, trapRarity: null, catchReadyAt: 0, awaitingTrapSelection: false },
            { unlocked: false, trapRarity: null, catchReadyAt: 0, awaitingTrapSelection: false },
            { unlocked: false, trapRarity: null, catchReadyAt: 0, awaitingTrapSelection: false },
            { unlocked: false, trapRarity: null, catchReadyAt: 0, awaitingTrapSelection: false },
            { unlocked: false, trapRarity: null, catchReadyAt: 0, awaitingTrapSelection: false },
            { unlocked: false, trapRarity: null, catchReadyAt: 0, awaitingTrapSelection: false },
            { unlocked: false, trapRarity: null, catchReadyAt: 0, awaitingTrapSelection: false },
            { unlocked: false, trapRarity: null, catchReadyAt: 0, awaitingTrapSelection: false },
            { unlocked: false, trapRarity: null, catchReadyAt: 0, awaitingTrapSelection: false },
            { unlocked: false, trapRarity: null, catchReadyAt: 0, awaitingTrapSelection: false }
        ]
    },
    animalDex: {},
    amulets: {
        wood: { level: 0, baseRate: 1.2, secRes: "berries", cost: { wood: 20, berries: 10 } },
        berries: { level: 0, baseRate: 0.8, secRes: "berries", cost: { wood: 15, berries: 25 } },
        mushrooms: { level: 0, baseRate: 0.5, secRes: "mushrooms", cost: { wood: 40, mushrooms: 70 } }
    },
    gear: {
        axe: { level: 1, name: "Holzaxt", nameEn: "Wooden Axe", cost: { wood: 25, berries: 10 } },
        pouch: { level: 1, name: "Handschuhe", nameEn: "Gloves", cost: { berries: 30, wood: 30 } },
        amuletFrame: { level: 0, name: "Kristallsucher", nameEn: "Crystal Finder", cost: { wood: 250, mushrooms: 150, crystals: 10 } }
    },
    elves: JSON.parse(JSON.stringify(ELF_DESIGN)),
    powerUps: {
        chain: { cooldownUntil: 0, duration: 360 },
        idle: { cooldownUntil: 0, activeUntil: 0, duration: 240 },
        crit: { cooldownUntil: 0, activeUntil: 0, duration: 360 }
    }
};

let gameState = JSON.parse(JSON.stringify(DEFAULT_STATE));
