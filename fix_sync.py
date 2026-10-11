"""
Corrige o sync.json: separa palavras que o Whisper juntou erroneamente.
"""
import json

with open("sync.json", "r", encoding="utf-8") as f:
    data = json.load(f)

new_words = []
new_id = 0

for w in data["words"]:
    word = w["word"]
    
    # Corrigir "miltonçantos." → "Milton" + "Santos."
    if "milton" in word.lower() and ("antos" in word.lower() or "santos" in word.lower()):
        mid = (w["start"] + w["end"]) / 2
        new_words.append({
            "id": new_id,
            "word": "Milton",
            "start": round(w["start"], 3),
            "end": round(mid, 3),
            "score": round(w["score"], 3)
        })
        new_id += 1
        new_words.append({
            "id": new_id,
            "word": "Santos.",
            "start": round(mid, 3),
            "end": round(w["end"], 3),
            "score": round(w["score"], 3)
        })
        new_id += 1
    else:
        w["id"] = new_id
        new_words.append(w)
        new_id += 1

data["words"] = new_words
data["word_count"] = len(new_words)

with open("sync.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"sync.json corrigido: {len(new_words)} palavras")

# Mostrar as primeiras 15 palavras para verificar
for w in new_words[:15]:
    print(f"  [{w['start']:.2f}-{w['end']:.2f}] {w['word']}")
