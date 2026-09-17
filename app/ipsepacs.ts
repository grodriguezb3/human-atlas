/**
 * ipsepacs.ts — Puente entre el visor anatomico y los datos de IPSE PACS.
 *
 * Carga el mapeo estructuras -> regiones anatomicas de la institucion y
 * consulta el endpoint Aj_Atlas3D.php (solo Superadmin) para obtener la
 * estadistica real, la demografia (sexo y edad) y los estudios.
 */

export interface ItemModalidad {
  modalidad: string;
  n: number;
  pct: number;
}

export interface ItemGrupoEdad {
  etiqueta: string;
  n: number;
  pct: number;
}

export interface ItemAnio {
  anio: number;
  n: number;
  pct: number;
}

export interface DemografiaSexo {
  Femenino: number;
  Masculino: number;
  Otro?: number;
  'Sin dato'?: number;
}

export interface DemografiaEdad {
  promedio: number | null;
  mediana: number | null;
  minima: number | null;
  maxima: number | null;
  conDato: number;
  grupos: ItemGrupoEdad[];
}

export interface RegionStats {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
  n: number;
  eco: number;
  rx: number;
  modalidades: ItemModalidad[];
  sexo: DemografiaSexo;
  edadPromedio: number | null;
}

export interface EstudioClinico {
  modalidad: string | null;
  modalidad_nombre?: string | null;
  descripcion: string | null;
  sexo?: string | null;
  edad?: number | null;
  fecha: string | null;
  study_uid: string | null;
  id_study: number | string | null;
}

/** Filtros del atlas. El atlas es ANONIMO por diseno: nunca se piden ni se
 *  muestran datos del paciente (nombre, cedula); solo fecha, edad, sexo,
 *  modalidad y descripcion. */
export interface FiltrosAtlas {
  sexo: '' | 'F' | 'M';
  edadMin: number;
  edadMax: number;
  modalidad: string;
}

export const EDAD_TOPE = 120;

export const FILTROS_VACIOS: FiltrosAtlas = { sexo: '', edadMin: 0, edadMax: EDAD_TOPE, modalidad: '' };

/** Solo se envian los filtros que el usuario realmente acoto. */
function aplicarFiltros(cuerpo: URLSearchParams, f: FiltrosAtlas): URLSearchParams {
  if (f.sexo) cuerpo.set('sexo', f.sexo);
  if (f.edadMin > 0) cuerpo.set('edad_min', String(f.edadMin));
  if (f.edadMax < EDAD_TOPE) cuerpo.set('edad_max', String(f.edadMax));
  if (f.modalidad) cuerpo.set('modalidad', f.modalidad);
  return cuerpo;
}

/** Clave de cache: los filtros forman parte de ella, si no la pantalla no
 *  refrescaria al mover el rango de edad. */
export function claveFiltros(f: FiltrosAtlas): string {
  return `${f.sexo}|${f.edadMin}-${f.edadMax}|${f.modalidad}`;
}

export interface RespuestaEstructura {
  estructura: string;
  region: string;
  slug: string;
  total: number;
  eco: number;
  rayosX: number;
  modalidades: ItemModalidad[];
  sexo: DemografiaSexo;
  edad: DemografiaEdad;
  anios: ItemAnio[];
  estudios: EstudioClinico[];
}

export interface KpisInstitucion {
  estudios: number;
  pacientes: number;
  regiones: number;
  modalidades: ItemModalidad[];
  sexo: DemografiaSexo;
  edad: DemografiaEdad;
  anios: ItemAnio[];
}

interface Mapeo {
  fuente: string;
  resumen: Record<string, { partes: number; conceptos: number }>;
  parteARegiones: Record<string, string[]>;
  conceptoARegiones: Record<string, string[]>;
}

/* Etiquetas en espanol para nuestras regiones (el visor viene en ingles,
   lo nuestro va en espanol). */
export const REGION_ES: Record<string, string> = {
  craneo: 'Cráneo',
  tiroides: 'Tiroides',
  mama: 'Mama',
  torax: 'Tórax',
  columna: 'Columna',
  pelvis: 'Pelvis',
  prostata: 'Próstata',
  'testiculos-escroto': 'Testículos / Escroto',
  'arbol-urinario': 'Árbol urinario',
  abdomen: 'Abdomen',
  'extremidades-inferiores': 'Extremidades inferiores',
  'extremidades-superiores': 'Extremidades superiores',
  'vascular-doppler': 'Vascular / Doppler',
  'partes-blandas': 'Partes blandas',
  obstetrico: 'Obstétrico',
};

/** Regiones que no existen en el modelo masculino: se avisa en la interfaz. */
export const REGION_SIN_MODELO = ['obstetrico', 'mama', 'prostata', 'tiroides'];

/** Color institucional por modalidad (para las barras del panel). */
export const COLOR_MODALIDAD: Record<string, string> = {
  'Ecografía': '#0046ad',
  'Rayos X': '#5b7fb7',
  'Tomografía': '#7c5cbf',
  'Resonancia': '#0f8a8a',
  'Mamografía': '#b5527f',
  'Medicina nuclear': '#c98a1b',
  'PET': '#c9601b',
  'Informe estructurado': '#8a97ab',
};

const API = (import.meta as unknown as { env: Record<string, string> })
  .env?.VITE_IPSEPACS_API ?? 'http://localhost:8081';

/* Ruta base del visor: permite publicarlo en una subcarpeta del PACS
   (p. ej. https://pacs.ipse.com.ec/atlas/) sin romper el desarrollo local. */
export const RUTA_BASE = (import.meta as unknown as { env: Record<string, string> })
  .env?.BASE_URL ?? '/';

/** El catalogo del modelo trae rutas absolutas (/models/body-0.bin). Publicado
 *  en una subcarpeta hay que devolverlas ahi o el navegador las pide en la raiz
 *  del dominio y responde 404 ("no se pudo cargar un archivo de anatomia"). */
export function conRutaBase<T extends { chunks?: { url?: string; gzip?: string }[] }>(atlas: T): T {
  const base = RUTA_BASE.replace(/\/$/, '');
  if (!base) return atlas;                       // desde la raiz: nada que ajustar
  const ajustar = (u?: string) => (u && u.startsWith('/') ? base + u : u);
  return {
    ...atlas,
    chunks: (atlas.chunks ?? []).map(c => ({ ...c, url: ajustar(c.url) as string, gzip: ajustar(c.gzip) })),
  } as T;
}

let mapeoCache: Mapeo | null = null;
const cacheRegiones = new Map<string, RegionStats[]>();
let statsPorRegion = new Map<string, RegionStats>();
const cacheEstructura = new Map<string, RespuestaEstructura>();

export async function cargarMapeo(): Promise<Mapeo> {
  if (mapeoCache) return mapeoCache;
  const r = await fetch(`${RUTA_BASE}ipsepacs-mapeo.json`);
  if (!r.ok) throw new Error('No se pudo cargar el mapeo de regiones.');
  mapeoCache = (await r.json()) as Mapeo;
  return mapeoCache;
}

/** Regiones de IPSE PACS a las que pertenece una estructura del atlas. */
export async function regionesDeEstructura(
  conceptId: string | undefined,
  parteIds: string[] = [],
): Promise<string[]> {
  const m = await cargarMapeo();
  const c = conceptId ? m.conceptoARegiones[conceptId] : undefined;
  if (c && c.length) return c;
  for (const p of parteIds) {
    const regs = m.parteARegiones[p];
    if (regs && regs.length) return regs;
  }
  return [];
}

/** Respuesta cruda del endpoint. */
interface Crudo<T> { success?: boolean; error?: string; data?: T }

/** Normaliza los numeros que la API puede devolver como texto. */
const num = (v: unknown) => Number(v ?? 0) || 0;

function normalizarDemografia<T extends {sexo?: DemografiaSexo; edad?: DemografiaEdad; edadPromedio?: unknown}>(x: T): T {
  if (x.sexo) {
    x.sexo = {
      Femenino: num(x.sexo.Femenino),
      Masculino: num(x.sexo.Masculino),
      Otro: num(x.sexo.Otro),
      'Sin dato': num(x.sexo['Sin dato']),
    };
  }
  if (x.edad) {
    x.edad = {
      ...x.edad,
      promedio: x.edad.promedio === null ? null : Number(x.edad.promedio),
      mediana: x.edad.mediana === null ? null : Number(x.edad.mediana),
      conDato: num(x.edad.conDato),
      grupos: (x.edad.grupos ?? []).map(g => ({ etiqueta: g.etiqueta, n: num(g.n), pct: num(g.pct) })),
    };
  }
  if (typeof x.edadPromedio === 'string') x.edadPromedio = Number(x.edadPromedio);
  return x;
}

/** Estadistica por region, con los filtros activos (se cachea por filtro). */
export async function cargarRegiones(filtros: FiltrosAtlas = FILTROS_VACIOS): Promise<RegionStats[]> {
  const clave = claveFiltros(filtros);
  const guardado = cacheRegiones.get(clave);
  if (guardado) return guardado;
  const cuerpo = aplicarFiltros(new URLSearchParams({ Requerimiento: 'Regiones' }), filtros);
  const r = await fetch(`${API}/Ajax/Aj_Atlas3D.php`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo.toString(),
  });
  const j = (await r.json()) as Crudo<RegionStats[]>;
  if (!j.success || !j.data) throw new Error(j.error ?? 'No se pudo obtener la estadística.');
  const datos = j.data.map(x => normalizarDemografia({
    ...x,
    n: num(x.n),
    eco: num(x.eco),
    rx: num(x.rx),
    modalidades: (x.modalidades ?? []).map(m => ({ modalidad: m.modalidad, n: num(m.n), pct: num(m.pct) })),
  }));
  cacheRegiones.set(clave, datos);
  /* El mapa de consulta se reemplaza completo: si se acumulara, una region que
     no cumple el filtro seguiria mostrando las cifras del filtro anterior. */
  statsPorRegion = new Map(datos.map(x => [x.slug, x]));
  return datos;
}

export function statsDeRegion(slug: string): RegionStats | undefined {
  return statsPorRegion.get(slug);
}

export async function cargarKpis(filtros: FiltrosAtlas = FILTROS_VACIOS): Promise<KpisInstitucion> {
  const cuerpo = aplicarFiltros(new URLSearchParams({ Requerimiento: 'KPIs' }), filtros);
  const r = await fetch(`${API}/Ajax/Aj_Atlas3D.php`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo.toString(),
  });
  const j = (await r.json()) as Crudo<KpisInstitucion>;
  if (!j.success || !j.data) throw new Error(j.error ?? 'No se pudieron obtener los indicadores.');
  return normalizarDemografia(j.data);
}

/** Estudios reales de la estructura seleccionada (se cachea por region + filtro). */
export async function cargarEstudiosEstructura(
  slug: string,
  nombre: string,
  filtros: FiltrosAtlas = FILTROS_VACIOS,
  limite = 12,
): Promise<RespuestaEstructura> {
  const clave = `${slug}|${limite}|${claveFiltros(filtros)}`;
  const guardado = cacheEstructura.get(clave);
  if (guardado) return guardado;
  const cuerpo = aplicarFiltros(
    new URLSearchParams({ Requerimiento: 'EstudiosEstructura', slug, nombre, limite: String(limite) }),
    filtros,
  );
  const r = await fetch(`${API}/Ajax/Aj_Atlas3D.php`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo.toString(),
  });
  const j = (await r.json()) as Crudo<RespuestaEstructura>;
  if (!j.success || !j.data) throw new Error(j.error ?? 'No se pudieron obtener los estudios.');
  cacheEstructura.set(clave, j.data);
  return j.data;
}

/**
 * Abre un estudio en el visor SIN datos del paciente (atlas anonimo).
 *
 * El enlace lo emite el backend con:
 *   - un solo uso por navegador  -> solo ese navegador puede abrirlo
 *   - modo anonimo               -> el visor oculta nombre, cedula, sexo y fecha
 *                                   de nacimiento, y no ofrece el boton para
 *                                   mostrarlos (estudio, no ficha clinica)
 */
export async function generarLinkAnonimo(studyUid: string): Promise<string> {
  const cuerpo = new URLSearchParams({
    Requerimiento: 'GenerarLink',
    study_uid: studyUid,
    origen: 'admin',      // el atlas forma parte del PACS interno
    tipo: 'visualizar',   // vínculo de navegador (un solo uso)
    anonimo: '1',         // sin datos del paciente
    horas: '24',
  });
  const r = await fetch(`${API}/Ajax/Aj_CompartirLinks.php`, {
    method: 'POST',
    credentials: 'include',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: cuerpo.toString(),
  });
  const j = (await r.json()) as {success?: boolean; url?: string; message?: string};
  if (!j.success || !j.url) throw new Error(j.message ?? 'No se pudo abrir el estudio.');
  return j.url;
}

/* ------------------------------ formato ------------------------------ */

/* El atlas es anonimo: no existe (ni se muestra) el nombre del paciente. */

export function fechaCorta(f: string | null): string {
  if (!f) return '';
  const d = new Date(f);
  if (Number.isNaN(d.getTime())) return f;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function numero(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('es-EC');
}

/** "26 años" / "Sin dato". */
export function edadTexto(edad: number | null | undefined): string {
  if (edad === null || edad === undefined) return 'Sin dato';
  return `${numero(edad)} ${edad === 1 ? 'año' : 'años'}`;
}

/** Porcentaje del total, con un decimal cuando aporta. */
export function porcentaje(n: number, total: number): string {
  if (!total) return '0%';
  const p = (n * 100) / total;
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}

/** Reparte el sexo en un texto compacto: "F 68% · M 31%". */
export function sexoResumen(sexo: DemografiaSexo | undefined): string {
  if (!sexo) return '';
  const total = (sexo.Femenino ?? 0) + (sexo.Masculino ?? 0) + (sexo.Otro ?? 0) + (sexo['Sin dato'] ?? 0);
  if (!total) return '';
  const f = Math.round(((sexo.Femenino ?? 0) * 100) / total);
  const m = Math.round(((sexo.Masculino ?? 0) * 100) / total);
  return `F ${f}% · M ${m}%`;
}
