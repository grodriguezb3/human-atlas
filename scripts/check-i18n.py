"""Auditoria de claves i18n: comprueba que toda clave usada en el codigo exista
en locales/en.json y locales/es.json (y que ambos archivos sean espejo).

Uso: python scripts/check-i18n.py
"""
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
ARCHIVOS = ["app/page.tsx", "app/scene.tsx", "app/model-download.ts", "app/agent-tools.ts"]
SISTEMAS = ["skeletal", "muscular", "arterial", "venous", "nervous", "digestive", "respiratory",
            "urinary", "reproductive", "lymphatic", "endocrine", "integumentary", "connective",
            "sensory", "cardiac"]
EXPLICACIONES = ["heart", "liver", "brain", "stomach", "spleen", "pancreas", "urinary bladder",
                 "trachea", "diaphragm"]


def hojas(o, p=""):
    s = set()
    for k, v in o.items():
        kk = f"{p}.{k}" if p else k
        s |= hojas(v, kk) if isinstance(v, dict) else {kk}
    return s


def main() -> int:
    en = json.loads((BASE / "locales/en.json").read_text(encoding="utf-8"))
    es = json.loads((BASE / "locales/es.json").read_text(encoding="utf-8"))
    claves_en, claves_es = hojas(en), hojas(es)

    problemas = []

    # 1) los dos archivos deben ser espejo
    if claves_en - claves_es:
        problemas.append(f"faltan en es.json: {sorted(claves_en - claves_es)}")
    if claves_es - claves_en:
        problemas.append(f"sobran en es.json: {sorted(claves_es - claves_en)}")

    # 2) claves usadas en el codigo: t('...') y translate('...')
    usadas = set()
    for rel in ARCHIVOS:
        f = BASE / rel
        if not f.exists():
            continue
        txt = f.read_text(encoding="utf-8")
        usadas |= set(re.findall(r"\bt\(\s*'([A-Za-z0-9_.]+)'", txt))
        usadas |= set(re.findall(r"\btranslate\(\s*'([A-Za-z0-9_.]+)'", txt))
    faltan_en = sorted(k for k in usadas if k not in claves_en)
    faltan_es = sorted(k for k in usadas if k not in claves_es)
    if faltan_en:
        problemas.append(f"claves usadas ausentes en en.json: {faltan_en}")
    if faltan_es:
        problemas.append(f"claves usadas ausentes en es.json: {faltan_es}")

    # 3) claves dinamicas: 15 sistemas x (name, description) y 9 explicaciones
    for s in SISTEMAS:
        for campo in ("name", "description"):
            for loc, cl in (("en", claves_en), ("es", claves_es)):
                if f"systems.{s}.{campo}" not in cl:
                    problemas.append(f"falta systems.{s}.{campo} en {loc}.json")
    for e in EXPLICACIONES:
        for loc, cl in (("en", claves_en), ("es", claves_es)):
            if f"explanations.{e}" not in cl:
                problemas.append(f"falta explanations.{e} en {loc}.json")

    # 4) los marcadores {var} deben coincidir entre idiomas
    def valores(o, p=""):
        out = {}
        for k, v in o.items():
            kk = f"{p}.{k}" if p else k
            if isinstance(v, dict):
                out.update(valores(v, kk))
            else:
                out[kk] = v
        return out
    ve, vs = valores(en), valores(es)
    for k in claves_en & claves_es:
        if set(re.findall(r"\{(\w+)\}", ve[k])) != set(re.findall(r"\{(\w+)\}", vs[k])):
            # el texto del plural ICU no son variables: se compara excluyendo plural
            if ", plural," not in ve[k]:
                problemas.append(f"marcadores distintos en {k}: {ve[k]!r} vs {vs[k]!r}")

    print(f"claves en.json: {len(claves_en)} | es.json: {len(claves_es)}")
    print(f"claves usadas en el codigo: {len(usadas)}")
    if problemas:
        print("\nPROBLEMAS:")
        for p in problemas:
            print("  -", p)
        return 1
    print("\nOK: los dos idiomas son espejo y todas las claves usadas existen.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
