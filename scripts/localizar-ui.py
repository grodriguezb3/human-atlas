"""Localiza los textos de accesibilidad de components/ui (los que menciona el
plan de i18n del proyecto: sr-only, aria-label y textos por defecto).

Usa translate() (no hook) para no cambiar la estructura de los componentes de
la libreria: es seguro y suficiente para textos de lector de pantalla.

Uso: python scripts/localizar-ui.py
"""
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
UI = BASE / "components" / "ui"

# (archivo, texto exacto a reemplazar, clave del bundle)
REEMPLAZOS: list[tuple[str, str, str]] = [
    ("breadcrumb.tsx", 'aria-label="breadcrumb"', "ui.breadcrumb"),
    ("breadcrumb.tsx", ">More<", "ui.more"),
    ("carousel.tsx", ">Previous slide<", "ui.previousSlide"),
    ("carousel.tsx", ">Next slide<", "ui.nextSlide"),
    ("carousel.tsx", ">Previous<", "ui.previous"),
    ("carousel.tsx", ">Next<", "ui.next"),
    ("command.tsx", 'placeholder="Search for a command to run..."', "ui.commandPlaceholder"),
    ("command.tsx", ">Command Palette<", "ui.commandPalette"),
    ("dialog.tsx", ">Close<", "ui.close"),
    ("sheet.tsx", ">Close<", "ui.close"),
    ("message-scroller.tsx", ">Scroll to end<", "ui.scrollToEnd"),
    ("message-scroller.tsx", ">Scroll to start<", "ui.scrollToStart"),
    ("pagination.tsx", 'aria-label="pagination"', "ui.pagination"),
    ("pagination.tsx", 'aria-label="Go to previous page"', "ui.goToPreviousPage"),
    ("pagination.tsx", 'aria-label="Go to next page"', "ui.goToNextPage"),
    ("pagination.tsx", ">More pages<", "ui.morePages"),
    ("sidebar.tsx", 'aria-label="Toggle Sidebar"', "ui.toggleSidebar"),
    ("sidebar.tsx", ">Toggle Sidebar<", "ui.toggleSidebar"),
    ("sidebar.tsx", ">Sidebar<", "ui.sidebarTitle"),
    ("sidebar.tsx", "Displays the mobile sidebar.", "ui.sidebarDescription"),
    ("spinner.tsx", 'aria-label="Loading"', "ui.loading"),
    ("toast.tsx", 'aria-label="Close toast"', "ui.closeToast"),
]

RUTA_I18N = "@/app/i18n"


def clave_jsx(clave: str) -> str:
    return "{translate('" + clave + "')}"


def clave_attr(clave: str) -> str:
    return "{translate('" + clave + "')}"


def main() -> int:
    cambios: list[str] = []
    por_archivo: dict[str, int] = {}

    for archivo, viejo, clave in REEMPLAZOS:
        f = UI / archivo
        if not f.exists():
            print(f"  aviso: no existe {archivo}")
            continue
        txt = f.read_text(encoding="utf-8")
        if viejo not in txt:
            continue

        if viejo.startswith("aria-label="):
            nuevo = "aria-label=" + clave_attr(clave)
        elif viejo.startswith("placeholder="):
            nuevo = "placeholder=" + clave_attr(clave)
        elif viejo.startswith(">") and viejo.endswith("<"):
            nuevo = ">" + clave_jsx(clave) + "<"
        else:
            nuevo = clave_jsx(clave)

        txt = txt.replace(viejo, nuevo, 1)

        # import de translate si falta
        if RUTA_I18N not in txt:
            m = re.search(r"^import .*?;$", txt, re.M)
            if m:
                linea = f"import {{translate}} from '{RUTA_I18N}';\n"
                txt = txt[: m.end()] + "\n" + linea + txt[m.end():]
        f.write_text(txt, encoding="utf-8")
        por_archivo[archivo] = por_archivo.get(archivo, 0) + 1
        cambios.append(f"  {archivo:26s} {viejo[:44]:44s} -> {clave}")

    print(f"archivos tocados: {len(por_archivo)} | textos localizados: {len(cambios)}")
    for c in cambios:
        print(c)
    if not cambios:
        print("nada que cambiar (quizas ya estaba hecho)")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
