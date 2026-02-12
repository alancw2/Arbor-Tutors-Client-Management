console.log("Tutor Log Autofill script injected!");
// Client model 
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

  static fromJSON(jsonObject) {
    return new Client(
      jsonObject.first_name,
      jsonObject.last_name,
      jsonObject.email,
      jsonObject.phone,
      jsonObject.hours_per_week,
      jsonObject.subject,
      jsonObject.total_hours
    );
  }
}
function waitForId(id, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      const el = document.getElementById(id);
      if (el) { clearInterval(t); resolve(el); }
      else if (Date.now() - start > timeoutMs) {
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
  // these events matter for forms that listen to input/change
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}
// Tutor info
var tutorName = "Alan";
var tutorLastName = "Ward";
var tutorEmail = "alanward@example.com";


// Chrome storage helpers
const STORAGE_KEY = "clients_db_v1";

// Read the DB { clients: [...] } from chrome.storage.local
async function loadDB() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const db = result[STORAGE_KEY];

  // First run: initialize empty db
  if (!db || !Array.isArray(db.clients)) {
    return { clients: [] };
  }
  return db;
}

// Write the DB back
async function saveDB(db) {
  await chrome.storage.local.set({ [STORAGE_KEY]: db });
}

// Upsert a client by email (add if missing, replace if exists)
async function upsertClient(client) {
  const db = await loadDB();

  const idx = db.clients.findIndex(c => c.email === client.email);
  const json = client.toJSON();

  if (idx === -1) db.clients.push(json);
  else db.clients[idx] = json;

  await saveDB(db);
  return db;
}

// Get a client by email (returns Client instance or null)
async function getClientByEmail(email) {
  const db = await loadDB();
  const raw = db.clients.find(c => c.email === email);
  return raw ? Client.fromJSON(raw) : null;
}

// Increment total hours for a client and persist.
// sessionHours is the hours you just tutored *this session*.
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

//Form autofill helpers
function fillFormFromClient(client) {
  const seperatedParentNumber = String(client.phone || "").split("-");

  // tutor
  setValue("Field11", tutorName);
  setValue("Field18", tutorLastName);
  setValue("Field6", tutorEmail);

  // student
  setValue("Field12", client.firstName);
  setValue("Field19", client.lastName);
  setValue("Field3", client.email);


  // phone ###-###-####
  setValue("Field23", seperatedParentNumber[0]);
  setValue("Field23-1", seperatedParentNumber[1]);
  setValue("Field23-2", seperatedParentNumber[2]);
  // date MM/DD/YYYY
  var today = new Date();
  setValue("Field9-1", today.getMonth() + 1);
  setValue("Field9-2", today.getDate());
  setValue("Field9", today.getFullYear());

  // session length + subject
  setValue("Field7", client.hrsPerWeek);
  setValue("Field16", client.subject);

  // total hours (display what it would become AFTER this session)
  const sessionHours = Number(document.getElementById("Field7").value);
  const computedTotal = (Number(client.totalHrs) || 0) + (Number.isFinite(sessionHours) ? sessionHours : 0);
  setValue("Field14", computedTotal);
}

// When session length changes, recompute Field14 live
function attachRecomputeTotalHandler(client) {
  const sessionLenEl = document.getElementById("Field7");
  const totalEl = document.getElementById("Field14");

  if (!sessionLenEl || !totalEl) return;

  sessionLenEl.addEventListener("input", () => {
    const sessionHours = Number(sessionLenEl.value);
    const computedTotal = (Number(client.totalHrs) || 0) + (Number.isFinite(sessionHours) ? sessionHours : 0);
    totalEl.value = computedTotal;
  });
}

// Before submit, persist the increment so next time it's remembered
function attachPersistOnSubmit(client) {
  // Try to find the actual form element on the page
  const form = document.querySelector("form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    try {
      const sessionHours = Number(document.getElementById("Field7").value);

      // Persist new total
      const newTotal = await addSessionHours(client.email, sessionHours);

      // Optional: ensure the submitted value matches what we saved
      document.getElementById("Field14").value = newTotal;
    } catch (err) {
      // If something is wrong, prevent submitting bad data
      e.preventDefault();
      alert("Could not save tutoring hours:\n" + err.message);
    }
  });
}

//bootstrap
(async function main() {
  // TEMP: seed client (you can later replace this with picking from storage)
  const seedClient = new Client("John", "Doe", "johndoe@email.com", "123-456-7890", 1, "Geometry", 12);

  // Ensure the client exists in storage (adds if missing, updates if present)
  await upsertClient(seedClient);

  // Load client from storage (so we're using the persisted version)
  const client = await getClientByEmail(seedClient.email);
  if (!client) throw new Error("Client failed to load from storage.");
  //wait for forms to update
  await waitForId("Field11");
  // Fill the form
  fillFormFromClient(client);

  // Recompute totals if you edit session length
  attachRecomputeTotalHandler(client);

  // Persist increment on submit
  attachPersistOnSubmit(client);
})();