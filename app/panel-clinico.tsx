/**
 * panel-clinico.tsx — Nuestra capa sobre el atlas: al seleccionar una
 * estructura muestra la estadistica real de la institucion, la demografia
 * (sexo y edad), las modalidades y los estudios de esa region.
 * Todo el texto va en espanol: son datos de la institucion.
 */
import {useEffect, useMemo, useState} from 'react';
import {Activity, ChevronRight, Users} from 'lucide-react';
import {
  COLOR_MODALIDAD,
  REGION_ES,
  REGION_SIN_MODELO,
  cargarEstudiosEstructura,
  edadTexto,
  fechaCorta,
  nombrePaciente,
  numero,
  porcentaje,
  regionesDeEstructura,
  statsDeRegion,
  type DemografiaEdad,
  type DemografiaSexo,
  type RespuestaEstructura,
} from './ipsepacs';

interface Props {
  nombre: string;
  conceptId?: string;
  partes: string[];
  onAbrirRegion?: (slug: string) => void;
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

export default function PanelClinico({nombre, conceptId, partes, onAbrirRegion}: Props) {
  const [regiones, setRegiones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState<RespuestaEstructura | null>(null);
  const [regionElegida, setRegionElegida] = useState<string>('');

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

  /* 2) Estudios reales de la region elegida */
  useEffect(() => {
    if (!regionElegida) return;
    let vivo = true;
    setCargando(true);
    cargarEstudiosEstructura(regionElegida, nombre)
      .then(d => {
        if (vivo) {
          setDatos(d);
          setCargando(false);
        }
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
  }, [regionElegida, nombre]);

  const stat = regionElegida ? statsDeRegion(regionElegida) : undefined;
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

          {!cargando && datos && datos.estudios.length > 0 && (
            <>
              <h4 className="ipse-sub">Estudios recientes</h4>
              <ul className="ipse-lista">
                {datos.estudios.slice(0, 8).map((e, i) => (
                  <li key={`${e.id_study}-${i}`}>
                    <b>{nombrePaciente(e.paciente)}</b>
                    <span className="ipse-paciente-datos">
                      <i className={e.sexo === 'Femenino' ? 'es-f' : e.sexo === 'Masculino' ? 'es-m' : ''}>
                        {e.sexo ?? 'Sin dato'}
                      </i>
                      <i>{edadTexto(e.edad)}</i>
                      <i>{e.modalidad_nombre ?? e.modalidad}</i>
                    </span>
                    <span>{e.cedula} · {fechaCorta(e.fecha)}</span>
                    <i>{e.descripcion}</i>
                  </li>
                ))}
              </ul>
              {datos.total > 8 && (
                <p className="ipse-note">y {numero(datos.total - 8)} estudios más</p>
              )}
              {onAbrirRegion && (
                <button type="button" className="ipse-abrir" onClick={() => onAbrirRegion(regionElegida)}>
                  Ver la región completa en el ATLAS <ChevronRight size={13} />
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
