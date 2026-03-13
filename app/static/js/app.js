// ── State ──────────────────────────────────────────────
let currentDocId = null;

// ── Document Loading ───────────────────────────────────
document.getElementById("pdfInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  showLoading(`Loading ${file.name}...`);

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/upload/pdf", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || "Upload failed");

    setDocument(data.doc_id, data.filename, data.char_count);
    addSystemMessage(
      `📄 Loaded **${data.filename}** (${data.char_count.toLocaleString()} characters)`,
    );
  } catch (err) {
    addSystemMessage(`❌ Error: ${err.message}`, "error");
  } finally {
    hideLoading();
    e.target.value = "";
  }
});

async function loadUrl() {
  const url = document.getElementById("urlInput").value.trim();
  if (!url) return;

  showLoading("Scraping website...");

  try {
    const res = await fetch("/upload/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || "Failed to load URL");

    setDocument(data.doc_id, url, data.char_count);
    addSystemMessage(
      `🌐 Loaded **${url}** (${data.char_count.toLocaleString()} characters)`,
    );
    document.getElementById("urlInput").value = "";
  } catch (err) {
    addSystemMessage(`❌ Error: ${err.message}`, "error");
  } finally {
    hideLoading();
  }
}

function setDocument(docId, name, charCount) {
  currentDocId = docId;

  const shortName = name.length > 35 ? name.substring(0, 35) + "..." : name;
  document.getElementById("docName").textContent = shortName;
  document.getElementById("docInfo").textContent =
    `${charCount.toLocaleString()} characters loaded`;

  document.getElementById("docStatus").style.display = "flex";
  document.getElementById("noDocNotice").style.display = "none";
  document.getElementById("messageInput").placeholder =
    "Ask something about your document...";
}

function clearDocument() {
  currentDocId = null;
  document.getElementById("docStatus").style.display = "none";
  document.getElementById("noDocNotice").style.display = "block";
  document.getElementById("messageInput").placeholder =
    "Chat without a document (general AI mode)...";
  addSystemMessage("🗑️ Document cleared — now in general chat mode");
}

// ── Chat ───────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  if (!message) return;

  input.value = "";
  autoResize(input);

  // Show user message
  addMessage("user", message);

  // Show thinking indicator
  const thinkingId = addThinking();

  // Disable send button
  const sendBtn = document.getElementById("sendBtn");
  sendBtn.disabled = true;

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        doc_id: currentDocId || "",
      }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || "Chat failed");

    removeThinking(thinkingId);
    addMessage("assistant", data.reply);
  } catch (err) {
    removeThinking(thinkingId);
    addMessage("assistant", `❌ Error: ${err.message}`);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

function handleKeyDown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ── Message Rendering ──────────────────────────────────
function addMessage(role, text) {
  const container = document.getElementById("chatMessages");

  // Remove welcome message on first chat
  const welcome = container.querySelector(".welcome-message");
  if (welcome) welcome.remove();

  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerHTML = `
        <div class="avatar">${role === "user" ? "👤" : "🤖"}</div>
        <div class="bubble">${escapeHtml(text)}</div>
    `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function addThinking() {
  const id = "thinking-" + Date.now();
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "message assistant thinking";
  div.id = id;
  div.innerHTML = `
        <div class="avatar">🤖</div>
        <div class="bubble">Thinking...</div>
    `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeThinking(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function addSystemMessage(text, type = "info") {
  const container = document.getElementById("chatMessages");
  const welcome = container.querySelector(".welcome-message");
  if (welcome) welcome.remove();

  const div = document.createElement("div");
  div.style.cssText = `
        text-align: center;
        font-size: 0.8rem;
        color: ${type === "error" ? "#ff6b6b" : "#555"};
        padding: 4px;
    `;
  div.textContent = text.replace(/\*\*(.*?)\*\*/g, "$1");
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ── Helpers ────────────────────────────────────────────
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

document.getElementById("messageInput").addEventListener("input", function () {
  autoResize(this);
});

function showLoading(text = "Loading...") {
  document.getElementById("loadingText").textContent = text;
  document.getElementById("loadingOverlay").style.display = "flex";
}

function hideLoading() {
  document.getElementById("loadingOverlay").style.display = "none";
}
