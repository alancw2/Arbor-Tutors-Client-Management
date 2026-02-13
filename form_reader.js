document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("client_info_form");
  const message = document.getElementById("message");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const formData = {
      first_name: document.getElementById("first_name").value,
      last_name: document.getElementById("last_name").value,
      client_email: document.getElementById("email").value,
      parent_number: document.getElementById("phone").value
    };

    chrome.storage.local.set({ userData: formData }, () => {
      console.log("Saved to chrome.storage.local:", formData);
      message.textContent = "Client saved successfully!";
      form.reset();
    });
  });
});
