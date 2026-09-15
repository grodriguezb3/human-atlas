#!/usr/bin/env python
"""Prepara y envia el PR de localizacion espanola al repositorio original.

NO publica nada salvo que se le pase --enviar (regla: nada se publica en GitHub
sin aprobacion explicita del usuario).

Uso:
    python revision/enviar-pr.py             # verifica y muestra el plan
    python revision/enviar-pr.py --enviar    # fork + push + abre el PR

Funciona sin gh: usa la API REST con el token que ya esta en ~/.git-credentials.
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request

REPO_ORIGINAL = "ashemag/human-atlas"
RAMA = "feat/i18n-es"
BASE = "main"
TITULO = "Add Spanish (es) localization"
CUERPO = pathlib.Path("revision/PR_DESCRIPTION.md")
API = "https://api.github.com"
RAIZ = pathlib.Path(__file__).resolve().parent.parent


def token() -> str:
    for linea in (pathlib.Path.home() / ".git-credentials").read_text(encoding="utf-8").splitlines():
        m = re.match(r"https://([^:]+):([^@]+)@(.+)", linea.strip())
        if m and "github" in m.group(3):
            return m.group(2)
    raise SystemExit("ERROR: no hay credencial de github.com en ~/.git-credentials")


def api(ruta: str, metodo: str = "GET", datos: dict | None = None) -> tuple[int, dict]:
    cuerpo = json.dumps(datos).encode() if datos is not None else None
    req = urllib.request.Request(
        API + ruta, data=cuerpo, method=metodo,
        headers={"Authorization": "Bearer " + token(),
                 "Accept": "application/vnd.github+json",
                 "User-Agent": "hermes-atlas-i18n",
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        detalle = e.read().decode()
        try:
            return e.code, json.loads(detalle)
        except Exception:
            return e.code, {"mensaje": detalle[:300]}


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=RAIZ, capture_output=True, text=True, check=check)


def verificaciones() -> None:
    print("== 1. verificaciones previas ==")
    rama = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    assert rama == RAMA, f"la rama actual es {rama}, se esperaba {RAMA}"
    print(f"  rama: {rama}")
    pendiente = git("status", "--porcelain").stdout.strip()
    sucio = [l for l in pendiente.splitlines() if not l.startswith("??")]
    assert not sucio, "hay cambios sin commitear:\n" + "\n".join(sucio)
    print("  arbol: limpio (sin cambios sin commitear)")
    for etiqueta, cmd in (("tsc", ["npm", "run", "check"]), ("build", ["npm", "run", "build"])):
        r = subprocess.run(cmd, cwd=RAIZ, capture_output=True, text=True, shell=(sys.platform == "win32"))
        assert r.returncode == 0, f"{etiqueta} falla:\n{(r.stdout + r.stderr)[-400:]}"
        print(f"  {etiqueta}: correcto")
    r = subprocess.run([sys.executable, "scripts/check-i18n.py"], cwd=RAIZ, capture_output=True, text=True)
    assert "OK" in r.stdout, "los catalogos no estan en espejo"
    print("  catalogos i18n: en espejo (es/en) y todas las claves usadas existen")
    print()


def main() -> int:
    enviar = "--enviar" in sys.argv
    verificaciones()

    estado, yo = api("/user")
    assert estado == 200, f"no se pudo autenticar contra la API ({estado})"
    usuario = yo["login"]
    print("== 2. cuenta de GitHub ==")
    print(f"  usuario: {usuario}")

    estado, original = api(f"/repos/{REPO_ORIGINAL}")
    print(f"  repositorio destino: {REPO_ORIGINAL} (HTTP {estado}, abierto: {original.get('open_issues_count')} issues/PRs)")

    diff = git("diff", "--stat", f"{BASE}..HEAD").stdout.strip().splitlines()
    print()
    print("== 3. lo que se enviaria ==")
    for l in diff[-4:]:
        print("  " + l.strip())

    assert CUERPO.exists(), f"falta el cuerpo del PR: {CUERPO}"
    print(f"  titulo del PR: {TITULO}")
    print(f"  cuerpo: {CUERPO.name} ({len(CUERPO.read_text(encoding='utf-8'))} caracteres)")

    if not enviar:
        print()
        print("== SIMULACION: nada publicado ==")
        print("Con --enviar ejecutaria exactamente esto:")
        print(f"  1. POST /repos/{REPO_ORIGINAL}/forks  (crea el fork en {usuario} si no existe)")
        print(f"  2. git remote add fork https://github.com/{usuario}/human-atlas.git")
        print(f"  3. git push fork {RAMA}")
        print(f"  4. POST /repos/{REPO_ORIGINAL}/pulls  head={usuario}:{RAMA} base={BASE}")
        return 0

    print()
    print("== 4. fork ==")
    estado, fork = api(f"/repos/{usuario}/human-atlas")
    if estado == 404:
        estado, fork = api(f"/repos/{REPO_ORIGINAL}/forks", "POST", {})
        print(f"  fork creado (HTTP {estado})")
    else:
        print(f"  fork ya existente (HTTP {estado})")

    remotos = git("remote").stdout.split()
    if "fork" not in remotos:
        git("remote", "add", "fork", f"https://github.com/{usuario}/human-atlas.git")
    print("  remoto 'fork' configurado")

    print()
    print("== 5. push de la rama ==")
    empuje = subprocess.run(["git", "push", "-u", "fork", RAMA], cwd=RAIZ,
                            capture_output=True, text=True)
    print((empuje.stdout + empuje.stderr)[-300:].strip())
    assert empuje.returncode == 0, "el push fallo"

    print()
    print("== 6. apertura del PR ==")
    estado, pr = api(f"/repos/{REPO_ORIGINAL}/pulls", "POST", {
        "title": TITULO, "head": f"{usuario}:{RAMA}", "base": BASE,
        "body": CUERPO.read_text(encoding="utf-8"), "maintainer_can_modify": True,
    })
    if estado in (200, 201):
        print(f"  PR abierto: {pr.get('html_url')}")
        return 0
    print(f"  ERROR al abrir el PR (HTTP {estado}): {json.dumps(pr)[:400]}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
