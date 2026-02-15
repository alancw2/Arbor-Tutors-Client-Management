console.log("form_reader.js loaded");

const STORAGE_KEY = "clients_db_v1";
const SELECTED_EMAIL_KEY = "selected_client_email_v1";

function $(id) {
  return document.getElementById(id);
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function isValidClientShape(c) {
  return c && typeof c.email === "string"
  && typeof c.first_name === "string"
  && typeof c.last_name === "string"
}

function mergeDB(existing, incoming) {
  const out = { clients: Array.isArray(existing.clients) ? [...existing.clients] : [] };
  const map = new Map(out.clients.map(c => [String(c.email).toLowerCase(), c]));

  for (const raw of (incoming.clients || [])) {
    if (!isValidClientShape(raw)) continue;

    const email = String(raw.email).trim().toLowerCase();
    const normalized = {
      first_name: String(raw.first_name ?? "").trim(),
      last_name: String(raw.last_name ?? "").trim(),
      email,
      phone: String(raw.phone ?? "").trim(),
      hours_per_week: Number(raw.hours_per_week) || 0,
      subject: String(raw.subject ?? "").trim(),
      total_hours: Number(raw.total_hours) || 0,
      class_name: "Client",
    };

    map.set(email, normalized); // upsert
  }

  out.clients = [...map.values()];
  return out;
}

document.addEventListener("DOMContentLoaded", () => {
  const exportBtn = $("export_btn");
  const importInput = $("import_file");
  const backupMsg = $("backup_msg");
  // Export
  exportBtn.addEventListener("click", async () => {
    const db = await loadDB();
    const payload = {
      schema: STORAGE_KEY,
      exported_at: new Date().toISOString(),
      clients: db.clients || []
    };
    downloadText("clients.json", JSON.stringify(payload, null, 2));
    if (backupMsg) backupMsg.textContent = "Exported clients.json";
  });

  // Import
  importfile?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      //Accept either:
      //A) {clients: [...]} (exported format)
      //B) { schema, exported_at, clients: [...] } (with metadata)
      if (!parsed || !Arrray.isArray(parsed.clients)) {
        throw new Error("Invalid format: expected { clients: [...] }");
      }
      const existingDB = await loadDB();
      const merged = mergeDB(existingDB, parsed);
      await saveDB(merged);
      await refreshDropdown();
      if (backupMsg) backupMsg.textContent = "Import successful and merged with existing data.";
    } catch (err) {
      console.error("Import error:", err);
      if (backupMsg) backupMsg.textContent = "Import failed: " + err.message;
    } finally {
      importInput.value = ""; // reset file input
    }
  });
});
document.getElementById("import_file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed.clients || !Array.isArray(parsed.clients)) {
      throw new Error("Invalid format: expected { clients: [...] }");
    }
    const db = await loadDB();
    for (const client of parsed.clients) {
      const email = String(client.email || "").trim().toLowerCase();
      const idx = db.clients.findIndex(c => String(c.email || "").trim().toLowerCase() === email);
      if (idx === -1) {
        db.clients.push(client);
      } else {
        db.clients[idx] = client; // overwrite existing
      }
    }
    await saveDB(db);
    await refreshDropdown();
    document.getElementById("backup_msg").textContent = `Imported ${parsed.clients.length} client(s) successfully`;
  } catch (err) {
    console.error("Import error:", err);
    document.getElementById("backup_msg").textContent = "Import failed: " + err.message;
  }
  e.target.value = ""; // reset file input
});

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
  $("remove_client_btn").addEventListener("click", async (e) => {
    e.preventDefault();
    
    const email = $("email").value.trim().toLowerCase();
    if (!email) {
      msg.textContent = "Email is required to remove a client.";
      return;
    }
    
    const db = await loadDB();
    const idx = db.clients.findIndex(c => c.email === email);
    if (idx === -1) {
      msg.textContent = "Client not found.";
      return;
    }
    
    db.clients.splice(idx, 1);
    await saveDB(db);
    
    // If the removed client was selected, clear the selection

    const selectedEmail = await chrome.storage.local.get(SELECTED_EMAIL_KEY);
    if (selectedEmail[SELECTED_EMAIL_KEY] === email) {
      await chrome.storage.local.remove(SELECTED_EMAIL_KEY);
    }
    
    msg.textContent = "Client removed.";
    await refreshDropdown();
  }
);

  // Load selected dropdown client into the form
  $("load_btn").addEventListener("click", async () => {
    //window.location.reload(); 
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
    chrome.tabs.reload();
    const email = $("client_select").value;
    if (!email) {
      msg.textContent = "Pick a client first.";
      return;
    }

    await chrome.storage.local.set({ [SELECTED_EMAIL_KEY]: email });
    msg.textContent = `Selected client set: ${email}`;
  });
});
