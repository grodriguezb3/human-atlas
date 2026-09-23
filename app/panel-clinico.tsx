/**
 * panel-clinico.tsx — Nuestra capa sobre el atlas: al seleccionar una
 * estructura muestra la estadistica real de la institucion, la demografia
 * (sexo y edad), las modalidades y los estudios de esa region.
 * Todo el texto va en espanol: son datos de la institucion.
 */
import {useEffect, useMemo, useState} from 'react';
import {Activity, Calendar, ChevronRight, Eye, Search, Users} from 'lucide-react';
import {
  COLOR_MODALIDAD,
  EDAD_TOPE,
  FILTROS_VACIOS,
  REGION_ES,
  REGION_SIN_MODELO,
  buscarDiagnostico,
  cargarEstudiosEstructura,
  cargarRegiones,
  claveFiltros,
  generarLinkAnonimo,
  pedirVerImagenes,
  edadTexto,
  fechaCorta,
  numero,
  porcentaje,
  regionesDeEstructura,
  statsDeRegion,
  type DemografiaEdad,
  type DemografiaSexo,
  type FiltrosAtlas,
  type RegionStats,
  type RespuestaEstructura,
  type RespuestaDiagnostico,
} from './ipsepacs';

interface Props {
  nombre: string;
  conceptId?: string;
  partes: string[];
  onAbrirRegion?: (slug: string) => void;
  /** Avisa al visor 3D para que vuelva a pintar con los filtros nuevos. */
  onFiltros?: (f: FiltrosAtlas) => void;
}

/** Barra horizontal con etiqueta y valor. */
function Barra({etiqueta, n, total, color, sufijo}: {
  etiqueta: string;
  n: number;
  total: number;
  color: string;
  sufijo?: string;
}) {
  const pct = total > 0 ? (n * 100) / total : 0;
  return (
    <li className="ipse-barra">
      <span className="ipse-barra-top">
        <b>{etiqueta}</b>
        <i>
          {numero(n)}
          {sufijo ? ` ${sufijo}` : ''} · {porcentaje(n, total)}
        </i>
      </span>
      <span className="ipse-barra-pista">
        <span className="ipse-barra-relleno" style={{width: `${pct}%`, background: color}} />
      </span>
    </li>
  );
}

/** Reparto por sexo (barra segmentada). */
function BloquesSexo({sexo, total}: {sexo: DemografiaSexo; total: number}) {
  const partes = [
    {etiqueta: 'Femenino', n: sexo.Femenino ?? 0, color: '#b5527f'},
    {etiqueta: 'Masculino', n: sexo.Masculino ?? 0, color: '#0046ad'},
    {etiqueta: 'Otro', n: sexo.Otro ?? 0, color: '#7c5cbf'},
    {etiqueta: 'Sin dato', n: sexo['Sin dato'] ?? 0, color: '#c3ccd9'},
  ].filter(p => p.n > 0);
  if (!total) return null;
  return (
    <div className="ipse-sexo">
      <span className="ipse-sexo-barra">
        {partes.map(p => (
          <span
            key={p.etiqueta}
            className="ipse-sexo-tramo"
            style={{width: `${(p.n * 100) / total}%`, background: p.color}}
            title={`${p.etiqueta}: ${numero(p.n)}`}
          />
        ))}
      </span>
      <span className="ipse-sexo-leyenda">
        {partes.map(p => (
          <span key={p.etiqueta}>
            <i style={{background: p.color}} />
            {p.etiqueta} <b>{porcentaje(p.n, total)}</b>
          </span>
        ))}
      </span>
    </div>
  );
}

/** Resumen numerico de la edad. */
function ResumenEdad({edad}: {edad: DemografiaEdad}) {
  if (edad.promedio === null && !edad.conDato) return null;
  return (
    <div className="ipse-edad-datos">
      <span>
        Promedio<strong>{edad.promedio !== null ? `${edad.promedio} años` : '—'}</strong>
      </span>
      <span>
        Mediana<strong>{edad.mediana !== null ? `${edad.mediana} años` : '—'}</strong>
      </span>
      <span>
        Máxima<strong>{edad.maxima !== null ? `${edad.maxima} años` : '—'}</strong>
      </span>
    </div>
  );
}

/** Barra de filtros: sexo, rango de edad (dos puntos) y tipo de estudio.
 *  Se aplica un instante despues de mover, para no consultar en cada pixel. */
function BarraFiltros({
  filtros,
  modalidades,
  onCambio,
  ocupado,
}: {
  filtros: FiltrosAtlas;
  modalidades: string[];
  onCambio: (f: FiltrosAtlas) => void;
  ocupado: boolean;
}) {
  const [local, setLocal] = useState<FiltrosAtlas>(filtros);
  const claveLocal = claveFiltros(local);

  /* Si los filtros cambian desde afuera (otra region), se reflejan aqui. */
  useEffect(() => {
    setLocal(filtros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveFiltros(filtros)]);

  /* Se avisa al panel poco despues de mover: evita una consulta por pixel. */
  useEffect(() => {
    if (claveLocal === claveFiltros(filtros)) return;
    const t = window.setTimeout(() => onCambio(local), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveLocal]);

  const pct = (v: number) => (v * 100) / EDAD_TOPE;
  const activo = claveLocal !== claveFiltros(FILTROS_VACIOS);

  return (
    <div className="ipse-filtros">
      <div className="ipse-filtros-linea ipse-filtros-sexo">
        <span className="ipse-filtros-titulo">Filtrar</span>
        <span className="ipse-segmento" role="group" aria-label="Sexo">
          {([['', 'Todos'], ['F', 'Femenino'], ['M', 'Masculino']] as const).map(([v, t]) => (
            <button
              key={v || 'todos'}
              type="button"
              className={local.sexo === v ? 'on' : ''}
              onClick={() => setLocal({...local, sexo: v})}
            >
              {t}
            </button>
          ))}
        </span>
        {activo && (
          <button
            type="button"
            className="ipse-filtros-limpiar"
            onClick={() => {
              setLocal(FILTROS_VACIOS);
              onCambio(FILTROS_VACIOS);
            }}
          >
            Quitar filtros
          </button>
        )}
        {ocupado && (
          <span className="ipse-filtros-ocupado">
            <Activity size={12} /> filtrando…
          </span>
        )}
      </div>

      <div className="ipse-filtros-linea ipse-filtros-edad">
        <span className="ipse-filtros-etiqueta">Edad</span>
        <span className="ipse-edad-valor">
          <b>{local.edadMin}</b> a <b>{local.edadMax}</b> años
        </span>
        <span className="ipse-edad-rango">
          <span className="ipse-edad-pista" />
          <span
            className="ipse-edad-relleno"
            style={{left: `${pct(local.edadMin)}%`, right: `${100 - pct(local.edadMax)}%`}}
          />
          <input
            type="range"
            min={0}
            max={EDAD_TOPE}
            value={local.edadMin}
            aria-label="Edad mínima"
            onChange={e => setLocal({...local, edadMin: Math.min(Number(e.target.value), local.edadMax)})}
          />
          <input
            type="range"
            min={0}
            max={EDAD_TOPE}
            value={local.edadMax}
            aria-label="Edad máxima"
            onChange={e => setLocal({...local, edadMax: Math.max(Number(e.target.value), local.edadMin)})}
          />
        </span>
      </div>

      {modalidades.length > 1 && (
        <div className="ipse-filtros-linea ipse-filtros-tipo">
          <span className="ipse-filtros-etiqueta">Tipo</span>
          <span className="ipse-segmento" role="group" aria-label="Tipo de estudio">
            <button
              type="button"
              className={local.modalidad === '' ? 'on' : ''}
              onClick={() => setLocal({...local, modalidad: ''})}
            >
              Todas
            </button>
            {modalidades.map(m => (
              <button
                key={m}
                type="button"
                className={local.modalidad === m ? 'on' : ''}
                onClick={() => setLocal({...local, modalidad: m})}
              >
                {m}
              </button>
            ))}
          </span>
        </div>
      )}

      {/* Búsqueda por descripción: dentro de la parte del cuerpo se puede
          precisar el estudio (p. ej. "mano", "rodilla"), incluidas las
          descripciones que combinan varias exploraciones. */}
      <div className="ipse-filtros-linea ipse-filtros-buscar">
        <span className="ipse-filtros-etiqueta">Buscar</span>
        <input
          type="search"
          className="ipse-buscar"
          placeholder="Ej.: mano, hombro, rodilla, tiroides…"
          aria-label="Buscar por descripción del estudio"
          value={local.buscar}
          onChange={e => setLocal({...local, buscar: e.target.value})}
        />
        {local.buscar.trim() !== '' && (
          <button
            type="button"
            className="ipse-filtros-limpiar"
            onClick={() => setLocal({...local, buscar: ''})}
          >
            Quitar búsqueda
          </button>
        )}
      </div>
    </div>
  );
}

export default function PanelClinico({nombre, conceptId, partes, onAbrirRegion, onFiltros}: Props) {
  const [regiones, setRegiones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState<RespuestaEstructura | null>(null);
  const [regionElegida, setRegionElegida] = useState<string>('');
  const [filtros, setFiltros] = useState<FiltrosAtlas>(FILTROS_VACIOS);
  /** Rango de fechas GENERAL: lo usan el diagnostico y el listado de estudios. */
  /** Anios con datos, para los chips del filtro de fechas. */
  const aniosFiltro = datos?.anios ?? [];
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filtrando, setFiltrando] = useState(false);
  /** Estadisticas de la region calculadas CON el rango de fechas. Cuando no hay
   *  fechas se usa el mapa general que llena la escena. */
  const [statsConFechas, setStatsConFechas] = useState<RegionStats | undefined>(undefined);
  const [abriendo, setAbriendo] = useState<string>('');
  /** Se usa mientras se trae el siguiente bloque de la lista. */
  const [cargandoMas, setCargandoMas] = useState(false);

  /* 1) A que region de IPSE PACS pertenece esta estructura */
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError('');
    setDatos(null);
    regionesDeEstructura(conceptId, partes)
      .then(regs => {
        if (!vivo) return;
        setRegiones(regs);
        setRegionElegida(regs[0] ?? '');
        if (!regs.length) setCargando(false);
      })
      .catch(e => {
        if (vivo) {
          setError(e.message);
          setCargando(false);
        }
      });
    return () => {
      vivo = false;
    };
  }, [conceptId, partes.join(',')]);

  /** Trae el siguiente bloque de estudios y lo agrega a los que ya se ven. */
  const mostrarMas = async () => {
    if (!datos || cargandoMas) return;
    setCargandoMas(true);
    try {
      const d = await cargarEstudiosEstructura(regionElegida, nombre, filtros, 10, datos.mostrados, {desde, hasta});
      setDatos(prev => (prev ? {...d, estudios: [...prev.estudios, ...d.estudios]} : d));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargandoMas(false);
    }
  };

  /* 1b) Las estadisticas (cuantos, edad, sexo, modalidad) tambien tienen que
     respetar el rango de fechas: se piden aparte cuando hay uno puesto. */
  useEffect(() => {
    if (!regionElegida || (desde === '' && hasta === '')) {
      setStatsConFechas(undefined);
      return;
    }
    let vivo = true;
    cargarRegiones(filtros, {desde, hasta})
      .then(regs => {
        if (vivo) setStatsConFechas(regs.find(r => r.slug === regionElegida));
      })
      .catch(() => {
        /* si falla se sigue mostrando el mapa general */
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionElegida, claveFiltros(filtros), desde, hasta]);

  /* 2) Estudios reales de la region elegida, con los filtros activos */
  useEffect(() => {
    if (!regionElegida) return;
    let vivo = true;
    setCargando(true);
    setFiltrando(true);
    cargarEstudiosEstructura(regionElegida, nombre, filtros, 10, 0, {desde, hasta})
      .then(d => {
        if (vivo) {
          setDatos(d);
          setCargando(false);
          setFiltrando(false);
        }
      })
      .catch(e => {
        if (vivo) {
          setError(e.message);
          setCargando(false);
          setFiltrando(false);
        }
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionElegida, nombre, claveFiltros(filtros), desde, hasta]);

  /* Abre el estudio en el visor con enlace anonimo (un solo uso, sin datos).
     Si el atlas esta dentro de la APP, el visor lo abre la app (bottom sheet con
     galeria o visor) y aqui no se hace nada; en la web sigue igual que siempre. */
  const abrirImagenes = (studyUid: string, orthancUid = '') => {
    if (pedirVerImagenes(studyUid, orthancUid)) return;
    setAbriendo(studyUid);
    generarLinkAnonimo(studyUid)
      .then(url => {
        window.open(url, '_blank', 'noopener');
        setAbriendo('');
      })
      .catch(e => {
        setAbriendo('');
        setError(e.message ?? 'No se pudo abrir el estudio.');
      });
  };

  const stat = statsConFechas ?? (regionElegida ? statsDeRegion(regionElegida) : undefined);
  const sinModelo = regiones.some(r => REGION_SIN_MODELO.includes(r));

  /* La respuesta de la estructura es la mas completa; la de regiones sirve
     de respaldo mientras carga. */
  const modalidades = datos?.modalidades ?? stat?.modalidades ?? [];
  const sexo = datos?.sexo ?? stat?.sexo;
  const edad = datos?.edad;
  const anios = datos?.anios ?? [];
  const total = datos?.total ?? stat?.n ?? 0;
  const totalSexo = useMemo(
    () => (sexo ? (sexo.Femenino ?? 0) + (sexo.Masculino ?? 0) + (sexo.Otro ?? 0) + (sexo['Sin dato'] ?? 0) : 0),
    [sexo],
  );
  const edadPromedio = edad?.promedio ?? stat?.edadPromedio ?? null;
  const maxAnio = useMemo(() => anios.reduce((m, a) => Math.max(m, a.n), 0), [anios]);

  return (
    <section className="ipse-clinico" aria-label="Datos de la institución">
      <div className="ipse-head">
        <span className="ipse-dot" />
        <span>IPSE PACS · datos de la institución</span>
      </div>

      {regiones.length === 0 && !cargando && (
        <p className="ipse-note">
          Esta estructura no tiene una región equivalente en nuestros estudios.
        </p>
      )}

      {regiones.length > 1 && (
        <div className="ipse-regiones">
          {regiones.map(r => (
            <button
              key={r}
              type="button"
              className={`ipse-chip ${r === regionElegida ? 'on' : ''}`}
              onClick={() => setRegionElegida(r)}
            >
              {REGION_ES[r] ?? r}
            </button>
          ))}
        </div>
      )}

      {regionElegida && (
        <>
          {/* --- filtros: sexo, rango de edad y tipo de estudio --- */}
          <BarraFiltros
            filtros={filtros}
            modalidades={modalidades.map(m => m.modalidad)}
            ocupado={filtrando}
            onCambio={f => {
              setFiltros(f);
              onFiltros?.(f);
            }}
          />

          {/* El filtro de fechas es general: aplica a las dos columnas de abajo. */}
          <FiltroFechas
            desde={desde}
            hasta={hasta}
            anios={aniosFiltro}
            onCambio={(d, h) => {
              setDesde(d);
              setHasta(h);
            }}
          />

          {/* --- titular: volumen, edad y sexo de un vistazo --- */}
          <div className="ipse-stat">
            <strong>{numero(total)}</strong>
            <span>
              estudios en <b>{REGION_ES[regionElegida] ?? regionElegida}</b>
            </span>
            {(edadPromedio !== null || totalSexo > 0) && (
              <em>
                {edadPromedio !== null && <>edad promedio <b>{edadPromedio} años</b></>}
                {edadPromedio !== null && totalSexo > 0 && ' · '}
                {totalSexo > 0 && sexo && (
                  <>
                    {porcentaje(sexo.Femenino ?? 0, totalSexo)} femenino
                  </>
                )}
              </em>
            )}
          </div>

          {/* --- modalidades: no solo "estudios" --- */}
          {modalidades.length > 0 && (
            <div className="ipse-bloque">
              <h4 className="ipse-sub">Por modalidad</h4>
              <ul className="ipse-barras">
                {modalidades.map(m => (
                  <Barra
                    key={m.modalidad}
                    etiqueta={m.modalidad}
                    n={m.n}
                    total={total || m.n}
                    color={COLOR_MODALIDAD[m.modalidad] ?? '#7c8ba1'}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* --- sexo --- */}
          {sexo && totalSexo > 0 && (
            <div className="ipse-bloque">
              <h4 className="ipse-sub">
                <Users size={12} /> Pacientes por sexo
              </h4>
              <BloquesSexo sexo={sexo} total={totalSexo} />
            </div>
          )}

          {/* --- edad --- */}
          {edad && (
            <div className="ipse-bloque">
              <h4 className="ipse-sub">Edad de los pacientes</h4>
              <ResumenEdad edad={edad} />
              {edad.grupos.some(g => g.n > 0) && (
                <ul className="ipse-barras">
                  {edad.grupos.map(g => (
                    <Barra
                      key={g.etiqueta}
                      etiqueta={`${g.etiqueta} años`}
                      n={g.n}
                      total={total}
                      color="#0046ad"
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* --- evolucion por año --- */}
          {anios.length > 1 && (
            <div className="ipse-bloque">
              <h4 className="ipse-sub">Estudios por año</h4>
              <ul className="ipse-anios">
                {anios.map(a => (
                  <li key={a.anio}>
                    <span
                      className="ipse-anio-barra"
                      style={{height: `${maxAnio > 0 ? Math.max(6, (a.n * 100) / maxAnio) : 0}%`}}
                      title={`${numero(a.n)} estudios`}
                    />
                    <i>{a.anio}</i>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sinModelo && (
            <p className="ipse-note">
              Esta región se resalta por zona anatómica: el modelo masculino de referencia
              no incluye estas estructuras.
            </p>
          )}

          {cargando && (
            <p className="ipse-note ipse-loading">
              <Activity size={13} /> Consultando estudios…
            </p>
          )}

          {error && <p className="ipse-note ipse-error">{error}</p>}

          {/* --- dos columnas: el diagnostico a la izquierda y los estudios a
               la derecha. Los dos respetan los filtros de sexo, edad y tipo. --- */}
          <div className="ipse-dos-columnas">
          <div className="ipse-columna">
          <BuscarDiagnostico filtros={filtros} slug={regionElegida} desde={desde} hasta={hasta} onAbrir={abrirImagenes} />
          </div>
          <div className="ipse-columna">
          {!cargando && datos && datos.estudios.length > 0 && (
            <>
              <h4 className="ipse-sub">
                Estudios {datos.buscar ? `con "${datos.buscar}"` : 'recientes'}
                <em className="ipse-contador">
                  {numero(datos.mostrados)} de {numero(datos.total)}
                </em>
              </h4>
              <ul className="ipse-lista">
                {datos.estudios.map((e, i) => (
                  <li key={`${e.id_study}-${i}`}>
                    {/* Atlas anonimo: sin nombre ni cedula; fecha, edad, sexo y tipo */}
                    <span className="ipse-paciente-datos">
                      <i className={e.sexo === 'Femenino' ? 'es-f' : e.sexo === 'Masculino' ? 'es-m' : ''}>
                        {e.sexo ?? 'Sin dato'}
                      </i>
                      <i>{edadTexto(e.edad)}</i>
                      <i>{e.modalidad_nombre ?? e.modalidad}</i>
                    </span>
                    <span className="ipse-estudio-fecha">{fechaCorta(e.fecha)}</span>
                    <i>{e.descripcion}</i>
                    {e.study_uid && (
                      <button
                        type="button"
                        className="ipse-ver-imagenes"
                        disabled={abriendo === e.study_uid}
                        onClick={() => abrirImagenes(e.study_uid as string, (e.orthanc_uid as string) ?? '')}
                      >
                        {abriendo === e.study_uid ? 'Abriendo…' : 'Ver imágenes'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {datos.hay_mas && (
                <button
                  type="button"
                  className="ipse-mas"
                  disabled={cargandoMas}
                  onClick={() => void mostrarMas()}
                >
                  {cargandoMas ? 'Cargando…' : 'Mostrar 10 más'}
                </button>
              )}
              {onAbrirRegion && (
                <button type="button" className="ipse-abrir" onClick={() => onAbrirRegion(regionElegida)}>
                  Ver la región completa en el ATLAS <ChevronRight size={13} />
                </button>
              )}
            </>
          )}
          </div>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Busqueda por DIAGNOSTICO dentro del texto de los informes.
 *
 * A diferencia del buscador de estudios (que mira la descripcion del estudio),
 * este mira lo que el medico ESCRIBIO en el informe, asi que encuentra el
 * diagnostico aunque el estudio se llame distinto.
 *
 * Cada resultado dice si es un CASO ESPECIFICO (el diagnostico esta en el
 * cierre del informe, donde van las impresiones) o una simple mencion, y
 * muestra el fragmento con el termino resaltado para verlo de un vistazo.
 */
function resaltar(texto: string, termino: string) {
  const palabras = termino
    .split(/\s+/)
    .filter(p => p.length >= 3)
    .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!texto || palabras.length === 0) return texto;
  const re = new RegExp(`(${palabras.join('|')})`, 'gi');
  const set = new Set(palabras.map(p => p.toLowerCase()));
  return texto.split(re).map((parte, i) =>
    set.has(parte.toLowerCase())
      ? <mark key={i} className="ipse-diag-marca">{parte}</mark>
      : <span key={i}>{parte}</span>,
  );
}

/**
 * Filtro de FECHAS, general para todo el panel: aplica igual a la busqueda por
 * diagnostico y al listado de estudios.
 *
 * Trae periodos ya hechos (hoy, ultimos 7 dias, este anio...) porque escribir
 * dos fechas a mano para lo de siempre es incomodo.
 */
function FiltroFechas({
  desde, hasta, anios, onCambio,
}: {
  desde: string;
  hasta: string;
  anios: {anio: number; n: number}[];
  onCambio: (desde: string, hasta: string) => void;
}) {
  const hoy = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const haceDias = (n: number) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() - n);
    return iso(d);
  };

  const anioActual = hoy.getFullYear();
  const periodos: {etiqueta: string; desde: string; hasta: string}[] = [
    {etiqueta: 'Todo', desde: '', hasta: ''},
    {etiqueta: 'Hoy', desde: iso(hoy), hasta: iso(hoy)},
    {etiqueta: 'Últimos 7 días', desde: haceDias(7), hasta: iso(hoy)},
    {etiqueta: 'Últimos 30 días', desde: haceDias(30), hasta: iso(hoy)},
    {etiqueta: 'Este año', desde: `${anioActual}-01-01`, hasta: `${anioActual}-12-31`},
    {etiqueta: 'Año pasado', desde: `${anioActual - 1}-01-01`, hasta: `${anioActual - 1}-12-31`},
  ];

  const activo = (p: {desde: string; hasta: string}) =>
    p.desde === desde && p.hasta === hasta;

  return (
    <div className="ipse-fechas">
      <div className="ipse-fechas-titulo">
        <Calendar size={12} /> Fechas
        {(desde !== '' || hasta !== '') && (
          <button
            type="button"
            className="ipse-fechas-limpiar"
            onClick={() => onCambio('', '')}
          >
            Quitar
          </button>
        )}
      </div>
      <div className="ipse-fechas-chips">
        {periodos.map(p => (
          <button
            key={p.etiqueta}
            type="button"
            className={`ipse-fecha-chip${activo(p) ? ' activo' : ''}`}
            onClick={() => onCambio(p.desde, p.hasta)}
          >
            {p.etiqueta}
          </button>
        ))}
        {anios.map(a => {
          const d = `${a.anio}-01-01`;
          const h = `${a.anio}-12-31`;
          const on = desde === d && hasta === h;
          return (
            <button
              key={a.anio}
              type="button"
              className={`ipse-fecha-chip${on ? ' activo' : ''}`}
              onClick={() => onCambio(on ? '' : d, on ? '' : h)}
            >
              {a.anio} <em>{numero(a.n)}</em>
            </button>
          );
        })}
      </div>
      {/* Los campos desde/hasta solo aparecen cuando hay un rango puesto: con
          "Todo" no aportan nada y llenan de ruido. */}
      {(desde !== '' || hasta !== '') && (
        <div className="ipse-fechas-rango">
          <label>
            <span>Desde</span>
            <input type="date" value={desde} max={hasta || undefined}
                   onChange={e => onCambio(e.target.value, hasta)} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={hasta} min={desde || undefined}
                   onChange={e => onCambio(desde, e.target.value)} />
          </label>
        </div>
      )}
    </div>
  );
}

function BuscarDiagnostico({filtros, slug, desde, hasta, onAbrir}: {filtros: FiltrosAtlas; slug: string; desde: string; hasta: string; onAbrir: (u: string, o: string) => void}) {
  /** Los diagnosticos que se estan buscando a la vez (se exigen todos). */
  const [terminos, setTerminos] = useState<string[]>([]);
  /** Lo que se esta escribiendo, todavia sin agregar. */
  const [borrador, setBorrador] = useState('');
  const [datos, setDatos] = useState<RespuestaDiagnostico | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const clave = claveFiltros(filtros);

  /** Agrega lo escrito como un termino mas. */
  const agregar = (valor: string) => {
    const v = valor.trim();
    if (v.length < 3) return;
    if (terminos.some(x => x.toLowerCase() === v.toLowerCase())) {
      setBorrador('');
      return;
    }
    setTerminos([...terminos, v]);
    setBorrador('');
  };

  const quitar = (valor: string) =>
    setTerminos(terminos.filter(x => x !== valor));

  useEffect(() => {
    // Se exigen TODOS los terminos: "fractura costal" pide las dos palabras.
    const t = terminos.join(' ').trim();
    if (t.length < 3) {
      setDatos(null);
      setError('');
      setCargando(false);
      return;
    }
    let vivo = true;
    setCargando(true);
    // Se espera a que deje de escribir: la busqueda es sobre mucho texto.
    const id = setTimeout(() => {
      buscarDiagnostico(t, filtros, {desde, hasta, slug})
        .then(r => {
          if (!vivo) return;
          setDatos(r);
          setError('');
        })
        .catch(e => {
          if (!vivo) return;
          setError(String(e?.message ?? e));
          setDatos(null);
        })
        .finally(() => {
          if (vivo) setCargando(false);
        });
    }, 380);
    return () => {
      vivo = false;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminos, slug, desde, hasta, clave]);

  const estudios = datos?.estudios ?? [];
  const anios = datos?.anios ?? [];

  return (
    <div className="ipse-bloque ipse-diag">
      <h4 className="ipse-sub">
        <Search size={12} /> Buscar un diagnóstico
      </h4>
      <p className="ipse-diag-ayuda">
        Busca en el texto de los informes, no en el nombre del estudio: escriba
        por ejemplo <b>litiasis vesicular</b> o <b>fractura</b>.
      </p>

      {/* Los diagnosticos buscados, cada uno como una ficha que se quita con la X */}
      {terminos.length > 0 && (
        <div className="ipse-diag-terminos">
          {terminos.map(x => (
            <span key={x} className="ipse-diag-termino">
              {x}
              <button
                type="button"
                onClick={() => quitar(x)}
                title={`Quitar "${x}"`}
                aria-label={`Quitar ${x}`}
              >
                ×
              </button>
            </span>
          ))}
          {terminos.length > 1 && (
            <span className="ipse-diag-y">se exigen todos</span>
          )}
        </div>
      )}

      <div className="ipse-diag-caja">
        <Search size={14} className="ipse-diag-lupa" />
        <input
          className="ipse-diag-campo"
          type="text"
          value={borrador}
          onChange={e => setBorrador(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              agregar(borrador);
            }
            // Con la caja vacia, borrar saca el ultimo termino.
            if (e.key === 'Backspace' && borrador === '' && terminos.length > 0) {
              setTerminos(terminos.slice(0, -1));
            }
          }}
          placeholder={
            terminos.length === 0
              ? 'Escriba un diagnóstico y pulse Enter…'
              : 'Agregar otro diagnóstico…'
          }
          aria-label="Buscar un diagnóstico en los informes"
        />
        {borrador.trim().length >= 3 && (
          <button
            type="button"
            className="ipse-diag-agregar"
            onClick={() => agregar(borrador)}
            title="Agregar este diagnóstico"
          >
            Agregar
          </button>
        )}
        {borrador === '' && terminos.length > 0 && (
          <button
            type="button"
            className="ipse-diag-limpiar"
            onClick={() => setTerminos([])}
            title="Quitar todos"
          >
            ×
          </button>
        )}
      </div>

      {cargando && (
        <p className="ipse-note ipse-loading">
          <Activity size={13} /> Buscando en los informes…
        </p>
      )}

      {!cargando && error !== '' && <p className="ipse-note ipse-error">{error}</p>}

      {!cargando && datos && estudios.length === 0 && (
        <p className="ipse-note">
          {datos.nota ?? 'No se encontró ese diagnóstico en los informes.'}
        </p>
      )}

      {!cargando && datos && estudios.length > 0 && (
        <>
          <p className="ipse-diag-resumen">
            <b>{numero(datos.especificos)}</b> {datos.especificos === 1 ? 'caso específico' : 'casos específicos'}
            {' · '}
            {numero(datos.total)} {datos.total === 1 ? 'estudio' : 'estudios'} en total
          </p>
          <ul className="ipse-diag-lista">
            {estudios.map(e => (
              <li
                key={e.id_study}
                className={`ipse-diag-item${e.especifico ? ' ipse-diag-ok' : ''}`}
              >
                <div className="ipse-diag-fila">
                  <span className="ipse-diag-fecha">{fechaCorta(e.fecha)}</span>
                  {e.especifico ? (
                    <span className="ipse-diag-badge" title="El diagnóstico figura en el cierre del informe">
                      Caso específico
                    </span>
                  ) : (
                    <span className="ipse-diag-badge ipse-diag-suave" title="Aparece mencionado en el informe">
                      Mencionado
                    </span>
                  )}
                  <span className="ipse-diag-meta">
                    {edadTexto(e.edad)} · {e.sexo === 'M' ? 'Masculino' : e.sexo === 'F' ? 'Femenino' : '—'} · {e.modalidad}
                  </span>
                </div>
                <div className="ipse-diag-desc-fila">
                  <p className="ipse-diag-desc">{e.descripcion}</p>
                  <button
                    type="button"
                    className="ipse-diag-ver"
                    onClick={() => onAbrir(e.study_uid, e.orthanc_uid)}
                    title="Abrir las imágenes de este estudio"
                  >
                    <Eye size={12} /> Ver imágenes
                  </button>
                </div>
                {e.extracto !== '' && (
                  <p className="ipse-diag-extracto">…{resaltar(e.extracto, terminos.join(' '))}…</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
