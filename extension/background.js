console.log(" DetectionNet background attivo");

chrome.runtime.onInstalled.addListener(() => {
  // Crea una voce di menu per analizzare immagini
  chrome.contextMenus.create({
    id: "analyze-image",
    title: "Analizza immagine con DetectionNet",
    contexts: ["image"]
  });

  // Crea una voce per analizzare testo selezionato
  chrome.contextMenus.create({
    id: "analyze-text",
    title: "Analizza testo selezionato con DetectionNet",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "analyze-image") {
    // Invia al content script l'URL dell'immagine
    chrome.tabs.sendMessage(tab.id, {
      action: "analyze_image",
      imageUrl: info.srcUrl
    });
  }

  if (info.menuItemId === "analyze-text") {
    // Invia al content script il testo selezionato
    chrome.tabs.sendMessage(tab.id, {
      action: "analyze_text",
      selectedText: info.selectionText
    });
  }
});

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === "fetch_analysis") {
    try {
      let endpoint = msg.type === "image" ? "analyze" : "analyze_text";
      const response = await fetch(`https://detectionnet.onrender.com/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          msg.type === "image" ? { url: msg.content } : { text: msg.content }
        ),
      });

      const data = await response.json();
      console.log("📊 Risultato analisi:", data);

      // Invia il risultato di nuovo al content script per mostrarlo
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "show_result",
          result: data,
          type: msg.type
        });
      }
    } catch (err) {
      console.error("❌ Errore nel backend:", err);
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "show_result",
          error: true
        });
      }
    }
  }
});