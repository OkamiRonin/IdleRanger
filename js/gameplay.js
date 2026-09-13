function loadGame() {
    try {
        const saved = localStorage.getItem("waldlaeufer_save_v5");
        if (saved) {
            const parsed = JSON.parse(saved);
            gameState = mergeDeep(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
        }
    } catch(e) {
        console.error("Ladefehler:", e);
    }

    // FIX: alte Spielstände speichern bisher ALLE Elfen-/Amulett-Felder (auch
    // Balance-Werte wie baseRate, rarity, icon, Kosten) direkt in localStorage.
    // mergeDeep überschreibt damit jede spätere Balance-Änderung wieder mit dem
    // Stand von damals (z.B. Aethelgard bleibt "Epic", obwohl er im Code längst
    // "Legendary" ist). Deshalb werden hier nach dem Laden alle Design-Werte
    // zwingend aus der aktuellen Konfiguration neu gesetzt - nur "count" (Elfen)
    // bzw. "level" (Amulette) bleiben der tatsächliche Spielfortschritt.
    resyncDesignFromDefaults();
    syncTrapProgress();

    if (gameState.settings.colorblind) {
        document.body.classList.add("colorblind-mode");
    }

    applyLanguageStrings();
    scheduleFairySpawn();
    scheduleLuminaSpawn();
    scheduleFenniraSpawn();
    updateUI();
}

function resyncDesignFromDefaults() {
    // Elves: keep only progress ("count"), refresh everything else (rarity,
    // perk, baseValue, icon, names, desc, maxCap) from DEFAULT_STATE.
    for (const key in DEFAULT_STATE.elves) {
        const defElf = DEFAULT_STATE.elves[key];
        const preservedCount = (gameState.elves[key] && gameState.elves[key].count) || 0;
        gameState.elves[key] = JSON.parse(JSON.stringify(defElf));
        gameState.elves[key].count = preservedCount;
    }

    // Amulets: keep only progress ("level"), refresh baseRate/secRes from the
    // design config and recompute cost from the design's base cost scaled to
    // the player's current level (same 1.5^level formula used on purchase).
    for (const key in AMULET_DESIGN) {
        const design = AMULET_DESIGN[key];
        const am = gameState.amulets[key];
        if (!am) continue;
        am.baseRate = design.baseRate;
        am.secRes = design.secRes;
        am.cost = { wood: Math.floor(design.baseCost.wood * Math.pow(1.5, am.level)) };
        am.cost[design.secRes] = Math.floor(design.baseCost[design.secRes] * Math.pow(1.5, am.level));
    }

    // Gear: names/descriptions may change with future updates; level & cost are
    // real progress so they stay untouched.
    for (const key in DEFAULT_STATE.gear) {
        if (gameState.gear[key]) {
            gameState.gear[key].name = DEFAULT_STATE.gear[key].name;
            gameState.gear[key].nameEn = DEFAULT_STATE.gear[key].nameEn;
        }
    }
}

function saveGame() {
    try {
        gameState.lastSave = Date.now();
        localStorage.setItem("waldlaeufer_save_v5", JSON.stringify(gameState));
        if (gameState.account.isLoggedIn && gameState.account.username) {
            localStorage.setItem(`account_${gameState.account.username}`, JSON.stringify(gameState));
        }
    } catch(e) {
        console.error("Speicherfehler:", e);
    }
}

function mergeDeep(target, source) {
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            mergeDeep(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

// Keep the permanent global trap unlock compatible with older saves. If an
// existing save already has an active trap, that rarity counts as purchased.
function syncTrapProgress() {
    const wildArea = gameState.wildArea;
    if (!wildArea) return;

    const storedRank = RARITY_ORDER.indexOf(wildArea.highestTrapRarity);
    const activeRank = (wildArea.plots || []).reduce((highest, plot) => {
        return Math.max(highest, RARITY_ORDER.indexOf(plot.trapRarity));
    }, -1);
    const highestRank = Math.max(storedRank, activeRank);
    wildArea.highestTrapRarity = highestRank >= 0 ? RARITY_ORDER[highestRank] : null;
}

function resetGamePrompt() {
    const isEn = gameState.settings.lang === "en";
    if (confirm(isEn ? "Really reset your entire game progress?" : "Möchtest du deinen gesamten Spielstand wirklich zurücksetzen?")) {
        stopProceduralBGM();
        localStorage.removeItem("waldlaeufer_save_v5");
        gameState = JSON.parse(JSON.stringify(DEFAULT_STATE));
        applyLanguageStrings();
        updateUI();
    }
}

/* 1. FAELAN DISCOUNT FIX: GEAR, AMULETS & WILD AREA TRAPS (NOT plot unlocks) */
function getGearAmuletDiscountMultiplier() {
    const red = Math.min(0.50, getElfBonus("costRed")); // Faelan, max. 50% Rabatt
    return Math.max(0.5, 1 - red);
}

/* ============ WILD AREA LOGIC ============ */

// Count active trap rarities for Elyndra's synergy bonus
function getActiveTrapRarityCount() {
    const activeRarities = new Set();
    gameState.wildArea.plots.forEach(plot => {
        if (plot.trapRarity) {
            activeRarities.add(plot.trapRarity);
        }
    });
    return activeRarities.size;
}

function getTrapCatchSeconds(rarity) {
    const base = TRAP_CONFIG[rarity].catchSec;
    const reduction = getElfBonus("trapTimeReduction"); // Ilvara, capped at 50%
    return Math.max(10, Math.floor(base * (1 - reduction)));
}

// Cost to place a trap is the missing part of the permanent global unlock.
function getTrapCost(rarity) {
    return getTrapUpgradeCost(null, rarity);
}

// Calculate the cumulative cost needed to unlock targetRarity globally.
// Once a rarity is unlocked, placing or switching to it is free on every plot.
function getTrapUpgradeCost(currentRarity, targetRarity) {
    const mult = getGearAmuletDiscountMultiplier();
    const cost = { wood: 0, berries: 0, mushrooms: 0, crystals: 0 };
    const highestUnlockedRank = gameState.wildArea
        ? RARITY_ORDER.indexOf(gameState.wildArea.highestTrapRarity)
        : -1;
    const currentRank = Math.max(
        highestUnlockedRank,
        currentRarity ? RARITY_ORDER.indexOf(currentRarity) : -1
    );
    const targetRank = RARITY_ORDER.indexOf(targetRarity);

    if (targetRank <= currentRank) return cost;

    for (let rank = currentRank + 1; rank <= targetRank; rank++) {
        const rarity = RARITY_ORDER[rank];
        for (const r in TRAP_CONFIG[rarity].cost) {
            cost[r] += Math.floor(TRAP_CONFIG[rarity].cost[r] * mult);
        }
    }
    return cost;
}

const LARGE_NUMBER_SUFFIXES = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function formatLargeNumber(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '∞';

    const sign = numericValue < 0 ? '-' : '';
    const absoluteValue = Math.floor(Math.abs(numericValue));
    if (absoluteValue < 1_000_000_000) {
        return `${sign}${absoluteValue.toLocaleString('de-DE')}`;
    }

    let suffixIndex = Math.floor(Math.log10(absoluteValue) / 3) - 3;
    suffixIndex = Math.min(LARGE_NUMBER_SUFFIXES.length - 1, Math.max(0, suffixIndex));
    let compactValue = absoluteValue / (1000 ** (suffixIndex + 3));

    if (compactValue >= 1000 && suffixIndex < LARGE_NUMBER_SUFFIXES.length - 1) {
        suffixIndex++;
        compactValue = absoluteValue / (1000 ** (suffixIndex + 3));
    }

    const decimals = compactValue < 10 && !Number.isInteger(compactValue) ? 1 : 0;
    const formattedValue = compactValue.toFixed(decimals).replace('.', ',');
    return `${sign}${formattedValue}${LARGE_NUMBER_SUFFIXES[suffixIndex]}`;
}

function formatTrapCost(cost) {
    const entries = Object.entries(cost).filter(([, value]) => value > 0);
    if (entries.length === 0) return gameState.settings.lang === 'en' ? 'Free' : 'Kostenlos';
    return entries.map(([resource, value]) => `${formatLargeNumber(value)} ${getResourceName(resource)}`).join(' + ');
}

function canAffordCost(cost) {
    for (const r in cost) {
        if ((gameState.resources[r] || 0) < cost[r]) return false;
    }
    return true;
}

function payCost(cost) {
    for (const r in cost) gameState.resources[r] -= cost[r];
}

function buyWildAreaPlot(idx) {
    const plot = gameState.wildArea.plots[idx];
    if (!plot || plot.unlocked) return;

    const cost = PLOT_UNLOCK_COSTS[idx]; // NO Faelan discount - plots stay full price
    if (!canAffordCost(cost)) {
        showNotification(gameState.settings.lang === 'en' ? "Not enough resources!" : "Nicht genügend Ressourcen!", "red");
        return;
    }
    payCost(cost);
    plot.unlocked = true;
    saveGame();
    updateUI();
}

// Places a trap on an unlocked, empty plot - OR replaces an existing trap with a
// higher-rarity one (upgrade). After a collection, this explicit selection starts
// the next catch cycle.
function placeTrap(idx, rarity) {
    const plot = gameState.wildArea.plots[idx];
    if (!plot || !plot.unlocked) return;

    const isEn = gameState.settings.lang === 'en';

    // Check if trying to place the same rarity trap (no-op)
    if (plot.trapRarity === rarity) return;

    // Calculate upgrade or downgrade cost
    const cost = getTrapUpgradeCost(plot.trapRarity, rarity);
    if (!canAffordCost(cost)) {
        showNotification(isEn ? "Not enough resources!" : "Nicht genügend Ressourcen!", "red");
        return;
    }

    // Determine if this is an upgrade or downgrade
    const isUpgrade = !plot.trapRarity || RARITY_ORDER.indexOf(rarity) > RARITY_ORDER.indexOf(plot.trapRarity);
    const actionName = isUpgrade ? (isEn ? "upgraded" : "verbessert") : (isEn ? "downgraded" : "herabgestuft");

    payCost(cost);
    if (RARITY_ORDER.indexOf(rarity) > RARITY_ORDER.indexOf(gameState.wildArea.highestTrapRarity)) {
        gameState.wildArea.highestTrapRarity = rarity;
    }
    plot.trapRarity = rarity;
    plot.awaitingTrapSelection = false;
    plot.catchReadyAt = Date.now() + getTrapCatchSeconds(rarity) * 1000;

    // Maelis (instantTrapTrigger): Chance to trigger trap immediately when placed
    const instantTriggerChance = getElfBonus("instantTrapTrigger"); // Maelis, capped at 10%
    if (Math.random() < instantTriggerChance) {
        plot.catchReadyAt = 0; // Make it ready immediately
    }

    const rarityName = isEn ? RARITIES[rarity].nameEn : RARITIES[rarity].name;
    showNotification(isEn ? `Trap ${actionName} to ${rarityName}!` : `Falle ${actionName} zu ${rarityName}!`, "emerald");

    saveGame();
    updateUI();
}

// Rolls WHICH animal a trap catches: any rarity up to (and including) the trap's
// own rarity, weighted so lower rarities are more likely even within that range.
function rollAnimalForTrap(trapRarity) {
    const trapRank = RARITY_ORDER.indexOf(trapRarity);
    const weights = [];
    for (let r = 0; r <= trapRank; r++) {
        weights.push({ rarity: RARITY_ORDER[r], weight: Math.pow(2, trapRank - r) });
    }
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosenRarity = weights[0].rarity;
    for (const w of weights) {
        if (roll < w.weight) { chosenRarity = w.rarity; break; }
        roll -= w.weight;
    }

    const speciesPool = Object.values(ANIMALS).filter(a => a.rarity === chosenRarity);
    const species = speciesPool[Math.floor(Math.random() * speciesPool.length)];

    const renyMult = (gameState.elves.reny && gameState.elves.reny.count > 0) ? 2 : 1;
    const isAlbino = Math.random() < (ALBINO_CHANCE * renyMult);

    return { species, isAlbino };
}

// Calculate base animal yield with support for fixed yields and boost restrictions
function getAnimalYield(species, isAlbino, elyndraBonus = 0) {
    if (species.fixedYield) {
        // Fixed yield animals: use the fixed amount, no buffs unless canBoost is true
        let amount = species.fixedYield;
        if (species.canBoost) {
            // For boostable fixed-yield animals (like Tier 4), apply Orin's boost
            const rarityYieldMult = 1 + getElfBonus(`animalYield${species.rarity}`);
            amount = Math.floor(amount * rarityYieldMult);
        }
        return amount;
    } else {
        // Regular yield animals: base calculation with elven bonuses
        const rarityYieldMult = 1 + getElfBonus(`animalYield${species.rarity}`);
        let amount = Math.floor(ANIMAL_YIELD_SECONDS[species.rarity] * getBasePassiveCPS() * rarityYieldMult * (1 + elyndraBonus));
        if (isAlbino) amount *= ALBINO_MULTIPLIER;
        return amount;
    }
}

// Helper function to collect a single animal and distribute resources
function _collectSingleAnimal(species, isAlbino) {
    const isEn = gameState.settings.lang === 'en';
    const name = isEn ? species.nameEn : species.name;
    const amount = getAnimalYield(species, isAlbino, 0);

    let notificationText = `${isAlbino ? '✨ ALBINO! ' : ''}${name} ${isEn ? 'caught!' : 'gefangen!'}`;

    if (amount > 0) {
        if (typeof species.resource === 'object' && species.resource !== null) {
            const totalPercent = Object.values(species.resource).reduce((a, b) => a + b, 0);
            let resourceTexts = [];
            for (const [resource, percent] of Object.entries(species.resource)) {
                const resourceAmount = Math.floor(amount * (percent / totalPercent));
                if (resourceAmount > 0) {
                    gameState.resources[resource] += resourceAmount;
                    gameState.stats[`total${capitalize(resource)}`] += resourceAmount;
                    resourceTexts.push(`+${resourceAmount} ${getResourceName(resource)}`);
                }
            }
            notificationText += ` ${resourceTexts.join(', ')}`;
        } else {
            gameState.resources[species.resource] += amount;
            gameState.stats[`total${capitalize(species.resource)}`] += amount;
            const resName = getResourceName(species.resource);
            notificationText += ` +${amount} ${resName}`;
        }
    }

    if (!gameState.animalDex[species.id]) gameState.animalDex[species.id] = { count: 0, albinoCount: 0, totalYield: 0 };
    gameState.animalDex[species.id].count++;
    if (isAlbino) gameState.animalDex[species.id].albinoCount++;
    gameState.animalDex[species.id].totalYield += amount;

    showNotification(notificationText, isAlbino ? "amber" : "emerald");
}

function collectAnimal(idx) {
    const plot = gameState.wildArea.plots[idx];
    if (!plot || !plot.trapRarity || Date.now() < plot.catchReadyAt) return;

    // First animal collection with Elyndra bonus
    const { species, isAlbino } = rollAnimalForTrap(plot.trapRarity);

    const collectAnimalToPlayer = (animal, alb, includeElyndra) => {
        const elyndra = includeElyndra ? getElfBonus("trapAnimalSynergy") * getActiveTrapRarityCount() : 0;
        const amt = getAnimalYield(animal, alb, elyndra);
        const enLang = gameState.settings.lang === 'en';
        const n = enLang ? animal.nameEn : animal.name;
        let notif = `${alb ? '✨ ALBINO! ' : ''}${n} ${enLang ? 'caught!' : 'gefangen!'}`;

        if (amt > 0) {
            if (typeof animal.resource === 'object' && animal.resource !== null) {
                const totPercent = Object.values(animal.resource).reduce((a, b) => a + b, 0);
                let resTexts = [];
                for (const [res, pct] of Object.entries(animal.resource)) {
                    const resAmt = Math.floor(amt * (pct / totPercent));
                    if (resAmt > 0) {
                        gameState.resources[res] += resAmt;
                        gameState.stats[`total${capitalize(res)}`] += resAmt;
                        resTexts.push(`+${resAmt} ${getResourceName(res)}`);
                    }
                }
                notif += ` ${resTexts.join(', ')}`;
            } else {
                gameState.resources[animal.resource] += amt;
                gameState.stats[`total${capitalize(animal.resource)}`] += amt;
                notif += ` +${amt} ${getResourceName(animal.resource)}`;
            }
        }

        if (!gameState.animalDex[animal.id]) gameState.animalDex[animal.id] = { count: 0, albinoCount: 0, totalYield: 0 };
        gameState.animalDex[animal.id].count++;
        if (alb) gameState.animalDex[animal.id].albinoCount++;
        gameState.animalDex[animal.id].totalYield += amt;
        showNotification(notif, alb ? "amber" : "emerald");
    };

    collectAnimalToPlayer(species, isAlbino, true);

    // Elandor's double catch chance
    const doubleCatchChance = getElfBonus("doubleCatchChance");
    if (Math.random() < doubleCatchChance) {
        const { species: s2, isAlbino: a2 } = rollAnimalForTrap(plot.trapRarity);
        collectAnimalToPlayer(s2, a2, false);
    }

    // Collecting ends this trap cycle. The player must explicitly select the
    // next trap before another catch can start; do not auto-recatch here.
    plot.trapRarity = null;
    plot.catchReadyAt = 0;
    plot.awaitingTrapSelection = true;
    saveGame();
    updateUI();
}

let animalDexOpen = false;
function toggleAnimalDex() {
    animalDexOpen = !animalDexOpen;
    document.getElementById("animaldex-list").classList.toggle("hidden", !animalDexOpen);
}

function formatDuration(sec) {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
}

function renderWildArea() {
    const isEn = gameState.settings.lang === 'en';
    const grid = document.getElementById("wildarea-grid");
    if (!grid) return;

    grid.innerHTML = "";

    gameState.wildArea.plots.forEach((plot, idx) => {
        const card = document.createElement("div");

        if (!plot.unlocked) {
            const cost = PLOT_UNLOCK_COSTS[idx];
            const costStr = Object.entries(cost).map(([r, v]) => `${formatLargeNumber(v)} ${getResourceName(r)}`).join(" + ") || "-";
            const canAfford = canAffordCost(cost);
            card.className = "glass-panel p-3 rounded-2xl border border-emerald-800/40 flex flex-col items-center justify-center gap-1.5 min-h-[130px] opacity-80";
            card.innerHTML = `
                <i class="fa-solid fa-lock text-2xl text-emerald-500/60 mb-1"></i>
                <span class="text-[11px] sm:text-sm text-emerald-300/70 text-center">${costStr}</span>
                <button onclick="buyWildAreaPlot(${idx})" ${canAfford ? '' : 'disabled'} class="mt-1 px-3 py-1.5 rounded-lg text-[11px] sm:text-sm font-bold ${canAfford ? 'glass-button text-emerald-100 hover:bg-emerald-600/40' : 'bg-emerald-950/50 text-emerald-500/40 cursor-not-allowed'}">
                    ${isEn ? 'Unlock' : 'Freischalten'}
                </button>
            `;
        } else if (!plot.trapRarity) {
            let btns = "";
            RARITY_ORDER.forEach(r => {
                const rData = RARITIES[r];
                const cost = getTrapCost(r);
                const costStr = formatTrapCost(cost);
                btns += `<button onclick="placeTrap(${idx}, '${r}')" title="${costStr}" class="w-full px-1.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold border ${rData.colorClass} ${rData.textClass} hover:brightness-125 transition">${isEn ? rData.nameEn : rData.name}</button>`;
            });
            card.className = "glass-panel p-3 rounded-2xl border border-emerald-500/30 flex flex-col items-center justify-center gap-1 min-h-[130px]";
            card.innerHTML = `
                <i class="fa-solid fa-boxes-stacked text-2xl text-emerald-400/70 mb-1"></i>
                <span class="text-[11px] sm:text-sm text-emerald-300/60 mb-1" data-i18n="wildAreaPlaceTrap">Falle aufstellen:</span>
                <div class="w-full space-y-1">${btns}</div>
            `;
        } else {
            const ready = Date.now() >= plot.catchReadyAt;
            const rData = RARITIES[plot.trapRarity];
            const remainingSec = Math.max(0, Math.ceil((plot.catchReadyAt - Date.now()) / 1000));

            let changeBtns = "";
            // Show change buttons ONLY when trap is ready to be collected
            if (ready) {
                RARITY_ORDER.forEach(r => {
                    if (r === plot.trapRarity) return; // Skip current trap rarity
                    const cost = getTrapUpgradeCost(plot.trapRarity, r);
                    const costStr = formatTrapCost(cost);
                    const isUpgrade = RARITY_ORDER.indexOf(r) > RARITY_ORDER.indexOf(plot.trapRarity);
                    const actionLabel = isUpgrade ? (isEn ? 'Upgrade' : 'Upgrade') : (isEn ? 'Change to' : 'Wechsel zu');
                    changeBtns += `<button onclick="placeTrap(${idx}, '${r}')" title="${costStr}" class="w-full px-1.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border ${RARITIES[r].colorClass} ${RARITIES[r].textClass} hover:brightness-125 transition">${actionLabel}: ${isEn ? RARITIES[r].nameEn : RARITIES[r].name}</button>`;
                });
            }

            card.className = `glass-panel p-3 rounded-2xl border ${rData.colorClass} flex flex-col items-center justify-center gap-1 min-h-[130px] ${ready ? 'animate-pulse' : ''}`;
            card.innerHTML = `
                <span class="text-[11px] sm:text-sm font-bold ${rData.textClass}">${isEn ? rData.nameEn : rData.name}-${isEn ? 'Trap' : 'Falle'}</span>
                ${ready
                    ? `<i class="fa-solid fa-gift text-3xl text-amber-300 my-1"></i><button onclick="collectAnimal(${idx})" class="px-3 py-1.5 rounded-lg text-[11px] sm:text-sm font-bold glass-button text-amber-200 hover:bg-amber-600/40" data-i18n="wildAreaCollect">Einsammeln</button>`
                    : `<i class="fa-solid text-2xl text-red-400/70 my-1"></i><span class="text-sm sm:text-base font-bold text-red-300">${formatDuration(remainingSec)}</span>`
                }
                <div class="w-full space-y-0.5 mt-1">${changeBtns}</div>
            `;
        }

        grid.appendChild(card);
    });
}

function updateWildAreaAlert() {
    const alertDot = document.getElementById("wildarea-alert-dot");
    if (!alertDot) return;

    const hasReadyTrap = gameState.wildArea.plots.some(plot =>
        plot.unlocked && plot.trapRarity && Date.now() >= plot.catchReadyAt
    );
    alertDot.classList.toggle("hidden", !hasReadyTrap);
}

function getResourceNameForAnimal(resource) {
    if (typeof resource === 'object' && resource !== null) {
        const resources = Object.entries(resource)
            .sort((a, b) => b[1] - a[1])
            .map(([res]) => getResourceName(res));
        return resources.join('/');
    } else {
        return getResourceName(resource);
    }
}

function renderAnimalDex() {
    const isEn = gameState.settings.lang === 'en';
    const list = document.getElementById("animaldex-list");
    const progressEl = document.getElementById("animaldex-progress");
    if (!list || !progressEl) return;

    const allAnimals = Object.values(ANIMALS);
    const discovered = allAnimals.filter(a => gameState.animalDex[a.id] && gameState.animalDex[a.id].count > 0).length;
    progressEl.innerText = `(${discovered}/${allAnimals.length})`;

    list.innerHTML = "";

    const animalsByRarity = {};
    RARITY_ORDER.forEach(rarity => {
        animalsByRarity[rarity] = allAnimals.filter(a => a.rarity === rarity);
    });

    RARITY_ORDER.forEach(rarity => {
        const animals = animalsByRarity[rarity];
        if (animals.length === 0) return;

        const rData = RARITIES[rarity];
        const groupDiscovered = animals.filter(a => gameState.animalDex[a.id] && gameState.animalDex[a.id].count > 0).length;

        const sectionDiv = document.createElement("div");
        sectionDiv.className = "flex flex-col gap-2 pb-3 border-b border-emerald-800/30";

        const headerDiv = document.createElement("div");
        headerDiv.className = `px-3 py-2 rounded-lg border ${rData.colorClass} bg-emerald-950/60`;
        headerDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-base sm:text-lg font-bold ${rData.textClass} flex items-center gap-2">
                    <i class="fa-solid fa-crown"></i>
                    ${isEn ? rData.nameEn : rData.name}
                </span>
                <span class="text-sm font-semibold text-emerald-300/80">${groupDiscovered}/${animals.length}</span>
            </div>
        `;
        sectionDiv.appendChild(headerDiv);

        const listDiv = document.createElement("div");
        listDiv.className = "flex flex-wrap gap-3 px-2";

        animals.forEach(a => {
            const entry = gameState.animalDex[a.id];
            const known = entry && entry.count > 0;
            const isAlbinoDiscovered = entry && entry.albinoCount > 0;

            const card = document.createElement("div");
            card.className = `glass-panel p-4 rounded-lg border ${known ? rData.colorClass : 'border-emerald-900/50'} flex flex-col items-center text-center gap-1.5 w-24 ${known ? '' : 'opacity-40'}`;
            card.innerHTML = `
                <div class="relative">
                    <i class="fa-solid ${known ? a.icon : 'fa-question'} text-3xl ${known ? rData.textClass : 'text-emerald-600'}"></i>
                    ${isAlbinoDiscovered ? '<i class="fa-solid fa-sparkles text-sm text-amber-300 absolute -top-1 -right-1"></i>' : ''}
                </div>
                <span class="text-xs font-bold text-emerald-100 leading-tight">${known ? (isEn ? a.nameEn : a.name) : '???'}</span>
                <span class="text-[10px] text-emerald-400/60">${known ? `${entry.count}x` : ''}</span>
                ${known ? `<span class="text-[9px] text-cyan-300/70">${Math.floor(entry.totalYield).toLocaleString('de-DE')}</span>` : ''}
                ${known ? `<span class="text-[8px] text-emerald-300/60">${getResourceNameForAnimal(a.resource)}</span>` : ''}
            `;
            listDiv.appendChild(card);
        });

        sectionDiv.appendChild(listDiv);
        list.appendChild(sectionDiv);
    });
}

function getElfBonus(perkType) {
    let total = 0;
    for (let id in gameState.elves) {
        const elf = gameState.elves[id];
        if (elf.perk === perkType && elf.count > 0) {
            let val = elf.count * elf.baseValue;
            if (elf.maxCap && val > elf.maxCap) val = elf.maxCap;
            total += val;
        }
    }
    return total;
}

// Click power WITHOUT the passive-yield synergy bonus (Rowan). Used as the
// reference stat for Nissa's passive-from-gather bonus, to avoid a circular
// dependency between click power and passive yield.
function getBaseClickPower() {
    const axeBase = gameState.gear.axe.level * 1.5;
    const elfMult = 1 + getElfBonus("clickPower");
    return Math.max(1, Math.floor(axeBase * elfMult * chainMultiplier));
}

// Rowan: +% Gather Power based on current passive yield/s. Computed from the
// BASE passive rate (pre-Nissa-bonus) and applied after all other click power
// calculations, so it never feeds back into itself.
function getClickPowerSynergyBonus() {
    const rowan = gameState.elves.rowan;
    if (!rowan || rowan.count === 0) return 0;
    let bonus = rowan.count * rowan.baseValue * getBasePassiveCPS();
    if (rowan.maxCap && bonus > rowan.maxCap) bonus = rowan.maxCap;
    return bonus;
}
