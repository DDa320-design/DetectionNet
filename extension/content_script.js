// ======== DetectionNet AI Image Lazy Detection ========


console.log("🔍 DetectionNet content script attivo!");

// Configurazione base
const API_URL = "https://detectionnet.onrender.com/api/analyze";  // backend Online
const analyzedImages = new Set(); // evita doppie analisi

let selectedElement = null;

// ===========================
// Modalità di funzionamento
// ===========================
let currentMode = "auto"; // valore di fallback

// Recupera modalità salvata prima di iniziare
chrome.storage.sync.get(["mode"], (res) => {
  currentMode = res.mode || "auto";
  console.log("🧭 Modalità attiva:", currentMode);

  if (currentMode === "auto") {
  console.log("⚙️ Avvio analisi automatica immagini...");
  initLazyDetection();
} else if (currentMode === "semi") {
  console.log("🟡 Modalità semi-automatica attiva...");
  activateSemiAutomaticMode();
} else {
  console.log("🕹️ Modalità manuale attiva — nessuna analisi automatica.");
  deactivateSemiAutomaticMode();
}
});

// ============================================================
// 🧹FUNZIONE DI PULIZIA GENERALE (chiamata ad ogni cambio modalità)
// ============================================================
let activeObservers = []; // tiene traccia degli observer attivi

function cleanupCurrentMode() {
  console.log("🧹 Pulizia modalità precedente...");

  // Rimuovi tutti i badge esistenti
  document.querySelectorAll(".detectionnet-analyze-badge").forEach(b => b.remove());
  document.querySelectorAll("div").forEach(div => {
    if (div.innerText?.includes("AI:") || div.innerText?.includes("Analisi...")) {
      div.remove();
    }
  });

  // Ripristina tutte le immagini con position originali
  document.querySelectorAll("img").forEach(img => {
    img.style.position = "";
    const parent = img.parentElement;
    if (parent && parent.style.position === "relative") parent.style.position = "";
  });

  // Disconnetti tutti gli observer attivi
  activeObservers.forEach(obs => {
    try { obs.disconnect(); } catch (_) {}
  });
  activeObservers = [];

  console.log("✅ Pulizia completata");
}

// ============================================================
//  GESTIONE DEL CAMBIO MODALITÀ IN TEMPO REALE
// ============================================================
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.mode) {
    const newMode = changes.mode.newValue;
    console.log(`🔁 Cambio modalità → ${newMode}`);

    cleanupCurrentMode();

    if (newMode === "auto") {
      currentMode = "auto";
      initLazyDetection();
    } else if (newMode === "semi") {
      currentMode = "semi";
      activateSemiAutomaticMode();

      // aggiunge l'observer per rilevare nuove immagini in modalità semi
      const obs = new MutationObserver(() => activateSemiAutomaticMode());
      obs.observe(document.body, { childList: true, subtree: true });
      activeObservers.push(obs);
    } else if (newMode === "manual") {
      currentMode = "manual";
      deactivateSemiAutomaticMode();
    }
  }
});



// Crea un badge da attaccare all’immagine
function createBadge(text, color = "gray") {
    const badge = document.createElement("div");
    badge.innerText = text;
    badge.style.position = "absolute";
    badge.style.top = "5px";
    badge.style.right = "5px";
    badge.style.background = color;
    badge.style.color = "white";
    badge.style.fontSize = "11px";
    badge.style.padding = "3px 6px";
    badge.style.borderRadius = "4px";
    badge.style.zIndex = "9999";
    badge.style.pointerEvents = "none";
    badge.style.fontFamily = "Arial, sans-serif";
    badge.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
    badge.style.transition = "all 0.3s ease";
    return badge;
}


// Parametri filtro
const MIN_WIDTH = 100;   // larghezza minima (px)
const MIN_HEIGHT = 100;  // altezza minima (px)
const ICON_KEYWORDS = ["favicon", "icon", "logo", "sprite", "avatar", "emoji"]; // parole chiave da evitare


// FILTRO immagini piccole o icone
function shouldSkip(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  if (w < MIN_WIDTH || h < MIN_HEIGHT) {
    console.log(`⚠️ Skippata immagine troppo piccola (${w}x${h}) → ${img.src}`);
    return true;
  }

  const srcLower = img.src.toLowerCase();
  if (ICON_KEYWORDS.some(k => srcLower.includes(k))) {
    console.log(`⚠️ Skippata icona (${img.src})`);
    return true;
  }

  return false;
}


// ======================================================
// 🔍 Analizza un’immagine singola (solo in modalità auto)
// ======================================================
async function analyzeImage(img) {
  if (currentMode !== "auto") return; // ⛔ blocca se manuale
  if (!img.src || analyzedImages.has(img.src)) return;
  analyzedImages.add(img.src);

  if (shouldSkip(img)) return;

  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";

  img.parentNode.insertBefore(wrapper, img);
  wrapper.appendChild(img);

  const badge = createBadge("Analisi...", "rgba(0,0,0,0.6)");
  wrapper.appendChild(badge);

  try {
      const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: img.src })
      });

      const data = await res.json();
      console.log("📊 Risultato AI:", data);

      const prob = data.ai_probability || 0;
      const percent = (prob * 100).toFixed(1);
      let color;
      if (prob > 0.7) color = "red";
      else if (prob > 0.4) color = "orange";
      else color = "green";

      badge.innerText = `AI: ${percent}%`;
      badge.style.background = color;
      badge.style.transform = "scale(1.05)";
      setTimeout(() => badge.style.transform = "scale(1)", 200);

  } catch (err) {
      console.error("❌ Errore analisi:", err);
      badge.innerText = "Errore";
      badge.style.background = "gray";
  }
}

const MAX_WORDS = 100; // numero massimo di parole da analizzare

function getVisibleText() {
  // Estrae solo testo visibile dalla pagina, escludendo script e tag irrilevanti
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  const texts = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.nodeValue.trim();
    if (text && text.length > 20) { // ignora frammenti troppo corti
      texts.push(text);
    }
  }
  return texts.join(" ");
}

async function analyzeTextAutomatically() {
  const text = getVisibleText();

  // Se non c’è testo, esci
  if (!text) return;

  // Conta le parole e tronca se necessario
  const words = text.split(/\s+/);
  const limitedText = words.slice(0, MAX_WORDS).join(" ");

  console.log(`🧠 Analisi automatica testo (${words.length} parole, limitato a ${MAX_WORDS})`);

  try {
    const response = await fetch("https://detectionnet.onrender.com/api/analyze_text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: limitedText }),
    });

    const data = await response.json();
    console.log("📊 Risultato analisi testo:", data);

    // Mostra il risultato all’utente
    alert(`🧠 Analisi automatica del testo\nProbabilità AI: ${(data.ai_probability * 100).toFixed(1)}%\nCategoria: ${data.category || "N/A"}`);
  } catch (err) {
    console.error("❌ Errore analisi testo:", err);
  }
}


// ======================================================
// 👁️ Lazy detection (solo in modalità auto)
// ======================================================
const observer = new IntersectionObserver((entries) => {
    if (currentMode !== "auto") return;
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            analyzeImage(entry.target);
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.4 });

function initLazyDetection() {
    document.querySelectorAll("img").forEach(img => observer.observe(img));
    //startAutoTextAnalysis();
}


// // Analisi automatica del testo all’avvio della modalità auto
// // 🧠 Analisi automatica del testo con evidenziazione
// function startAutoTextAnalysis() {
//   const text = getVisibleText();
//   if (!text) return;

//   const words = text.split(/\s+/);
//   const limitedText = words.slice(0, MAX_WORDS).join(" ");

//   console.log(`🧠 Analisi automatica testo (${words.length} parole, limitato a ${MAX_WORDS})`);

//   // 🟡 Evidenziazione del testo analizzato
//   const highlightColor = "rgba(255, 255, 0, 0.3)";
//   const highlightedNodes = [];

//   // Seleziona nodi di testo visibili e applica evidenziazione
//   const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
//   let totalWords = 0;
//   while (walker.nextNode()) {
//     const node = walker.currentNode;
//     const parent = node.parentNode;
//     const content = node.nodeValue.trim();

//     if (content && content.length > 20) {
//       const wordsInNode = content.split(/\s+/);
//       totalWords += wordsInNode.length;
//       if (totalWords > MAX_WORDS) break;

//       const span = document.createElement("span");
//       span.textContent = content;
//       span.style.backgroundColor = highlightColor;
//       span.style.borderRadius = "3px";
//       span.style.transition = "background-color 1s ease";

//       const parent = node.parentNode;
//       if (parent) {
//         parent.replaceChild(span, node);
//         highlightedNodes.push(span);
//       }
//     }
//   }

//   // 🔄 Chiamata API al backend
//   fetch("https://detectionnet.onrender.com/api/analyze_text", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ text: limitedText }),
//   })
//     .then(res => res.json())
//     .then(data => {
//       console.log("📊 Risultato analisi testo:", data);

//       // Mostra banner discreto con risultato
//       const banner = document.createElement("div");
//       banner.textContent = `🧠 Testo analizzato — AI: ${(data.ai_probability * 100).toFixed(1)}%`;
//       banner.style.position = "fixed";
//       banner.style.bottom = "10px";
//       banner.style.right = "10px";
//       banner.style.background = "rgba(0,0,0,0.7)";
//       banner.style.color = "white";
//       banner.style.padding = "6px 12px";
//       banner.style.borderRadius = "8px";
//       banner.style.fontSize = "13px";
//       banner.style.zIndex = "9999";
//       document.body.appendChild(banner);
//       setTimeout(() => banner.remove(), 5000);
//     })
//     .catch(err => console.error("❌ Errore analisi testo:", err))
//     .finally(() => {
//       // 🔄 Dopo 6 secondi, rimuove gradualmente l’evidenziazione
//       setTimeout(() => {
//         highlightedNodes.forEach(span => {
//           span.style.backgroundColor = "transparent";
//           setTimeout(() => {
//             const textNode = document.createTextNode(span.textContent);
//             span.parentNode.replaceChild(textNode, span);
//           }, 800);
//         });
//       }, 6000);
//     });
// }

// Rileva nuove immagini (solo in modalità auto)
const mutationObserver = new MutationObserver(() => {
    if (currentMode !== "auto") return;
    document.querySelectorAll("img").forEach(img => {
        if (!analyzedImages.has(img.src)) observer.observe(img);
    });
});
mutationObserver.observe(document.body, { childList: true, subtree: true });

// =============================
// 🔸 Modalità semi-automatica
// =============================


let semiObserver = null;

// helper: controlla skip basato sia sulle dimensioni "intrinseche" che su quelle visualizzate
function isSmallOrIcon(el) {
  if (!el) return true;
  // per immagini: controlla natural e visual size
  if (el.tagName === "IMG" || el.tagName === "VIDEO") {
    const naturalW = el.naturalWidth || 0;
    const naturalH = el.naturalHeight || 0;
    const rect = el.getBoundingClientRect();
    const dispW = rect.width || 0;
    const dispH = rect.height || 0;

    // usa shouldSkip (che usa naturalWidth/naturalHeight) e aggiunge controllo dimensione visuale
    if (shouldSkip(el)) return true;
    if (dispW < MIN_WIDTH || dispH < MIN_HEIGHT) return true;

    return false;
  }

  // per testo: considera la lunghezza e se è visibile
  if (el.innerText) {
    const words = el.innerText.trim().split(/\s+/).length;
    if (words < 5) return true;
    // evita elementi nascosti
    const rect = el.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 14) return true;
    return false;
  }

  return true;
}

function detectElementsForSemiAuto() {
  // Evita esecuzioni ripetute troppo aggressive
  console.log("🟡 detectElementsForSemiAuto() running...");

  const images = Array.from(document.querySelectorAll("img"));
  // const paragraphs = Array.from(document.querySelectorAll("p, span, .article, .post, .content"))
  //   .filter(p => p.innerText && p.innerText.trim().length > 20);

  images.forEach(img => {
    // skip se già processata o non valida
    if (img.dataset.detectionAttached) return;
    if (isSmallOrIcon(img)) {
      // marca come ignorata per non testare sempre
      img.dataset.detectionAttached = "skipped";
      return;
    }
    img.dataset.detectionAttached = true;
    createAnalyzeBadge(img, "image", img.src);
  });

  // paragraphs.forEach(p => {
  //   if (p.dataset.detectionAttached) return;
  //   // sample length check
  //   const words = p.innerText.trim().split(/\s+/).length;
  //   if (words < 5 || words > 80) {
  //     p.dataset.detectionAttached = "skipped";
  //     return;
  //   }
  //   if (isSmallOrIcon(p)) {
  //     p.dataset.detectionAttached = "skipped";
  //     return;
  //   }
  //   p.dataset.detectionAttached = true;
  //   const sampleText = p.innerText.slice(0, 200);
  //   createAnalyzeBadge(p, "text", sampleText);
  // });
}

function activateSemiAutomaticMode() {
  console.log("🟡 Attivazione modalità semi-automatica...");
  detectElementsForSemiAuto();
  if (semiObserver) semiObserver.disconnect();
  semiObserver = new MutationObserver(() => detectElementsForSemiAuto());
  semiObserver.observe(document.body, { childList: true, subtree: true });
}

function deactivateSemiAutomaticMode() {
  console.log("🔕 Disattivazione modalità semi-automatica...");
  if (semiObserver) {
    semiObserver.disconnect();
    semiObserver = null;
  }
  // Rimuove badge "Analizza" esistenti
  document.querySelectorAll("div").forEach(el => {
    if (el && el.textContent && el.textContent.trim() === "Analizza") el.remove();
  });
}

function createAnalyzeBadge(element, type, content) {
  if (isSmallOrIcon(element)) return;

  const badge = document.createElement("div");
  badge.textContent = "Analizza";
  badge.className = "detectionnet-analyze-badge";

  // === 💄 MODIFICA: stile trasparente / poco invasivo ===
  badge.style.cssText = `
    position: absolute;
    top: 6px;
    left: 6px;
    background: rgba(255, 255, 255, 0.25); /* semitrasparente */
    color: #000;
    font-weight: 700;
    font-size: 11px;
    padding: 3px 7px;
    border-radius: 6px;
    cursor: pointer;
    z-index: 2147483647;
    backdrop-filter: blur(2px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    transition: all .12s ease;
  `;

  // al passaggio del mouse leggero effetto evidenza
  badge.addEventListener("mouseenter", () => {
    badge.style.background = "rgba(255, 255, 0, 0.35)";
  });
  badge.addEventListener("mouseleave", () => {
    badge.style.background = "rgba(255, 255, 255, 0.25)";
  });

  // ANALISI AL CLICK ===
  badge.addEventListener("click", async (e) => {
    e.preventDefault();      // 🔹 blocca apertura link / immagine
    e.stopPropagation();     // 🔹 blocca il bubbling verso l’elemento sotto

    badge.textContent = "⏳ Analizzando...";
    badge.style.background = "rgba(200,200,200,0.5)";
    badge.style.cursor = "default";

    try {
      const res = await fetch("https://detectionnet.onrender.com/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: content })
      });
      const data = await res.json();
      const prob = (data.ai_probability * 100).toFixed(1);
      const category = data.category || (data.ai_probability > 0.5 ? "AI" : "Umana");

      // aggiorna badge con risultato
      badge.textContent = `${category} (${prob}%)`;
      badge.style.background = data.ai_probability > 0.5
        ? "rgba(255, 0, 0, 0.5)"     // rosso trasparente per AI
        : "rgba(0, 255, 0, 0.4)";    // verde trasparente per Human
      badge.style.color = "#fff";
    } catch (err) {
      console.error("Errore analisi semi-automatica:", err);
      badge.textContent = "Errore ❌";
      badge.style.background = "rgba(255, 0, 0, 0.5)";
      badge.style.color = "#fff";
    }
  });

  // posizione badge sopra elemento
  const container = element.parentElement;
  if (container) {
    const prev = getComputedStyle(container).position;
    if (prev === "static" || !prev) container.style.position = "relative";
    container.appendChild(badge);
  } else {
    element.style.position = element.style.position || "relative";
    document.body.appendChild(badge);
    const r = element.getBoundingClientRect();
    badge.style.top = `${window.scrollY + r.top + 6}px`;
    badge.style.left = `${window.scrollX + r.left + 6}px`;
  }
}







// =====================================
// Modalità manuale — selezione elemento
// =====================================
document.addEventListener("click", (e) => {
  chrome.storage.sync.get(["mode"], (res) => {
    if (res.mode === "manual") {
      e.preventDefault();
      e.stopPropagation();

      if (selectedElement) selectedElement.style.outline = "";

      selectedElement = e.target;
      console.log("🟦 Elemento selezionato:", selectedElement);
    }
  });
});

// Riceve comandi dal popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "analyze_selected" && selectedElement) {
    analyzeSingle(selectedElement);
  }
});


// 🔍 Funzione di analisi singolo elemento (manuale)
async function analyzeSingle(el) {
  let src = null;
  let isText = false;

  if (el.tagName === "IMG" || el.tagName === "VIDEO") {
    src = el.src;
  } else if (el.tagName === "DIV" || el.tagName === "P" || el.tagName === "SPAN") {
    src = el.innerText.slice(0, 300);
    isText = true;
  }

  if (!src) {
    alert("⚠️ Nessun contenuto valido selezionato.");
    return;
  }

  try {
    let formData = new FormData();

    if (isText) {
      formData.append("text_input", src);
    } else {
      // 🟢 Invia solo l’URL come testo, perché non hai un file locale
      // il backend lo salverà come “url: ...”
      formData.append("text_input", src);
    }

    const res = await fetch("https://detectionnet.onrender.com/api/upload", {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log("📊 Risultato AI (manuale):", data);

    const percent = Math.round(data.ai_probability * 100);
    const color = data.ai_probability > 0.5
      ? "rgba(255,80,80,0.9)"
      : "rgba(80,200,120,0.9)";

    // 🔹 Badge visivo sulla pagina
    const badge = document.createElement("div");
    badge.textContent = `${data.category} (${percent}%)`;
    badge.style.position = "absolute";
    badge.style.background = color;
    badge.style.color = "white";
    badge.style.padding = "4px 6px";
    badge.style.borderRadius = "8px";
    badge.style.fontSize = "12px";
    badge.style.fontWeight = "bold";
    badge.style.zIndex = "9999";
    badge.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";

    const rect = el.getBoundingClientRect();
    badge.style.top = `${window.scrollY + rect.top - 25}px`;
    badge.style.left = `${window.scrollX + rect.left}px`;
    document.body.appendChild(badge);

    // ✅ Salvataggio automatico nel DB gestito da /api/upload
  } catch (err) {
    console.error("❌ Errore analisi manuale:", err);
    alert("Errore durante l'analisi manuale.");
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "analyze_image") {
    console.log("📩 Comando context menu ricevuto (immagine):", msg.imageUrl);

    // Chiede al background di fare la fetch
    chrome.runtime.sendMessage({
      action: "fetch_analysis",
      type: "image",
      content: msg.imageUrl
    });
  }

  if (msg.action === "analyze_text") {
    console.log("📩 Comando context menu ricevuto (testo):", msg.selectedText);

    // Chiede al background di fare la fetch
    chrome.runtime.sendMessage({
      action: "fetch_analysis",
      type: "text",
      content: msg.selectedText
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "show_result") {
    if (msg.error) {
      alert("❌ Errore durante l'analisi.");
      return;
    }

    const data = msg.result;
    const prob = (data.ai_probability * 100).toFixed(1);
    const tipo = msg.type === "image" ? "immagine" : "testo";

    alert(` Analisi ${tipo}:\nProbabilità AI: ${prob}%\nCategoria: ${data.category || "N/A"}`);
  }
});

// // Aggiornamento automatico Pagina

// chrome.runtime.onMessage.addListener((msg) => {
//   if (msg.action === "mode_changed") {
//     currentMode = msg.newMode;
//     console.log("🔄 Modalità cambiata dal popup:", currentMode);

//     if (currentMode === "auto") {
//       deactivateSemiAutomaticMode();
//       initLazyDetection();
//     } else if (currentMode === "semi") {
//       deactivateSemiAutomaticMode(); // reset vecchi badge
//       activateSemiAutomaticMode();
//     } else {
//       deactivateSemiAutomaticMode();
//     }
//   }
// });