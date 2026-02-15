# Tutor Log Autofill (Arbor Tutors / Wufoo)

A lightweight Chrome Extension that helps tutors quickly complete the Arbor Tutors Tutor Log form by saving client information locally and autofilling repetitive fields.

This project was built to reduce manual typing, improve consistency, and automatically track cumulative tutoring hours per student.

---

## Features

- **Client database stored locally** using `chrome.storage.local`
- **Autofill Wufoo Tutor Log form** with saved client information
- **Auto-compute total hours** based on previous total + current session length
- **Auto-increment and persist total hours** when the form is submitted
- **Client selector UI** (popup) for choosing which student to autofill
- **Client information import/export functionality allowing client data transfer between devices.

---

## How It Works

### Client Entry Page (Extension Popup)
Tutors enter and save student information such as:
- First/Last name
- Email
- Parent phone number
- Subject
- Hours per week
- Total hours

This information is stored locally in Chrome under:

- `clients_db_v1`  
- `selected_client_email_v1`

### Tutor Log Autofill (Content Script)
When the tutor visits the Arbor/Wufoo Tutor Log form, the extension:
1. Loads the currently selected client
2. Autofills the Tutor Log fields
3. Computes total hours dynamically
4. Updates the stored total hours when the form is submitted

---

## Privacy / Data Storage

**All data is stored locally** in the user's browser using `chrome.storage.local`.

- No data is transmitted to any external server.
- No analytics or tracking is included.
- Users are responsible for protecting their browser profile/device.

---

## Installation (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/alancw2/Arbor-Tutors-Client-Management.git
