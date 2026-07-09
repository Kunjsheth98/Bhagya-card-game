// BHAGYA — Supabase connection
// Anon key is safe to expose in client code — it's protected by the Row Level Security
// policies set up in Bhagya_Duel_Schema.sql, not by secrecy.

const SUPABASE_URL = "https://fvpwmgdvuekwwhzckryg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2cHdtZ2R2dWVrd3doemNrcnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1ODc5NTAsImV4cCI6MjA5OTE2Mzk1MH0.t3c3WvqGEfdros0wjqwfycURkCbVZ6em5DjAfJM9Ooc";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// stable anonymous player id, separate from display name, persisted per device
function getPlayerUid() {
  let uid = localStorage.getItem("bhagya_player_uid");
  if (!uid) {
    uid = (crypto.randomUUID ? crypto.randomUUID() : ("p" + Date.now() + Math.random().toString(16).slice(2)));
    localStorage.setItem("bhagya_player_uid", uid);
  }
  return uid;
}
