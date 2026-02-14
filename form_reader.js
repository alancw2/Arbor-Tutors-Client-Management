console.log("form_reader.js loaded");

const STORAGE_KEY = "clients_db_v1";
const SELECTED_EMAIL_KEY = "selected_client_email_v1";

function $(id) {
  return document.getElementById(id);
}

// ---------- Client JSON helpers (matches Client.fromJSON in arbor_script.js) ----------
function readFormToClientJSON() {
  return {
    first_name: $("first_name").value.trim(),
    last_name: $("last_name").value.trim(),
    email: $("email").value.trim().toLowerCase(),
    phone: $("phone").value.trim(),
    hours_per_week: Number($("hrsPerWeek").value) || 0,
    subject: $("subject").value.trim(),
    total_hours: Number($("totalHrs").value) || 0,
    class_name: "Client"
  };
}

function writeClientJSONToForm(c) {
  $("first_name").value = c.first_name || "";
  $("last_name").value = c.last_name || "";
  $("email").value = c.email || "";
  $("phone").value = c.phone || "";
  $("hrsPerWeek").value = (c.hours_per_week ?? "");
  $("subject").value = c.subject || "";
  $("totalHrs").value = (c.total_hours ?? "");
}

// ---------- Storage helpers ----------
async function loadDB() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const db = result[STORAGE_KEY];
  return (!db || !Array.isArray(db.clients)) ? { clients: [] } : db;
}

async function saveDB(db) {
  await chrome.storage.local.set({ [STORAGE_KEY]: db });
}

async function upsertClientJSON(clientJson) {
  const db = await loadDB();
  const idx = db.clients.findIndex(c => c.email === clientJson.email);
  if (idx === -1) db.clients.push(clientJson);
  else db.clients[idx] = clientJson;
  await saveDB(db);
  return db;
}

async function getClientJSONByEmail(email) {
  const db = await loadDB();
  return db.clients.find(c => c.email === email) || null;
}

// ---------- UI helpers ----------
async function refreshDropdown() {
  const db = await loadDB();
  const sel = $("client_select");
  sel.innerHTML = `<option value="">(pick one)</option>`;

  for (const c of db.clients) {
    const opt = document.createElement("option");
    opt.value = c.email;
    opt.textContent = `${c.first_name} ${c.last_name} (${c.email})`;
    sel.appendChild(opt);
  }
}

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", async () => {
  const msg = $("message");

  await refreshDropdown();

  // Save client (upsert)
  $("client_info_form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const clientJson = readFormToClientJSON();

    if (!clientJson.email) {
      msg.textContent = "Email is required.";
      return;
    }

    await upsertClientJSON(clientJson);

    // (optional but recommended) set this client as selected immediately
    await chrome.storage.local.set({ [SELECTED_EMAIL_KEY]: clientJson.email });

    msg.textContent = "Saved client (and set as selected).";
    await refreshDropdown();
  });

  // Load selected dropdown client into the form
  $("load_btn").addEventListener("click", async () => {
    const email = $("client_select").value;
    if (!email) return;

    const client = await getClientJSONByEmail(email);
    if (!client) {
      msg.textContent = "Client not found in storage.";
      return;
    }

    writeClientJSONToForm(client);
    msg.textContent = "Loaded client into form.";
  });

  // Set dropdown client as the selected client for autofill
  $("set_selected_btn").addEventListener("click", async () => {
    const email = $("client_select").value;
    if (!email) {
      msg.textContent = "Pick a client first.";
      return;
    }

    await chrome.storage.local.set({ [SELECTED_EMAIL_KEY]: email });
    msg.textContent = `Selected client set: ${email}`;
  });
});
