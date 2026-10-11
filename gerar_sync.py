"""
Gera sync.json a partir do áudio usando Whisper com timestamps por palavra.
"""
import whisper
import json
import sys

print("Carregando modelo Whisper (base)...")
model = whisper.load_model("base")

print("Transcrevendo o áudio com timestamps por palavra...")
result = model.transcribe(
    "Geografia.mp3",
    language="pt",
    word_timestamps=True
)

words = []
word_id = 0

for segment in result["segments"]:
    if "words" not in segment:
        continue
    for w in segment["words"]:
        words.append({
            "id": word_id,
            "word": w["word"].strip(),
            "start": round(w["start"], 3),
            "end": round(w["end"], 3),
            "score": round(w.get("probability", 0.0), 3)
        })
        word_id += 1

sync_data = {
    "audio": "Geografia.mp3",
    "language": "pt-BR",
    "duration": round(result.get("duration", 135.045), 3) if "duration" in result else 135.045,
    "word_count": len(words),
    "words": words
}

# Tentar obter duração real do áudio
try:
    import subprocess
    r = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", "Geografia.mp3"],
        capture_output=True, text=True
    )
    if r.returncode == 0 and r.stdout.strip():
        sync_data["duration"] = round(float(r.stdout.strip()), 3)
except Exception:
    pass

with open("sync.json", "w", encoding="utf-8") as f:
    json.dump(sync_data, f, ensure_ascii=False, indent=2)

print(f"sync.json gerado com {len(words)} palavras.")
print(f"Duração: {sync_data['duration']}s")
print("Primeiras 10 palavras:")
for w in words[:10]:
    print(f"  [{w['start']:.2f}-{w['end']:.2f}] {w['word']}")
print("...")
print("Últimas 5 palavras:")
for w in words[-5:]:
    print(f"  [{w['start']:.2f}-{w['end']:.2f}] {w['word']}")
