const API_URL = "https://detectionnet.onrender.com/api/analyze";



  // --- mostra la sezione di feedback dopo l'analisi ---
document.getElementById("feedback-section").classList.remove("hidden");

// gestione click sui bottoni di segnalazione
document.querySelectorAll(".feedback-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const feedback = btn.dataset.feedback;

    // Recupera info dal risultato attuale
    const resultText = document.getElementById("resultText").innerText;
    const fileInput = document.getElementById("fileInput");
    const textInput = document.getElementById("textInput");

    // Ricava sorgente e tipo
    const source =
      fileInput.files[0]
        ? (fileInput.files[0].name || fileInput.files[0].type)
        : textInput.value.slice(0, 100) || "unknown";

    // Estrai probabilità e categoria dal testo del risultato
    const probMatch = resultText.match(/([\d.]+)%/);
    const ai_probability = probMatch ? parseFloat(probMatch[1]) / 100 : 0;

    const categoryMatch = resultText.match(/<b>(.*?)<\/b>/);
    const category = categoryMatch ? categoryMatch[1] : "unknown";

    const payload = {
      source,
      ai_probability,
      category,
      feedback_type: feedback,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      alert("✅ Segnalazione inviata: " + feedback);
      console.log("Feedback salvato:", data);
    } catch (err) {
      console.error(" Errore durante l'invio feedback:", err);
      alert("Errore durante l'invio del feedback.");
    }
  });
});

  // --- POPOLA LA NEWS LIST (mock) ---
  const newsList = document.getElementById("news-list");
  if (newsList && newsList.children.length === 0) {
    const mockNews = [
      { title: "OpenAI: aggiornamenti su policy e sicurezza", time: "oggi" },
      { title: "UE lavora a linee guida sull'uso dell'AI nei media", time: "oggi" },
      { title: "Nuovo studio: riconoscimento deepfake migliora del 20%", time: "ieri" },
      { title: "Dataset pubblico per detection rilasciato da XYZ", time: "2 giorni fa" },
      { title: "Startup locale ottiene grant per ricerca AI etica", time: "questa settimana" }
    ];
    mockNews.forEach(n => {
      const d = document.createElement("div");
      d.className = "news-item";
      d.style.padding = "8px";
      d.style.marginBottom = "8px";
      d.style.borderRadius = "6px";
      d.style.background = "#fff";
      d.innerHTML = `<strong>${n.title}</strong><div style="font-size:12px;color:#666;margin-top:6px">${n.time}</div>`;
      newsList.appendChild(d);
    });
  }