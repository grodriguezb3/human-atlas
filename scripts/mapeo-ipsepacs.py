"""Mapeo de las regiones anatomicas de IPSE PACS contra el catalogo de
human-atlas (BodyParts3D 4.0).

Entrada : public/models/atlas.json   (2234 partes, 3432 conceptos)
Salida  : ipsepacs-mapeo.json        (nuestro puente de datos)

El mapeo trabaja sobre los CONCEPTOS (que agrupan varias mallas) y tambien
sobre las PARTES, porque el visor resalta estructuras en ambos niveles.
Reglas por nombre anatomico (ingles) y por sistema del atlas. Una estructura
puede pertenecer a mas de una region (un rinon es abdomen y via urinaria).
"""
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
ATLAS = BASE / "public" / "models" / "atlas.json"
SALIDA = BASE / "ipsepacs-mapeo.json"

# ---------------------------------------------------------------- reglas
# Por nombre (minusculas). El orden importa: la primera regla que coincida
# define la region principal; las adicionales suman pertenencia.
REGLAS = [
    ("craneo", r"\b(skull|cranium|mandible|maxilla|parietal bone|frontal bone|temporal bone|occipital bone|zygomatic|sphenoid|ethmoid|nasal bone|vomer|palatine|hyoid|lacrimal|malleus|incus|stapes|calvaria|cerebrum|cerebellum|brain stem|brain|diencephalon|thalamus|hypothalamus|pituitary|corpus callosum|meninges|dura mater|arachnoid|pia mater|ventricle of brain|eye|eyeball|retina|cornea|lens|optic nerve|ear|cochlea|vestibulocochlear|tympanic|tongue|tooth|teeth|gingiva|palate)\b"),
    ("tiroides", r"\b(thyroid|parathyroid|isthmus of thyroid|trachea|larynx|epiglottis|vocal fold|cricoid|thyroid cartilage)\b"),
    ("mama", r"\b(mammary|breast|lactiferous|nipple|areola)\b"),
    ("torax", r"\b(rib|costal|sternum|manubrium|xiphoid|thoracic vertebra|clavicle|thymus|lung|pulmonary|bronch|pleura|alveol|mediastin|heart|atrium|ventricle of heart|mitral|tricuspid|aortic valve|pulmonary valve|coronary|pericardium|esophagus|diaphragm|tracheobronchial)\b"),
    ("columna", r"\b(vertebra|vertebral|intervertebral|spinal cord|spinal nerve|cauda equina|sacrum|coccyx|dura of spinal|nucleus pulposus|annulus fibrosus|spinal canal|nerve root)\b"),
    ("pelvis", r"\b(hip bone|ilium|ischium|pubis|pelvi|acetabul|sacroiliac|obturator|inguinal canal|pelvic)\b"),
    ("prostata", r"\b(prostate|prostatic|seminal vesicle|ejaculatory duct|bulbourethral|cowper)\b"),
    ("testiculos-escroto", r"\b(testic|testis|epididymis|scrotum|spermatic cord|vas deferens|deferent duct|pampiniform|penis|corpus cavernosum|corpus spongiosum|glans|urethra spongy)\b"),
    ("arbol-urinario", r"\b(kidney|renal|ureter|urinary bladder|bladder|urethra|nephron|calyx|calix|pyramid of kidney|papilla of kidney|glomerul|bowman)\b"),
    ("abdomen", r"\b(liver|hepat|stomach|gastric|duodenum|jejunum|ileum|intestin|colon|cecum|appendix|rectum|anal|spleen|pancreas|gallbladder|bile|choledoch|cystic duct|mesenter|omentum|peritone|retroperitone|adrenal|suprarenal|abdominal aorta|celiac|hepatic artery|portal vein|splenic)\b"),
    ("extremidades-inferiores", r"\b(femur|tibia|fibula|patella|knee|meniscus|cruciate|collateral ligament|achilles|calcaneus|talus|tarsal|metatarsal|phalanx of foot|toe|plantar|foot|ankle|thigh|gluteal|gluteus|quadriceps|hamstring|adductor|sartorius|gastrocnemius|soleus|tibial|peroneal|popliteal|femoral|saphenous|iliotibial|hip joint|greater trochanter)\b"),
    ("extremidades-superiores", r"\b(humerus|radius|ulna|carpal|metacarpal|phalanx of hand|finger|thumb|hand|wrist|elbow|shoulder|scapula|acromion|deltoid|biceps|triceps|brachial|brachialis|coracoid|glenoid|rotator cuff|supraspinatus|infraspinatus|subscapularis|teres|forearm|axilla|axillary|radial artery|ulnar artery|median nerve|ulnar nerve|cubital)\b"),
    ("vascular-doppler", r"\b(aorta|artery|arterial|arteries|vein|venous|vena cava|carotid|jugular|subclavian|brachial artery|radial artery|ulnar artery|femoral artery|popliteal artery|tibial artery|peroneal artery|saphenous vein|portal vein|iliac|mesenteric vessel|circle of willis|sinus of dura)\b"),
    ("partes-blandas", r"\b(muscle|muscular|fascia|tendon|aponeurosis|ligament|cartilage|adipose|subcutaneous|dermis|epidermis|skin|integument|lymph node|lymphatic|lymph|bone marrow|connective|joint capsule|bursa|synovi)\b"),
]

# Sistemas del atlas -> region de respaldo cuando el nombre no coincide
SISTEMAS_FALLBACK = {
    "skeletal": "partes-blandas",      # hueso suelto no identificado
    "muscular": "partes-blandas",
    "connective": "partes-blandas",
    "integumentary": "partes-blandas",
    "arterial": "vascular-doppler",
    "venous": "vascular-doppler",
    "nervous": "craneo",
    "cardiac": "torax",
    "respiratory": "torax",
    "digestive": "abdomen",
    "urinary": "arbol-urinario",
    "reproductive": "prostata",
    "endocrine": "tiroides",
    "lymphatic": "partes-blandas",
    "sensory": "craneo",
}

# Estructuras clave por region: las que el visor debe usar como ancla visual
ANCLAS = {
    "craneo": ["skull", "cranium", "brain", "frontal bone", "parietal bone"],
    "tiroides": ["thyroid", "larynx", "trachea"],
    "mama": ["mammary", "breast"],
    "torax": ["rib", "sternum", "lung", "heart", "thoracic vertebra"],
    "columna": ["vertebra", "spinal cord", "sacrum", "intervertebral"],
    "pelvis": ["hip bone", "ilium", "sacrum"],
    "prostata": ["prostate", "seminal vesicle"],
    "testiculos-escroto": ["testis", "scrotum", "epididymis"],
    "arbol-urinario": ["kidney", "ureter", "urinary bladder"],
    "abdomen": ["liver", "stomach", "intestine", "kidney", "pancreas", "spleen", "colon"],
    "extremidades-inferiores": ["femur", "tibia", "fibula", "patella"],
    "extremidades-superiores": ["humerus", "radius", "ulna", "scapula"],
    "vascular-doppler": ["aorta", "vena cava", "carotid", "artery", "vein"],
    "partes-blandas": ["muscle", "fascia", "tendon", "skin"],
}


def regiones_de(nombre: str, sistema: str):
    n = (nombre or "").lower()
    encontradas = []
    for region, patron in REGLAS:
        if re.search(patron, n):
            encontradas.append(region)
    if not encontradas:
        fb = SISTEMAS_FALLBACK.get(sistema)
        if fb:
            encontradas.append(fb)
    return encontradas


def main():
    data = json.loads(ATLAS.read_text(encoding="utf-8"))
    partes = data["parts"]
    conceptos = data["concepts"]

    por_region = {r: {"partes": [], "conceptos": [], "nombres": []} for r, _ in REGLAS}
    parte_a_regiones = {}
    concepto_a_regiones = {}

    for p in partes:
        regs = regiones_de(p.get("name"), p.get("system"))
        parte_a_regiones[p["id"]] = regs
        for r in regs:
            por_region[r]["partes"].append(p["id"])
            if len(por_region[r]["nombres"]) < 400:
                por_region[r]["nombres"].append(p.get("name"))

    for c in conceptos:
        regs = regiones_de(c.get("name"), "")
        if not regs:
            # hereda de sus elementos
            for e in c.get("elements", []):
                regs = parte_a_regiones.get(e, [])
                if regs:
                    break
        concepto_a_regiones[c["id"]] = regs
        for r in regs:
            por_region[r]["conceptos"].append(c["id"])

    resumen = {}
    for r, info in por_region.items():
        resumen[r] = {
            "partes": len(info["partes"]),
            "conceptos": len(info["conceptos"]),
            "anclas": [n for n in info["nombres"]
                       if any(a in (n or "").lower() for a in ANCLAS.get(r, []))][:25],
        }

    salida = {
        "fuente": data.get("version"),
        "sexo": data.get("sex"),
        "totalPartes": len(partes),
        "totalConceptos": len(conceptos),
        "resumenPorRegion": resumen,
        "parteARegiones": parte_a_regiones,
        "conceptoARegiones": concepto_a_regiones,
    }
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")

    print("Mapeo escrito en", SALIDA)
    print("%-26s %8s %10s" % ("REGION", "PARTES", "CONCEPTOS"))
    for r, v in sorted(resumen.items(), key=lambda x: -x[1]["partes"]):
        print("%-26s %8d %10d" % (r, v["partes"], v["conceptos"]))
    sin_region = sum(1 for v in parte_a_regiones.values() if not v)
    print("\npartes sin region asignada:", sin_region, "de", len(partes))


if __name__ == "__main__":
    sys.exit(main())
