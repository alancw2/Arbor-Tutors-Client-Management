/**
 * arbor_script.js
 * Content script for Wufoo/Arbor tutor log pages.
 * - Loads the "selected client" from chrome.storage.local (set by your popup/options UI)
 * - Autofills the Wufoo form
 * - Live-recomputes total hours as session length changes
 * - On submit: increments total_hours in storage, then submits the form
 */

console.log("Tutor Log Autofill script injected!");

const STORAGE_KEY = "clients_db_v1";
const SELECTED_EMAIL_KEY = "selected_client_email_v1";

// ------------------ Client model ------------------
class Client {
  constructor(firstName, lastName, email, phone, hrsPerWeek, subject, totalHrs) {
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.phone = phone;
    this.hrsPerWeek = hrsPerWeek;
    this.subject = subject;
    this.totalHrs = totalHrs;
  }

  toJSON() {
    return {
      first_name: this.firstName,
      last_name: this.lastName,
      email: this.email,
      phone: this.phone,
      subject: this.subject,
      hours_per_week: this.hrsPerWeek,
      total_hours: this.totalHrs,
      class_name: "Client",
    };
  }

  static fromJSON(o) {
    return new Client(
      o.first_name,
      o.last_name,
      o.email,
      o.phone,
      o.hours_per_week,
      o.subject,
      o.total_hours
    );
  }
}

// ------------------ Storage helpers ------------------
async function loadDB() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const db = result[STORAGE_KEY];
  return (!db || !Array.isArray(db.clients)) ? { clients: [] } : db;
}

async function saveDB(db) {
  await chrome.storage.local.set({ [STORAGE_KEY]: db });
}

async function getClientByEmail(email) {
  const db = await loadDB();
  const raw = db.clients.find(c => c.email === email);
  return raw ? Client.fromJSON(raw) : null;
}

async function getSelectedClient() {
  const sel = await chrome.storage.local.get([SELECTED_EMAIL_KEY]);
  const email = sel[SELECTED_EMAIL_KEY];
  if (!email) return null;
  return await getClientByEmail(email);
}

/**
 * Increment total_hours for a client and persist.
 * sessionHours is the number of hours for THIS session.
 */
async function addSessionHours(email, sessionHours) {
  const db = await loadDB();
  const idx = db.clients.findIndex(c => c.email === email);
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

// ------------------ DOM helpers ------------------
function waitForId(id, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      const el = document.getElementById(id);
      if (el) {
        clearInterval(t);
        resolve(el);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error("Timed out waiting for #" + id));
      }
    }, 100);
  });
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el) {
    console.error("Missing element:", id);
    return false;
  }
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

// ------------------ Tutor info (ship blanks; user can set in UI later) ------------------
const tutorName = "";
const tutorLastName = "";
const tutorEmail = "";

// ------------------ Autofill logic ------------------
function fillFormFromClient(client) {
  const parts = String(client.phone || "").split("-");

  // tutor
  setValue("Field11", tutorName);
  setValue("Field18", tutorLastName);
  setValue("Field6", tutorEmail);

  // student
  setValue("Field12", client.firstName);
  setValue("Field19", client.lastName);
  setValue("Field3", client.email);

  // phone ###-###-####
  setValue("Field23", parts[0] || "");
  setValue("Field23-1", parts[1] || "");
  setValue("Field23-2", parts[2] || "");

  // date MM/DD/YYYY
  const today = new Date();
  setValue("Field9-1", today.getMonth() + 1);
  setValue("Field9-2", today.getDate());
  setValue("Field9", today.getFullYear());

  // session length + subject
  setValue("Field7", client.hrsPerWeek);
  setValue("Field16", client.subject);

  // total hours display (what total would become after this session)
  const sessionHours = Number(document.getElementById("Field7")?.value);
  const computedTotal =
    (Number(client.totalHrs) || 0) + (Number.isFinite(sessionHours) ? sessionHours : 0);
  setValue("Field14", computedTotal);
}

function attachRecomputeTotalHandler(client) {
  const sessionLenEl = document.getElementById("Field7");
  const totalEl = document.getElementById("Field14");
  if (!sessionLenEl || !totalEl) return;

  sessionLenEl.addEventListener("input", () => {
    const sessionHours = Number(sessionLenEl.value);
    const computedTotal =
      (Number(client.totalHrs) || 0) + (Number.isFinite(sessionHours) ? sessionHours : 0);
    totalEl.value = computedTotal;
  });
}

/**
 * Persist hours BEFORE submit navigates away.
 * Prevents double-increment by guarding with a flag.
 */
function attachPersistOnSubmit(client) {
  const form = document.querySelector("form");
  if (!form) return;

  let saving = false;
  let resubmitting = false;

  form.addEventListener(
    "submit",
    async (e) => {
      // If we manually called form.submit(), do not intercept again
      if (resubmitting) return;

      // Avoid double-submit spam
      if (saving) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      saving = true;

      // Stop Wufoo navigation until we finish saving
      e.preventDefault();
      e.stopImmediatePropagation();

      try {
        const sessionHours = Number(document.getElementById("Field7")?.value);

        // Ask background.js to do the storage write safely
        const resp = await chrome.runtime.sendMessage({
          type: "ADD_SESSION_HOURS",
          email: client.email,
          sessionHours
        });

        if (!resp?.ok) throw new Error(resp?.error || "Failed to persist hours");

        // Ensure the submitted total matches what we saved
        setValue("Field14", resp.newTotal);

        // Submit only after saving
        resubmitting = true;
        form.submit();
      } catch (err) {
        saving = false;
        alert("Could not save tutoring hours:\n" + err.message);
      }
    },
    true // capture phase helps beat Wufoo handlers
  );
}

// ------------------ bootstrap ------------------
(async function main() {
  try {
    // Wait for Wufoo to exist
    await waitForId("Field11");

    // Load the selected client set from your entry page
    const client = await getSelectedClient();
    if (!client) {
      console.warn("No selected client set. Open your client entry page and set one.");
      return;
    }

    fillFormFromClient(client);
    attachRecomputeTotalHandler(client);
    attachPersistOnSubmit(client);
  } catch (err) {
    console.error("Autofill bootstrap failed:", err);
  }
})();