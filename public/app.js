
"use strict";

const $ = id => document.getElementById(id);
const STORAGE_KEY = "caraxes_conversations_v1";

let conversations = loadConversations();
let currentId = null;
let attachedText = "";
let attachedName = "";
let busy = false;
let activeRecognition = null;

function loadConversations() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveConversations() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations.slice(0, 60))
    );
  } catch (error) {
    console.error("Could not save chat history:", error);
  }
}

function makeId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7);
}

function currentConversation() {
  return conversations.find(c => c.id === currentId);
}

function renderHistory() {
  const list = $("historyList");
  if (!list) return;

  list.innerHTML = "";

  conversations.forEach(c => {
    const button = document.createElement("button");
    button.className = "history-entry";
    button.textContent = c.title || "New conversation";
    button.title = button.textContent;
    button.onclick = () => openConversation(c.id);
    list.appendChild(button);
  });
}

function renderMessages() {
  const container = $("messages");
  const welcome = $("welcome");
  const chatScroll = $("chatScroll");
  const conversation = currentConversation();

  if (!container || !welcome) return;

  container.innerHTML = "";

  const hasMessages = Boolean(
    conversation &&
    Array.isArray(conversation.messages) &&
    conversation.messages.length
  );

  welcome.style.display = hasMessages ? "none" : "block";

  if (!conversation) return;

  conversation.messages.forEach(message => {
    const element = document.createElement("div");
    element.className =
      "message " +
      (message.role === "user" ? "user" : "assistant");

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (message.role === "assistant") {
      const label = document.createElement("div");
      label.className = "message-label";
      label.textContent = "CARAXES AI";
      bubble.appendChild(label);
    }

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = message.text || "";
    bubble.appendChild(content);

    if (message.role === "assistant") {
      const actions = document.createElement("div");
      actions.className = "message-actions";

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy";
      copy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(message.text || "");
          copy.textContent = "Copied";
          setTimeout(() => {
            copy.textContent = "Copy";
          }, 1500);
        } catch {
          copy.textContent = "Copy unavailable";
        }
      };

      const speak = document.createElement("button");
      speak.type = "button";
      speak.textContent = "Read aloud";
      speak.onclick = () => speakText(message.text || "");

      actions.append(copy, speak);
      bubble.appendChild(actions);
    }

    element.appendChild(bubble);
    container.appendChild(element);
  });

  if (chatScroll) {
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }
}

function startNewChat() {
  currentId = makeId();

  conversations.unshift({
    id: currentId,
    title: "New conversation",
    messages: [],
    updated: Date.now()
  });

  saveConversations();
  renderHistory();
  renderMessages();

  $("topTitle").textContent = "New conversation";
  $("messageInput").focus();
  showView("chat");
}

function openConversation(id) {
  currentId = id;

  const conversation = currentConversation();

  if (!conversation) return;

  $("topTitle").textContent =
    conversation.title || "Conversation";

  renderMessages();
  showView("chat");
  closeSidebar();
}

function addMessage(role, text) {
  let conversation = currentConversation();

  if (!conversation) {
    startNewChat();
    conversation = currentConversation();
  }

  conversation.messages.push({
    role,
    text,
    time: Date.now()
  });

  conversation.updated = Date.now();

  if (
    role === "user" &&
    conversation.title === "New conversation"
  ) {
    conversation.title =
      text.slice(0, 42) + (text.length > 42 ? "…" : "");
  }

  saveConversations();
  renderHistory();
  renderMessages();

  $("topTitle").textContent = conversation.title;
}

function setBusy(value) {
  busy = value;

  $("sendBtn").disabled = value;
  $("messageInput").disabled = value;
}

function showTyping() {
  const element = document.createElement("div");
  element.className = "message assistant";
  element.id = "typing";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = "CARAXES AI";

  const status = document.createElement("div");
  status.className = "typing";
  status.textContent = "Thinking…";

  bubble.append(label, status);
  element.appendChild(bubble);

  $("messages").appendChild(element);
  $("chatScroll").scrollTop = $("chatScroll").scrollHeight;
}

async function sendMessage(text) {
  if (busy || !text.trim()) return;

  if (!currentConversation()) {
    startNewChat();
  }

  const finalText = attachedText
    ? `${text.trim()}\n\n[Attached file: ${attachedName}]\n${attachedText}`
    : text.trim();

  attachedText = "";
  attachedName = "";

  $("attachmentChip").hidden = true;
  $("attachmentChip").textContent = "";

  addMessage("user", finalText);

  $("messageInput").value = "";
  resizeInput();

  setBusy(true);
  showTyping();

  const conversation = currentConversation();

  const messages = conversation.messages
    .slice(-24)
    .map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      text: message.text
    }));

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an invalid response.");
    }

    $("typing")?.remove();

    if (!response.ok) {
      throw new Error(
        data.error || "The request could not be completed."
      );
    }

    if (typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("The AI returned an empty response.");
    }

    addMessage("assistant", data.reply);

  } catch (error) {
    $("typing")?.remove();

    addMessage(
      "assistant",
      "I couldn't complete that request: " +
      (error.message || "Please try again.")
    );

  } finally {
    setBusy(false);
    $("messageInput").focus();
  }
}

function resizeInput() {
  const textarea = $("messageInput");

  textarea.style.height = "auto";
  textarea.style.height =
    Math.min(textarea.scrollHeight, 180) + "px";
}

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    alert("Text-to-speech is not supported in this browser.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("scrim").classList.remove("show");
}

function showView(name) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.remove("active");
  });

  const target = $(name + "View");

  if (target) {
    target.classList.add("active");
  }

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === name
    );
  });

  const titles = {
    chat: currentConversation()?.title || "New conversation",
    image: "Image Studio",
    video: "Video Studio",
    audio: "Voice Tools",
    files: "Documents"
  };

  $("topTitle").textContent = titles[name] || "Workspace";

  closeSidebar();
}

/* NEW CHAT */

$("newChat").onclick = startNewChat;

/* CHAT FORM */

$("chatForm").addEventListener("submit", event => {
  event.preventDefault();
  sendMessage($("messageInput").value);
});

$("messageInput").addEventListener("input", resizeInput);

$("messageInput").addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("chatForm").requestSubmit();
  }
});

/* SUGGESTIONS */

document.querySelectorAll(".suggestion").forEach(button => {
  button.onclick = () => {
    sendMessage(button.dataset.prompt || "");
  };
});

/* NAVIGATION */

document.querySelectorAll(".nav-item").forEach(button => {
  button.onclick = () => {
    showView(button.dataset.view);
  };
});

/* CLEAR HISTORY */

$("clearHistory").onclick = () => {
  if (
    confirm("Clear all saved chat history on this device?")
  ) {
    conversations = [];
    currentId = null;

    saveConversations();
    renderHistory();
    renderMessages();

    $("topTitle").textContent = "New conversation";
  }
};

/* MOBILE SIDEBAR */

$("openSidebar").onclick = () => {
  $("sidebar").classList.add("open");
  $("scrim").classList.add("show");
};

$("closeSidebar").onclick = closeSidebar;
$("scrim").onclick = closeSidebar;

/* FILE ATTACHMENT */

$("fileInput").onchange = async event => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (file.size > 300000) {
    alert("Please choose a text file under 300 KB.");
    event.target.value = "";
    return;
  }

  try {
    attachedText = await file.text();
    attachedName = file.name;

    $("attachmentChip").textContent =
      "Attached: " + file.name;

    $("attachmentChip").hidden = false;

  } catch {
    alert("Could not read this file.");
  }

  event.target.value = "";
};

/* VOICE INPUT */

$("voiceInput").onclick = () => {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "Voice input is not supported in this browser. Try Chrome."
    );
    return;
  }

  if (activeRecognition) {
    activeRecognition.stop();
    return;
  }

  const recognition = new SpeechRecognition();

  activeRecognition = recognition;
  recognition.lang = navigator.language || "en-IN";
  recognition.interimResults = false;
  recognition.continuous = false;

  $("voiceInput").textContent = "Listening…";

  recognition.onresult = event => {
    const transcript =
      event.results[0][0].transcript;

    const input = $("messageInput");

    input.value +=
      (input.value ? " " : "") + transcript;

    resizeInput();
  };

  recognition.onerror = () => {
    alert(
      "Voice input could not start. Check microphone permission."
    );
  };

  recognition.onend = () => {
    activeRecognition = null;
    $("voiceInput").textContent = "⌁";
  };

  try {
    recognition.start();
  } catch {
    activeRecognition = null;
    $("voiceInput").textContent = "⌁";
    alert("Could not start voice input.");
  }
};

/* VOICE TOOLS */

$("testVoice").onclick = () => {
  speakText(
    "Hello. This is CARAXES AI voice output."
  );
};

$("stopVoice").onclick = stopSpeaking;

$("voiceSupport").textContent =
  ("speechSynthesis" in window)
    ? "Device text-to-speech is available. Voice input depends on browser support."
    : "Text-to-speech is not supported in this browser.";

/* SERVER CONNECTION STATUS */

async function checkConnection() {
  try {
    const response = await fetch("/api/health");

    if (!response.ok) {
      throw new Error("Server unavailable");
    }

    const data = await response.json();

    $("connectionText").textContent =
      data.aiConfigured
        ? "AI connected"
        : "Server online · API key needed";

    $("connectionText").previousElementSibling.style.background =
      data.aiConfigured ? "#8a9c77" : "#b49a70";

  } catch {
    $("connectionText").textContent =
      "Server connection unavailable";

    $("connectionText").previousElementSibling.style.background =
      "#b46f60";
  }
}

/* INITIAL LOAD */

renderHistory();

if (conversations.length) {
  currentId = conversations[0].id;
  openConversation(currentId);
} else {
  renderMessages();
}

checkConnection();
    
