// BHAGYA — Shared Battle Engine
// Pure state-transformation functions (no Supabase, no DOM) so the exact same
// card-effect logic powers Duel of Fates (vs a real person) and Bot Battle (vs AI).

const HAND_SIZE = 5;
const TURN_SECONDS = 20;
const RARITY_RANK = { Common: 0, Uncommon: 1, Rare: 2, Mythic: 3, Legendary: 4 };

function beginBattleRound(state, roundNum, startingUid) {
  const deckOrder = state.deckOrder && state.deckOrder.length ? state.deckOrder : shuffledDeck();
  let deckPointer = state.deckPointer || 0;

  let deck = deckOrder;
  if (deckPointer + (HAND_SIZE * state.order.length) > deck.length) { deck = shuffledDeck(); deckPointer = 0; }

  const hands = {};
  state.order.forEach(uid => {
    hands[uid] = deck.slice(deckPointer, deckPointer + HAND_SIZE).map(id => ({ cardId: id, played: false }));
    deckPointer += HAND_SIZE;
  });

  const roundWins = state.roundWins || {};
  const awayStrikes = state.awayStrikes || {};
  state.order.forEach(uid => { if (!(uid in roundWins)) roundWins[uid] = 0; if (!(uid in awayStrikes)) awayStrikes[uid] = 0; });

  return {
    ...state,
    deckOrder: deck,
    deckPointer,
    round: roundNum,
    hands,
    flags: Object.fromEntries(state.order.map(uid => [uid, { shield: false, locked: false, skipNext: false }])),
    roundScores: Object.fromEntries(state.order.map(uid => [uid, 0])),
    roundHighestRarity: Object.fromEntries(state.order.map(uid => [uid, "Common"])),
    revealTo: {},
    turnUid: startingUid,
    turnExpiresAt: new Date(Date.now() + TURN_SECONDS * 1000).toISOString(),
    turnSelfTimedOut: false,
    roundWins,
    awayStrikes,
    matchLog: state.matchLog || [],
    lastPlay: null,
    phase: "playing",
    winnerUid: null,
    winReason: null
  };
}

// Rule-based on effectType category (not 78 bespoke scripts) — see delivery notes
function resolveBattlePlay(state, actorUid, cardId) {
  const opponentUid = state.order.find(u => u !== actorUid);
  const card = cardById(cardId);
  const modifier = drawModifierForRarity(card.rarity);
  const t = card.effectType.toLowerCase();
  const reversed = modifier.mult === -1;
  const modMult = reversed ? 1 : modifier.mult;

  let actorDelta = 0, opponentDelta = 0;
  const notes = [];

  const hasBoost = t.includes("boost") || (!/(shield|block|skip|swap|reveal|peek|guess|prediction|lock|draw)/.test(t) && !t.includes("curse") && !t.includes("steal"));
  if (hasBoost) {
    let pts = Math.round(card.basePoints * modMult);
    if (t.includes("double")) pts *= 2;
    actorDelta += reversed ? -card.basePoints : pts;
    notes.push(`+${reversed ? -card.basePoints : pts} to self`);
  }

  if (t.includes("steal") || t.includes("tax")) {
    let amt = Math.round(card.basePoints * modMult);
    if (state.flags[opponentUid].shield) {
      state.flags[opponentUid].shield = false;
      notes.push(`Steal blocked by opponent's shield`);
    } else if (state.flags[opponentUid].locked) {
      notes.push(`Steal blocked — opponent's score is locked`);
    } else {
      opponentDelta -= amt; actorDelta += amt;
      notes.push(`Stole ${amt} from opponent`);
    }
  }

  if (t.includes("curse")) {
    let amt = Math.round(card.basePoints * modMult);
    if (state.flags[opponentUid].shield) {
      state.flags[opponentUid].shield = false;
      notes.push(`Curse blocked by opponent's shield`);
    } else if (state.flags[opponentUid].locked) {
      notes.push(`Curse blocked — opponent's score is locked`);
    } else {
      opponentDelta -= amt;
      notes.push(`Cursed opponent for -${amt}`);
    }
  }

  if (t.includes("shield")) { state.flags[actorUid].shield = true; notes.push("Shield raised"); }
  if (t.includes("block")) { state.flags[actorUid].shield = true; notes.push("Blocking stance ready"); }
  if (t.includes("lock")) { state.flags[actorUid].locked = true; notes.push("Score locked for the round"); }
  if (t.includes("cure") || t.includes("immune") || t.includes("cleanse")) {
    state.flags[actorUid].shield = true;
    notes.push("Cleansed and shielded");
  }
  if (t.includes("skip")) { state.flags[opponentUid].skipNext = true; notes.push("Opponent's next turn will be skipped"); }
  if (t.includes("swap") && !t.includes("swap score")) {
    const mine = state.hands[actorUid].filter(c => !c.played);
    const theirs = state.hands[opponentUid].filter(c => !c.played);
    if (mine.length && theirs.length) {
      const a = mine[Math.floor(Math.random() * mine.length)];
      const b = theirs[Math.floor(Math.random() * theirs.length)];
      const tmp = a.cardId; a.cardId = b.cardId; b.cardId = tmp;
      notes.push("Swapped a random card with your opponent");
    }
  }
  if (t.includes("swap score")) {
    const tmp = state.roundScores[actorUid];
    state.roundScores[actorUid] = state.roundScores[opponentUid];
    state.roundScores[opponentUid] = tmp;
    notes.push("Round scores swapped!");
  }
  if (t.includes("draw") && !t.includes("withdraw")) {
    const extra = card.hindi === "Khazana" ? 2 : 1;
    for (let i = 0; i < extra; i++) {
      const next = state.deckOrder[state.deckPointer % state.deckOrder.length];
      state.deckPointer += 1;
      state.hands[actorUid].push({ cardId: next, played: false });
    }
    notes.push(`Drew ${extra} extra card${extra > 1 ? "s" : ""}`);
  }
  if (t.includes("reveal all")) {
    state.revealTo[actorUid] = state.order.slice();
    state.revealTo[opponentUid] = state.order.slice();
    notes.push("Both hands revealed");
  } else if (t.includes("peek") || t.includes("reveal") || t.includes("guess") || t.includes("prediction")) {
    state.revealTo[opponentUid] = [...(state.revealTo[opponentUid] || []), actorUid];
    notes.push("You can now see your opponent's hand");
  }
  if (t.includes("total chaos")) {
    const tmp = state.roundWins[actorUid];
    state.roundWins[actorUid] = state.roundWins[opponentUid];
    state.roundWins[opponentUid] = tmp;
    notes.push("Match round-wins swapped — total chaos!");
  } else if (t.includes("chaos")) {
    const tmp = state.roundScores[actorUid];
    state.roundScores[actorUid] = state.roundScores[opponentUid];
    state.roundScores[opponentUid] = tmp;
    notes.push("Round scores thrown into chaos");
  }
  if (t.includes("reset")) {
    state.hands[actorUid] = state.hands[actorUid].map(c => {
      if (c.played) return c;
      const next = state.deckOrder[state.deckPointer % state.deckOrder.length];
      state.deckPointer += 1;
      return { cardId: next, played: false };
    });
    notes.push("Remaining hand redrawn fresh");
  }
  if (t.includes("combo")) {
    const last = state.lastPlay;
    if (last) { actorDelta += last.points; notes.push(`Combo! Replayed +${last.points}`); }
  }

  if (modifier.cost) { actorDelta -= modifier.cost; notes.push(`Cost ${modifier.cost} (Cursed modifier)`); }

  state.roundScores[actorUid] = Math.max(0, (state.roundScores[actorUid] || 0) + actorDelta);
  state.roundScores[opponentUid] = Math.max(0, (state.roundScores[opponentUid] || 0) + opponentDelta);

  if (RARITY_RANK[card.rarity] > RARITY_RANK[state.roundHighestRarity[actorUid]]) {
    state.roundHighestRarity[actorUid] = card.rarity;
  }

  const play = { uid: actorUid, cardId, modifierId: modifier.id, points: actorDelta, notes, ts: Date.now() };
  state.matchLog.push(play);
  state.lastPlay = play;

  return { card, modifier, notes };
}

function advanceBattleTurn(state) {
  const opponentUid = state.order.find(u => u !== state.turnUid);
  const allPlayed = state.order.every(uid => state.hands[uid].every(c => c.played));
  if (allPlayed) { finishBattleRound(state); return; }

  let nextUid = opponentUid;
  if (state.flags[nextUid].skipNext) {
    state.flags[nextUid].skipNext = false;
    nextUid = state.turnUid;
  }
  if (state.hands[nextUid].every(c => c.played)) {
    const other = state.order.find(u => u !== nextUid);
    if (!state.hands[other].every(c => c.played)) nextUid = other;
  }

  state.turnUid = nextUid;
  state.turnExpiresAt = new Date(Date.now() + TURN_SECONDS * 1000).toISOString();
  state.turnSelfTimedOut = false;
}

function finishBattleRound(state) {
  const [a, b] = state.order;
  let winnerUid;
  if (state.roundScores[a] > state.roundScores[b]) winnerUid = a;
  else if (state.roundScores[b] > state.roundScores[a]) winnerUid = b;
  else {
    const ra = RARITY_RANK[state.roundHighestRarity[a]], rb = RARITY_RANK[state.roundHighestRarity[b]];
    winnerUid = ra >= rb ? a : b;
  }
  state.roundWins[winnerUid] += 1;
  state.phase = "round_end";
  state.roundWinnerUid = winnerUid;

  const needed = state.winsNeeded || 3;
  if (state.roundWins[winnerUid] >= needed) {
    state.phase = "match_end";
    state.winnerUid = winnerUid;
    state.winReason = "score";
  }
}

function pickLowestCard(unplayedList) {
  return unplayedList.slice().sort((a, b) => cardById(a.cardId).basePoints - cardById(b.cardId).basePoints)[0];
}
