// ── State ──────────────────────────────────────────────
let loadedDocs = []; // [{ id, name, charCount }]
let chatHistory = [];

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

    addDoc(data.doc_id, data.filename, data.char_count);
    addSystemMessage(
      `📄 Loaded ${data.filename} (${data.char_count.toLocaleString()} chars)`,
    );
  } catch (err) {
    addSystemMessage(`❌ ${friendlyError(err.message)}`, "error");
  } finally {
    hideLoading();
    e.target.value = "";
  }
});

async function loadUrl() {
  const url = document.getElementById("urlInput").value.trim();
  if (!url) {
    addSystemMessage("❌ Please enter a URL first.", "error");
    return;
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    addSystemMessage("❌ URL must start with http:// or https://", "error");
    return;
  }

  showLoading("Scraping website...");

  try {
    const res = await fetch("/upload/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load URL");

    addDoc(data.doc_id, url, data.char_count);
    addSystemMessage(
      `🌐 Loaded ${shortenUrl(url)} (${data.char_count.toLocaleString()} chars)`,
    );
    document.getElementById("urlInput").value = "";
  } catch (err) {
    addSystemMessage(`❌ ${friendlyError(err.message)}`, "error");
  } finally {
    hideLoading();
  }
}

// ── Document Management ────────────────────────────────
function addDoc(id, name, charCount) {
  // Prevent duplicates
  if (loadedDocs.find((d) => d.id === id)) {
    addSystemMessage(`⚠️ ${name} is already loaded.`, "error");
    return;
  }

  loadedDocs.push({ id, name, charCount });
  renderDocsList();
  updatePlaceholder();
}

function removeDoc(id) {
  loadedDocs = loadedDocs.filter((d) => d.id !== id);
  renderDocsList();
  updatePlaceholder();
  addSystemMessage(`🗑️ Document removed — chat continues.`);
}

function confirmClearAll() {
  // Show warning modal
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "clearModal";
  modal.innerHTML = `
        <div class="modal">
            <h3>⚠️ Clear All Documents?</h3>
            <p>This will remove all loaded documents and reset your chat history.</p>
            <div class="modal-buttons">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-danger" onclick="clearAll()">Yes, Clear All</button>
            </div>
        </div>
    `;
  document.body.appendChild(modal);
}

function closeModal() {
  const modal = document.getElementById("clearModal");
  if (modal) modal.remove();
}

function clearAll() {
  closeModal();
  loadedDocs = [];
  chatHistory = [];
  renderDocsList();
  updatePlaceholder();

  // Clear chat messages
  const container = document.getElementById("chatMessages");
  container.innerHTML = `
        <div class="welcome-message">
            <h3>👋 Welcome to DocuChat!</h3>
            <p>Load a document on the left, then ask me anything about it.</p>
            <p>Or just chat without a document for general AI assistance.</p>
        </div>
    `;
  addSystemMessage("🗑️ All documents cleared and chat history reset.");
}

function renderDocsList() {
  const list = document.getElementById("docsList");
  const notice = document.getElementById("noDocNotice");
  const clearBtn = document.getElementById("clearAllBtn");
  const countEl = document.getElementById("docsCount");

  if (loadedDocs.length === 0) {
    list.innerHTML = "";
    notice.style.display = "block";
    clearBtn.style.display = "none";
    countEl.textContent = "No documents loaded";
    return;
  }

  notice.style.display = "none";
  clearBtn.style.display = "inline-block";
  countEl.textContent = `${loadedDocs.length} document${loadedDocs.length > 1 ? "s" : ""} loaded`;

  list.innerHTML = loadedDocs
    .map(
      (doc) => `
        <div class="doc-item">
            <div class="doc-item-info">
                <strong title="${doc.name}">
                    ${doc.name.startsWith("http") ? "🌐" : "📄"} ${shortenName(doc.name)}
                </strong>
                <span>${doc.charCount.toLocaleString()} chars</span>
            </div>
            <button class="btn btn-ghost"
                onclick="removeDoc('${escapeAttr(doc.id)}')"
                title="Remove document">✕</button>
        </div>
    `,
    )
    .join("");
}

function updatePlaceholder() {
  const input = document.getElementById("messageInput");
  if (loadedDocs.length === 0) {
    input.placeholder = "Chat without a document (general AI mode)...";
  } else if (loadedDocs.length === 1) {
    input.placeholder = "Ask something about your document...";
  } else {
    input.placeholder = `Ask something across all ${loadedDocs.length} documents...`;
  }
}

// ── Chat ───────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  if (!message) return;

  input.value = "";
  autoResize(input);
  addMessage("user", message);
  const thinkingId = addThinking();

  const sendBtn = document.getElementById("sendBtn");
  sendBtn.disabled = true;

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        doc_ids: loadedDocs.map((d) => d.id),
        history: chatHistory,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Chat failed");

    removeThinking(thinkingId);
    addMessage("assistant", data.reply);
    chatHistory.push({ user: message, assistant: data.reply });
  } catch (err) {
    removeThinking(thinkingId);
    addMessage("assistant", `❌ ${friendlyError(err.message)}`);
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
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ── Helpers ────────────────────────────────────────────
function friendlyError(msg) {
  if (msg.includes("timed out")) return "Request timed out. Please try again.";
  if (msg.includes("not found")) return "Document not found. Please reload it.";
  if (msg.includes("No text found"))
    return "Could not extract text from this PDF.";
  if (msg.includes("HTTP 4"))
    return "Could not access that URL. It may be restricted.";
  if (msg.includes("Could not reach"))
    return "Could not reach that URL. Check your connection.";
  return msg;
}

function shortenUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url.substring(0, 40) + "...";
  }
}

function shortenName(name) {
  if (name.startsWith("http")) return shortenUrl(name);
  return name.length > 30 ? name.substring(0, 30) + "..." : name;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return str.replace(/'/g, "\\'");
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
