// background.js (MV3 service worker) — full file, copy/paste

console.log("[TutorLog] background service worker loaded");

const STORAGE_KEY = "clients_db_v1";

/** Load DB from chrome.storage.local */
async function loadDB() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const db = result[STORAGE_KEY];
  return !db || !Array.isArray(db.clients) ? { clients: [] } : db;
}

/** Save DB to chrome.storage.local */
async function saveDB(db) {
  await chrome.storage.local.set({ [STORAGE_KEY]: db });
}

/**
 * Increment total_hours for a client and persist.
 * sessionHours is the number of hours for THIS session.
 */
async function addSessionHours(email, sessionHours) {
  const db = await loadDB();
  const idx = db.clients.findIndex((c) => c.email === email);
  if (idx === -1) throw new Error("Client not found in storage for email: " + email);

  const current = Number(db.clients[idx].total_hours) || 0;
  const add = Number(sessionHours);

  if (!Number.isFinite(add) || add <= 0) {
    throw new Error("Session hours must be a positive number. Got: " + sessionHours);
  }

  const newTotal = current + add;
  db.clients[idx].total_hours = newTotal;

  await saveDB(db);
  return newTotal;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Quick connectivity test
  if (msg?.type === "PING") {
    sendResponse({ ok: true, from: "background" });
    return; // sync response, no return true needed
  }

  // Main handler used by arbor_script.js
  if (msg?.type !== "ADD_SESSION_HOURS") return;

  (async () => {
    const email = String(msg.email || "");
    const sessionHours = msg.sessionHours;

    if (!email) throw new Error("Missing email in message");

    const newTotal = await addSessionHours(email, sessionHours);

    sendResponse({ ok: true, newTotal });
  })().catch((e) => {
    sendResponse({ ok: false, error: String(e?.message || e) });
  });

  return true; // keep the message channel open for async sendResponse
});