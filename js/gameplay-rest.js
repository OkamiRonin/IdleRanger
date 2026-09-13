function getClickPower() {
    const base = getBaseClickPower();
    const synergyMult = 1 + getClickPowerSynergyBonus();
    return Math.max(1, Math.floor(base * synergyMult));
}

function getCritChance() {
    let baseCrit = 0.05 + (gameState.gear.pouch.level - 1) * 0.02;
    baseCrit += getElfBonus("critChance");

    if (Date.now() < gameState.powerUps.crit.activeUntil) {
        baseCrit += 0.50;
    }
    return baseCrit;
}

/* 2. VAELEN BALANCING: CRYSTAL CHANCE STRICTLY CAPPED */
function getCrystalChance() {
    let baseChance = 0.03 + (gameState.gear.amuletFrame.level * 0.008);
    const vaelenBonus = getElfBonus("crystalChance");
    return Math.min(0.35, baseChance + vaelenBonus);
}

function getPowerUpCooldownReduction(elfKey) {
    const count = gameState.elves[elfKey].count;
    if (count <= 1) return 0;
    const dupLevels = count - 1;
    return Math.min(0.75, dupLevels * 0.01);
}

function getEffectivePowerUpCD(puType) {
    const pu = gameState.powerUps[puType];
    let elfKey = "ignis";
    if (puType === "idle") elfKey = "aeris";
    if (puType === "crit") elfKey = "valerius";

    const red = getPowerUpCooldownReduction(elfKey);
    return Math.floor(pu.duration * (1 - red));
}

function getBasePassiveCPS() {
    let total = 0;
    const elfPassiveMult = 1 + getElfBonus("passiveYield");
    let powerUpMult = 1;
    if (Date.now() < gameState.powerUps.idle.activeUntil) {
        powerUpMult = 2.0;
    }
    for (let res in gameState.amulets) {
        const am = gameState.amulets[res];
        total += (am.level * am.baseRate) * elfPassiveMult * powerUpMult;
    }
    return total;
}

function getPassiveYieldSynergyBonus() {
    const nissa = gameState.elves.nissa;
    if (!nissa || nissa.count === 0) return 0;
    let bonus = nissa.count * nissa.baseValue * getBaseClickPower();
    if (nissa.maxCap && bonus > nissa.maxCap) bonus = nissa.maxCap;
    return bonus;
}

function getResourcePerSecond() {
    let rates = { wood: 0, berries: 0, mushrooms: 0, crystals: 0 };
    const elfPassiveMult = 1 + getElfBonus("passiveYield");
    const synergyMult = 1 + getPassiveYieldSynergyBonus();

    let powerUpMult = 1;
    if (Date.now() < gameState.powerUps.idle.activeUntil) {
        powerUpMult = 2.0;
    }

    for (let res in gameState.amulets) {
        const am = gameState.amulets[res];
        rates[res] = (am.level * am.baseRate) * elfPassiveMult * powerUpMult * synergyMult;
    }
    return rates;
}

function getTotalCPS() {
    const r = getResourcePerSecond();
    return Object.values(r).reduce((a, b) => a + b, 0);
}

const forageBtn = document.getElementById("forage-btn");
if (forageBtn) {
    forageBtn.addEventListener("click", (e) => {
        playSFX('woodchop');

        const zone = ZONES[gameState.currentZone];
        const clickPower = getClickPower();
        const totalCritChance = getCritChance();

        let critMultiplier = 1;
        let critCount = 0;
        let tempChance = totalCritChance;

        while (tempChance > 0) {
            if (tempChance >= 1.0) {
                critCount++;
                tempChance -= 1.0;
            } else {
                if (Math.random() < tempChance) critCount++;
                break;
            }
        }

        if (critCount > 0) {
            critMultiplier = critCount + 1;
        }

        const finalGain = clickPower * critMultiplier;
        let bonusMsg = "";

        if (zone.primaryRes === "balanced") {
            const balancedGain = Math.max(1, Math.floor(finalGain * 0.5));
            gameState.resources.wood += balancedGain;
            gameState.resources.berries += balancedGain;
            gameState.resources.mushrooms += balancedGain;

            gameState.stats.totalWood += balancedGain;
            gameState.stats.totalBerries += balancedGain;
            gameState.stats.totalMushrooms += balancedGain;
        } else {
            gameState.resources[zone.primaryRes] += finalGain;
            gameState.stats[`total${capitalize(zone.primaryRes)}`] += finalGain;

            if (Math.random() < 0.35) {
                const secGain = Math.max(1, Math.floor(finalGain * 0.5));
                gameState.resources[zone.secondaryRes] += secGain;
                gameState.stats[`total${capitalize(zone.secondaryRes)}`] += secGain;
                bonusMsg = ` +${secGain} ${getResourceName(zone.secondaryRes)}`;
            }
        }

        const bonusPowerVal = Math.max(1, Math.floor(clickPower * 0.10));

        if (Math.random() < getElfBonus("woodBonus")) {
            gameState.resources.wood += bonusPowerVal;
            gameState.stats.totalWood += bonusPowerVal;
            bonusMsg += ` +${bonusPowerVal} Holz!`;
        }
        if (Math.random() < getElfBonus("mushBonus")) {
            gameState.resources.mushrooms += bonusPowerVal;
            gameState.stats.totalMushrooms += bonusPowerVal;
            bonusMsg += ` +${bonusPowerVal} Pilze!`;
        }
        if (Math.random() < getElfBonus("berryBonus")) {
            gameState.resources.berries += bonusPowerVal;
            gameState.stats.totalBerries += bonusPowerVal;
            bonusMsg += ` +${bonusPowerVal} Beeren!`;
        }

        if (Math.random() < getCrystalChance()) {
            let crysGained = 1;
            if (Math.random() < getElfBonus("doubleCrystal")) {
                crysGained = 2;
                bonusMsg += ` +2 Kristalle!`;
            } else {
                bonusMsg += ` +1 Kristall!`;
            }
            gameState.resources.crystals += crysGained;
            gameState.stats.totalCrystals += crysGained;
        }

        gameState.stats.totalClicks++;

        let isCrit = critCount > 0;
        let primName = zone.primaryRes === "balanced" ? "All-Res" : getResourceName(zone.primaryRes);
        let displayGain = zone.primaryRes === "balanced" ? Math.max(1, Math.floor(finalGain * 0.5)) : finalGain;
        let floatText = `+${displayGain} ${primName}${bonusMsg}`;
        if (critCount > 1) {
            floatText = `MULTI-CRIT x${critCount + 1}! (+${displayGain} ${primName})`;
        } else if (critCount === 1) {
            floatText = `CRIT! +${displayGain} ${primName}`;
        }

        createFloatingText(e, floatText, isCrit, critCount > 1);
        updateUI();
    });
}

function createFloatingText(e, text, isCrit, isMulti) {
    if (!forageBtn) return;
    const rect = forageBtn.getBoundingClientRect();
    const el = document.createElement("div");

    let col = "text-emerald-200";
    if (isMulti) col = "text-cyan-300 font-black scale-125 animate-pulse";
    else if (isCrit) col = "text-amber-300 font-black scale-110";

    el.className = `float-text text-xs sm:text-sm ${col}`;
    el.innerText = text;

    const x = e.clientX ? (e.clientX - rect.left) : (rect.width / 2);
    const y = e.clientY ? (e.clientY - rect.top) : (rect.height / 2);

    el.style.left = `${x + (Math.random() * 30 - 15)}px`;
    el.style.top = `${y - 15}px`;

    forageBtn.appendChild(el);
    setTimeout(() => el.remove(), 850);
}

/* 1. FAELAN DISCOUNT EXCLUDED FROM GACHA PACKS (FIXED FIXED PRICES) */
function buyElfPack(packType, count = 1) {
    let cWood = 0, cBerries = 0, cCrys = 0;

    if (packType === 'basic') {
        cWood = 100 * count;
        cBerries = 100 * count;
        cCrys = 1 * count;
        if (gameState.resources.wood < cWood || gameState.resources.berries < cBerries || gameState.resources.crystals < cCrys) {
            showNotification(gameState.settings.lang === 'en' ? "Not enough resources!" : "Nicht genügend Ressourcen!", "red");
            return;
        }
        gameState.resources.wood -= cWood;
        gameState.resources.berries -= cBerries;
        gameState.resources.crystals -= cCrys;
    } else if (packType === 'magic') {
        cCrys = 15 * count;
        if (gameState.resources.crystals < cCrys) {
            showNotification(gameState.settings.lang === 'en' ? "Not enough crystals!" : "Nicht genügend Kristalle!", "red");
            return;
        }
        gameState.resources.crystals -= cCrys;
    }

    performPackPull(packType, count);
}

function performPackPull(packType, count = 1) {
    playSFX('packOpen');

    let pulledResults = [];
    for (let i = 0; i < count; i++) {
        const elfId = pullSingleElfKey(packType);
        const elf = gameState.elves[elfId];
        const isNew = elf.count === 0;
        elf.count++;
        pulledResults.push({ elf, isNew });

        if (isNew && elf.perk === "fairySpawn") scheduleFairySpawn();
        if (isNew && elf.perk === "mythicFairySpawn") scheduleLuminaSpawn();
        if (isNew && elf.perk === "trapTimeFairySpawn") scheduleFenniraSpawn();
    }

    const isEn = gameState.settings.lang === 'en';

    if (count === 1) {
        const item = pulledResults[0];
        const rData = RARITIES[item.elf.rarity];

        const cardBox = document.getElementById("gacha-modal-card");
        cardBox.className = `glass-panel p-6 rounded-3xl max-w-sm w-full text-center border-2 ${rData.colorClass} space-y-4`;
        document.getElementById("gacha-elf-icon").className = `fa-solid ${item.elf.icon}`;

        const rarEl = document.getElementById("gacha-elf-rarity");
        rarEl.innerText = isEn ? rData.nameEn : rData.name;
        rarEl.className = `px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${rData.colorClass} ${rData.textClass}`;

        document.getElementById("gacha-elf-name").innerText = isEn ? item.elf.nameEn : item.elf.name;
        document.getElementById("gacha-elf-level").innerText = `Level ${item.elf.count} ${item.isNew ? '(Neu! / New!)' : '(Duplikat!)'}`;
        document.getElementById("gacha-elf-desc").innerText = isEn ? item.elf.descEn : item.elf.desc;
        document.getElementById("gacha-modal").classList.remove("hidden");
    } else {
        document.getElementById("gacha-multi-title").innerText = isEn ? `${count}x Elf Summon!` : `${count}x Elfen-Ziehung!`;

        const listContainer = document.getElementById("gacha-multi-list");
        listContainer.innerHTML = "";
        pulledResults.forEach(res => {
            const rData = RARITIES[res.elf.rarity];
            const row = document.createElement("div");
            row.className = `p-2.5 rounded-xl border flex items-center justify-between text-xs ${rData.colorClass}`;
            row.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fa-solid ${res.elf.icon} text-base ${rData.textClass}"></i>
                    <div>
                        <div class="font-bold text-emerald-100">${isEn ? res.elf.nameEn : res.elf.name} <span class="text-[10px] ${rData.textClass}">(${isEn ? rData.nameEn : rData.name})</span></div>
                        <div class="text-[10px] text-emerald-300/70">${isEn ? res.elf.descEn : res.elf.desc}</div>
                    </div>
                </div>
                <div class="text-right">
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${res.isNew ? 'bg-amber-500/30 text-amber-300 border border-amber-400/50' : 'bg-emerald-900/60 text-emerald-300'}">
                        Lvl ${res.elf.count} ${res.isNew ? '(NEU!)' : ''}
                    </span>
                </div>
            `;
            listContainer.appendChild(row);
        });
        document.getElementById("gacha-multi-modal").classList.remove("hidden");
    }

    saveGame();
    updateUI();
}

function grantFreeMagicPack() {
    gameState.packs.magic += 1;
    showNotification(gameState.settings.lang === 'en' ? "Starlight Fairy grants a Magic Pack! (Check your inventory)" : "Sternenfee schenkt dir ein Magic Pack! (Siehe Inventar)", "cyan");
    saveGame();
    updateUI();
}

function openInventoryPack(packType) {
    if (gameState.packs[packType] <= 0) return;
    gameState.packs[packType] -= 1;
    performPackPull(packType, 1);
}

function pullSingleElfKey(packType) {
    let selectedRarity = "Common";
    const rand = Math.random();

    if (packType === 'magic') {
        if (rand < 0.01) selectedRarity = "Mythic";
        else if (rand < 0.15) selectedRarity = "Legendary";
        else if (rand < 0.50) selectedRarity = "Epic";
        else if (rand < 0.85) selectedRarity = "Rare";
        else selectedRarity = "Uncommon";
    } else {
        if (rand < 0.02) selectedRarity = "Legendary";
        else if (rand < 0.10) selectedRarity = "Epic";
        else if (rand < 0.30) selectedRarity = "Rare";
        else if (rand < 0.65) selectedRarity = "Uncommon";
        else selectedRarity = "Common";
    }
    return getRandomElfByRarity(selectedRarity);
}

function isElfCapped(id) {
    const elf = gameState.elves[id];
    if (!elf || elf.count === 0) return false;

    if (elf.maxCount) return elf.count >= elf.maxCount;
    if (!elf.maxCap) return false;

    if (id === "rowan") return (elf.count * elf.baseValue * getBasePassiveCPS()) >= elf.maxCap;
    if (id === "nissa") return (elf.count * elf.baseValue * getBaseClickPower()) >= elf.maxCap;
    return (elf.count * elf.baseValue) >= elf.maxCap;
}

function isElfEligible(id) {
    if (id === "reny") {
        return Object.keys(ANIMALS).every(aid => gameState.animalDex[aid] && gameState.animalDex[aid].count > 0);
    }
    return true;
}

function getRandomElfByRarity(rarity) {
    let filtered = Object.values(gameState.elves).filter(e => e.rarity === rarity && !isElfCapped(e.id) && isElfEligible(e.id));
    if (filtered.length === 0) {
        filtered = Object.values(gameState.elves).filter(e => e.rarity === rarity && isElfEligible(e.id));
    }
    if (filtered.length === 0) return "sylas";
    return filtered[Math.floor(Math.random() * filtered.length)].id;
}

function closeGachaModal() {
    document.getElementById("gacha-modal").classList.add("hidden");
}

function closeGachaMultiModal() {
    document.getElementById("gacha-multi-modal").classList.add("hidden");
}

function activatePowerUp(type) {
    let requiredElf = "ignis";
    if (type === 'idle') requiredElf = "aeris";
    if (type === 'crit') requiredElf = "valerius";

    if (gameState.elves[requiredElf].count === 0) {
        const isEn = gameState.settings.lang === 'en';
        const eName = isEn ? gameState.elves[requiredElf].nameEn : gameState.elves[requiredElf].name;
        showNotification(`${isEn ? 'Requires Elf:' : 'Benötigt Elfe:'} ${eName}!`, "red");
        return;
    }

    const now = Date.now();
    const pu = gameState.powerUps[type];
    if (now < pu.cooldownUntil) return;

    playSFX('spellCast');
    const effectiveCD = getEffectivePowerUpCD(type);

    if (type === 'chain') {
        startChainChopping();
        pu.cooldownUntil = now + (effectiveCD * 1000);
    } else if (type === 'idle') {
        pu.activeUntil = now + (30 * 1000);
        pu.cooldownUntil = now + (effectiveCD * 1000);
        showNotification("Segen des Waldes aktiviert! (2x Passiv-Ertrag)", "emerald");
    } else if (type === 'crit') {
        pu.activeUntil = now + (30 * 1000);
        pu.cooldownUntil = now + (effectiveCD * 1000);
        showNotification("Fokus der Elfen aktiviert! (+50% Crit)", "cyan");
    }

    saveGame();
    updateUI();
}

/* 4.5. PITCH-RISING KETTENFÄLLER COMBOS */
function startChainChopping() {
    chainActive = true;
    chainHits = 0;
    chainMultiplier = 1;
    showNotification("Kettenfällen gestartet! Klicke die Symbole!", "amber");
    spawnChainTarget();
}

function spawnChainTarget() {
    clearTimeout(chainTimer);
    if (currentChainTargetEl) {
        currentChainTargetEl.remove();
        currentChainTargetEl = null;
    }

    if (!chainActive) return;

    const overlay = document.getElementById("chain-target-overlay");
    const btn = document.createElement("button");

    const timeLimit = Math.max(650, 2800 - (chainHits * 140));
    const x = Math.floor(Math.random() * (window.innerWidth - 90)) + 15;
    const y = Math.floor(Math.random() * (window.innerHeight - 180)) + 70;

    btn.className = "absolute pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full glass-panel border-2 border-amber-400 bg-amber-500/30 text-amber-300 flex flex-col items-center justify-center shadow-xl animate-bounce cursor-pointer active:scale-90 transition-transform z-50";
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;

    btn.innerHTML = `
        <i class="fa-solid fa-tree text-2xl sm:text-3xl drop-shadow"></i>
        <span class="text-[9px] font-black text-white bg-amber-950/80 px-1.5 rounded-full border border-amber-400/50">+${Math.round((chainHits + 1) * 20)}%</span>
    `;

    btn.onclick = (e) => {
        e.stopPropagation();
        chainHits++;
        playSFX('chainHit', chainHits);
        chainMultiplier = 1 + (chainHits * 0.2);
        createFloatingText(e, `Kette x${chainHits}! (+${Math.round((chainMultiplier-1)*100)}%)`, true, false);
        spawnChainTarget();
    };

    overlay.appendChild(btn);
    currentChainTargetEl = btn;

    chainTimer = setTimeout(() => {
        endChainChopping(false);
    }, timeLimit);
}

function endChainChopping(completed) {
    if (currentChainTargetEl) {
        currentChainTargetEl.remove();
        currentChainTargetEl = null;
    }

    if (chainHits > 0) {
        showNotification(`Kettenfällen beendet! +${Math.round((chainMultiplier - 1) * 100)}% Sammelkraft!`, "amber");
        clearTimeout(chainBuffTimer);
        chainBuffTimer = setTimeout(() => {
            chainMultiplier = 1;
            chainHits = 0;
            chainActive = false;
            updateUI();
        }, 10000);
    } else {
        showNotification("Kettenfällen verpasst!", "red");
        chainMultiplier = 1;
        chainHits = 0;
        chainActive = false;
    }
    updateUI();
}

function getSariaCooldownRange() {
    const saria = gameState.elves.saria;
    const dupLevels = Math.max(0, saria.count - 1);
    return { minSec: 60, maxSec: Math.max(90, 300 - dupLevels) };
}

function getLuminaCooldownRange() {
    const lumina = gameState.elves.lumina;
    const dupLevels = Math.max(0, lumina.count - 1);
    const cdReductionSec = Math.min(15, dupLevels) * 60;
    return { minSec: 300, maxSec: Math.max(300, 3600 - cdReductionSec) };
}

function renderFairyCooldownBar() {
    const isEn = gameState.settings.lang === 'en';
    const bar = document.getElementById("fairy-cooldown-bar");
    if (!bar) return;

    let html = "";
    const saria = gameState.elves.saria;
    if (saria.count > 0) {
        const r = getSariaCooldownRange();
        html += `<div class="flex-1 max-w-[160px] bg-purple-950/50 border border-purple-500/30 rounded-xl px-2 py-1 flex items-center justify-center gap-1.5 text-[10px] text-purple-200">
            <i class="fa-solid fa-feather text-purple-300"></i>
            <span class="font-bold">${isEn ? 'Fairy min CD:' : 'Waldfee min. CD:'} ${r.minSec}s–${r.maxSec}s</span>
        </div>`;
    }

    const lumina = gameState.elves.lumina;
    if (lumina.count > 0) {
        const r = getLuminaCooldownRange();
        html += `<div class="flex-1 max-w-[160px] bg-rose-950/50 border border-rose-500/30 rounded-xl px-2 py-1 flex items-center justify-center gap-1.5 text-[10px] text-rose-200">
            <i class="fa-solid fa-star text-rose-300"></i>
            <span class="font-bold">${isEn ? 'Starlight min CD:' : 'Sternenfee min. CD:'} ${Math.round(r.minSec / 60)}–${Math.round(r.maxSec / 60)} Min</span>
        </div>`;
    }

    bar.innerHTML = html;
}

function scheduleFairySpawn() {
    clearTimeout(fairyTimeout);
    const saria = gameState.elves.saria;
    if (saria.count === 0) return;

    const r = getSariaCooldownRange();
    const delayMs = (Math.floor(Math.random() * (r.maxSec - r.minSec)) + r.minSec) * 1000;
    fairyTimeout = setTimeout(spawnFairyOnScreen, delayMs);
}

function spawnFairyOnScreen() {
    const overlay = document.getElementById("chain-target-overlay");
    const fairyBtn = document.createElement("button");

    const x = Math.floor(Math.random() * (window.innerWidth - 100)) + 20;
    const y = Math.floor(Math.random() * (window.innerHeight - 200)) + 80;

    fairyBtn.className = "absolute pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full glass-panel border-2 border-purple-400 bg-purple-500/40 text-purple-200 flex flex-col items-center justify-center shadow-2xl fairy-animation cursor-pointer active:scale-90 transition-transform z-50";
    fairyBtn.style.left = `${x}px`;
    fairyBtn.style.top = `${y}px`;

    fairyBtn.innerHTML = `
        <i class="fa-solid fa-feather text-2xl sm:text-3xl text-purple-300 drop-shadow"></i>
        <span class="text-[8px] font-black text-purple-100 bg-purple-950/80 px-1 rounded-full border border-purple-400/50">Waldfee</span>
    `;

    fairyBtn.onclick = (e) => {
        e.stopPropagation();
        playSFX('spellCast');

        const saria = gameState.elves.saria;
        const dupLevels = Math.max(0, saria.count - 1);
        const extraClicks = dupLevels * 5;
        const totalClicksYield = 100 + extraClicks;

        const gain = getClickPower() * totalClicksYield;
        const zone = ZONES[gameState.currentZone];

        if (zone.primaryRes === "balanced") {
            gameState.resources.wood += gain;
            gameState.resources.berries += gain;
            gameState.resources.mushrooms += gain;
        } else {
            gameState.resources[zone.primaryRes] += gain;
        }

        createFloatingText(e, `WALDFEE! +${gain}`, true, true);
        showNotification(`Saria beschenkt dich mit Ertrag von ${totalClicksYield} Klicks!`, "cyan");

        fairyBtn.remove();
        scheduleFairySpawn();
        updateUI();
    };

    overlay.appendChild(fairyBtn);

    setTimeout(() => {
        if (fairyBtn.parentNode) {
            fairyBtn.remove();
            scheduleFairySpawn();
        }
    }, 20000);
}

function scheduleLuminaSpawn() {
    clearTimeout(luminaTimeout);
    const lumina = gameState.elves.lumina;
    if (!lumina || lumina.count === 0) return;

    const r = getLuminaCooldownRange();
    const delayMs = (Math.floor(Math.random() * (r.maxSec - r.minSec + 1)) + r.minSec) * 1000;
    luminaTimeout = setTimeout(spawnLuminaOnScreen, delayMs);
}

function spawnLuminaOnScreen() {
    const overlay = document.getElementById("chain-target-overlay");
    const luminaBtn = document.createElement("button");

    const x = Math.floor(Math.random() * (window.innerWidth - 100)) + 20;
    const y = Math.floor(Math.random() * (window.innerHeight - 200)) + 80;

    luminaBtn.className = "absolute pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full glass-panel border-2 border-rose-400 bg-gradient-to-br from-rose-500/40 to-purple-500/40 text-rose-200 flex flex-col items-center justify-center shadow-2xl fairy-animation cursor-pointer active:scale-90 transition-transform z-50";
    luminaBtn.style.left = `${x}px`;
    luminaBtn.style.top = `${y}px`;

    luminaBtn.innerHTML = `
        <i class="fa-solid fa-star text-2xl sm:text-3xl text-rose-200 drop-shadow"></i>
        <span class="text-[8px] font-black text-rose-100 bg-rose-950/80 px-1 rounded-full border border-rose-400/50">Sternenfee</span>
    `;

    luminaBtn.onclick = (e) => {
        e.stopPropagation();
        playSFX('spellCast');
        grantFreeMagicPack();
        luminaBtn.remove();
        scheduleLuminaSpawn();
    };

    overlay.appendChild(luminaBtn);

    setTimeout(() => {
        if (luminaBtn.parentNode) {
            luminaBtn.remove();
            scheduleLuminaSpawn();
        }
    }, 20000);
}

function getFenniraCooldownRange() {
    const fennira = gameState.elves.fennira;
    const dupLevels = Math.max(0, fennira.count - 1);
    const cdReductionSec = Math.min(10, dupLevels) * 60;
    return { minSec: 120, maxSec: Math.max(120, 900 - cdReductionSec) };
}

function scheduleFenniraSpawn() {
    clearTimeout(fenniraTimeout);
    const fennira = gameState.elves.fennira;
    if (!fennira || fennira.count === 0) return;

    const r = getFenniraCooldownRange();
    const delayMs = (Math.floor(Math.random() * (r.maxSec - r.minSec + 1)) + r.minSec) * 1000;
    fenniraTimeout = setTimeout(spawnFenniraOnScreen, delayMs);
}

function spawnFenniraOnScreen() {
    const overlay = document.getElementById("chain-target-overlay");
    const fenniraBtn = document.createElement("button");

    const x = Math.floor(Math.random() * (window.innerWidth - 100)) + 20;
    const y = Math.floor(Math.random() * (window.innerHeight - 200)) + 80;

    fenniraBtn.className = "absolute pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full glass-panel border-2 border-cyan-400 bg-gradient-to-br from-cyan-500/40 to-blue-500/40 text-cyan-200 flex flex-col items-center justify-center shadow-2xl fairy-animation cursor-pointer active:scale-90 transition-transform z-50";
    fenniraBtn.style.left = `${x}px`;
    fenniraBtn.style.top = `${y}px`;

    fenniraBtn.innerHTML = `
        <i class="fa-solid fa-hourglass-half text-2xl sm:text-3xl text-cyan-200 drop-shadow"></i>
        <span class="text-[8px] font-black text-cyan-100 bg-cyan-950/80 px-1 rounded-full border border-cyan-400/50">Zeitfee</span>
    `;

    fenniraBtn.onclick = (e) => {
        e.stopPropagation();
        playSFX('spellCast');

        let affected = 0;
        gameState.wildArea.plots.forEach(plot => {
            if (plot.trapRarity && plot.catchReadyAt > Date.now()) {
                const remaining = plot.catchReadyAt - Date.now();
                plot.catchReadyAt -= Math.floor(remaining * 0.10);
                affected++;
            }
        });
        const isEn = gameState.settings.lang === 'en';
        showNotification(isEn ? `Time Fairy sped up ${affected} trap(s) by 10%!` : `Zeitfee beschleunigt ${affected} Falle(n) um 10%!`, "cyan");

        saveGame();
        updateUI();

        fenniraBtn.remove();
        scheduleFenniraSpawn();
    };

    overlay.appendChild(fenniraBtn);

    setTimeout(() => {
        if (fenniraBtn.parentNode) {
            fenniraBtn.remove();
            scheduleFenniraSpawn();
        }
    }, 20000);
}

function buyAmuletLevel(resKey) {
    const am = gameState.amulets[resKey];
    const mult = getGearAmuletDiscountMultiplier();
    const secKey = am.secRes;
    const costWood = Math.floor(am.cost.wood * mult);
    const costSec = am.cost[secKey] ? Math.floor(am.cost[secKey] * mult) : 0;

    if (gameState.resources.wood >= costWood && (!costSec || gameState.resources[secKey] >= costSec)) {
        gameState.resources.wood -= costWood;
        if (costSec) gameState.resources[secKey] -= costSec;

        let levelsGained = 1;
        const aethelChance = getElfBonus("doubleUpgrade");
        if (Math.random() < aethelChance) {
            levelsGained = 2;
            showNotification("Aethelgard verdoppelt dein Amulett-Upgrade kostenlos!", "amber");
        }

        am.level += levelsGained;
        am.cost.wood = Math.floor(am.cost.wood * Math.pow(1.5, levelsGained));
        if (am.cost[secKey]) am.cost[secKey] = Math.floor(am.cost[secKey] * Math.pow(1.5, levelsGained));

        updateUI();
        saveGame();
    }
}

function upgradeGear(gearKey) {
    const item = gameState.gear[gearKey];
    const mult = getGearAmuletDiscountMultiplier();
    let canBuy = true;

    for (let r in item.cost) {
        if (gameState.resources[r] < Math.floor(item.cost[r] * mult)) {
            canBuy = false;
            break;
        }
    }

    if (canBuy) {
        playSFX('gearUpgrade');

        for (let r in item.cost) {
            gameState.resources[r] -= Math.floor(item.cost[r] * mult);
            const scaleFactor = gearKey === 'amuletFrame' ? 2.2 : 1.6;
            item.cost[r] = Math.floor(item.cost[r] * scaleFactor);
        }

        let levelsGained = 1;
        const aethelChance = getElfBonus("doubleUpgrade");
        if (Math.random() < aethelChance) {
            levelsGained = 2;
            showNotification("Aethelgard verdoppelt dein Werkzeug-Upgrade kostenlos!", "amber");
        }

        item.level += levelsGained;
        updateUI();
        saveGame();
    }
}

function unlockZone(zoneIdx) {
    const zone = ZONES[zoneIdx];
    if (!zone.req) return;

    const mult = getGearAmuletDiscountMultiplier();
    let canBuy = true;
    for (let r in zone.req) {
        if (gameState.resources[r] < Math.floor(zone.req[r] * mult)) {
            canBuy = false;
            break;
        }
    }

    if (canBuy) {
        for (let r in zone.req) {
            gameState.resources[r] -= Math.floor(zone.req[r] * mult);
        }
        gameState.unlockedZones.push(zoneIdx);
        gameState.currentZone = zoneIdx;

        if (zone.crystalReward) {
            gameState.resources.crystals += zone.crystalReward;
            gameState.stats.totalCrystals += zone.crystalReward;
            showNotification(`Gebiet freigeschaltet! +${zone.crystalReward} Kristalle Belohnung!`, "cyan");
        }

        if (gameState.settings.bgmEnabled) {
            startProceduralBGM();
        }

        updateUI();
        saveGame();
    }
}

function selectZone(zoneIdx) {
    if (gameState.unlockedZones.includes(zoneIdx)) {
        gameState.currentZone = zoneIdx;
        if (gameState.settings.bgmEnabled) {
            startProceduralBGM();
        }
        updateUI();
    }
}

/* SETTINGS & MODAL CONTROLS */
function openSettingsModal() {
    document.getElementById("setting-language").value = gameState.settings.lang;
    document.getElementById("setting-colorblind").checked = gameState.settings.colorblind;
    document.getElementById("setting-sfx-vol").value = gameState.settings.sfxVolume;
    document.getElementById("setting-bgm-vol").value = gameState.settings.bgmVolume;
    document.getElementById("sfx-vol-val").innerText = `${gameState.settings.sfxVolume}%`;
    document.getElementById("bgm-vol-val").innerText = `${gameState.settings.bgmVolume}%`;

    const badge = document.getElementById("account-status-badge");
    if (gameState.account.isLoggedIn) {
        badge.innerText = gameState.account.username;
        badge.className = "text-[10px] px-2 py-0.5 rounded-full bg-cyan-900 text-cyan-300 border border-cyan-500 font-bold";
    } else {
        badge.innerText = gameState.settings.lang === 'en' ? "Guest" : "Gast";
        badge.className = "text-[10px] px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-300 border border-emerald-700";
    }

    document.getElementById("settings-modal").classList.remove("hidden");
}

function closeSettingsModal() {
    document.getElementById("settings-modal").classList.add("hidden");
}

function changeLanguage(langKey) {
    gameState.settings.lang = langKey;
    applyLanguageStrings();
    updateUI();
    saveGame();
}

function applyLanguageStrings() {
    const lang = gameState.settings.lang;
    const dict = I18N[lang] || I18N.de;

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (dict[key]) {
            el.innerText = dict[key];
        }
    });
}

function toggleColorblindMode(enabled) {
    gameState.settings.colorblind = enabled;
    if (enabled) {
        document.body.classList.add("colorblind-mode");
    } else {
        document.body.classList.remove("colorblind-mode");
    }
    updateUI();
    saveGame();
}

function updateAudioSettings() {
    gameState.settings.sfxVolume = parseInt(document.getElementById("setting-sfx-vol").value);
    gameState.settings.bgmVolume = parseInt(document.getElementById("setting-bgm-vol").value);

    document.getElementById("sfx-vol-val").innerText = `${gameState.settings.sfxVolume}%`;
    document.getElementById("bgm-vol-val").innerText = `${gameState.settings.bgmVolume}%`;

    if (gameState.settings.bgmEnabled) {
        startProceduralBGM();
    }
    saveGame();
}

function handleAccountAuth(action) {
    const userEl = document.getElementById("auth-username");
    const passEl = document.getElementById("auth-password");
    const user = userEl.value.trim();
    const pass = passEl.value.trim();

    const isEn = gameState.settings.lang === 'en';

    if (!user || !pass) {
        showNotification(isEn ? "Enter username & password!" : "Benutzername & Passwort eingeben!", "red");
        return;
    }

    if (action === 'register') {
        if (localStorage.getItem(`account_${user}`)) {
            showNotification(isEn ? "User already exists!" : "Benutzer existiert bereits!", "red");
            return;
        }
        gameState.account.username = user;
        gameState.account.isLoggedIn = true;
        saveGame();
        showNotification(isEn ? "Account registered & saved!" : "Account registriert & gespeichert!", "cyan");
        openSettingsModal();
    } else if (action === 'login') {
        const existing = localStorage.getItem(`account_${user}`);
        if (!existing) {
            showNotification(isEn ? "Account not found!" : "Account nicht gefunden!", "red");
            return;
        }
        const parsed = JSON.parse(existing);
        gameState = mergeDeep(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
        syncTrapProgress();
        gameState.account.username = user;
        gameState.account.isLoggedIn = true;
        applyLanguageStrings();
        updateUI();
        showNotification(isEn ? "Logged in successfully!" : "Erfolgreich angemeldet!", "emerald");
        openSettingsModal();
    }
}

function exportSavegame() {
    const str = btoa(JSON.stringify(gameState));
    navigator.clipboard.writeText(str).then(() => {
        showNotification(gameState.settings.lang === 'en' ? "Save string copied!" : "Spielstand in Zwischenablage kopiert!", "cyan");
    }).catch(() => {
        prompt("Save String:", str);
    });
}

function importSavegamePrompt() {
    const isEn = gameState.settings.lang === 'en';
    const str = prompt(isEn ? "Paste Save String:" : "Füge deinen Speicherstand-Code ein:");
    if (str) {
        try {
            const parsed = JSON.parse(atob(str));
            gameState = mergeDeep(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
            syncTrapProgress();
            applyLanguageStrings();
            updateUI();
            saveGame();
            showNotification(isEn ? "Save imported!" : "Spielstand importiert!", "emerald");
        } catch(e) {
            showNotification(isEn ? "Invalid Save Code!" : "Ungültiger Code!", "red");
        }
    }
}

function updateUI() {
    const isEn = gameState.settings.lang === 'en';

    document.getElementById("res-wood").innerText = Math.floor(gameState.resources.wood).toLocaleString('de-DE');
    document.getElementById("res-berries").innerText = Math.floor(gameState.resources.berries).toLocaleString('de-DE');
    document.getElementById("res-mushrooms").innerText = Math.floor(gameState.resources.mushrooms).toLocaleString('de-DE');
    document.getElementById("res-crystals").innerText = Math.floor(gameState.resources.crystals).toLocaleString('de-DE');
    document.getElementById("cps-val").innerText = getTotalCPS().toFixed(1);

    const currentZoneData = ZONES[gameState.currentZone];
    document.getElementById("zone-badge").innerText = currentZoneData.badge;
    document.getElementById("zone-name").innerText = isEn ? currentZoneData.nameEn : currentZoneData.name;
    document.getElementById("zone-desc").innerText = isEn ? currentZoneData.descEn : currentZoneData.desc;
    document.getElementById("zone-icon").className = `fa-solid ${currentZoneData.icon} text-6xl sm:text-7xl text-emerald-400 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] group-hover:scale-110 transition duration-200`;
    document.body.style.background = ZONE_BACKGROUNDS[gameState.currentZone] || ZONE_BACKGROUNDS[0];
    renderFairyCooldownBar();
    renderWildArea();
    updateWildAreaAlert();
    renderAnimalDex();

    document.getElementById("stat-click-power").innerText = `+${getClickPower()} / Klick`;
    const critVal = Math.round(getCritChance() * 100);
    document.getElementById("stat-crit-chance").innerText = `${critVal}% ${critVal > 100 ? '(Multi!)' : ''}`;
    document.getElementById("stat-crystal-chance").innerText = `${(getCrystalChance() * 100).toFixed(1)}%`;

    document.getElementById("pack-basic-cost").innerText = `100 ${getResourceName('berries')} + 100 ${getResourceName('wood')} + 1 ${getResourceName('crystals')}`;
    document.getElementById("pack-magic-cost").innerText = `15 ${getResourceName('crystals')}`;

    document.getElementById("pack-basic-inventory").innerText = gameState.packs.basic;
    document.getElementById("pack-magic-inventory").innerText = gameState.packs.magic;
    document.getElementById("pack-basic-open-btn").disabled = gameState.packs.basic <= 0;
    document.getElementById("pack-magic-open-btn").disabled = gameState.packs.magic <= 0;

    updatePowerUpUI();
    renderAmulets();
    renderElvesTab();
    renderGear();
    renderPowerUpsTab();
    renderZones();
}

function updatePowerUpUI() {
    const now = Date.now();
    const types = [
        { type: 'chain', elfKey: 'ignis' },
        { type: 'idle', elfKey: 'aeris' },
        { type: 'crit', elfKey: 'valerius' }
    ];

    const isEn = gameState.settings.lang === 'en';

    types.forEach(item => {
        const pu = gameState.powerUps[item.type];
        const isOwned = gameState.elves[item.elfKey].count > 0;
        const statusEl = document.getElementById(`quick-pu-${item.type}-status`);
        const barEl = document.getElementById(`quick-pu-${item.type}-bar`);

        if (!statusEl || !barEl) return;

        if (!isOwned) {
            statusEl.innerText = isEn ? "Locked" : "Gesperrt";
            statusEl.className = "text-[9px] text-red-400 font-bold";
            barEl.style.width = "0%";
            return;
        }

        const isCooling = now < pu.cooldownUntil;
        const isActive = (item.type === 'idle' || item.type === 'crit') && (now < pu.activeUntil);

        if (isActive) {
            const remainingActive = Math.ceil((pu.activeUntil - now) / 1000);
            statusEl.innerText = `${remainingActive}s active`;
            statusEl.className = "text-[9px] text-green-300 font-bold animate-pulse";
            barEl.style.width = "100%";
        } else if (isCooling) {
            const remainingCd = Math.ceil((pu.cooldownUntil - now) / 1000);
            statusEl.innerText = `${remainingCd}s CD`;
            statusEl.className = "text-[9px] text-gray-400 font-bold";
            const cdTotal = getEffectivePowerUpCD(item.type) * 1000;
            const cdElapsed = cdTotal - (pu.cooldownUntil - now);
            barEl.style.width = `${Math.min(100, Math.max(0, (cdElapsed / cdTotal) * 100))}%`;
        } else {
            statusEl.innerText = isEn ? "Ready" : "Bereit";
            statusEl.className = "text-[9px] text-amber-300 font-bold";
            barEl.style.width = "100%";
        }
    });

    const activeBuffsBar = document.getElementById("active-buffs-bar");
    if (activeBuffsBar) {
        activeBuffsBar.innerHTML = "";
        if (chainMultiplier > 1) {
            activeBuffsBar.innerHTML += `<span class="px-2.5 py-1 bg-amber-950/80 border border-amber-400 text-amber-300 rounded-full font-bold shadow animate-bounce"><i class="fa-solid fa-bolt mr-1"></i> Kettenfällen: +${Math.round((chainMultiplier-1)*100)}%</span>`;
        }
        if (now < gameState.powerUps.idle.activeUntil) {
            const sec = Math.ceil((gameState.powerUps.idle.activeUntil - now) / 1000);
            activeBuffsBar.innerHTML += `<span class="px-2.5 py-1 bg-emerald-950/80 border border-emerald-400 text-emerald-300 rounded-full font-bold shadow animate-pulse"><i class="fa-solid fa-leaf mr-1"></i> Segen (2x Idle): ${sec}s</span>`;
        }
        if (now < gameState.powerUps.crit.activeUntil) {
            const sec = Math.ceil((gameState.powerUps.crit.activeUntil - now) / 1000);
            activeBuffsBar.innerHTML += `<span class="px-2.5 py-1 bg-cyan-950/80 border border-cyan-400 text-cyan-300 rounded-full font-bold shadow animate-pulse"><i class="fa-solid fa-crosshairs mr-1"></i> Fokus (+50% Crit): ${sec}s</span>`;
        }
    }
}

function renderAmulets() {
    const container = document.getElementById("amulets-list");
    if (!container) return;
    container.innerHTML = "";

    const mult = getGearAmuletDiscountMultiplier();
    const amuletMeta = [
        { key: "wood", name: "Amulett des Holzes", nameEn: "Wood Amulet", icon: "fa-tree", resName: getResourceName('wood') },
        { key: "berries", name: "Beeren-Amulett", nameEn: "Berry Amulet", icon: "fa-apple-whole", resName: getResourceName('berries') },
        { key: "mushrooms", name: "Pilz-Runenstein", nameEn: "Mushroom Runestone", icon: "fa-campground", resName: getResourceName('mushrooms') }
    ];

    const isEn = gameState.settings.lang === 'en';

    amuletMeta.forEach(meta => {
        const am = gameState.amulets[meta.key];
        const secKey = am.secRes;
        const cWood = Math.floor(am.cost.wood * mult);
        const cSec = am.cost[secKey] ? Math.floor(am.cost[secKey] * mult) : 0;

        const canAfford = gameState.resources.wood >= cWood && (!cSec || gameState.resources[secKey] >= cSec);

        let costText = `${formatLargeNumber(cWood)} ${getResourceName('wood')}`;
        if (cSec) costText += ` + ${formatLargeNumber(cSec)} ${getResourceName(secKey)}`;

        const card = document.createElement("div");
        card.className = "glass-panel p-3.5 rounded-2xl flex items-center justify-between border border-emerald-800/30";
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-300 text-xl shrink-0">
                    <i class="fa-solid ${meta.icon}"></i>
                </div>
                <div>
                    <div class="font-bold text-emerald-100">${isEn ? meta.nameEn : meta.name} <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">Lvl ${am.level}</span></div>
                    <div class="text-xs text-emerald-300/70">+${(am.level * am.baseRate).toFixed(2)} ${meta.resName}/s</div>
                    <div class="text-[11px] text-amber-300/80 mt-0.5">Cost: ${costText}</div>
                </div>
            </div>
            <button onclick="buyAmuletLevel('${meta.key}')" class="px-3.5 py-2 glass-button text-xs font-bold rounded-xl shrink-0 ${canAfford ? 'text-emerald-100 hover:bg-emerald-600/40' : 'opacity-40 cursor-not-allowed text-gray-400'}">
                ${isEn ? 'Upgrade' : 'Verbessern'}
            </button>
        `;
        container.appendChild(card);
    });
}

function renderElvesTab() {
    const isEn = gameState.settings.lang === 'en';
    const costReductionPercent = getElfBonus("costRed") * 100;
    const costReductionLabel = costReductionPercent.toFixed(costReductionPercent % 1 === 0 ? 0 : 1).replace('.', ',');
    const bonusSummaryEl = document.getElementById("active-elf-bonuses-summary");
    if (bonusSummaryEl) {
        bonusSummaryEl.innerHTML = `
            <div>- ${isEn ? 'Gear Cost:' : 'Upgrade-Kosten:'} <b class="text-emerald-200">-${costReductionLabel}%</b></div>
            <div>+ ${isEn ? 'Passive Yield:' : 'Passiv-Ertrag:'} <b class="text-emerald-200">+${Math.round(getElfBonus("passiveYield") * 100)}%</b></div>
            <div>+ ${isEn ? 'Crit Chance:' : 'Crit-Chance:'} <b class="text-emerald-200">+${Math.round(getElfBonus("critChance") * 100)}%</b></div>
            <div>+ ${isEn ? 'Double Tick:' : 'Doppel-Tick:'} <b class="text-amber-300">+${Math.round(getElfBonus("doubleTick") * 100)}%</b></div>
            <div>+ ${isEn ? 'Gather Power:' : 'Sammelkraft:'} <b class="text-emerald-200">+${Math.round(getElfBonus("clickPower") * 100)}%</b></div>
            <div>+ ${isEn ? 'Crystal Drop:' : 'Kristall-Drop:'} <b class="text-cyan-300">+${(getCrystalChance() * 100).toFixed(1)}%</b></div>
            <div>+ ${isEn ? 'Double Crystal:' : 'Doppel-Kristall:'} <b class="text-cyan-300">+${Math.round(getElfBonus("doubleCrystal") * 100)}%</b></div>
            <div>+ ${isEn ? 'Free Upgrade:' : 'Doppel-Upgrade:'} <b class="text-amber-300">+${Math.round(getElfBonus("doubleUpgrade") * 100)}%</b></div>
            <div>+ ${isEn ? 'Gather from Passive:' : 'Sammelkraft durch Ertrag:'} <b class="text-emerald-200">+${Math.round(getClickPowerSynergyBonus() * 100)}%</b></div>
            <div>+ ${isEn ? 'Passive from Gather:' : 'Ertrag durch Sammelkraft:'} <b class="text-emerald-200">+${Math.round(getPassiveYieldSynergyBonus() * 100)}%</b></div>
        `;
    }

    const collectionEl = document.getElementById("elves-collection-list");
    if (!collectionEl) return;
    collectionEl.innerHTML = "";

    Object.values(gameState.elves).forEach(elf => {
        const isUnlocked = elf.count > 0;
        const rData = RARITIES[elf.rarity];
        let bonusStr = `+${Math.round(getElfBonus(elf.perk) * 100)}%`;
        if (elf.perk.startsWith("powerup") || elf.perk === "fairySpawn" || elf.perk === "mythicFairySpawn" || elf.perk === "trapTimeFairySpawn") {
            bonusStr = isUnlocked ? (isEn ? "Unlocked" : "Freigeschaltet") : (isEn ? "Locked" : "Gesperrt");
        } else if (elf.perk === "clickFromPassive") {
            bonusStr = `+${Math.round(getClickPowerSynergyBonus() * 100)}%`;
        } else if (elf.perk === "passiveFromClick") {
            bonusStr = `+${Math.round(getPassiveYieldSynergyBonus() * 100)}%`;
        } else if (elf.perk === "trapTimeReduction") {
            bonusStr = `-${Math.round(getElfBonus(elf.perk) * 100)}%`;
        } else if (elf.perk === "albinoChanceMult") {
            bonusStr = isUnlocked ? "x2" : (isEn ? "Locked" : "Gesperrt");
        }

        const isMaxed = isElfCapped(elf.id);
        const levelStr = isMaxed ? "MAX" : `${isEn ? 'Level' : 'Level'} ${elf.count}`;

        const card = document.createElement("div");
        card.className = `glass-panel p-3 rounded-2xl flex items-center justify-between border ${rData.colorClass} ${isUnlocked ? '' : 'opacity-50'}`;
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-950/80 border flex items-center justify-center text-lg shrink-0 ${rData.colorClass} ${rData.textClass}">
                    <i class="fa-solid ${elf.icon}"></i>
                </div>
                <div>
                    <div class="font-bold text-emerald-100 text-xs sm:text-sm flex items-center gap-2">
                        ${isEn ? elf.nameEn : elf.name}
                        <span class="text-[9px] font-bold px-1.5 py-0.2 rounded ${rData.colorClass} ${rData.textClass}">
                            ${isEn ? rData.nameEn : rData.name} ${gameState.settings.colorblind ? `[${rData.code}]` : ''}
                        </span>
                    </div>
                    <div class="text-[11px] text-emerald-300/70">${isEn ? elf.descEn : elf.desc}</div>
                </div>
            </div>
            <div class="text-right shrink-0">
                <div class="text-xs font-bold ${isMaxed ? 'text-amber-300' : rData.textClass}">${levelStr}</div>
                <div class="text-[10px] text-emerald-200/80">${bonusStr}</div>
            </div>
        `;
        collectionEl.appendChild(card);
    });
}

const GEAR_ICON_TIERS = {
    axe: ["fa-hammer", "fa-fire", "fa-bolt", "fa-gem", "fa-crown"],
    pouch: ["fa-hand-fist", "fa-hands", "fa-hand-sparkles", "fa-shield", "fa-shield-halved"]
};

function getGearTierIndex(level) {
    return Math.min(4, Math.floor(Math.max(0, level - 1) / 5));
}

function renderGear() {
    const container = document.getElementById("gear-list");
    if (!container) return;
    container.innerHTML = "";

    const isEn = gameState.settings.lang === 'en';
    const mult = getGearAmuletDiscountMultiplier();
    const gearMeta = [
        { key: "axe", name: isEn ? gameState.gear.axe.nameEn : gameState.gear.axe.name, desc: isEn ? "Increases manual gathering power." : "Erhöht manuelle Sammelkraft." },
        { key: "pouch", name: isEn ? gameState.gear.pouch.nameEn : gameState.gear.pouch.name, desc: isEn ? "Increases Critical Chance by +2% per level." : "Erhöht Kritische Chance um +2% pro Stufe." },
        { key: "amuletFrame", icon: "fa-gem", name: isEn ? gameState.gear.amuletFrame.nameEn : gameState.gear.amuletFrame.name, desc: isEn ? "Increases Crystal drop chance." : "Erhöht Kristall-Dropchance beim Sammeln." }
    ];

    gearMeta.forEach(g => {
        const item = gameState.gear[g.key];
        let canAfford = true;
        let costParts = [];

        for (let r in item.cost) {
            const cVal = Math.floor(item.cost[r] * mult);
            costParts.push(`${formatLargeNumber(cVal)} ${getResourceName(r)}`);
            if (gameState.resources[r] < cVal) canAfford = false;
        }

        let icon = g.icon;
        let iconColorClass = "text-amber-400";
        if (GEAR_ICON_TIERS[g.key]) {
            const tierIdx = getGearTierIndex(item.level);
            icon = GEAR_ICON_TIERS[g.key][tierIdx];
            iconColorClass = RARITIES[RARITY_ORDER[tierIdx]].textClass;
        }

        const card = document.createElement("div");
        card.className = "glass-panel p-3.5 rounded-2xl flex items-center justify-between border border-emerald-800/30";
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center ${iconColorClass} text-xl shrink-0">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div>
                    <div class="font-bold text-emerald-100">${g.name} <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">Lvl ${item.level}</span></div>
                    <div class="text-xs text-emerald-300/70">${g.desc}</div>
                    <div class="text-[11px] text-amber-300/80 mt-0.5">Cost: ${costParts.join(", ")}</div>
                </div>
            </div>
            <button onclick="upgradeGear('${g.key}')" class="px-3.5 py-2 glass-button text-xs font-bold rounded-xl shrink-0 ${canAfford ? 'text-emerald-100 hover:bg-emerald-600/40' : 'opacity-40 cursor-not-allowed text-gray-400'}">
                ${isEn ? 'Upgrade' : 'Verbessern'}
            </button>
        `;
        container.appendChild(card);
    });
}

function renderPowerUpsTab() {
    const container = document.getElementById("powerups-list");
    if (!container) return;
    container.innerHTML = "";

    const now = Date.now();
    const isEn = gameState.settings.lang === 'en';

    const puData = [
        { key: 'chain', elfKey: 'ignis', title: isEn ? 'Chain Chop' : 'Kettenfällen', icon: 'fa-bolt-lightning text-amber-400', desc: isEn ? 'Click floating tree targets for massive gather power boosts.' : 'Sammle fliegende Baum-Symbole für einen massiven Sammelkraft-Bonus.' },
        { key: 'idle', elfKey: 'aeris', title: isEn ? 'Forest Blessing' : 'Segen des Waldes', icon: 'fa-leaf text-emerald-400', desc: isEn ? 'Doubles automatic passive yield of all amulets for 30s.' : 'Verdoppelt für 30 Sekunden den automatischen Passiv-Ertrag aller Amulette.' },
        { key: 'crit', elfKey: 'valerius', title: isEn ? 'Elven Focus' : 'Fokus der Elfen', icon: 'fa-crosshairs text-cyan-400', desc: isEn ? 'Increases Crit Chance by +50% for 30s (Enables Multi-Crits).' : 'Erhöht deine Crit-Chance für 30 Sekunden um +50% (Ermöglicht Multi-Crits).' }
    ];

    puData.forEach(pu => {
        const state = gameState.powerUps[pu.key];
        const requiredElf = gameState.elves[pu.elfKey];
        const isOwned = requiredElf.count > 0;

        const effectiveCD = getEffectivePowerUpCD(pu.key);
        const cdReductionPercent = Math.round(getPowerUpCooldownReduction(pu.elfKey) * 100);

        const isCooling = now < state.cooldownUntil;
        const isActive = (pu.key === 'idle' || pu.key === 'crit') && (now < state.activeUntil);

        let btnText = isEn ? "Activate" : "Aktivieren";
        let btnStyle = "glass-button text-emerald-100 hover:bg-emerald-600/40";

        if (!isOwned) {
            btnText = isEn ? "Locked" : "Gesperrt";
            btnStyle = "opacity-40 cursor-not-allowed bg-red-950/60 text-red-300 border border-red-500/30";
        } else if (isActive) {
            const sec = Math.ceil((state.activeUntil - now) / 1000);
            btnText = `${isEn ? 'Active' : 'Aktiv'} (${sec}s)`;
            btnStyle = "bg-emerald-600 border border-emerald-300 text-white animate-pulse";
        } else if (isCooling) {
            const sec = Math.ceil((state.cooldownUntil - now) / 1000);
            btnText = `CD (${sec}s)`;
            btnStyle = "opacity-50 cursor-not-allowed bg-emerald-950 text-gray-400";
        }

        const card = document.createElement("div");
        card.className = "glass-panel p-4 rounded-2xl border border-emerald-800/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3";
        card.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-2xl shrink-0 mt-1 sm:mt-0">
                    <i class="fa-solid ${pu.icon}"></i>
                </div>
                <div>
                    <div class="font-bold text-emerald-100 text-base">${pu.title}</div>
                    <div class="text-xs text-emerald-300/80 mt-0.5">${pu.desc}</div>
                    <div class="text-[11px] text-amber-300/80 mt-1 flex items-center gap-2">
                        <span>${isEn ? 'Requires:' : 'Erforderlich:'} <b>${isEn ? requiredElf.nameEn : requiredElf.name}</b></span>
                        <span>• CD: ${effectiveCD}s ${cdReductionPercent > 0 ? `(-${cdReductionPercent}%)` : ''}</span>
                    </div>
                </div>
            </div>
            <button onclick="activatePowerUp('${pu.key}')" ${!isOwned || isCooling || isActive ? 'disabled' : ''} class="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs transition shrink-0 ${btnStyle}">
                ${btnText}
            </button>
        `;
        container.appendChild(card);
    });
}

function renderZones() {
    const container = document.getElementById("zones-list");
    if (!container) return;
    container.innerHTML = "";

    const isEn = gameState.settings.lang === 'en';
    const mult = getGearAmuletDiscountMultiplier();

    ZONES.forEach((zone, idx) => {
        const isUnlocked = gameState.unlockedZones.includes(idx);
        const isCurrent = gameState.currentZone === idx;

        let canAfford = true;
        let reqParts = [];
        if (zone.req) {
            for (let r in zone.req) {
                const cVal = Math.floor(zone.req[r] * mult);
                reqParts.push(`${formatLargeNumber(cVal)} ${getResourceName(r)}`);
                if (gameState.resources[r] < cVal) canAfford = false;
            }
        }

        const card = document.createElement("div");
        card.className = `glass-panel p-3.5 rounded-2xl flex items-center justify-between border ${isCurrent ? 'border-amber-400/60 bg-emerald-900/30' : 'border-emerald-800/30'}`;

        let btnHTML = "";
        if (isCurrent) {
            btnHTML = `<span class="text-xs font-bold text-amber-400 px-3 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/30">${isEn ? 'Active' : 'Aktiv'}</span>`;
        } else if (isUnlocked) {
            btnHTML = `<button onclick="selectZone(${idx})" class="px-3.5 py-2 glass-button text-xs font-bold rounded-xl text-emerald-100 hover:bg-emerald-600/40">${isEn ? 'Travel' : 'Reisen'}</button>`;
        } else {
            btnHTML = `<button onclick="unlockZone(${idx})" class="px-3.5 py-2 glass-button text-xs font-bold rounded-xl ${canAfford ? 'text-emerald-100 hover:bg-emerald-600/40' : 'opacity-40 cursor-not-allowed text-gray-400'}">${isEn ? 'Unlock' : 'Freischalten'}</button>`;
        }

        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl shrink-0">
                    <i class="fa-solid ${zone.icon}"></i>
                </div>
                <div>
                    <div class="font-bold text-emerald-100">${isEn ? zone.nameEn : zone.name} <span class="text-xs text-emerald-400 font-normal">(${zone.badge})</span></div>
                    <div class="text-xs text-emerald-300/70">${isEn ? zone.descEn : zone.desc}</div>
                    ${!isUnlocked ? `<div class="text-[11px] text-amber-300/80 mt-0.5">Req: ${reqParts.join(", ")}</div>` : `<div class="text-[11px] text-cyan-300 mt-0.5">+${zone.crystalReward} ${isEn ? 'Crystals Reward' : 'Kristalle Belohnung'}</div>`}
                </div>
            </div>
            <div class="shrink-0">${btnHTML}</div>
        `;
        container.appendChild(card);
    });
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function getResourceName(k) {
    const isEn = gameState.settings.lang === 'en';
    switch(k) {
        case 'wood': return isEn ? 'Wood' : 'Holz';
        case 'berries': return isEn ? 'Berries' : 'Beeren';
        case 'mushrooms': return isEn ? 'Mushrooms' : 'Pilze';
        case 'crystals': return isEn ? 'Crystals' : 'Kristalle';
        case 'basicPack': return isEn ? 'Basic Pack' : 'Einfaches Pack';
        case 'mythicPack': return isEn ? 'Mythic Pack' : 'Mystisches Pack';
        default: return '';
    }
}

function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.remove("hidden");

    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.remove("text-emerald-400", "bg-emerald-900/50", "border", "border-emerald-500/30");
        btn.classList.add("text-emerald-300/60");
    });

    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.remove("text-emerald-300/60");
        activeBtn.classList.add("text-emerald-400", "bg-emerald-900/50", "border", "border-emerald-500/30");
    }
}

function showNotification(msg, color = "emerald") {
    const notif = document.createElement("div");
    const colorClasses = {
        emerald: "bg-emerald-900/90 border-emerald-400 text-emerald-100",
        amber: "bg-amber-900/90 border-amber-400 text-amber-100",
        cyan: "bg-cyan-900/90 border-cyan-400 text-cyan-100",
        red: "bg-red-900/90 border-red-400 text-red-100"
    };
    notif.className = `fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl border ${colorClasses[color] || colorClasses.emerald} text-xs sm:text-sm font-bold shadow-2xl transition-all duration-300 transform -translate-y-4 opacity-0 pointer-events-none`;
    notif.innerText = msg;
    document.body.appendChild(notif);

    setTimeout(() => notif.classList.remove("-translate-y-4", "opacity-0"), 10);
    setTimeout(() => {
        notif.classList.add("-translate-y-4", "opacity-0");
        setTimeout(() => notif.remove(), 300);
    }, 2500);
}

/* PASSIVE REVENUE LOOP */
setInterval(() => {
    const rates = getResourcePerSecond();
    const doubleTickChance = getElfBonus("doubleTick");

    for (let res in rates) {
        let amount = rates[res];
        if (Math.random() < doubleTickChance) {
            amount *= 2;
        }
        gameState.resources[res] += amount;
        gameState.stats[`total${capitalize(res)}`] += amount;
    }
    updateUI();
}, 1000);

setInterval(saveGame, 10000);

window.onload = function() {
    loadGame();
};
