// BHAGYA — Party Prediction (3-8 players, guess whose fortune is whose)

const PARTY_MIN = 3, PARTY_MAX = 8;
const PARTY_GUESS_SECONDS = 15;

let partyRoomCode = null;
let partyChannel = null;
let partyMyUid = null;
let partyLatestState = null;
let partyWatchdog = null;
let partyResolvedForIndex = -1;

async function partyCreateRoom() {
  partyMyUid = getPlayerUid();
  const code = genRoomCode();
  const initialState = {
    hostUid: partyMyUid,
    players: { [partyMyUid]: { name: myName() } },
    order: [partyMyUid],
    phase: "lobby",
    scores: {}
  };
  const { error } = await sb.from("bhagya_rooms").insert({ room_code: code, mode: "party", status: "lobby", state: initialState });
  if (error) { alert("Could not create room: " + error.message); return; }
  partyRoomCode = code;
  subscribeToPartyRoom(code);
  showScreen("#screen-party-lobby");
  renderPartyLobby(initialState);
}

async function partyJoinRoom(code) {
  code = code.trim().toUpperCase();
  if (code.length !== 6) { alert("Room codes are 6 characters."); return; }
  partyMyUid = getPlayerUid();
  const { data, error } = await sb.from("bhagya_rooms").select("*").eq("room_code", code).eq("mode", "party").single();
  if (error || !data) { alert("Room not found."); return; }
  if (data.status !== "lobby") { alert("This party already started or has ended."); return; }
  const state = data.state;
  if (state.order.length >= PARTY_MAX && !state.order.includes(partyMyUid)) { alert("This room is full."); return; }
  if (!state.order.includes(partyMyUid)) {
    state.order.push(partyMyUid);
    state.players[partyMyUid] = { name: myName() };
  }
  const { error: upErr } = await sb.from("bhagya_rooms").update({ state }).eq("room_code", code);
  if (upErr) { alert("Could not join: " + upErr.message); return; }
  partyRoomCode = code;
  subscribeToPartyRoom(code);
  showScreen("#screen-party-lobby");
  renderPartyLobby(state);
}

function subscribeToPartyRoom(code) {
  if (partyChannel) sb.removeChannel(partyChannel);
  partyChannel = sb.channel("party:" + code)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bhagya_rooms", filter: `room_code=eq.${code}` },
      payload => onPartyStateChange(payload.new.state))
    .subscribe();
}

function onPartyStateChange(state) {
  partyLatestState = state;
  if (state.phase === "lobby") {
    renderPartyLobby(state);
  } else {
    if ($("#screen-party-lobby") && !$("#screen-party-lobby").classList.contains("hidden")) showScreen("#screen-party");
    renderPartyBoard(state);
    managePartyWatchdog(state);
  }
}

async function partyWriteState(newState) {
  const { error } = await sb.from("bhagya_rooms").update({
    state: newState, status: newState.phase === "summary" ? "completed" : "in_progress"
  }).eq("room_code", partyRoomCode);
  if (error) console.error("Party write failed:", error);
  partyLatestState = newState;
}

function renderPartyLobby(state) {
  $("#party-lobby-code").textContent = partyRoomCode;
  $("#party-lobby-players").innerHTML = state.order.map(uid => `<div class="lobby-player-pill">🪷 ${state.players[uid].name}</div>`).join("");
  const canStart = state.order.length >= PARTY_MIN && state.hostUid === partyMyUid;
  const btn = $("#party-start-btn");
  btn.classList.toggle("hidden", state.hostUid !== partyMyUid);
  btn.disabled = !canStart;
  btn.textContent = canStart ? "Start Party" : `Waiting for players (${state.order.length}/${PARTY_MIN} min)`;
}

async function partyStartMatch() {
  const state = structuredClone(partyLatestState);
  if (state.order.length < PARTY_MIN) return;
  let deck = shuffledDeck();
  const hands = {};
  state.order.forEach((uid, i) => {
    const cardId = deck[i];
    const modifier = drawModifierForRarity(cardById(cardId).rarity);
    hands[uid] = { cardId, modifierId: modifier.id };
  });
  const revealOrder = state.order.slice();
  for (let i = revealOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [revealOrder[i], revealOrder[j]] = [revealOrder[j], revealOrder[i]];
  }
  const scores = {}; state.order.forEach(uid => scores[uid] = 0);
  const fresh = {
    ...state, phase: "guessing", hands, revealOrder, currentRevealIndex: 0,
    guesses: {}, scores, guessDeadline: new Date(Date.now() + PARTY_GUESS_SECONDS * 1000).toISOString()
  };
  await partyWriteState(fresh);
}

async function partySubmitGuess(guessedUid) {
  const state = partyLatestState;
  const targetUid = state.revealOrder[state.currentRevealIndex];
  if (partyMyUid === targetUid) return;
  const { data } = await sb.from("bhagya_rooms").select("state").eq("room_code", partyRoomCode).single();
  const fresh = data.state;
  if (fresh.currentRevealIndex !== state.currentRevealIndex) return;
  fresh.guesses[partyMyUid] = guessedUid;
  await partyWriteState(fresh);
}

function managePartyWatchdog(state) {
  clearInterval(partyWatchdog);
  if (state.phase !== "guessing") return;
  partyWatchdog = setInterval(() => checkPartyResolve(), 1000);
}

async function checkPartyResolve() {
  const state = partyLatestState;
  if (!state || state.phase !== "guessing") return;
  const targetUid = state.revealOrder[state.currentRevealIndex];
  const guessers = state.order.filter(u => u !== targetUid);
  const allGuessed = guessers.every(u => state.guesses[u] !== undefined);
  const timeUp = Date.now() > new Date(state.guessDeadline).getTime();
  if (!allGuessed && !timeUp) return;
  if (partyResolvedForIndex === state.currentRevealIndex) return;
  partyResolvedForIndex = state.currentRevealIndex;

  setTimeout(async () => {
    const { data } = await sb.from("bhagya_rooms").select("state").eq("room_code", partyRoomCode).single();
    const fresh = data.state;
    if (fresh.phase !== "guessing" || fresh.currentRevealIndex !== state.currentRevealIndex) return;

    const tUid = fresh.revealOrder[fresh.currentRevealIndex];
    const gsrs = fresh.order.filter(u => u !== tUid);
    const correct = gsrs.filter(u => fresh.guesses[u] === tUid);
    correct.forEach(u => { fresh.scores[u] = (fresh.scores[u] || 0) + 20; });
    if (correct.length === 0) fresh.scores[tUid] = (fresh.scores[tUid] || 0) + 10;

    fresh.phase = "round_reveal";
    fresh.lastRoundResult = { targetUid: tUid, correctGuessers: correct, bonusAwarded: correct.length === 0 };
    await partyWriteState(fresh);
  }, 300 + Math.random() * 500);
}

async function partyContinue() {
  const state = structuredClone(partyLatestState);
  const nextIndex = state.currentRevealIndex + 1;
  if (nextIndex >= state.revealOrder.length) {
    state.phase = "summary";
    await partyWriteState(state);
    return;
  }
  state.phase = "guessing";
  state.currentRevealIndex = nextIndex;
  state.guesses = {};
  state.guessDeadline = new Date(Date.now() + PARTY_GUESS_SECONDS * 1000).toISOString();
  await partyWriteState(state);
}

function renderPartyBoard(state) {
  if (state.phase === "summary") { renderPartySummary(state); return; }

  const targetUid = state.revealOrder[state.currentRevealIndex];
  const isTarget = partyMyUid === targetUid;
  $("#party-round-label").textContent = `Fortune ${state.currentRevealIndex + 1} of ${state.revealOrder.length}`;

  const card = cardById(state.hands[targetUid].cardId);
  $("#party-mystery-card").innerHTML = `<img src="${card.img}" alt="${card.eng}">`;
  $("#party-mystery-name").textContent = card.hindi;
  $("#party-mystery-desc").textContent = card.desc;

  const area = $("#party-guess-area");
  if (state.phase === "guessing") {
    if (isTarget) {
      area.innerHTML = `<p style="opacity:.75;font-size:.9rem">This is YOUR fortune — wait while everyone else guesses whose it is…</p>`;
    } else {
      const myGuess = state.guesses[partyMyUid];
      area.innerHTML = `
        <p style="opacity:.7;font-size:.85rem;margin-bottom:10px">Whose fortune is this?</p>
        <div class="party-guess-grid">
          ${state.order.filter(u => u !== targetUid).map(uid => `
            <button class="party-guess-btn ${myGuess === uid ? "selected" : ""}" data-guess="${uid}" ${myGuess ? "disabled" : ""}>${state.players[uid].name}</button>
          `).join("")}
        </div>`;
      $all("[data-guess]").forEach(btn => btn.onclick = () => partySubmitGuess(btn.dataset.guess));
    }
  } else if (state.phase === "round_reveal") {
    const r = state.lastRoundResult;
    const targetName = state.players[r.targetUid].name;
    const correctNames = r.correctGuessers.map(u => state.players[u].name);
    area.innerHTML = `
      <div class="panel" style="max-width:440px">
        <h3 class="gold-title" style="margin-bottom:8px">It was ${targetName}'s fortune!</h3>
        <p style="opacity:.8;font-size:.88rem;margin-bottom:14px">
          ${r.bonusAwarded ? `Nobody guessed right — ${targetName} gets a +10 bonus for being unpredictable!`
            : `Correctly guessed by: ${correctNames.join(", ")} (+20 each)`}
        </p>
        <button class="btn-primary" id="party-continue-btn">${state.currentRevealIndex + 1 >= state.revealOrder.length ? "See Final Results" : "Next Fortune"}</button>
      </div>`;
    $("#party-continue-btn").onclick = partyContinue;
  }

  const lb = $("#party-live-scores");
  lb.innerHTML = state.order.map(uid => `<div class="party-leaderboard-row"><span>${state.players[uid].name}</span><span>${state.scores[uid] || 0}</span></div>`).join("");
}

function renderPartySummary(state) {
  $("#party-round-label").textContent = "Party Complete";
  $("#party-mystery-card").innerHTML = "";
  $("#party-mystery-name").textContent = "";
  $("#party-mystery-desc").textContent = "";
  const sorted = state.order.slice().sort((a, b) => (state.scores[b] || 0) - (state.scores[a] || 0));
  $("#party-guess-area").innerHTML = `
    <div class="panel" style="max-width:440px">
      <h3 class="gold-title" style="margin-bottom:12px">🏆 ${state.players[sorted[0]].name} — Fortune Reader!</h3>
      <div style="text-align:left;margin-bottom:16px">
        ${sorted.map((uid, i) => `<div class="party-leaderboard-row ${i === 0 ? "first" : ""}"><span>${i + 1}. ${state.players[uid].name}</span><span>${state.scores[uid] || 0} pts</span></div>`).join("")}
      </div>
      <button class="btn-primary" id="party-exit-btn" style="width:100%">Back to Menu</button>
    </div>`;
  $("#party-exit-btn").onclick = partyExitToMenu;
  $("#party-live-scores").innerHTML = "";
}

function partyExitToMenu() {
  if (partyChannel) sb.removeChannel(partyChannel);
  clearInterval(partyWatchdog);
  partyResolvedForIndex = -1;
  showScreen("#screen-main-menu");
  renderMainMenu();
}

document.addEventListener("DOMContentLoaded", () => {
  $("#mode-party").addEventListener("click", () => showScreen("#screen-party-entry"));
  $("#party-entry-back").addEventListener("click", () => showScreen("#screen-main-menu"));
  $("#party-create-btn").addEventListener("click", partyCreateRoom);
  $("#party-join-btn").addEventListener("click", () => partyJoinRoom($("#party-join-code-input").value));
  $("#party-lobby-back").addEventListener("click", () => { if (partyChannel) sb.removeChannel(partyChannel); showScreen("#screen-main-menu"); renderMainMenu(); });
  $("#party-start-btn").addEventListener("click", partyStartMatch);
  $("#party-quit-btn").addEventListener("click", partyExitToMenu);
});
