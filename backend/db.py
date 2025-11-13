import sqlite3
import os
from datetime import datetime

# === Percorso assoluto verso la root del progetto ===
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__)))
DB_PATH = os.path.join(BASE_DIR, "detections.db")

print(f"📁 Database path in uso: {DB_PATH}")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT,
        ai_probability REAL,
        timestamp TEXT
    )
    """)
    conn.commit()
    conn.close()

def save_detection(url, ai_probability):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO detections (url, ai_probability, timestamp) VALUES (?, ?, ?)",
        (url, ai_probability, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()

def get_recent_detections(limit=20):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT url, ai_probability, timestamp FROM detections ORDER BY id DESC LIMIT ?", (limit,))
    rows = cur.fetchall()
    conn.close()
    return [{"url": r[0], "ai_probability": r[1], "timestamp": r[2]} for r in rows]

def get_daily_stats():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*), AVG(ai_probability) FROM detections WHERE DATE(timestamp) = DATE('now')")
    count, avg_prob = cur.fetchone()
    conn.close()
    return {"today_count": count or 0, "average_probability": avg_prob or 0.0}