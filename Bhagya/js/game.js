// BHAGYA — Game Engine
// All state persists to localStorage so nothing is ever lost between sessions.

const LS_KEYS = {
  NAME: "bhagya_player_name",
  BEST_SCORE: "bhagya_best_score",
  COLLECTION: "bhagya_collection",
  RUN_STATE: "bhagya_run_state",
  SEEN_HTP: "bhagya_seen_how_to_play"
};

const RUN_LENGTH = 21;
const ROUND_SIZE = 7;
const MAX_BONUS_DRAWS = 15; // hard safety cap so bonus-draw chains can never run away

// cards that grant a bonus draw when played (id -> number of bonus draws)
const BONUS_DRAW_CARDS = {
  15: 1, // Bachat
  23: 2, // Khazana
  24: 1, // Samriddhi
  47: 1, // Gyan Ganga
  70: 1  // Nakshatra ka Ashirwad
};

const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Mythic", "Legendary"];

// ---------------------------------------------------------------
// Utility
// ---------------------------------------------------------------
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function shuffledDeck() {
  const arr = CARDS.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.map(c => c.id);
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function cardById(id) { return CARDS.find(c => c.id === id); }

function pageWipe(cb) {
  const wipe = document.createElement("div");
  wipe.className = "page-wipe active";
  document.body.appendChild(wipe);
  setTimeout(() => { cb && cb(); }, 250);
  setTimeout(() => { wipe.remove(); }, 520);
}

function showScreen(id) {
  $all(".screen").forEach(s => s.classList.add("hidden"));
  pageWipe(() => { $(id).classList.remove("hidden"); });
}

// ---------------------------------------------------------------
// Name Gate
// ---------------------------------------------------------------
function validName(v) {
  const t = v.trim();
  if (t.length < 2 || t.length > 20) return false;
  if (!/[a-zA-Z]/.test(t)) return false;
  return true;
}

function initNameGate() {
  const existing = localStorage.getItem(LS_KEYS.NAME);
  if (existing) {
    boot(existing);
    return;
  }
  $("#name-gate").classList.remove("hidden");
  const input = $("#name-input");
  const btn = $("#name-submit");
  const msg = $("#name-field-msg");

  input.addEventListener("input", () => {
    const ok = validName(input.value);
    btn.disabled = !ok;
    msg.textContent = input.value.length > 0 && !ok
      ? "Name should be 2–20 characters and include a letter."
      : "";
  });

  btn.addEventListener("click", () => {
    if (!validName(input.value)) return; // hard stop — never proceeds on invalid name
    const name = input.value.trim();
    localStorage.setItem(LS_KEYS.NAME, name);
    $("#name-gate").classList.add("hidden");
    boot(name);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !btn.disabled) btn.click();
  });
}

function boot(name) {
  $("#app").classList.remove("hidden");
  $("#player-name-chip").textContent = name;
  renderMainMenu();
  showScreen("#screen-main-menu");

  const run = loadJSON(LS_KEYS.RUN_STATE, null);
  const hasUnfinishedRun = run && run.drawIndex < RUN_LENGTH;

  if (hasUnfinishedRun) {
    setTimeout(() => offerResume(run, () => {
      if (!localStorage.getItem(LS_KEYS.SEEN_HTP)) openHowToPlay(true);
    }), 500);
  } else if (!localStorage.getItem(LS_KEYS.SEEN_HTP)) {
    setTimeout(() => openHowToPlay(true), 400);
  }
}

// ---------------------------------------------------------------
// Main Menu
// ---------------------------------------------------------------
function renderMainMenu() {
  const best = localStorage.getItem(LS_KEYS.BEST_SCORE) || 0;
  $("#best-score-display").textContent = best;
}

function offerResume(run, afterClose) {
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="panel">
      <h2 class="gold-title">Continue your journey?</h2>
      <p style="opacity:.75;margin:12px 0 20px;font-size:.9rem">
        You have an unfinished Panchang Run — draw ${run.drawIndex} of ${RUN_LENGTH}, with ${run.score} points so far.
      </p>
      <button class="btn-primary" id="resume-yes" style="margin-bottom:10px">Continue Run</button>
      <button class="btn-secondary" id="resume-no" style="width:100%">Start Fresh Instead</button>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector("#resume-yes").onclick = () => { ov.remove(); startSolo(run); };
  ov.querySelector("#resume-no").onclick = () => { localStorage.removeItem(LS_KEYS.RUN_STATE); ov.remove(); if (afterClose) afterClose(); };
}

// ---------------------------------------------------------------
// How To Play
// ---------------------------------------------------------------
function openHowToPlay(firstTime = false) {
  localStorage.setItem(LS_KEYS.SEEN_HTP, "1");
  showScreen("#screen-how-to-play");
}

// ---------------------------------------------------------------
// SOLO MODE — Ekal Yatra
// ---------------------------------------------------------------
let soloState = null;

function startSolo(resumeState = null) {
  soloDrawLocked = false;
  if (resumeState) {
    soloState = resumeState;
  } else {
    soloState = {
      deckOrder: shuffledDeck(),
      drawIndex: 0,
      score: 0,
      roundScores: [0, 0, 0],
      bonusDrawsUsed: 0,
      history: []
    };
  }
  showScreen("#screen-solo");
  renderSoloScreen();
}

function saveRun() {
  saveJSON(LS_KEYS.RUN_STATE, soloState);
}

function renderSoloScreen() {
  const s = soloState;
  const pct = Math.round((s.drawIndex / RUN_LENGTH) * 100);
  $("#solo-progress-fill").style.width = pct + "%";
  $("#solo-progress-label-current").textContent = `Draw ${s.drawIndex} / ${RUN_LENGTH}`;
  $("#solo-progress-label-round").textContent = `Round ${Math.min(3, Math.floor(s.drawIndex / ROUND_SIZE) + 1)} of 3`;
  $("#solo-score-value").textContent = s.score;

  // reset deck visual to "back" state, ready for next tap
  const flip = $("#solo-flip-card");
  flip.classList.remove("flipped");
  $("#solo-reveal-info").innerHTML = `<p style="opacity:.55;font-size:.85rem">Tap the deck to draw your next card.</p>`;
  $("#solo-card-glow").classList.remove("show");

  const deckStack = $("#solo-deck-stack");
  if (s.drawIndex >= RUN_LENGTH) {
    finishRun();
  }
}

function drawSoloCard(isBonus = false) {
  const s = soloState;
  if (!isBonus && s.drawIndex >= RUN_LENGTH) return; // hard stop, cannot over-draw

  const nextId = s.deckOrder[isBonus ? (RUN_LENGTH + s.bonusDrawsUsed) % s.deckOrder.length : s.drawIndex];
  const card = cardById(nextId);
  const modifier = drawModifierForRarity(card.rarity);

  // resolve points
  let effectMult = card.effectType.includes("Double") ? 2 : 1;
  let pts;
  if (modifier.mult === -1) {
    pts = -card.basePoints; // Vakri/Retrograde reversal
  } else {
    pts = Math.round(card.basePoints * effectMult * modifier.mult);
  }
  if (modifier.cost) pts -= modifier.cost;

  s.score = Math.max(0, s.score + pts);
  const roundIdx = Math.min(2, Math.floor((isBonus ? s.drawIndex - 1 : s.drawIndex) / ROUND_SIZE));
  s.roundScores[roundIdx] = (s.roundScores[roundIdx] || 0) + pts;

  if (!isBonus) s.drawIndex += 1;
  else s.bonusDrawsUsed += 1;

  s.history.push({ cardId: card.id, modifierId: modifier.id, points: pts, bonus: isBonus });

  // collection tracking — the base card itself is always marked discovered;
  // "none" (no modifier rolled) does not count toward the 10-modifier completion goal
  const coll = loadJSON(LS_KEYS.COLLECTION, {});
  if (!coll[card.id]) coll[card.id] = { modifiersSeen: [] };
  if (modifier.id !== "none" && !coll[card.id].modifiersSeen.includes(modifier.id)) {
    coll[card.id].modifiersSeen.push(modifier.id);
  }
  saveJSON(LS_KEYS.COLLECTION, coll);

  saveRun();
  return { card, modifier, pts };
}

function playFlipAnimation(result) {
  const { card, modifier, pts } = result;
  const flip = $("#solo-flip-card");
  const front = $("#solo-flip-front");
  const glow = $("#solo-card-glow");

  front.style.setProperty("--rarity-color", RARITY_COLOR[card.rarity]);
  front.innerHTML = `<img src="${card.img}" alt="${card.eng}">`;

  flip.classList.remove("flipped");
  void flip.offsetWidth; // reflow to restart animation
  setTimeout(() => flip.classList.add("flipped"), 60);

  glow.style.background = `radial-gradient(circle, ${RARITY_COLOR[card.rarity]}55, transparent 70%)`;
  setTimeout(() => glow.classList.add("show"), 60);

  const info = $("#solo-reveal-info");
  const modText = modifier.id !== "none" ? `<div class="reveal-modifier">✦ ${modifier.hindi} (${modifier.name})</div>` : "";
  info.innerHTML = `
    <div class="reveal-name">${card.hindi}</div>
    <div class="reveal-sub">${card.eng} · ${card.suit}</div>
    <div class="reveal-rarity-badge" style="background:${RARITY_COLOR[card.rarity]}33;color:${RARITY_COLOR[card.rarity]};border:1px solid ${RARITY_COLOR[card.rarity]}">${card.rarity}</div>
    <div class="reveal-effect">${card.desc}</div>
    <div class="reveal-points ${pts >= 0 ? "positive" : "negative"}">${pts >= 0 ? "+" : ""}${pts} pts</div>
    ${modText}
  `;

  if (["Rare", "Mythic", "Legendary"].includes(card.rarity)) {
    burstParticles(RARITY_COLOR[card.rarity], card.rarity === "Legendary");
  }

  renderScoreRollup();
}

function renderScoreRollup() {
  const el = $("#solo-score-value");
  const target = soloState.score;
  const start = parseInt(el.textContent) || 0;
  const dur = 500;
  const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(start + (target - start) * p);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function burstParticles(color, big) {
  const layer = $("#particle-layer");
  const count = big ? 40 : 20;
  const originX = window.innerWidth / 2;
  const originY = window.innerHeight / 2 - 60;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 160;
    p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    p.style.setProperty("--dy", Math.sin(angle) * dist + "px");
    p.style.left = originX + "px";
    p.style.top = originY + "px";
    p.style.background = color;
    p.style.boxShadow = `0 0 8px ${color}`;
    layer.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
  if (big) {
    const flash = document.createElement("div");
    flash.className = "flash";
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 850);
  }
}

let soloDrawLocked = false;

function handleDeckTap() {
  const s = soloState;
  if (!s || s.drawIndex >= RUN_LENGTH) return;
  if (soloDrawLocked) return; // hard stop — ignores taps while a draw is already resolving
  soloDrawLocked = true;
  $("#solo-deck-stack").classList.add("spent");

  const result = drawSoloCard(false);
  playFlipAnimation(result);

  $("#solo-progress-fill").style.width = Math.round((s.drawIndex / RUN_LENGTH) * 100) + "%";
  $("#solo-progress-label-current").textContent = `Draw ${s.drawIndex} / ${RUN_LENGTH}`;
  $("#solo-progress-label-round").textContent = `Round ${Math.min(3, Math.floor((s.drawIndex - 1) / ROUND_SIZE) + 1)} of 3`;

  // resolve any bonus draws this card grants, in sequence, after the main reveal
  let bonuses = 0;
  if (BONUS_DRAW_CARDS[result.card.id]) bonuses += BONUS_DRAW_CARDS[result.card.id];
  if (result.modifier.extraDraw) bonuses += result.modifier.extraDraw;
  bonuses = Math.min(bonuses, MAX_BONUS_DRAWS - s.bonusDrawsUsed);

  // snapshot the exact draw index and round score THIS card completed, at trigger time —
  // never re-read live state after the delay, which is what caused the fractional-round bug
  const completedDrawIndex = s.drawIndex;
  const justFinishedRound = completedDrawIndex % ROUND_SIZE === 0 && completedDrawIndex < RUN_LENGTH;
  const finishedRoundNum = completedDrawIndex / ROUND_SIZE;
  const finishedRoundScore = s.roundScores[finishedRoundNum - 1];
  const finishedTotalScore = s.score;
  const runIsComplete = completedDrawIndex >= RUN_LENGTH;

  let chain = Promise.resolve();
  for (let i = 0; i < bonuses; i++) {
    chain = chain.then(() => new Promise(res => {
      setTimeout(() => {
        const bonusResult = drawSoloCard(true);
        playFlipAnimation(bonusResult);
        res();
      }, 1400);
    }));
  }

  chain.then(() => {
    setTimeout(() => {
      soloDrawLocked = false;
      if (!soloState) return; // user may have quit mid-chain
      $("#solo-deck-stack").classList.remove("spent");
      if (runIsComplete) {
        finishRun();
      } else if (justFinishedRound) {
        showRoundBreak(finishedRoundNum, finishedRoundScore, finishedTotalScore);
      }
    }, 1500);
  });
}

function showRoundBreak(roundNum, roundScore, totalScore) {
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="panel">
      <h2 class="gold-title">Fortune So Far — Round ${roundNum} Complete</h2>
      <div class="summary-stat-grid">
        <div class="summary-stat"><div class="num">${roundScore}</div><div class="lbl">This Round</div></div>
        <div class="summary-stat"><div class="num">${totalScore}</div><div class="lbl">Total So Far</div></div>
      </div>
      <button class="btn-primary" id="round-continue">Continue to Round ${roundNum + 1}</button>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector("#round-continue").onclick = () => { ov.remove(); renderSoloScreen(); };
}

function finishRun() {
  const s = soloState;
  const best = parseInt(localStorage.getItem(LS_KEYS.BEST_SCORE) || "0");
  const isNewBest = s.score > best;
  if (isNewBest) localStorage.setItem(LS_KEYS.BEST_SCORE, s.score);
  localStorage.removeItem(LS_KEYS.RUN_STATE);

  const highest = s.history.reduce((a, h) => {
    const c = cardById(h.cardId);
    return RARITY_ORDER.indexOf(c.rarity) > RARITY_ORDER.indexOf(a) ? c.rarity : a;
  }, "Common");

  const suitCounts = {};
  s.history.forEach(h => { const c = cardById(h.cardId); suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1; });
  const topSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0];

  showScreen("#screen-run-summary");
  $("#run-summary-body").innerHTML = `
    ${isNewBest ? `<div class="best-banner">🏆 New Personal Best!</div>` : ""}
    <div class="summary-stat-grid">
      <div class="summary-stat"><div class="num">${s.score}</div><div class="lbl">Final Score</div></div>
      <div class="summary-stat"><div class="num">${highest}</div><div class="lbl">Highest Rarity</div></div>
      <div class="summary-stat"><div class="num">${topSuit ? topSuit[0] : "—"}</div><div class="lbl">Strongest Suit</div></div>
      <div class="summary-stat"><div class="num">${best > s.score ? best : s.score}</div><div class="lbl">Personal Best</div></div>
    </div>
  `;
  soloState = null;
}

function quitSoloToMenu() {
  if (soloState && soloState.drawIndex > 0 && soloState.drawIndex < RUN_LENGTH) {
    saveRun();
  }
  soloDrawLocked = false;
  $all(".overlay").forEach(ov => ov.remove()); // clear any stray round-break/summary panels
  soloState = null;
  showScreen("#screen-main-menu");
  renderMainMenu();
}

// ---------------------------------------------------------------
// Collection — Panchang Album
// ---------------------------------------------------------------
let collectionFilter = "All";

function openCollection() {
  showScreen("#screen-collection");
  renderCollection();
}

function renderCollection() {
  const coll = loadJSON(LS_KEYS.COLLECTION, {});
  const unlocked = Object.keys(coll).length;
  $("#collection-progress-text").textContent = `${unlocked} / ${CARDS.length} discovered`;

  const suits = ["All", "Prem", "Dhan", "Shakti", "Gyan", "Chaya", "Tara"];
  $("#suit-tabs").innerHTML = suits.map(s =>
    `<button class="suit-tab ${s === collectionFilter ? "active" : ""}" data-suit="${s}">${s}</button>`
  ).join("");
  $all(".suit-tab").forEach(btn => btn.onclick = () => { collectionFilter = btn.dataset.suit; renderCollection(); });

  const list = CARDS.filter(c => collectionFilter === "All" || c.suit === collectionFilter);
  $("#card-grid").innerHTML = list.map(c => {
    const entry = coll[c.id];
    const locked = !entry;
    const modCount = entry ? entry.modifiersSeen.length : 0;
    return `
      <div class="mini-card ${locked ? "locked" : ""}" data-id="${c.id}">
        ${locked ? "" : `<img src="${c.img}" alt="${c.eng}">`}
        ${locked ? "" : `<div class="mod-count">${modCount}/10</div>`}
      </div>`;
  }).join("");

  $all(".mini-card").forEach(el => {
    el.onclick = () => {
      const id = parseInt(el.dataset.id);
      if (coll[id]) openCardDetail(id, coll[id]);
    };
  });
}

function openCardDetail(id, entry) {
  const c = cardById(id);
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="panel card-detail-body">
      <button class="close-x">✕</button>
      <img src="${c.img}" alt="${c.eng}">
      <h2 class="gold-title">${c.hindi}</h2>
      <div class="reveal-sub">${c.eng} · ${c.suit} · ${c.rarity}</div>
      <p class="reveal-effect" style="margin-top:8px">${c.desc}</p>
      <div style="font-size:.72rem;opacity:.6;margin-top:12px;text-transform:uppercase;letter-spacing:.5px">Modifiers Discovered</div>
      <div class="mod-icon-row">
        ${MODIFIERS.filter(m => m.id !== "none").map(m => `<div class="mod-icon ${entry.modifiersSeen.includes(m.id) ? "seen" : ""}" title="${m.name}">${m.name[0]}</div>`).join("")}
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector(".close-x").onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

// ---------------------------------------------------------------
// Settings
// ---------------------------------------------------------------
function openSettings() {
  showScreen("#screen-settings");
  $("#settings-current-name").textContent = localStorage.getItem(LS_KEYS.NAME) || "";
}

function changeName() {
  const input = $("#settings-name-input");
  if (!validName(input.value)) {
    $("#settings-name-msg").textContent = "Name should be 2–20 characters and include a letter.";
    return;
  }
  const name = input.value.trim();
  localStorage.setItem(LS_KEYS.NAME, name);
  $("#player-name-chip").textContent = name;
  $("#settings-current-name").textContent = name;
  $("#settings-name-msg").textContent = "Saved!";
  input.value = "";
  setTimeout(() => { $("#settings-name-msg").textContent = ""; }, 1800);
}

// ---------------------------------------------------------------
// Wire up on load
// ---------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initNameGate();

  $("#mode-single-player").addEventListener("click", () => showScreen("#screen-single-player-menu"));
  $("#single-player-back").addEventListener("click", () => { showScreen("#screen-main-menu"); renderMainMenu(); });
  $("#mode-solo").addEventListener("click", () => startSolo());
  $("#solo-deck-stack").addEventListener("click", handleDeckTap);
  $("#solo-quit-btn").addEventListener("click", quitSoloToMenu);
  $("#run-summary-continue").addEventListener("click", () => { showScreen("#screen-main-menu"); renderMainMenu(); });
  $("#run-summary-again").addEventListener("click", () => startSolo());

  $("#nav-collection").addEventListener("click", openCollection);
  $("#collection-back").addEventListener("click", () => { showScreen("#screen-main-menu"); renderMainMenu(); });

  $("#nav-how-to-play").addEventListener("click", () => openHowToPlay(false));
  $("#htp-close").addEventListener("click", () => { showScreen("#screen-main-menu"); renderMainMenu(); });
  $("#htp-back-top").addEventListener("click", () => { showScreen("#screen-main-menu"); renderMainMenu(); });

  $("#nav-settings").addEventListener("click", openSettings);
  $("#settings-back").addEventListener("click", () => { showScreen("#screen-main-menu"); renderMainMenu(); });
  $("#settings-save-name").addEventListener("click", changeName);

  $all(".mode-card.disabled").forEach(el => {
    el.addEventListener("click", () => {
      alert("This mode needs online multiplayer, which is coming in the next update — once the game's backend is connected!");
    });
  });
});
