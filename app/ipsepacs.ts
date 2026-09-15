/**
 * ipsepacs.ts — Puente entre el visor anatomico y los datos de IPSE PACS.
 *
 * Carga el mapeo estructuras -> regiones anatomicas de la institucion y
 * consulta el endpoint Aj_Atlas3D.php (solo Superadmin) para obtener la
 * estadistica real y los estudios.
 */

export interface RegionStats {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
  n: number;
  eco: number;
  rx: number;
}

export interface EstudioClinico {
  modalidad: string | null;
  descripcion: string | null;
  paciente: string | null;
  cedula: string | null;
  fecha: string | null;
  study_uid: string | null;
  id_study: number | string | null;
}

export interface RespuestaEstructura {
  estructura: string;
  region: string;
  slug: string;
  total: number;
  eco: number;
  rayosX: number;
  estudios: EstudioClinico[];
}

export interface KpisInstitucion {
  estudios: number;
  pacientes: number;
  regiones: number;
  eco: number;
  rayosX: number;
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

const API = (import.meta as unknown as { env: Record<string, string> })
  .env?.VITE_IPSEPACS_API ?? 'http://localhost:8081';

let mapeoCache: Mapeo | null = null;
let regionesCache: RegionStats[] | null = null;
const statsPorRegion = new Map<string, RegionStats>();
const cacheEstructura = new Map<string, RespuestaEstructura>();

export async function cargarMapeo(): Promise<Mapeo> {
  if (mapeoCache) return mapeoCache;
  const r = await fetch('/ipsepacs-mapeo.json');
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

/** Estadistica por region (una sola llamada, se cachea). */
export async function cargarRegiones(): Promise<RegionStats[]> {
  if (regionesCache) return regionesCache;
  const r = await fetch(`${API}/Ajax/Aj_Atlas3D.php`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'Requerimiento=Regiones',
  });
  const j = (await r.json()) as Crudo<RegionStats[]>;
  if (!j.success || !j.data) throw new Error(j.error ?? 'No se pudo obtener la estadística.');
  regionesCache = j.data.map(x => ({
    ...x,
    n: Number(x.n ?? 0),
    eco: Number(x.eco ?? 0),
    rx: Number(x.rx ?? 0),
  }));
  regionesCache.forEach(x => statsPorRegion.set(x.slug, x));
  return regionesCache;
}

export function statsDeRegion(slug: string): RegionStats | undefined {
  return statsPorRegion.get(slug);
}

export async function cargarKpis(): Promise<KpisInstitucion> {
  const r = await fetch(`${API}/Ajax/Aj_Atlas3D.php`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'Requerimiento=KPIs',
  });
  const j = (await r.json()) as Crudo<KpisInstitucion>;
  if (!j.success || !j.data) throw new Error(j.error ?? 'No se pudieron obtener los indicadores.');
  return j.data;
}

/** Estudios reales de la estructura seleccionada (se cachea por region). */
export async function cargarEstudiosEstructura(
  slug: string,
  nombre: string,
  limite = 12,
): Promise<RespuestaEstructura> {
  const clave = `${slug}|${limite}`;
  const guardado = cacheEstructura.get(clave);
  if (guardado) return guardado;
  const cuerpo = new URLSearchParams({ Requerimiento: 'EstudiosEstructura', slug, nombre, limite: String(limite) });
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

export function nombrePaciente(p: string | null): string {
  if (!p) return 'Sin nombre';
  return p.replace(/\^/g, ' ').replace(/\s+/g, ' ').trim();
}

export function fechaCorta(f: string | null): string {
  if (!f) return '';
  const d = new Date(f);
  if (Number.isNaN(d.getTime())) return f;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}
