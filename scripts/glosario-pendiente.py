"""Diagnostico del glosario: que palabras del catalogo faltan por traducir.

Lee los nombres de las 2.234 piezas y 3.432 conceptos, cuenta las palabras y
compara contra el glosario de scripts/build-anatomy-es.py.

Uso: python scripts/glosario-pendiente.py [--top 400] [--csv salida.csv]
"""
import argparse
import collections
import importlib.util
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
ATLAS = BASE / "public" / "models" / "atlas.json"
GEN = BASE / "scripts" / "build-anatomy-es.py"


def cargar_glosario() -> set[str]:
    spec = importlib.util.spec_from_file_location("gen_es", GEN)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    palabras = set()
    for termino in mod.GLOSARIO:
        palabras.update(termino.split())
    palabras.update(mod.LATERALIDAD)
    palabras.update(mod.NIVEL)
    palabras.update(mod.ORDINALES)
    palabras.update(mod.MODIFICADORES)
    palabras.update({"of", "the"})
    return palabras


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=400)
    ap.add_argument("--csv", type=str, default="")
    args = ap.parse_args()

    data = json.loads(ATLAS.read_text(encoding="utf-8"))
    nombres = [p["name"] for p in data["parts"]] + [c["name"] for c in data["concepts"]]
    freq: collections.Counter[str] = collections.Counter()
    for n in nombres:
        freq.update(w.lower() for w in re.findall(r"[A-Za-z]+", n))

    conocidas = cargar_glosario()
    faltan = [(w, c) for w, c in freq.most_common() if w not in conocidas]
    cubierto = sum(c for w, c in freq.items() if w in conocidas)
    total = sum(freq.values())

    print(f"nombres analizados: {len(nombres)} | palabras distintas: {len(freq)}")
    print(f"palabras ya en el glosario: {len([w for w in freq if w in conocidas])}")
    print(f"cobertura actual de apariciones: {cubierto/total*100:.1f}%")
    print(f"palabras SIN traducir (distintas): {len(faltan)}")
    acum = 0
    for i, (_w, c) in enumerate(faltan):
        acum += c
        if i + 1 in (100, 200, 300, 400, 600):
            print(f"  traduciendo las {i+1} palabras mas frecuentes que faltan -> cobertura {(cubierto+acum)/total*100:.1f}%")

    print(f"\n--- las {args.top} palabras mas frecuentes que faltan ---")
    print(", ".join(w for w, _ in faltan[: args.top]))

    if args.csv:
        with open(args.csv, "w", encoding="utf-8") as fh:
            fh.write("palabra,frecuencia,traduccion\n")
            for w, c in faltan[: args.top]:
                fh.write(f"{w},{c},\n")
        print(f"\nCSV de trabajo escrito en {args.csv}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
