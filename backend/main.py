from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import requests
import os, shutil, json
from backend.db import init_db, save_detection, get_daily_stats, get_recent_detections


# percorsi assoluti 
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
STATIC_DIR = os.path.join(FRONTEND_DIR, "static")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI()

# 🔹 Abilita CORS per permettere richieste da estensioni e frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# 🔹 Monta la cartella frontend per servire la dashboard
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# 🔹 Inizializza il database
init_db()

# 🔹 Modello di input (uguale al tuo)
class ImageRequest(BaseModel):
    url: str

# ==========================================================
# 🔸 ENDPOINT PRINCIPALE PER ANALISI IMMAGINI
# ==========================================================



@app.post("/api/analyze")
async def analyze(data: ImageRequest):
    url = data.url
    result = detect_image(url)
    print(f"✅ ANALYSIS DONE: {url} → {result}")  # <--- DEBUG
    save_detection(url, result)
    print("💾 Salvataggio effettuato!")  # <--- DEBUG
    return {"url": url, "ai_probability": result}




@app.post("/api/analyze_text")
async def analyze_text(request: Request):
    data = await request.json()
    text = data.get("text", "")
    # finto modello per ora
    #prob = 0.82 if "AI" in text else 0.27
    prob = round(random.uniform(0.1, 0.9), 3)
    category = "AI-generated" if prob > 0.51 else "Human"
    result = {
        "ai_probability": prob,
        "category": category
    }
    return JSONResponse(result)

# ==========================================================
# 🔸 SIMULAZIONE DETECTOR (mock o API reale se hai la key)
# ==========================================================


### API_Key1_ZeroTrue: zt_a2b52cea166546f1addd904c3aa24609
### API_Key1_Winston:8rZ1V24uaHg7ExJwCfNDmGHzR3QrgkRvBrgz8LlO0a40d0f4


def detect_image(url: str):
    """
    Analizza l'immagine: se non hai una API key, restituisce un valore casuale.
    """
    try:
        # hf_api = "https://api-inference.huggingface.co/models/umm-maybe/AI-image-detector"
        # headers = {"Authorization": f"Bearer YOUR_HF_API_KEY"}  # <- sostituisci più avanti
        # payload = {"inputs": url}

        # # Se non hai la chiave, simuliamo il risultato
        # if "YOUR_HF_API_KEY" in headers["Authorization"]:
        #     return round(random.uniform(0.1, 0.9), 3)

        # # Chiamata reale (verrà usata quando hai la key)
        # r = requests.post(hf_api, headers=headers, json=payload, timeout=15)
        # res = r.json()

        
        # API_KEY = "8rZ1V24uaHg7ExJwCfNDmGHzR3QrgkRvBrgz8LlO0a40d0f4"  # Winston AI
        # endpoint = "https://api.gowinston.ai/v2/image-detection"
        API_KEY = "Nothing"
        endpoint = "https://api-inference.huggingface.co/models/umm-maybe/AI-image-detector"

        payload = {
            "url": url,
            "version": "2.0"
        }

        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }

        # ⏱ Timeout 20 secondi per sicurezza
        response = requests.post(endpoint, json=payload, headers=headers, timeout=20)
        data = response.json()

        # ✅ DEBUG
        print("📩 Risposta Winston:", data)

        # 🔹 Se Winston restituisce una probabilità, leggila (adatta al formato corretto)
        if isinstance(data, dict):
            # Caso comune: {"ai_probability": 0.82, ...}
            for key in ["ai_probability", "score", "probability"]:
                if key in data:
                    return float(data[key])
            # Se il risultato è in un campo annidato:
            if "data" in data and isinstance(data["data"], dict):
                if "score" in data["data"]:
                    return float(data["data"]["score"])
        
        # Se la struttura non è chiara o Winston non risponde come previsto
        return 0.5

    except Exception as e:
        print("❌ Errore Winston AI:", e)
        return 0.5
# ======================================================
# 🏠 HOME PAGE
# ======================================================
@app.get("/", response_class=HTMLResponse)
def home():
    with open("frontend/index.html") as f:
        return f.read()

# ==========================================================
# 🔸 DASHBOARD FRONTEND
# ==========================================================
@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    """Ritorna la pagina HTML del frontend"""
    with open("frontend/dashboard.html") as f:
        return f.read()
    
# ======================================================
# 📦 API: CARICAMENTO E CLASSIFICAZIONE
# ======================================================
@app.post("/api/upload")
async def upload_media(
    file: UploadFile = File(None),
    text_input: str = Form(None)
):
    """Riceve un file multimediale o testo e restituisce una probabilità mock"""

    # 🧠 Classificazione mock (0–1)
    ai_prob = round(random.uniform(0.1, 0.95), 3)
    category = "AI-generated" if ai_prob > 0.5 else "Human"

    if file:
        # Salva il file localmente
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        url = f"/{UPLOAD_DIR}/{file.filename}"
    else:
        url = f"text:{text_input[:30]}..."

    # 🔹 Salva nel DB
    save_detection(url, ai_prob)

    return JSONResponse({
        "url": url,
        "ai_probability": ai_prob,
        "category": category
    })

# ==========================================================
# 🔸 API STATISTICHE
# ==========================================================
@app.get("/api/stats")
def api_stats():
    """Ritorna statistiche giornaliere e recenti dal DB"""
    return {"daily": get_daily_stats(), "recent": get_recent_detections()}



# ====== Endpoint feedback ======
FEEDBACK_FILE = "backend/feedback_log.json"


@app.post("/api/feedback")
async def save_feedback(request: Request):
    """Riceve feedback utente (falso positivo / falso negativo)"""
    try:
        data = await request.json()

        # Aggiungi log locale (in memoria o su file)
        if not os.path.exists(FEEDBACK_FILE):
            with open(FEEDBACK_FILE, "w") as f:
                json.dump([], f)

        with open(FEEDBACK_FILE, "r") as f:
            logs = json.load(f)

        logs.append(data)

        with open(FEEDBACK_FILE, "w") as f:
            json.dump(logs, f, indent=2)

        print(f"✅ Feedback ricevuto: {data}")
        return JSONResponse({"status": "ok", "message": "Feedback salvato correttamente."})

    except Exception as e:
        print(f"❌ Errore salvataggio feedback: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)
    
