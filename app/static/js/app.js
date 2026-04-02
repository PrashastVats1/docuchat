// ── State ──────────────────────────────────────────────
let loadedDocs = [];
let chatHistory = [];
let panelOpen = false;

// ── Panel Toggle ───────────────────────────────────────
function togglePanel() {
  const panel = document.getElementById("sidePanel");
  const backdrop = document.getElementById("panelBackdrop");
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    panelOpen = !panelOpen;
    panel.classList.toggle("open", panelOpen);
    backdrop.classList.toggle("visible", panelOpen);
  } else {
    panelOpen = !panelOpen;
    panel.classList.toggle("hidden-desktop", !panelOpen);
  }
}

// Start with panel open on desktop, closed on mobile
window.addEventListener("load", () => {
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) {
    panelOpen = true;
  }
});

// Close panel on mobile when window resizes to desktop
window.addEventListener("resize", () => {
  const isMobile = window.innerWidth <= 768;
  const panel = document.getElementById("sidePanel");
  const backdrop = document.getElementById("panelBackdrop");

  if (!isMobile) {
    panel.classList.remove("open");
    backdrop.classList.remove("visible");
    if (panelOpen) panel.classList.remove("hidden-desktop");
  }
});

// ── Toast Notifications ────────────────────────────────
function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  const icons = { error: "❌", success: "✅", info: "ℹ️" };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  toast.onclick = () => dismissToast(toast);

  container.appendChild(toast);

  setTimeout(() => dismissToast(toast), duration);
}

function dismissToast(toast) {
  toast.style.animation = "slideOut 0.3s ease forwards";
  setTimeout(() => toast.remove(), 300);
}

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

    await addDoc(data.doc_id, data.filename, data.char_count);
    addSystemMessage(
      `📄 Loaded ${data.filename} (${data.char_count.toLocaleString()} chars)`,
    );
    showToast(`${data.filename} loaded successfully!`, "success");
  } catch (err) {
    showToast(friendlyError(err.message), "error");
  } finally {
    hideLoading();
    e.target.value = "";
  }
});

// ── Document Management ────────────────────────────────
async function addDoc(id, name, charCount) {
  if (loadedDocs.find((d) => d.id === id)) {
    showToast(`${name} is already loaded.`, "info");
    return;
  }

  // Fetch preview
  let preview = "";
  try {
    const res = await fetch(`/preview/${encodeURIComponent(id)}`);
    const data = await res.json();
    preview = data.preview || "";
  } catch {
    preview = "Preview unavailable.";
  }

  loadedDocs.push({ id, name, charCount, preview });
  renderDocsList();
  updatePlaceholder();
}

function removeDoc(id) {
  loadedDocs = loadedDocs.filter((d) => d.id !== id);
  renderDocsList();
  updatePlaceholder();
  showToast("Document removed.", "info");
  addSystemMessage("🗑️ Document removed — chat continues.");
}

async function showPreview(id) {
  const doc = loadedDocs.find((d) => d.id === id);
  if (!doc) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "previewModal";
  modal.innerHTML = `
        <div class="modal" style="max-width: 600px; width: 90%; text-align: left;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="preview-modal-title">
                    ${doc.name.startsWith("http") ? "🌐" : "📄"} ${escapeHtml(shortenName(doc.name))}
                </span>
                <button class="btn btn-ghost" onclick="closePreviewModal()">✕</button>
            </div>
            <p style="font-size:0.75rem; color:#555; margin-top:4px;">
                First 500 characters of ${doc.charCount.toLocaleString()} total
            </p>
            <div class="preview-modal-body">${escapeHtml(doc.preview)}</div>
        </div>
    `;
  modal.onclick = (e) => {
    if (e.target === modal) closePreviewModal();
  };
  document.body.appendChild(modal);
}

function closePreviewModal() {
  const modal = document.getElementById("previewModal");
  if (modal) modal.remove();
}

function confirmClearAll() {
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

  const container = document.getElementById("chatMessages");
  container.innerHTML = `
        <div class="welcome-message">
            <h3>👋 Welcome to DocuChat!</h3>
            <p>Load a document on the left, then ask me anything about it.</p>
            <p>Or just chat without a document for general AI assistance.</p>
        </div>
    `;
  showToast("All documents cleared and chat reset.", "info");
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
    <div class="doc-item" id="doc-item-${CSS.escape(doc.id)}">
        <div class="doc-item-header">
            <div class="doc-item-info">
                <strong title="${escapeHtml(doc.name)}">
                    ${doc.name.startsWith("http") ? "🌐" : "📄"} ${escapeHtml(shortenName(doc.name))}
                </strong>
                <span>${doc.charCount.toLocaleString()} chars</span>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn btn-preview"
                    onclick="showPreview('${escapeAttr(doc.id)}')">
                    Preview
                </button>
                <button class="btn btn-ghost"
                    onclick="removeDoc('${escapeAttr(doc.id)}')"
                    title="Remove document">✕</button>
            </div>
        </div>
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
    showToast(friendlyError(err.message), "error");
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
    return "Could not reach that URL. Check the address.";
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
