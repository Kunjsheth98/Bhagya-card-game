// BHAGYA — Duel of Fates (multiplayer, vs a real person)
// Uses the shared engine (js/duel-engine.js) and shared UI (js/battle-ui.js).
// State lives in Supabase table `bhagya_rooms` (mode='duel'), synced via Realtime.
//
// Honest note on trust model: client-authoritative state protected by the room code +
// open RLS policy, not a server-validated Edge Function. Fine for a private game
// between people who trust each other — see delivery notes for the full explanation.

const AFK_GRACE_SECONDS = 15;

let duelRoomCode = null;
let duelChannel = null;
let duelLocalTimerInterval = null;
let duelWatchdogInterval = null;
let duelMyUid = null;
let duelLatestState = null;
let duelActing = false;

function myUid() { return getPlayerUid(); }
function myName() { return localStorage.getItem("bhagya_player_name") || "Player"; }

function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ---------------------------------------------------------------
// Room lifecycle
// ---------------------------------------------------------------
async function duelCreateRoom() {
  duelMyUid = myUid();
  const code = genRoomCode();
  const initialState = {
    hostUid: duelMyUid,
    players: { [duelMyUid]: { name: myName() } },
    order: [duelMyUid],
    phase: "lobby",
    round: 1,
    winsNeeded: 3,
    roundWins: {},
    awayStrikes: {}
  };
  const { error } = await sb.from("bhagya_rooms").insert({ room_code: code, mode: "duel", status: "lobby", state: initialState });
  if (error) {
    alert("Could not create room: " + error.message + "\n\nMake sure Bhagya_Rooms_Schema.sql has been run in Supabase, and check your internet connection.");
    return;
  }
  duelRoomCode = code;
  subscribeToDuelRoom(code);
  showScreen("#screen-duel-lobby");
  renderDuelLobby(initialState);
}

async function duelJoinRoom(code) {
  code = code.trim().toUpperCase();
  if (code.length !== 6) { alert("Room codes are 6 characters."); return; }
  duelMyUid = myUid();
  const { data, error } = await sb.from("bhagya_rooms").select("*").eq("room_code", code).eq("mode", "duel").single();
  if (error || !data) { alert("Room not found. Double-check the code."); return; }
  if (data.status !== "lobby") { alert("This match already started or has ended."); return; }
  const state = data.state;
  if (state.order.length >= 2 && !state.order.includes(duelMyUid)) { alert("This room is full."); return; }

  if (!state.order.includes(duelMyUid)) {
    state.order.push(duelMyUid);
    state.players[duelMyUid] = { name: myName() };
  }

  const { error: upErr } = await sb.from("bhagya_rooms").update({ state }).eq("room_code", code);
  if (upErr) { alert("Could not join: " + upErr.message); return; }

  duelRoomCode = code;
  subscribeToDuelRoom(code);
  showScreen("#screen-duel-lobby");
  renderDuelLobby(state);
}

function subscribeToDuelRoom(code) {
  if (duelChannel) sb.removeChannel(duelChannel);
  duelChannel = sb.channel("room:" + code)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bhagya_rooms", filter: `room_code=eq.${code}` },
      payload => onDuelStateChange(payload.new.state, payload.new.status))
    .subscribe();
}

function onDuelStateChange(state, status) {
  duelLatestState = state;
  if (status === "lobby") {
    renderDuelLobby(state);
  } else {
    if ($("#screen-duel-lobby") && !$("#screen-duel-lobby").classList.contains("hidden")) {
      showScreen("#screen-duel");
    }
    const opponentUid = state.order.find(u => u !== duelMyUid);
    renderBattleBoard(state, duelMyUid, opponentUid, state.players[opponentUid] ? state.players[opponentUid].name : "Opponent", duelPlayCard, { showTimer: true });
    if (state.phase === "round_end") showBattleRoundEnd(state, duelMyUid, state.players[opponentUid].name, duelContinueAfterRound);
    if (state.phase === "match_end") {
      clearInterval(duelLocalTimerInterval); clearInterval(duelWatchdogInterval);
      showBattleMatchEnd(state, duelMyUid, state.players[opponentUid].name, duelExitToMenu);
    }
    handleDuelPhaseTransitions(state);
  }
}

async function duelWriteState(newState) {
  const { error } = await sb.from("bhagya_rooms").update({
    state: newState,
    status: newState.phase === "match_end" ? "completed" : "in_progress"
  }).eq("room_code", duelRoomCode);
  if (error) console.error("Failed to write duel state:", error);
  duelLatestState = newState;
}

// ---------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------
function renderDuelLobby(state) {
  $("#duel-lobby-code").textContent = duelRoomCode;
  const names = state.order.map(uid => state.players[uid].name);
  $("#duel-lobby-players").innerHTML = names.map(n => `<div class="lobby-player-pill">🪷 ${n}</div>`).join("")
    + (names.length < 2 ? `<div class="lobby-player-pill waiting">Waiting for opponent…</div>` : "");
  const canStart = state.order.length === 2 && state.hostUid === duelMyUid;
  const startBtn = $("#duel-start-btn");
  startBtn.classList.toggle("hidden", state.hostUid !== duelMyUid);
  startBtn.disabled = !canStart;
  startBtn.textContent = canStart ? "Start Duel" : `Waiting for players (${state.order.length}/2)`;
}

async function duelStartMatch() {
  const state = duelLatestState;
  if (state.order.length !== 2) return;
  const fresh = beginBattleRound(state, 1, state.order[0]);
  await duelWriteState(fresh);
}

async function duelPlayCard(cardIndex) {
  if (duelActing) return;
  const state = duelLatestState;
  if (!state || state.phase !== "playing" || state.turnUid !== duelMyUid) return;
  const entry = state.hands[duelMyUid][cardIndex];
  if (!entry || entry.played) return;

  duelActing = true;
  const fresh = structuredClone(state);
  fresh.hands[duelMyUid][cardIndex].played = true;
  resolveBattlePlay(fresh, duelMyUid, entry.cardId);
  advanceBattleTurn(fresh);
  await duelWriteState(fresh);
  duelActing = false;
}

async function duelContinueAfterRound() {
  const state = structuredClone(duelLatestState);
  if (state.phase === "match_end") return;
  const nextRound = state.round + 1;
  const startingUid = state.order[(nextRound - 1) % 2];
  const fresh = beginBattleRound(state, nextRound, startingUid);
  await duelWriteState(fresh);
}

function duelExitToMenu() {
  if (duelChannel) sb.removeChannel(duelChannel);
  clearInterval(duelLocalTimerInterval);
  clearInterval(duelWatchdogInterval);
  showScreen("#screen-main-menu");
  renderMainMenu();
}

// ---------------------------------------------------------------
// Timers & AFK handling
// ---------------------------------------------------------------
function handleDuelPhaseTransitions(state) {
  clearInterval(duelLocalTimerInterval);
  clearInterval(duelWatchdogInterval);
  if (state.phase !== "playing") return;
  duelLocalTimerInterval = setInterval(() => tickDuelTimer(), 500);
  duelWatchdogInterval = setInterval(() => checkDuelWatchdog(), 3000);
}

function tickDuelTimer() {
  const state = duelLatestState;
  if (!state || state.phase !== "playing") return;
  const remain = Math.max(0, Math.round((new Date(state.turnExpiresAt) - Date.now()) / 1000));
  const val = $("#duel-timer-value");
  if (val) val.textContent = remain;
  const ring = $("#duel-timer-ring");
  if (ring) {
    ring.classList.toggle("amber", remain <= 5 && remain > 2);
    ring.classList.toggle("red", remain <= 2);
  }
  if (remain === 0 && state.turnUid === duelMyUid && !state.turnSelfTimedOut && !duelActing) {
    duelSelfAutoPlay();
  }
}

async function duelSelfAutoPlay() {
  duelActing = true;
  const state = structuredClone(duelLatestState);
  state.turnSelfTimedOut = true;
  const hand = state.hands[duelMyUid];
  const unplayed = hand.map((c, i) => ({ ...c, i })).filter(c => !c.played);
  if (!unplayed.length) { duelActing = false; return; }
  const chosen = pickLowestCard(unplayed);
  hand[unplayed.find(u => u.cardId === chosen.cardId).i].played = true;
  resolveBattlePlay(state, duelMyUid, chosen.cardId);
  advanceBattleTurn(state);
  await duelWriteState(state);
  duelActing = false;
}

async function checkDuelWatchdog() {
  const state = duelLatestState;
  if (!state || state.phase !== "playing" || duelActing) return;
  const elapsedSinceExpiry = (Date.now() - new Date(state.turnExpiresAt)) / 1000;
  if (state.turnUid === duelMyUid) return;
  if (elapsedSinceExpiry < TURN_SECONDS + AFK_GRACE_SECONDS) return;

  duelActing = true;
  const fresh = structuredClone(duelLatestState);
  if (fresh.turnUid !== state.turnUid) { duelActing = false; return; }

  const awayUid = fresh.turnUid;
  const hand = fresh.hands[awayUid];
  const unplayed = hand.map((c, i) => ({ ...c, i })).filter(c => !c.played);
  fresh.awayStrikes[awayUid] = (fresh.awayStrikes[awayUid] || 0) + 1;

  if (fresh.awayStrikes[awayUid] >= 2) {
    fresh.phase = "match_end";
    fresh.winnerUid = fresh.order.find(u => u !== awayUid);
    fresh.winReason = "afk";
    await duelWriteState(fresh);
    duelActing = false;
    return;
  }

  if (unplayed.length) {
    const chosen = pickLowestCard(unplayed);
    hand[unplayed.find(u => u.cardId === chosen.cardId).i].played = true;
    resolveBattlePlay(fresh, awayUid, chosen.cardId);
  }
  advanceBattleTurn(fresh);
  await duelWriteState(fresh);
  duelActing = false;
}

// ---------------------------------------------------------------
// Wire up
// ---------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  $("#mode-duel").addEventListener("click", () => { resetBattleUiFlags(); showScreen("#screen-duel-entry"); });
  $("#duel-entry-back").addEventListener("click", () => showScreen("#screen-main-menu"));
  $("#duel-create-btn").addEventListener("click", duelCreateRoom);
  $("#duel-join-btn").addEventListener("click", () => duelJoinRoom($("#duel-join-code-input").value));
  $("#duel-lobby-back").addEventListener("click", () => {
    if (duelChannel) sb.removeChannel(duelChannel);
    showScreen("#screen-main-menu"); renderMainMenu();
  });
  $("#duel-start-btn").addEventListener("click", duelStartMatch);
});
