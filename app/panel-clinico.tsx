/**
 * panel-clinico.tsx — Nuestra capa sobre el atlas: al seleccionar una
 * estructura muestra la estadistica real de la institucion y los estudios
 * de esa region. Todo el texto va en espanol.
 */
import {useEffect, useState} from 'react';
import {Activity, ChevronRight} from 'lucide-react';
import {
  REGION_ES,
  REGION_SIN_MODELO,
  cargarEstudiosEstructura,
  fechaCorta,
  nombrePaciente,
  regionesDeEstructura,
  statsDeRegion,
  type RespuestaEstructura,
} from './ipsepacs';

interface Props {
  nombre: string;
  conceptId?: string;
  partes: string[];
  onAbrirRegion?: (slug: string) => void;
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
        <div className="ipse-stat">
          <strong>{(stat?.n ?? datos?.total ?? 0).toLocaleString('es-EC')}</strong>
          <span>
            estudios en <b>{REGION_ES[regionElegida] ?? regionElegida}</b>
          </span>
          <em>
            {(stat?.eco ?? datos?.eco ?? 0).toLocaleString('es-EC')} ecografía ·{' '}
            {(stat?.rx ?? datos?.rayosX ?? 0).toLocaleString('es-EC')} rayos X
          </em>
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
                <span>
                  {e.cedula} · {e.modalidad} · {fechaCorta(e.fecha)}
                </span>
                <i>{e.descripcion}</i>
              </li>
            ))}
          </ul>
          {datos.estudios.length > 8 && (
            <p className="ipse-note">y {(datos.total - 8).toLocaleString('es-EC')} estudios más</p>
          )}
          {onAbrirRegion && (
            <button type="button" className="ipse-abrir" onClick={() => onAbrirRegion(regionElegida)}>
              Ver la región completa en el ATLAS <ChevronRight size={13} />
            </button>
          )}
        </>
      )}
    </section>
  );
}
