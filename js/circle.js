// BHAGYA — Reading Circle (co-op, 2-8 players, no losers)
// Everyone draws together, reveals together, and the round becomes a shared
// Group Fortune. Fixed at 5 rounds so it always ends cleanly.

const CIRCLE_ROUNDS = 5;
const CIRCLE_MIN = 2, CIRCLE_MAX = 8;

let circleRoomCode = null;
let circleChannel = null;
let circleMyUid = null;
let circleLatestState = null;
let circleActing = false;

const SUIT_FORTUNE_PHRASE = {
  Prem: "love finds its way to you",
  Dhan: "fortune smiles on wealth close by",
  Shakti: "strength rises to meet the moment",
  Gyan: "wisdom lights the path ahead",
  Chaya: "shadows stir with a little mystery",
  Tara: "the stars align in your favor"
};

function buildGroupFortune(cardsThisRound) {
  const suits = [...new Set(cardsThisRound.map(c => cardById(c.cardId).suit))];
  const phrases = suits.map(s => SUIT_FORTUNE_PHRASE[s]);
  let body;
  if (phrases.length === 1) body = phrases[0];
  else if (phrases.length === 2) body = phrases.join(", and ");
  else body = phrases.slice(0, -1).join(", ") + ", and " + phrases[phrases.length - 1];
  return `Tonight, ${body}.`;
}

// ---------------------------------------------------------------
// Room lifecycle
// ---------------------------------------------------------------
async function circleCreateRoom() {
  circleMyUid = getPlayerUid();
  const code = genRoomCode();
  const initialState = {
    hostUid: circleMyUid,
    players: { [circleMyUid]: { name: myName() } },
    order: [circleMyUid],
    phase: "lobby",
    round: 0,
    totals: {},
    groupFortunes: []
  };
  const { error } = await sb.from("bhagya_rooms").insert({ room_code: code, mode: "circle", status: "lobby", state: initialState });
  if (error) { alert("Could not create room: " + error.message); return; }
  circleRoomCode = code;
  subscribeToCircleRoom(code);
  showScreen("#screen-circle-lobby");
  renderCircleLobby(initialState);
}

async function circleJoinRoom(code) {
  code = code.trim().toUpperCase();
  if (code.length !== 6) { alert("Room codes are 6 characters."); return; }
  circleMyUid = getPlayerUid();
  const { data, error } = await sb.from("bhagya_rooms").select("*").eq("room_code", code).eq("mode", "circle").single();
  if (error || !data) { alert("Room not found."); return; }
  if (data.status !== "lobby") { alert("This circle already started or has ended."); return; }
  const state = data.state;
  if (state.order.length >= CIRCLE_MAX && !state.order.includes(circleMyUid)) { alert("This room is full."); return; }
  if (!state.order.includes(circleMyUid)) {
    state.order.push(circleMyUid);
    state.players[circleMyUid] = { name: myName() };
  }
  const { error: upErr } = await sb.from("bhagya_rooms").update({ state }).eq("room_code", code);
  if (upErr) { alert("Could not join: " + upErr.message); return; }
  circleRoomCode = code;
  subscribeToCircleRoom(code);
  showScreen("#screen-circle-lobby");
  renderCircleLobby(state);
}

function subscribeToCircleRoom(code) {
  if (circleChannel) sb.removeChannel(circleChannel);
  circleChannel = sb.channel("circle:" + code)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bhagya_rooms", filter: `room_code=eq.${code}` },
      payload => onCircleStateChange(payload.new.state))
    .subscribe();
}

function onCircleStateChange(state) {
  circleLatestState = state;
  if (state.phase === "lobby") {
    renderCircleLobby(state);
  } else {
    if ($("#screen-circle-lobby") && !$("#screen-circle-lobby").classList.contains("hidden")) showScreen("#screen-circle");
    renderCircleBoard(state);
    watchCircleReveal(state);
  }
}

async function circleWriteState(newState) {
  const { error } = await sb.from("bhagya_rooms").update({
    state: newState, status: newState.phase === "summary" ? "completed" : "in_progress"
  }).eq("room_code", circleRoomCode);
  if (error) console.error("Circle write failed:", error);
  circleLatestState = newState;
}

function renderCircleLobby(state) {
  $("#circle-lobby-code").textContent = circleRoomCode;
  $("#circle-lobby-players").innerHTML = state.order.map(uid => `<div class="lobby-player-pill">🪷 ${state.players[uid].name}</div>`).join("");
  const canStart = state.order.length >= CIRCLE_MIN && state.hostUid === circleMyUid;
  const btn = $("#circle-start-btn");
  btn.classList.toggle("hidden", state.hostUid !== circleMyUid);
  btn.disabled = !canStart;
  btn.textContent = canStart ? "Start Circle" : `Waiting for players (${state.order.length}/${CIRCLE_MIN} min)`;
}

async function circleStartMatch() {
  const state = structuredClone(circleLatestState);
  if (state.order.length < CIRCLE_MIN) return;
  const fresh = dealCircleRound(state, 1);
  await circleWriteState(fresh);
}

function dealCircleRound(state, roundNum) {
  let deck = state.deckOrder && state.deckOrder.length ? state.deckOrder : shuffledDeck();
  let pointer = state.deckPointer || 0;
  if (pointer + state.order.length > deck.length) { deck = shuffledDeck(); pointer = 0; }
  const roundCards = {};
  state.order.forEach(uid => {
    const cardId = deck[pointer]; pointer += 1;
    const modifier = drawModifierForRarity(cardById(cardId).rarity);
    roundCards[uid] = { cardId, modifierId: modifier.id };
  });
  const totals = state.totals || {};
  state.order.forEach(uid => { if (!(uid in totals)) totals[uid] = 0; });
  return {
    ...state, deckOrder: deck, deckPointer: pointer, round: roundNum,
    roundCards, readyToReveal: Object.fromEntries(state.order.map(u => [u, false])),
    totals, phase: "playing"
  };
}

async function circleRevealMyCard() {
  if (circleActing) return;
  circleActing = true;
  const { data } = await sb.from("bhagya_rooms").select("state").eq("room_code", circleRoomCode).single();
  const fresh = data.state;
  fresh.readyToReveal[circleMyUid] = true;
  await circleWriteState(fresh);
  circleActing = false;
}

let circleResolvedForRound = -1;
async function watchCircleReveal(state) {
  if (state.phase !== "playing") return;
  const allReady = state.order.every(uid => state.readyToReveal[uid]);
  if (!allReady) return;
  if (circleResolvedForRound === state.round) return;
  circleResolvedForRound = state.round;

  // small random delay so not every client races to write at once
  setTimeout(async () => {
    const { data } = await sb.from("bhagya_rooms").select("state").eq("room_code", circleRoomCode).single();
    const fresh = data.state;
    if (fresh.phase !== "playing" || fresh.round !== state.round) return; // someone already resolved it

    const cardsThisRound = fresh.order.map(uid => fresh.roundCards[uid]);
    fresh.order.forEach(uid => {
      const rc = fresh.roundCards[uid];
      const card = cardById(rc.cardId);
      const mod = MODIFIERS.find(m => m.id === rc.modifierId);
      const mult = mod.mult === -1 ? -1 : mod.mult;
      const pts = mod.mult === -1 ? -card.basePoints : Math.round(card.basePoints * mult);
      fresh.totals[uid] = Math.max(0, fresh.totals[uid] + pts);
    });
    fresh.groupFortunes.push(buildGroupFortune(cardsThisRound));
    fresh.phase = "revealed";
    await circleWriteState(fresh);
  }, 300 + Math.random() * 500);
}

async function circleContinue() {
  const state = structuredClone(circleLatestState);
  if (state.round >= CIRCLE_ROUNDS) {
    state.phase = "summary";
    await circleWriteState(state);
    return;
  }
  const fresh = dealCircleRound(state, state.round + 1);
  await circleWriteState(fresh);
}

function renderCircleBoard(state) {
  $("#circle-round-label").textContent = state.phase === "summary" ? "Circle Complete" : `Round ${state.round} of ${CIRCLE_ROUNDS}`;

  const grid = $("#circle-player-grid");
  grid.innerHTML = state.order.map(uid => {
    const ready = state.readyToReveal && state.readyToReveal[uid];
    const revealed = state.phase === "revealed" || state.phase === "summary";
    const rc = state.roundCards ? state.roundCards[uid] : null;
    const cardHtml = revealed && rc
      ? `<img src="${cardById(rc.cardId).img}" alt="">`
      : (ready ? "✓" : "🔮");
    return `
      <div class="circle-player-chip ${revealed ? "revealed" : "pending"}">
        <div class="cp-name">${state.players[uid].name}</div>
        <div class="cp-card">${cardHtml}</div>
        <div style="font-size:.68rem;opacity:.6;margin-top:4px">${state.totals[uid] || 0} pts</div>
      </div>`;
  }).join("");

  const fortuneBox = $("#circle-fortune-box");
  const revealArea = $("#circle-reveal-area");
  if (state.phase === "playing") {
    fortuneBox.classList.add("hidden");
    const myReady = state.readyToReveal[circleMyUid];
    revealArea.innerHTML = myReady
      ? `<p style="opacity:.7;font-size:.85rem">Waiting for the rest of the circle to reveal…</p>`
      : `<button class="btn-primary" id="circle-reveal-btn">Reveal My Card</button>`;
    const btn = $("#circle-reveal-btn");
    if (btn) btn.onclick = circleRevealMyCard;
  } else if (state.phase === "revealed") {
    fortuneBox.textContent = state.groupFortunes[state.groupFortunes.length - 1];
    fortuneBox.classList.remove("hidden");
    revealArea.innerHTML = `<button class="btn-primary" id="circle-continue-btn">${state.round >= CIRCLE_ROUNDS ? "See Circle Summary" : "Continue to Round " + (state.round + 1)}</button>`;
    $("#circle-continue-btn").onclick = circleContinue;
  } else if (state.phase === "summary") {
    fortuneBox.classList.add("hidden");
    const fortunesHtml = state.groupFortunes.map((f, i) => `<p style="margin-bottom:8px"><strong>Round ${i + 1}:</strong> ${f}</p>`).join("");
    revealArea.innerHTML = `
      <div class="panel" style="max-width:480px;margin-top:10px">
        <h3 class="gold-title" style="margin-bottom:10px">Your Circle's Fortunes</h3>
        <div style="text-align:left;font-size:.85rem;opacity:.85;margin-bottom:16px">${fortunesHtml}</div>
        <button class="btn-primary" id="circle-exit-btn" style="width:100%">Back to Menu</button>
      </div>`;
    $("#circle-exit-btn").onclick = circleExitToMenu;
  }
}

function circleExitToMenu() {
  if (circleChannel) sb.removeChannel(circleChannel);
  circleResolvedForRound = -1;
  showScreen("#screen-main-menu");
  renderMainMenu();
}

document.addEventListener("DOMContentLoaded", () => {
  $("#mode-circle").addEventListener("click", () => showScreen("#screen-circle-entry"));
  $("#circle-entry-back").addEventListener("click", () => showScreen("#screen-main-menu"));
  $("#circle-create-btn").addEventListener("click", circleCreateRoom);
  $("#circle-join-btn").addEventListener("click", () => circleJoinRoom($("#circle-join-code-input").value));
  $("#circle-lobby-back").addEventListener("click", () => { if (circleChannel) sb.removeChannel(circleChannel); showScreen("#screen-main-menu"); renderMainMenu(); });
  $("#circle-start-btn").addEventListener("click", circleStartMatch);
  $("#circle-quit-btn").addEventListener("click", circleExitToMenu);
});
