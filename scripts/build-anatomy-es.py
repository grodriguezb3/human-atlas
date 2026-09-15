"""Genera locales/anatomy.es.json: nombres de las estructuras del atlas en espanol.

Fuente de datos: public/models/atlas.json (BodyParts3D 4.0, nombres en ingles).
Metodo: glosario de Terminologia Anatomica en espanol + reglas de reordenamiento
(laterality / nivel / ordinal / modificadores). Lo que no se puede traducir con
confianza NO se inventa: se omite y el visor cae al nombre en ingles.

Uso:
    python scripts/build-anatomy-es.py            # genera el archivo y reporta cobertura
    python scripts/build-anatomy-es.py --muestra 40
"""
import argparse
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
ATLAS = BASE / "public" / "models" / "atlas.json"
SALIDA = BASE / "locales" / "anatomy.es.json"

# --------------------------------------------------------------- glosario
# Terminos anatomicos. Clave: termino en ingles (minusculas). Valor: espanol.
GLOSARIO = {
    # cabeza y cuello
    "skull": "cráneo", "cranium": "cráneo", "calvaria": "calota", "mandible": "mandíbula",
    "maxilla": "maxilar", "frontal bone": "hueso frontal", "parietal bone": "hueso parietal",
    "temporal bone": "hueso temporal", "occipital bone": "hueso occipital", "sphenoid": "esfenoides",
    "ethmoid": "etmoides", "zygomatic": "cigomático", "nasal bone": "hueso nasal", "vomer": "vómer",
    "palatine": "palatino", "hyoid": "hioides", "lacrimal": "lagrimal", "brain": "cerebro",
    "cerebrum": "cerebro", "cerebellum": "cerebelo", "brainstem": "tronco del encéfalo",
    "thalamus": "tálamo", "hypothalamus": "hipotálamo", "pituitary": "hipófisis",
    "corpus callosum": "cuerpo calloso", "meninges": "meninges", "dura mater": "duramadre",
    "spinal cord": "médula espinal", "eye": "ojo", "eyeball": "globo ocular", "retina": "retina",
    "cornea": "córnea", "lens": "cristalino", "optic nerve": "nervio óptico", "ear": "oído",
    "cochlea": "cóclea", "tympanic": "timpánico", "tongue": "lengua", "tooth": "diente",
    "teeth": "dientes", "gingiva": "encía", "palate": "paladar", "temporal": "temporal",
    # cuello / endocrino / via aerea
    "thyroid": "tiroides", "parathyroid": "paratiroides", "thymus": "timo", "trachea": "tráquea",
    "larynx": "laringe", "pharynx": "faringe", "esophagus": "esófago", "epiglottis": "epiglotis",
    "vocal fold": "pliegue vocal", "thyroid cartilage": "cartílago tiroides", "cricoid": "cricoides",
    # torax
    "rib": "costilla", "costal cartilage": "cartílago costal", "sternum": "esternón",
    "manubrium": "manubrio", "xiphoid": "xifoides", "clavicle": "clavícula", "scapula": "escápula",
    "lung": "pulmón", "bronchus": "bronquio", "bronchiole": "bronquiolo", "pleura": "pleura",
    "heart": "corazón", "atrium": "aurícula", "ventricle": "ventrículo", "valve": "válvula",
    "aorta": "aorta", "pulmonary artery": "arteria pulmonar", "pulmonary vein": "vena pulmonar",
    "pericardium": "pericardio", "diaphragm": "diafragma", "mediastinum": "mediastino",
    # abdomen
    "liver": "hígado", "gallbladder": "vesícula biliar", "bile duct": "conducto biliar",
    "stomach": "estómago", "duodenum": "duodeno", "jejunum": "yeyuno", "ileum": "íleon",
    "cecum": "ciego", "colon": "colon", "rectum": "recto", "anus": "ano", "appendix": "apéndice",
    "pancreas": "páncreas", "spleen": "bazo", "kidney": "riñón", "ureter": "uréter",
    "bladder": "vejiga", "urethra": "uretra", "adrenal": "suprarrenal", "mesentery": "mesenterio",
    "omentum": "epiplón", "peritoneum": "peritoneo",
    # pelvis / reproductor
    "hip bone": "hueso coxal", "ilium": "ilion", "ischium": "isquion", "pubis": "pubis",
    "sacrum": "sacro", "coccyx": "cóccix", "prostate": "próstata", "testis": "testículo",
    "epididymis": "epidídimo", "scrotum": "escroto", "penis": "pene",
    "seminal vesicle": "vesícula seminal", "vas deferens": "conducto deferente",
    "uterus": "útero", "ovary": "ovario", "fallopian tube": "trompa uterina", "vagina": "vagina",
    "cervix": "cuello uterino", "mammary gland": "glándula mamaria", "breast": "mama",
    "nipple": "pezón", "rectum": "recto",
    # columna
    "vertebra": "vértebra", "intervertebral disc": "disco intervertebral", "atlas": "atlas",
    "axis": "axis", "nucleus pulposus": "núcleo pulposo",
    # extremidad superior
    "humerus": "húmero", "radius": "radio", "ulna": "cúbito", "carpal": "hueso del carpo",
    "metacarpal": "hueso del metacarpo", "phalanx": "falange", "finger": "dedo de la mano",
    "thumb": "pulgar", "hand": "mano", "wrist": "muñeca", "elbow": "codo", "shoulder": "hombro",
    "deltoid": "deltoides", "biceps": "bíceps", "triceps": "tríceps", "brachialis": "braquial",
    # extremidad inferior
    "femur": "fémur", "tibia": "tibia", "fibula": "peroné", "patella": "rótula", "knee": "rodilla",
    "meniscus": "menisco", "tarsal": "hueso del tarso", "metatarsal": "hueso del metatarso",
    "calcaneus": "calcáneo", "talus": "astrágalo", "toe": "dedo del pie", "foot": "pie",
    "ankle": "tobillo", "thigh": "muslo", "gluteus": "glúteo", "quadriceps": "cuádriceps",
    "gastrocnemius": "gastrocnemio", "soleus": "sóleo", "adductor": "adductor",
    "sartorius": "sartorio", "hip joint": "articulación de la cadera",
    # vasos
    "artery": "arteria", "vein": "vena", "capillary": "capilar", "carotid": "carótida",
    "jugular": "yugular", "subclavian": "subclavia", "brachial artery": "arteria braquial",
    "radial artery": "arteria radial", "ulnar artery": "arteria ulnar",
    "femoral artery": "arteria femoral", "popliteal artery": "arteria poplítea",
    "vena cava": "vena cava", "portal vein": "vena porta", "iliac": "ilíaca",
    "saphenous vein": "vena safena", "tibial artery": "arteria tibial",
    # tejidos y sistemas generales
    "muscle": "músculo", "bone": "hueso", "nerve": "nervio", "ligament": "ligamento",
    "tendon": "tendón", "cartilage": "cartílago", "joint": "articulación", "fascia": "fascia",
    "skin": "piel", "lymph node": "ganglio linfático", "lymphatic vessel": "vaso linfático",
    "bone marrow": "médula ósea", "adipose tissue": "tejido adiposo",
    # frases compuestas que deben ganar a sus partes (nucleo correcto)
    "bronchial tree": "árbol bronquial", "segmental bronchial tree": "árbol bronquial segmentario",
    "cerebral arterial circle": "círculo arterial cerebral", "circle of willis": "círculo arterial cerebral",
    "spinal cord": "médula espinal", "white matter": "sustancia blanca",
    "gray matter": "sustancia gris", "choroid plexus": "plexo coroideo",
    "corpus callosum": "cuerpo calloso", "brain stem": "tronco del encéfalo",
    # piezas dentales y maxilares
    "jaw": "mandíbula", "upper jaw": "maxilar superior", "lower jaw": "mandíbula",
    "molar tooth": "molar", "premolar tooth": "premolar", "incisor tooth": "incisivo",
    "canine tooth": "canino", "wisdom tooth": "muela del juicio", "uvula": "úvula",
    "tonsil": "amígdala", "cheek": "mejilla", "lip": "labio", "eyelid": "párpado",
    "conjunctiva": "conjuntiva", "sclera": "esclerótica", "iris": "iris", "pupil": "pupila",
    # regiones y accidentes oseos (nombres compuestos tipo "Body of sternum")
    "body": "cuerpo", "head": "cabeza", "neck": "cuello", "shaft": "diáfisis",
    "process": "apófisis", "tubercle": "tubérculo", "tuberosity": "tuberosidad",
    "fossa": "fosa", "foramen": "foramen", "canal": "conducto", "sulcus": "surco",
    "notch": "escotadura", "crest": "cresta", "spine": "espina", "angle": "ángulo",
    "border": "borde", "surface": "superficie", "part": "porción", "region": "región",
    "lobe": "lóbulo", "segment": "segmento", "branch": "rama", "trunk": "tronco",
    "arch": "arco", "sinus": "seno", "ganglion": "ganglio", "plexus": "plexo",
    "cavity": "cavidad", "membrane": "membrana", "capsule": "cápsula", "cortex": "corteza",
    "medulla": "médula", "hilum": "hilio", "apex": "vértice", "fundus": "fondo",
    "isthmus": "istmo", "orifice": "orificio", "septum": "tabique", "tendon sheath": "vaina tendinosa",
    # huesos y musculos frecuentes que faltaban
    "temporal bone": "hueso temporal", "occipital": "occipital", "sphenoid bone": "hueso esfenoides",
    "petrous part": "porción petrosa", "mastoid": "mastoides", "styloid": "estiloides",
    "coronoid": "coronoides", "condyle": "cóndilo", "epicondyle": "epicóndilo",
    "trochanter": "trocánter", "malleolus": "maléolo", "navicular": "navicular",
    "cuboid": "cuboides", "scaphoid": "escafoides", "lunate": "semilunar", "triquetral": "piramidal",
    "pisiform": "pisiforme", "trapezium": "trapecio", "trapezoid": "trapezoide", "capitate": "grande",
    "hamate": "ganchoso", "sesamoid": "sesamoideo", "vertebral body": "cuerpo vertebral",
    "transverse process": "apófisis transversa", "spinous process": "apófisis espinosa",
    "articular process": "apófisis articular", "pedicle": "pedículo", "lamina": "lámina",
    "atlas": "atlas", "axis vertebra": "axis", "odontoid process": "apófisis odontoides",
}

# Modificadores que se reordenan al final en espanol
LATERALIDAD = {"left": "izquierdo", "right": "derecho", "bilateral": "bilateral"}
NIVEL = {"upper": "superior", "lower": "inferior", "superior": "superior", "inferior": "inferior",
         "anterior": "anterior", "posterior": "posterior", "medial": "medial", "lateral": "lateral",
         "superficial": "superficial", "deep": "profundo", "middle": "medio", "central": "central"}

# Terminos que en espanol son femeninos y no siguen la regla de la terminacion
FEMENINOS = {"piel", "nariz", "sangre", "mano", "raíz", "pared", "porción", "región", "cavidad",
             "glándula", "médula", "lámina", "membrana", "corteza", "mucosa", "serosa", "cápsula",
             "vena", "arteria", "válvula", "vértebra", "costilla", "clavícula", "escápula",
             "rótula", "tibia", "falange", "encía", "lengua", "pleura", "aurícula", "aorta",
             "tráquea", "laringe", "faringe", "vejiga", "uretra", "próstata", "mama", "trompa",
             "uña", "pálpebra", "ceja", "mejilla", "mandíbula", "amígdala", "túnica", "fosa"}
MASCULINOS = {"diente", "pie", "hombro", "codo", "tobillo", "muñeca",
              # masculinos que no terminan en -o (la heuristica los tomaria por femeninos)
              "platisma", "diafragma", "psoas", "hioides", "peroné", "esternón", "colon",
              "fórnix", "pubis", "testis", "sacro", "cráneo", "ligamento", "tendón"}


def _genero(termino: str) -> str:
    """Devuelve 'f' o 'm' para concordar el adjetivo en espanol.

    Se mira el SUSTANTIVO (primera palabra) y no la ultima: en "vena pulmonar"
    el genero lo fija "vena", no "pulmonar".
    """
    nucleo = termino.lower().split()[0]
    if nucleo.endswith("as"):
        return "f"                      # arterias, venas, ramas
    if nucleo.endswith("os"):
        return "m"                      # nervios, musculos
    if nucleo in MASCULINOS:
        return "m"
    if nucleo in FEMENINOS or nucleo.endswith(("a", "ión", "ad", "umbre")):
        return "f"
    return "m"


def _es_plural(nucleo: str) -> bool:
    return nucleo.endswith("s") and not nucleo.endswith("is")


_SIN_TILDE = str.maketrans("áéíóúÁÉÍÓÚ", "aeiouAEIOU")


def _plural_palabra(adj: str) -> str:
    """Pluraliza un adjetivo respetando la ortografia del espanol.

    Voca+l -> +s (dorsal -> dorsales por la -l, pero comun -> comunes sin tilde
    porque al pasar a palabra llana la tilde desaparece).
    """
    if adj.endswith(("a", "e", "i", "o", "u")):
        return adj + "s"
    if adj.endswith("z"):
        return adj[:-1] + "ces"
    if any(c in adj for c in "áéíóú") and adj.endswith(("n", "s")):
        # comun -> comunes, joven -> jovenes (la tilde se pierde en el plural)
        return adj.translate(_SIN_TILDE) + "es"
    return adj + "es"


def _concordar(adjetivo: str, genero: str, plural: bool = False) -> str:
    """Concuerda el adjetivo con el sustantivo: izquierdo->izquierda, medio->media,
    primero->primera, profundo->profunda, y en plural -> -os/-as."""
    if plural:
        return _plural_palabra(adjetivo)
    if genero != "f":
        return adjetivo
    if adjetivo in ("primer", "tercer"):
        return adjetivo + "a"          # primer rama -> primera rama
    if adjetivo.endswith("o"):
        return adjetivo[:-1] + "a"     # sexto vertebra -> sexta vertebra
    return adjetivo


def _articulo(femenino: bool, plural: bool) -> str:
    return ("de las" if femenino else "de los") if plural else ("de la" if femenino else "del")


ORDINALES = {"first": "primer", "second": "segundo", "third": "tercer", "fourth": "cuarto",
             "fifth": "quinto", "sixth": "sexto", "seventh": "séptimo", "eighth": "octavo"}

# Adjetivos latinos que en espanol van DESPUES del sustantivo ("flexor longus" ->
# "flexor largo"). Se posponen al nucleo, antes del nivel y la lateralidad.
CALIFICATIVOS = {
    "longus": "largo", "brevis": "corto", "long": "largo", "short": "corto",
    "magnus": "mayor", "major": "mayor", "minor": "menor", "maximus": "mayor",
    "minimus": "menor", "superficialis": "superficial", "profundus": "profundo",
    "profunda": "profunda", "superficial": "superficial", "profundo": "profundo",
    "accessorius": "accesorio", "accessory": "accesorio", "anomalus": "anómalo",
    "proprius": "propio", "proper": "propio", "communis": "común", "common": "común",
    "secundus": "secundario", "tertius": "terciario", "quartus": "cuarto",
    "lateralis": "lateral", "medialis": "medial", "intermedius": "intermedio",
    "posterior": "posterior", "anterior": "anterior", "superior": "superior",
    "inferior": "inferior", "internus": "interno", "externus": "externo",
    "dexter": "derecho", "sinister": "izquierdo", "longissimus": "longísimo",
    "semispinalis": "semiespinoso", "iliocostalis": "iliocostal", "vastus": "vasto",
    "rectus": "recto", "obliquus": "oblicuo", "transversus": "transverso",
    "transverse": "transverso", "oblique": "oblicuo", "teres": "redondo",
    "caudatus": "caudado", "caudate": "caudado", "lumbrical": "lumbrical",
    "lumbricalis": "lumbrical", "cuneiform": "cuneiforme", "arytenoid": "aritenoides",
    "cricoarytenoid": "cricoaritenoideo", "aryepiglottic": "ariepiglótico",
    "vestibular": "vestibular", "cochlear": "coclear", "phrenic": "frénico",
    "splanchnic": "esplácnico", "sciatic": "ciático", "tibial": "tibial",
    "fibular": "fibular", "fibularis": "fibular", "peroneal": "peroneo",
    "popliteal": "poplíteo", "femoral": "femoral", "iliac": "ilíaco",
    "gluteal": "glúteo", "obturator": "obturador", "pudendal": "pudendo",
    "ischiadic": "isquiático", "calcarine": "calcarino", "cingulate": "cingulado",
    "fornix": "fórnix", "hippocampal": "hipocampal", "olfactory": "olfatorio",
    "optic": "óptico", "oculomotor": "oculomotor", "trochlear": "troclear",
    "trigeminal": "trigémino", "abducens": "abducens", "facial": "facial",
    "glossopharyngeal": "glosofaríngeo", "vagus": "vago", "hypoglossal": "hipogloso",
    "accessory nerve": "nervio accesorio", "median": "mediano", "ulnar": "ulnar",
    "radial": "radial", "musculocutaneous": "musculocutáneo", "axillary": "axilar",
    "interosseous": "interóseo", "collateral": "colateral", "recurrent": "recurrente",
    "communicating": "comunicante", "circumflex": "circunflejo", "ascending": "ascendente",
    "descending": "descendente", "transverse colon": "colon transverso",
    "marginal": "marginal", "segmental": "segmentario", "basal": "basal",
    "apical": "apical", "distal": "distal", "proximal": "proximal",
    "interventricular": "interventricular", "interatrial": "interauricular",
    "atrioventricular": "auriculoventricular", "coronary": "coronario",
    "cardiac": "cardíaco", "pulmonary": "pulmonar", "bronchial": "bronquial",
    "bronchopulmonary": "broncopulmonar", "tracheal": "traqueal", "laryngeal": "laríngeo",
    "pharyngeal": "faríngeo", "esophageal": "esofágico", "gastric": "gástrico",
    "duodenal": "duodenal", "jejunal": "yeyunal", "ileal": "ileal", "colic": "cólico",
    "cecal": "cecal", "appendicular": "apendicular", "rectal": "rectal",
    "hepatic": "hepático", "hepatovenous": "hepatovenoso", "biliary": "biliar",
    "cystic": "cístico", "pancreatic": "pancreático", "pancreaticoduodenal": "pancreaticoduodenal",
    "splenic": "esplénico", "renal": "renal", "suprarenal": "suprarrenal",
    "adrenal": "suprarrenal", "ureteric": "ureteral", "vesical": "vesical",
    "urethral": "uretral", "prostatic": "prostático", "uterine": "uterino",
    "ovarian": "ovárico", "tubal": "tubárico", "cervical": "cervical",
    "thoracic": "torácico", "lumbar": "lumbar", "sacral": "sacro", "coccygeal": "coccígeo",
    "vertebral": "vertebral", "costal": "costal", "sternal": "esternal",
    "clavicular": "clavicular", "scapular": "escapular", "acromial": "acromial",
    "humeral": "humeral", "brachial": "braquial", "antebrachial": "antebraquial",
    "carpal": "carpiano", "palmar": "palmar", "digital": "digital",
    "metacarpal": "metacarpiano", "plantar": "plantar", "dorsal": "dorsal",
    "metatarsal": "metatarsiano", "tarsal": "tarsiano", "calcaneal": "calcáneo",
    "malleolar": "maleolar", "genicular": "genicular", "patellar": "rotuliano",
    "meniscal": "meniscal", "cruciate": "cruzado", "sagittal": "sagital",
    "coronal": "coronal", "petrous": "petroso", "mastoid": "mastoideo",
    "styloid": "estiloideo", "zygomatic": "cigomático", "sphenoid": "esfenoideo",
    "ethmoid": "etmoidal", "frontal": "frontal", "parietal": "parietal",
    "temporal": "temporal", "occipital": "occipital", "nasal": "nasal",
    "lacrimal": "lagrimal", "maxillary": "maxilar", "mandibular": "mandibular",
    "palatine": "palatino", "hyoid": "hioideo", "cerebral": "cerebral",
    "cerebellar": "cerebeloso", "callosomarginal": "callosomarginal",
    "choroidal": "coroideo", "ciliary": "ciliar", "lingular": "lingular",
    "mesenteric": "mesentérico", "omental": "omental", "epiploic": "epiploico",
    "peritoneal": "peritoneal", "pleural": "pleural", "pericardial": "pericárdico",
    "mediastinal": "mediastínico", "diaphragmatic": "diafragmático",
    "epigastric": "epigástrico", "hypogastric": "hipogástrico",
    "iliac vein": "vena ilíaca", "lumbar artery": "arteria lumbar",
    "intercostal": "intercostal", "subcostal": "subcostal", "pectoral": "pectoral",
    "pectoralis": "pectoral", "deltoid": "deltoides", "trapezius": "trapecio",
    "serratus": "serrato", "latissimus": "dorsal ancho", "rhomboid": "romboides",
    "supraspinatus": "supraespinoso", "infraspinatus": "infraespinoso",
    "subscapularis": "subescapular", "coracobrachial": "coracobraquial",
    "sternocleidomastoid": "esternocleidomastoideo", "platysma": "platisma",
    "sartorius": "sartorio", "gracilis": "grácil", "adductor": "adductor",
    "abductor": "abductor", "extensor": "extensor", "flexor": "flexor",
    "pronator": "pronador", "supinator": "supinador", "levator": "elevador",
    "depressor": "depresor", "constrictor": "constrictor", "opponens": "oponente",
    "thenar": "tenar", "hypothenar": "hipotenar", "aponeurosis": "aponeurosis",
    "aponeurotic": "aponeurótico", "investing": "de revestimiento",
    "superficial fascia": "fascia superficial", "deep fascia": "fascia profunda",
    "compartment": "compartimento", "subdivision": "subdivisión", "division": "división",
    "wall": "pared", "ring": "anillo", "zone": "zona", "limb": "miembro",
    "organ": "órgano", "system": "sistema", "skeleton": "esqueleto", "free": "libre",
    "tract": "tracto", "hemisphere": "hemisferio", "gyrus": "giro",
    "colliculus": "colículo", "neuraxis": "neuroeje", "tree": "árbol",
    "tributary": "tributaria", "set": "conjunto", "nose": "nariz",
    "little": "pequeño", "index": "índice", "forearm": "antebrazo",
    "arteries": "arterias", "veins": "venas", "disk": "disco",
    "symphysis": "sínfisis", "arterial": "arterial", "venous": "venoso",
    "ventricular": "ventricular", "atrial": "auricular",
}

# Genitivos latinos: la estructura A "de" B ("flexor pollicis" -> "flexor del pulgar")
GENITIVOS = {
    "pollicis": "del pulgar", "hallucis": "del dedo gordo", "digiti": "del dedo",
    "digitorum": "de los dedos", "minimi": "mínimo", "indicis": "del índice",
    "carpi": "del carpo", "brachii": "del brazo", "femoris": "del fémur",
    "tibiae": "de la tibia", "fibulae": "del peroné", "humeri": "del húmero",
    "radii": "del radio", "ulnae": "del cúbito", "scapulae": "de la escápula",
    "claviculae": "de la clavícula", "capitis": "de la cabeza", "cervicis": "del cuello",
    "thoracis": "del tórax", "lumborum": "de la región lumbar", "oris": "de la boca",
    "oculi": "del ojo", "auris": "del oído", "nasi": "de la nariz",
    "pedis": "del pie", "manus": "de la mano", "corporis": "del cuerpo",
    "cordis": "del corazón", "renis": "del riñón", "hepatis": "del hígado",
    "uteri": "del útero", "prostatae": "de la próstata", "testis": "del testículo",
}

CORTESIA = {"of", "the", "and"}

# Sustantivos que deben mandar como nucleo del nombre ("lacrimal NERVE" ->
# "nervio lagrimal", no "lagrimal nervio").
SUSTANTIVOS_NUCLEO = {
    "nerve", "artery", "arteries", "vein", "veins", "muscle", "bone", "ligament",
    "tendon", "cartilage", "joint", "gland", "duct", "node", "plexus", "ganglion",
    "sinus", "branch", "trunk", "lobe", "part", "portion", "segment", "disc", "disk",
    "vertebra", "rib", "root", "ramus", "arteriole", "venule", "capillary", "valve",
    "chamber", "atrium", "ventricle", "peduncle", "fasciculus", "tract", "nucleus",
    "gyrus", "sulcus", "fissure", "foramen", "canal", "process", "tubercle",
    "tuberosity", "fossa", "notch", "crest", "spine", "angle", "border", "surface",
    "membrane", "capsule", "cortex", "medulla", "hippocampus", "amygdala", "insula",
    "putamen", "pons", "chiasm", "commissure", "concha", "sac", "space", "column",
    "layer", "ring", "zone", "limb", "organ", "system", "skeleton", "network",
    "sphincter", "apparatus", "orbit", "conduit", "structure", "epithelium",
    "parenchyma", "perineum", "perineal", "face", "back", "arm", "leg", "chest",
    "nostril", "eye", "ear", "nose", "mouth", "tongue", "tooth", "skin",
    # sustantivos que viven en el diccionario de calificativos pero son nucleo
    "retinaculum", "aponeurosis", "gyrus", "sulcus", "fissure", "habenula",
    "tonsil", "uvula", "epiglottis", "larynx", "pharynx", "bronchus", "trachea",
    "lung", "heart", "liver", "kidney", "stomach", "spleen", "pancreas",
    "intestine", "colon", "rectum", "bladder", "prostate", "uterus", "ovary",
    "thyroid", "thymus", "breast", "testis", "scrotum", "penis", "clitoris",
    "mesentery", "omentum", "peritoneum", "pleura", "pericardium", "diaphragm",
    "esophagus", "duodenum", "jejunum", "ileum", "cecum", "appendix",
    "stria", "tarsal", "eyelid", "cornea", "retina", "sclera", "iris", "lens",
    "conjunctiva", "eyeball", "molar", "premolar", "incisor", "canine", "tooth",
}

# Terminos de accion muscular: cuando no hay sustantivo, estos son el nucleo
# ("flexor pollicis brevis" -> "flexor corto del pulgar").
NUCLEOS_ACCION = {"flexor", "extensor", "adductor", "abductor", "pronator", "supinator",
                  "levator", "depressor", "constrictor", "opponens", "tensor", "rotator",
                  "sphincter", "digastric", "sartorius", "gracilis", "coracobrachialis",
                  "brachioradialis", "genioglossus", "hyoglossus",
                  # nombres musculares latinos que son el nucleo del rotulo
                  "vastus", "obliquus", "rectus", "transversus", "gluteus", "tibialis",
                  "peroneus", "fibularis", "latissimus", "longissimus", "semitendinosus",
                  "semimembranosus", "iliacus", "psoas", "gemellus", "obturator",
                  "piriformis", "plantaris", "popliteus", "soleus", "gastrocnemius",
                  "temporalis", "masseter", "scalenus", "erector", "spinalis", "longus",
                  "teres", "anconeus", "deltoideus", "trapezius", "sternocleidomastoid",
                  "brachialis", "palmaris", "lumbricals", "interossei", "multifidus",
                  "arytenoid", "cricothyroid", "thyrohyoid", "stylohyoid", "geniohyoid"}

# Accion muscular que manda sobre el resto de calificativos.
ACCION_PRIMARIA = {"flexor", "extensor", "adductor", "abductor", "pronator", "supinator",
                   "levator", "depressor", "constrictor", "opponens", "tensor"}

# Palabras de posicion: nunca son el nucleo del nombre (en "obliquus capitis
# superior" el nucleo es "obliquus", no "superior").
NO_NUCLEO = {"superior", "inferior", "anterior", "posterior", "medial", "lateral",
             "medio", "media", "media1", "superficial", "profundo", "profunda",
             "proximal", "distal", "superior1", "derecho", "izquierdo", "medio1"}

# Tercer bloque: cabeza/cuello, sistema nervioso, digestivo y terminos generales
CALIFICATIVOS.update({
    "palmaris": "palmar", "lumbricals": "lumbricales", "geniohyoid": "geniohioideo",
    "mylohyoid": "milohioideo", "omohyoid": "omohioideo", "sternohyoid": "esternohioideo",
    "sternothyroid": "esternotiroideo", "precuneal": "precuneal",
    "thalamogeniculate": "talamogeniculado", "intermediomedial": "intermediomedial",
    "polar": "polar", "thalamoperforating": "talamoperforante",
    "precommunicating": "precomunicante", "vermian": "vermiano", "temporo": "temporo",
    "insula": "ínsula", "amygdala": "amígdala", "globus": "globo", "pallidus": "pálido",
    "hippocampus": "hipocampo", "putamen": "putamen", "medullaris": "medular",
    "fusiform": "fusiforme", "parahippocampal": "parahipocampal",
    "supramarginal": "supramarginal", "arcuate": "arqueado", "cephalic": "cefálico",
    "network": "red", "cubital": "cubital", "alar": "alar", "genioglossus": "geniogloso",
    "hyoglossus": "hiogloso", "palatopharyngeus": "palatofaríngeo",
    "pterygomandibular": "pterigomandibular", "salpingopharyngeus": "salpingofaríngeo",
    "stylopharyngeus": "estilofaríngeo", "sublingual": "sublingual",
    "submandibular": "submandibular", "aryepiglotticus": "ariepiglótico",
    "corniculate": "corniculado", "elasticus": "elástico", "straight": "recto",
    "vocalis": "vocal", "deferent": "deferente", "concha": "concha",
    "iliolumbar": "iliolumbar", "space": "espacio", "large": "grande",
    "column": "columna", "skeletal": "esquelético", "arm": "brazo", "entity": "entidad",
    "fibrous": "fibroso", "sphincter": "esfínter", "basilar": "basilar",
    "peduncle": "pedúnculo", "hemiazygos": "hemiácigos", "epiglottic": "epiglótico",
    "mediobasal": "mediobasal", "subsuperior": "subsuperior", "laterobasal": "laterobasal",
    "gastroduodenal": "gastroduodenal", "gastro": "gastro",
    "gastroepiploic": "gastroepiploico", "sigmoid": "sigmoideo", "cranial": "craneal",
    "in": "en", "vivo": "vivo", "postvertebral": "postvertebral", "extrinsic": "extrínseco",
    "cardinal": "cardinal", "diencephalon": "diencéfalo", "outflow": "salida",
    "inflow": "entrada", "perineal": "perineal", "innermost": "más interno",
    "vertical": "vertical", "interpeduncular": "interpeduncular", "mammillary": "mamilar",
    "oblongata": "oblongada", "chiasm": "quiasma", "pons": "puente",
    "tuber": "tubérculo", "cinereum": "cinéreo", "junction": "unión",
    "parenchyma": "parénquima", "pre": "pre", "spongiosum": "esponjoso",
    "azygos": "ácigos", "variant": "variante", "parasympathetic": "parasimpático",
    "tracheobronchial": "traqueobronquial", "face": "cara", "lobular": "lobulillar",
    "apicoposterior": "apicoposterior", "cage": "caja", "back": "espalda",
    "gastrointestinal": "gastrointestinal", "cartilaginous": "cartilaginoso",
    "osseous": "óseo", "vertebrae": "vértebras", "myocardial": "miocárdico",
    "linea": "línea", "alba": "blanca", "aqueduct": "acueducto", "habenula": "habénula",
    "pineal": "pineal", "tentorium": "tentorio", "cerebelli": "del cerebelo",
    "libera": "libre", "mesocolica": "mesocólica", "omentalis": "omental",
    "ileocecal": "ileocecal", "uvular": "uvular", "eyebrow": "ceja", "pubic": "púbico",
    "cavernosum": "cavernoso", "glans": "glande", "mesoappendix": "mesoapéndice",
    "mesocolon": "mesocolon", "caudal": "caudal", "oesophageal": "esofágico",
    "autonomic": "autónomo", "irregular": "irregular", "salivary": "salival",
    "portion": "porción", "neural": "neural", "cavernous": "cavernoso",
    "visceral": "visceral", "suboccipital": "suboccipital", "cavitated": "cavitado",
    "parts": "partes", "hindbrain": "rombencéfalo", "tectum": "techo",
    "heterogeneous": "heterogéneo", "dorsum": "dorso", "metencephalon": "metencéfalo",
    "hairs": "pelos", "caval": "caval", "cell": "célula", "subarachnoid": "subaracnoideo",
    "axial": "axial", "perineum": "periné", "hemiliver": "hemihígado", "orbit": "órbita",
    "apparatus": "aparato", "inferomedial": "inferomedial", "limbic": "límbico",
    "subendocardial": "subendocárdico", "pulmopleural": "pulmopleural",
    "subcortex": "subcorteza", "archicortex": "arquicorteza", "formation": "formación",
    "flat": "plano", "pneumatized": "neumatizado", "true": "verdadero",
    "typical": "típico", "false": "falso", "floating": "flotante", "atypical": "atípico",
    "conduit": "conducto", "decussation": "decusación", "line": "línea",
    "continuity": "continuidad", "infrahyoid": "infrahioideo", "extrahepatic": "extrahepático",
    "coeliac": "celíaco", "coli": "del colon", "subsector": "subsector", "loose": "laxo",
    "mucoid": "mucoide", "nonskeletal": "no esquelético", "prevertebral": "prevertebral",
    "suprahyoid": "suprahioideo", "extra": "extra", "ocular": "ocular",
    "boundary": "límite", "laryngopharynx": "laringofaringe",
    "parenchymatous": "parenquimatoso", "corticomedullary": "corticomedular",
    "nonparenchymatous": "no parenquimatoso", "solid": "sólido", "hollow": "hueco",
    "auriculotemporal": "auriculotemporal", "physical": "físico", "serous": "seroso",
    "scalene": "escaleno", "subdivisionof": "subdivisión de", "immaterial": "inmaterial",
    "structure": "estructura", "material": "material", "epithelium": "epitelio",
    "leaf": "hoja", "epidermis": "epidermis", "organs": "órganos",
    "appendage": "apéndice", "intracranial": "intracraneal", "supreme": "supremo",
    "regions": "regiones", "clusters": "grupos", "membranous": "membranoso",
    "incisure": "incisura", "nuclear": "nuclear", "complex": "complejo",
    "circumventricular": "circunventricular", "alimentary": "alimentario",
    "genital": "genital", "cardiovascular": "cardiovascular",
    "musculoskeletal": "musculoesquelético", "subaortic": "subaórtico",
    "curtain": "cortina", "mons": "monte", "human": "humano",
    "basicranium": "basicráneo", "neurocranium": "neurocráneo",
    "viscerocranium": "viscerocráneo", "soft": "blando", "root": "raíz",
    "faucial": "faucial", "epithalamus": "epitálamo", "intrahepatic": "intrahepático",
    "antero": "antero", "integument": "tegumento", "fascial": "fascial",
    "vasculature": "vascularización", "pancreaticobiliary": "pancreaticobiliar",
    "basicranial": "basicraneal", "lata": "lata", "dorsalis": "dorsal",
    "ii": "II", "iii": "III", "iv": "IV", "v": "V", "vi": "VI", "vii": "VII",
    "viii": "VIII", "ix": "IX", "x": "X", "xi": "XI", "xii": "XII",
    "posterior cerebral artery": "arteria cerebral posterior",
    "middle cerebral artery": "arteria cerebral media",
    "anterior cerebral artery": "arteria cerebral anterior",
    "middle meningeal artery": "arteria meníngea media",
    "maxillary artery": "arteria maxilar", "facial artery": "arteria facial",
    "temporal bone": "hueso temporal", "frontal sinus": "seno frontal",
    "sphenoid sinus": "seno esfenoidal", "maxillary sinus": "seno maxilar",
    "ethmoid sinus": "seno etmoidal", "frontal lobe": "lóbulo frontal",
    "parietal lobe": "lóbulo parietal", "temporal lobe": "lóbulo temporal",
    "occipital lobe": "lóbulo occipital", "insula lobe": "ínsula",
    "temporal lobe": "lóbulo temporal", "limbic lobe": "lóbulo límbico",
    # cavidad oral y piezas dentales (serie primaria y secundaria)
    "secondary": "secundario", "primary": "primario", "deciduous": "deciduo",
    "permanent": "permanente", "molar": "molar", "premolar": "premolar",
    "incisor": "incisivo", "canine": "canino", "dentine": "dentina",
    "enamel": "esmalte", "pulp": "pulpa", "crown": "corona", "cementum": "cemento",
    "periodontal": "periodontal", "gingiva": "encia", "alveolar": "alveolar",
    "cheek": "mejilla", "lip": "labio", "palate": "paladar", "uvula": "úvula",
    "frenulum": "frenillo", "oral": "oral", "buccal": "bucal",
    "pharyngeal": "faríngeo", "nasal": "nasal", "septum": "tabique",
    "vestibule": "vestíbulo", "commissure": "comisura", "fundus": "fondo",
    "pylorus": "píloro", "cardia": "cardias", "antrum": "antro", "cecum": "ciego",
    # ojo y anexos (la serie que quedo pendiente)
    "nasociliary": "nasociliar", "tarsal": "tarsal", "eyelid": "párpado",
    "supraorbital": "supraorbitario", "supra-orbital": "supraorbitario",
    "infraorbital": "infraorbitario", "infra-orbital": "infraorbitario",
    "ciliary": "ciliar", "conjunctiva": "conjuntiva",
    "conjunctival": "conjuntival", "eyeball": "globo ocular", "cornea": "córnea",
    "choroid": "coroides", "retina": "retina", "sclera": "esclerótica",
    "lens": "cristalino", "palpebral": "palpebral", "stria": "estría",
    "vitreous": "vítreo", "canaliculus": "canalículo", "lacrimal lake": "lago lagrimal",
    "levator palpebrae superioris": "elevador del párpado superior",
    "superioris": "superior", "palpebrae": "del párpado",
    # musculos latinos: cada termino de NUCLEOS_ACCION debe tener traduccion
    "external": "externo", "internal": "interno", "innermost": "más interno",
    "outermost": "más externo", "deep": "profundo", "superficial": "superficial",
    "inferior": "inferior", "superior": "superior",
    "medius": "medio", "maximus": "mayor", "minimus": "mínimo", "longus": "largo",
    "brevis": "corto", "tibialis": "tibial", "peroneus": "peroneo",
    "fibularis": "fibular", "latissimus": "latísimo", "longissimus": "longísimo",
    "semitendinosus": "semitendinoso", "semimembranosus": "semimembranoso",
    "iliacus": "ilíaco", "gemellus": "gemelo", "obturator": "obturador",
    "piriformis": "piriforme", "popliteus": "poplíteo", "soleus": "sóleo",
    "gastrocnemius": "gastrocnemio", "masseter": "masetero", "erector": "erector",
    "multifidus": "multífido", "arytenoid": "aritenoides", "rectus": "recto",
    "obliquus": "oblicuo", "transversus": "transverso", "vastus": "vasto",
    "teres": "redondo", "deltoideus": "deltoides", "trapezius": "trapecio",
    "anconeus": "ancóneo", "temporalis": "temporal", "gluteus": "glúteo",
})

# Segundo bloque: musculos, vasos, nervios y accidentes (tramo 120-320 de frecuencia)
CALIFICATIVOS.update({
    "pronator": "pronador", "scalenus": "escaleno", "cusp": "cúspide", "papillary": "papilar",
    "septal": "septal", "anatomical": "anatómico", "subsegmental": "subsegmentario",
    "girdle": "cintura", "orbital": "orbitario", "rotator": "rotador", "precentral": "precentral",
    "perforating": "perforante", "cricothyroid": "cricotiroideo", "layer": "capa",
    "chest": "tórax", "leg": "pierna", "intermediate": "intermedio", "pontine": "protuberancial",
    "matter": "sustancia", "small": "pequeño", "big": "grande", "abdominal": "abdominal",
    "frontobasal": "frontobasal", "ileocolic": "ileocólico", "leaflet": "valva",
    "lobar": "lobar", "side": "lado", "ophthalmic": "oftálmico", "plate": "lámina",
    "gemellus": "gemelo", "splenius": "esplenio", "pericallosal": "pericalloso",
    "brachium": "brazo", "stria": "estría", "diagonal": "diagonal", "conus": "cono",
    "component": "componente", "systemic": "sistémico", "content": "contenido",
    "ethmoidal": "etmoidal", "check": "de retención", "choroid": "coroides",
    "tendinous": "tendinoso", "quadratus": "cuadrado", "tensor": "tensor",
    "levatores": "elevadores", "costarum": "de las costillas", "interossei": "interóseos",
    "colli": "del cuello", "stylohyoid": "estilohioideo", "postcentral": "postcentral",
    "to": "a", "angular": "angular", "posteromedial": "posteromedial",
    "geniculate": "geniculado", "musculophrenic": "musculofrénico", "great": "mayor",
    "suprascapular": "supraescapular", "thoracodorsal": "toracodorsal", "veli": "del velo",
    "palatini": "palatinos", "crico": "crico", "tenth": "décimo", "eleventh": "undécimo",
    "ninth": "noveno", "intestine": "intestino", "testicular": "testicular",
    "myocardium": "miocardio", "chamber": "cámara", "anterolateral": "anterolateral",
    "paracentral": "paracentral", "forebrain": "prosencéfalo", "white": "blanco",
    "midbrain": "mesencéfalo", "thyro": "tiro", "palpebrae": "del párpado",
    "superioris": "superior", "spinalis": "espinal", "intertransversarius": "intertransverso",
    "digastric": "digástrico", "branches": "ramas", "commissure": "comisura",
    "costocervical": "costocervical", "thyrocervical": "tirocervical", "tricuspid": "tricúspide",
    "aortic": "aórtico", "brachiocephalic": "braquiocefálico", "with": "con",
    "insular": "insular", "splenial": "esplenial", "terminal": "terminal",
    "prefrontal": "prefrontal", "terminalis": "terminal", "telencephalon": "telencéfalo",
    "princeps": "principal", "mitral": "mitral", "taenia": "tenia", "raphe": "rafe",
    "twelfth": "duodécimo", "vascular": "vascular", "sector": "sector",
    "intrapulmonary": "intrapulmonar", "intrinsic": "intrínseco", "musculature": "musculatura",
    "sac": "saco", "coccygeus": "coccígeo", "iliococcygeus": "iliococcígeo",
    "pubococcygeus": "pubococcígeo", "puborectalis": "puborrectal", "ani": "del ano",
    "retinaculum": "retináculo", "intertransversarii": "intertransversos",
    "interspinales": "interespinosos", "interspinalis": "interespinoso",
    "hypothalamic": "hipotalámico", "postcommunicating": "postcomunicante", "lobule": "lobulillo",
    "celiac": "celíaco", "basilic": "basílica", "main": "principal", "hair": "pelo",
    "urinary": "urinario", "anastomosis": "anastomosis", "thorax": "tórax",
    "pelvis": "pelvis", "pelvic": "pélvico", "cluster": "grupo", "mouth": "boca",
    "bony": "óseo", "corona": "corona", "ciliaris": "ciliar", "infratrochlear": "infratroclear",
    "canaliculus": "canalículo", "lake": "lago", "nasolacrimal": "nasolagrimal",
    "suspensory": "suspensorio", "supra": "supra", "supratrochlear": "supratroclear",
    "trochlea": "tróclea", "vitreous": "vítreo", "tertius": "tercero", "iliacus": "ilíaco",
    "iliotibial": "iliotibial", "pectineus": "pectíneo", "piriformis": "piriforme",
    "plantaris": "plantar", "popliteus": "poplíteo", "psoas": "psoas",
    "semimembranosus": "semimembranoso", "semitendinosus": "semitendinoso",
    "fasciae": "de la fascia", "latae": "lata", "subclavius": "subclavio",
    "breves": "cortos", "longi": "largos", "sternocostal": "esternocostal",
    "anconeus": "ancóneo", "brachioradialis": "braquiorradial",
    "coracobrachialis": "coracobraquial", "levator palpebrae": "elevador del párpado",
    "platisma": "platisma", "platysma": "platisma", "aponeurosis": "aponeurosis",
    "eyeball": "globo ocular", "gland": "glándula", "duct": "conducto",
    "chamber of": "cámara del", "ciliary ganglion": "ganglio ciliar",
    "lacrimal": "lagrimal", "orbital part": "porción orbitaria",
    "cerebral hemisphere": "hemisferio cerebral", "white matter": "sustancia blanca",
    "gray matter": "sustancia gris", "spinal cord": "médula espinal",
    "small intestine": "intestino delgado", "large intestine": "intestino grueso",
    "urinary bladder": "vejiga urinaria", "abdominal aorta": "aorta abdominal",
    "vena cava": "vena cava", "thoracic aorta": "aorta torácica",
    "pulmonary trunk": "tronco pulmonar", "bile duct": "conducto biliar",
    "nasolacrimal duct": "conducto nasolagrimal", "lacrimal gland": "glándula lagrimal",
    "lacrimal sac": "saco lagrimal", "vitreous body": "cuerpo vítreo",
})
MODIFICADORES = {"secondary": "secundario", "primary": "primario", "permanent": "permanente",
                 "deciduous": "temporal", "accessory": "accesorio", "minor": "menor",
                 "major": "mayor", "dorsal": "dorsal", "ventral": "ventral",
                 "external": "externo", "internal": "interno", "lateral": "lateral"}

# Frases compuestas frecuentes que se resuelven de una vez (mayor calidad)
FRASES = {
    "left": "izquierdo", "right": "derecho",
    "molar tooth": "molar", "premolar tooth": "premolar", "incisor tooth": "incisivo",
    "canine tooth": "canino", "wisdom tooth": "muela del juicio",
}


def traducir_estructura(nombre: str) -> str | None:
    """Traduce un nombre anatomico. Devuelve None si no hay confianza suficiente."""
    original = nombre.strip()
    if not original:
        return None
    texto = original.lower().rstrip(".")
    # Los nombres muy largos o con conectores oracionales ("to", "for") no se
    # traducen: el armado pierde precision y es mejor mostrar el original.
    if " to " in texto or " for " in texto or len(texto.split()) > 8:
        return None

    # 1) Coincidencia exacta con el glosario
    if texto in GLOSARIO:
        t = GLOSARIO[texto]
        return t[0].upper() + t[1:]

    # 2) Frase compuesta: "x of y" -> "x del y"
    if " of " in texto:
        izq, der = texto.split(" of ", 1)
        a, b = traducir_estructura(izq), traducir_estructura(der)
        if a and b:
            nucleo_b = b.split()[0].lower()
            enlace = _articulo(_genero(b) == "f", _es_plural(nucleo_b))
            return f"{a.capitalize()} {enlace} {b[0].lower() + b[1:]}"
        return None

    # 3) Estructura + modificadores: se busca la estructura mas larga del glosario
    def armar(dic_nucleo: dict[str, str], preferir: set[str] | None = None) -> str | None:
        cands = [t for t in dic_nucleo if t in texto]
        # las frases compuestas ("bronchial tree") mandan sobre la palabra suelta
        frases = [t for t in cands if " " in t]
        if frases:
            cands = frases
        # las palabras de posicion (superior, medial...) nunca son nucleo
        fuertes = [t for t in cands if t not in NO_NUCLEO]
        if fuertes:
            cands = fuertes
        if preferir:
            primarios = [t for t in cands if t in ACCION_PRIMARIA]
            if primarios:
                cands = primarios
            else:
                pref = [t for t in cands if t in preferir]
                if pref:
                    cands = pref
        encontrado = max(cands, key=len, default=None)
        if not encontrado:
            return None
        nucleo = dic_nucleo[encontrado]
        resto = texto.replace(encontrado, " ", 1).split()

        ordinal = next((ORDINALES[t] for t in resto if t in ORDINALES), None)
        califs = [CALIFICATIVOS[t] for t in resto if t in CALIFICATIVOS]
        genits = [GENITIVOS[t] for t in resto if t in GENITIVOS]
        mods = [MODIFICADORES[t] for t in resto
                if t in MODIFICADORES and t not in NIVEL and t not in CALIFICATIVOS]
        niveles = [NIVEL[t] for t in resto if t in NIVEL and t not in CALIFICATIVOS]
        lados = [LATERALIDAD[t] for t in resto if t in LATERALIDAD]

        conocidos = (set(ORDINALES) | set(CALIFICATIVOS) | set(GENITIVOS) | set(MODIFICADORES)
                     | set(NIVEL) | set(LATERALIDAD) | CORTESIA)
        if [t for t in resto if t not in conocidos]:
            return None

        genero = _genero(nucleo)
        plural = _es_plural(nucleo.lower())
        partes: list[str] = []
        if ordinal:
            partes.append(_concordar(ordinal, genero, plural))
        partes.append(nucleo)                                        # nucleo
        partes.extend(dict.fromkeys(_concordar(c, genero, plural) for c in califs))
        partes.extend(dict.fromkeys(_concordar(m, genero, plural) for m in mods))
        partes.extend(dict.fromkeys(_concordar(n, genero, plural) for n in niveles))
        partes.extend(dict.fromkeys(genits))                         # "del pulgar"
        partes.extend(dict.fromkeys(_concordar(l, genero, plural) for l in lados))
        salida = " ".join(partes)
        return salida[0].upper() + salida[1:]

    # Primero con sustantivos conocidos (y dentro de ellos, los que son nucleo
    # anatomico: nervio, arteria, vena...); si no hay, el termino de accion
    # muscular (flexor, extensor...) hace de nucleo.
    return (armar(GLOSARIO, preferir=SUSTANTIVOS_NUCLEO)
            or armar(CALIFICATIVOS, preferir=SUSTANTIVOS_NUCLEO | NUCLEOS_ACCION))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--muestra", type=int, default=0, help="imprime N ejemplos")
    args = ap.parse_args()

    data = json.loads(ATLAS.read_text(encoding="utf-8"))
    partes = data["parts"]

    candidatos: dict[str, tuple[str, str]] = {}
    sin_traducir: list[str] = []
    for p in partes:
        nombre = p.get("name") or ""
        if p.get("system") == "integumentary" and nombre.lower().startswith("skin"):
            candidatos[p["id"]] = ("Piel", nombre)
            continue
        t = traducir_estructura(nombre)
        if t:
            candidatos[p["id"]] = (t, nombre)
        else:
            sin_traducir.append(nombre)

    # Colisiones: dos estructuras distintas con el mismo nombre en espanol son un
    # error visible; se descartan y quedan en ingles (el visor cae al original).
    por_espanol: dict[str, list[tuple[str, str]]] = {}
    for pid, (t, en) in candidatos.items():
        por_espanol.setdefault(t, []).append((pid, en))
    ambiguos = {t: v for t, v in por_espanol.items() if len({en for _, en in v}) > 1}
    for t, v in ambiguos.items():
        for pid, en in v:
            candidatos.pop(pid, None)
            sin_traducir.append(f"{en}  [ambiguo: {t}]")

    salida = {pid: t for pid, (t, _en) in candidatos.items()}

    SALIDA.write_text(json.dumps(dict(sorted(salida.items())), ensure_ascii=False, indent=1) + "\n",
                      encoding="utf-8")

    total = len(partes)
    print(f"escrito {SALIDA.relative_to(BASE)}")
    print(f"traducidas {len(salida)} de {total} piezas ({len(salida)/total*100:.1f}%)")
    print(f"sin traducir (quedan en ingles): {len(sin_traducir)}")
    print(f"descartadas por ambiguedad: {sum(len(v) for v in ambiguos.values())}")
    if args.muestra:
        print("\n--- ejemplos ---")
        for k, v in list(salida.items())[: args.muestra]:
            ing = next(p["name"] for p in partes if p["id"] == k)
            print(f"  {ing:52s} -> {v}")
        print("\n--- sin traducir (muestra) ---")
        for n in sin_traducir[: args.muestra]:
            print(f"  {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
