
document.getElementById("open-home").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://detectionnet.onrender.com/" });
});

document.getElementById("open-dashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://detectionnet.onrender.com/dashboard" });
});



// ==============================
// 🧭 Gestione modalità automatica / manuale
// ==============================
const modeSelect = document.getElementById("mode");
const analyzeBtn = document.getElementById("analyze-selected");
const statusText = document.getElementById("status");

// Carica modalità salvata
chrome.storage.sync.get(["mode"], (res) => {
  const mode = res.mode || "auto";
  modeSelect.value = mode;
  updateStatus(mode);
});

// Salva modalità selezionata
modeSelect.addEventListener("change", () => {
  const mode = modeSelect.value;
  chrome.storage.sync.set({ mode });
  updateStatus(mode);
});

// Aggiorna testo di stato
function updateStatus(mode) {
  let desc = "";
  if (mode === "auto") {
    desc = "Automatica (analizza tutto in automatico)";
  } else if (mode === "semi") {
    desc = "Semi-Automatica (rileva tutto, ma clicchi tu su 'Analizza')";
  } else {
    desc = "Manuale (clic su elementi singoli)";
  }

  statusText.textContent = `Modalità attiva: ${desc}`;
}
// ==============================
// 🔍 Analisi contenuto selezionato
// ==============================
analyzeBtn.addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "analyze_selected" });
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.mode) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "mode_changed",
        newMode: changes.mode.newValue
      });
    });
  }
});