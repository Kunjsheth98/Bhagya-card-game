// BHAGYA — Shared Battle UI
// Renders the #screen-duel board for BOTH multiplayer Duel of Fates and single-player
// Bot Battle. `onPlayCard(index)` is provided by whichever mode is currently active.

function renderPips(wins, total) {
  let html = "";
  for (let i = 0; i < total; i++) html += `<span class="pip ${i < wins ? "filled" : ""}"></span>`;
  return html;
}

function renderFlags(flags) {
  const out = [];
  if (flags.shield) out.push(`<span class="flag-chip">🛡 Shielded</span>`);
  if (flags.locked) out.push(`<span class="flag-chip">🔒 Locked</span>`);
  if (flags.skipNext) out.push(`<span class="flag-chip">⏭ Skip Pending</span>`);
  return out.join("");
}

function showTooltip(anchor, text) {
  $all(".tooltip-box").forEach(t => t.remove());
  const box = document.createElement("div");
  box.className = "tooltip-box";
  box.textContent = text;
  document.body.appendChild(box);
  const r = anchor.getBoundingClientRect();
  box.style.left = Math.min(window.innerWidth - 250, r.left) + "px";
  box.style.top = (r.bottom + 8 + window.scrollY) + "px";
  setTimeout(() => document.addEventListener("click", function h(e) { if (!box.contains(e.target)) { box.remove(); document.removeEventListener("click", h); } }), 10);
}

/**
 * @param state        the battle state
 * @param myUid        my own uid
 * @param opponentUid  opponent's uid
 * @param opponentName display name for opponent (bot difficulty label or real name)
 * @param onPlayCard   fn(index) called when I tap one of my own playable cards
 * @param opts         { showTimer: bool }
 */
function renderBattleBoard(state, myUid, opponentUid, opponentName, onPlayCard, opts = {}) {
  const winsNeeded = state.winsNeeded || 3;
  const totalPips = winsNeeded * 2 - 1;

  $("#duel-my-name").textContent = state.players[myUid].name;
  $("#duel-opp-name").textContent = opponentName;
  $("#duel-round-label").textContent = `Round ${state.round}`;
  $("#duel-my-round-score").textContent = state.roundScores[myUid];
  $("#duel-opp-round-score").textContent = state.roundScores[opponentUid];

  $("#duel-my-pips").innerHTML = renderPips(state.roundWins[myUid], totalPips);
  $("#duel-opp-pips").innerHTML = renderPips(state.roundWins[opponentUid], totalPips);

  $("#duel-my-flags").innerHTML = renderFlags(state.flags[myUid]);
  $("#duel-opp-flags").innerHTML = renderFlags(state.flags[opponentUid]);

  const isMyTurn = state.turnUid === myUid && state.phase === "playing";
  const timerRing = $("#duel-timer-ring");
  if (opts.showTimer === false) {
    timerRing.classList.add("hidden");
    $("#duel-turn-banner").textContent = isMyTurn ? "Your move — choose a card" : `${opponentName} is thinking…`;
  } else {
    timerRing.classList.remove("hidden");
    $("#duel-turn-banner").textContent = isMyTurn ? "Your move — choose a card" : `Waiting for ${opponentName}…`;
  }
  $("#duel-turn-banner").classList.toggle("my-turn", isMyTurn);

  const canSeeOpp = (state.revealTo[opponentUid] || []).includes(myUid);
  $("#duel-opp-hand").innerHTML = state.hands[opponentUid].map(c => {
    if (c.played) return `<div class="duel-mini-card played"></div>`;
    if (canSeeOpp) { const cd = cardById(c.cardId); return `<div class="duel-mini-card revealed" title="${cd.hindi}"><img src="${cd.img}"></div>`; }
    return `<div class="duel-mini-card"></div>`;
  }).join("");

  $("#duel-my-hand").innerHTML = state.hands[myUid].map((c, i) => {
    const cd = cardById(c.cardId);
    const disabled = c.played || !isMyTurn;
    return `
      <div class="duel-hand-card ${c.played ? "played" : ""} ${disabled ? "disabled" : ""}" data-i="${i}" style="--rc:${RARITY_COLOR[cd.rarity]}">
        <img src="${cd.img}" alt="${cd.eng}">
        <div class="duel-hand-card-body">
          <div class="duel-hand-card-name">${cd.hindi}</div>
          <div class="duel-hand-card-rarity" style="color:${RARITY_COLOR[cd.rarity]}">${cd.rarity} · ${cd.suit}</div>
          <div class="duel-hand-card-desc">${cd.desc}</div>
        </div>
      </div>`;
  }).join("");

  $all(".duel-hand-card:not(.disabled)").forEach(el => {
    el.addEventListener("click", () => onPlayCard(parseInt(el.dataset.i)));
  });

  const lastLog = $("#duel-last-play");
  if (state.lastPlay) {
    const p = state.lastPlay;
    const cd = cardById(p.cardId);
    const who = p.uid === myUid ? "You" : opponentName;
    lastLog.textContent = `${who} played ${cd.hindi}: ${p.notes.join(", ")}`;
  } else {
    lastLog.textContent = "";
  }
}

let battleRoundEndShownFor = -1;
function showBattleRoundEnd(state, myUid, opponentName, onContinue) {
  if (battleRoundEndShownFor === state.round) return;
  battleRoundEndShownFor = state.round;
  const iWon = state.roundWinnerUid === myUid;
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="panel">
      <h2 class="gold-title">${iWon ? "You won this round!" : opponentName + " won this round"}</h2>
      <div class="summary-stat-grid">
        <div class="summary-stat"><div class="num">${state.roundScores[myUid]}</div><div class="lbl">Your Score</div></div>
        <div class="summary-stat"><div class="num">${state.roundScores[state.order.find(u => u !== myUid)]}</div><div class="lbl">${opponentName}'s Score</div></div>
      </div>
      <p style="opacity:.7;font-size:.85rem;margin-bottom:14px">Round wins: You ${state.roundWins[myUid]} — ${state.roundWins[state.order.find(u => u !== myUid)]} ${opponentName}</p>
      <button class="btn-primary" id="battle-round-continue">Continue to Round ${state.round + 1}</button>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector("#battle-round-continue").onclick = () => { ov.remove(); onContinue(); };
}

let battleMatchEndShown = false;
function showBattleMatchEnd(state, myUid, opponentName, onExit) {
  if (battleMatchEndShown) return;
  battleMatchEndShown = true;
  const iWon = state.winnerUid === myUid;
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="panel">
      <h2 class="gold-title">${iWon ? "Victory!" : "Defeat"}</h2>
      <p style="opacity:.8;margin:10px 0">${state.winReason === "afk"
        ? (iWon ? `${opponentName} went away too long — you win by default.` : "You were away too long and forfeited the match.")
        : `Final round wins: ${state.roundWins[myUid]} — ${state.roundWins[state.order.find(u => u !== myUid)]}`}</p>
      <button class="btn-primary" id="battle-back-menu" style="width:100%">Back to Menu</button>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector("#battle-back-menu").onclick = () => {
    ov.remove();
    battleMatchEndShown = false;
    battleRoundEndShownFor = -1;
    onExit();
  };
}

function resetBattleUiFlags() {
  battleRoundEndShownFor = -1;
  battleMatchEndShown = false;
}
