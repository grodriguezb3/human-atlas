/**
 * sesion.tsx — Entrar y el perfil, dentro del atlas.
 *
 * El atlas (el muñeco) se ve siempre, sin cuenta. Lo que se abre con cuenta es
 * la INFORMACIÓN DEL PACS de las tablas. Hay dos ingresos y los dos están aquí:
 *
 *   1. IPSE PACS      — el personal del sistema, con su usuario de siempre.
 *   2. Institución    — las instituciones educativas, con el correo y la clave
 *                       que crearon en el portal del atlas.
 *
 * Sin permiso, las tablas avisan; con permiso, se llenan.
 */
'use client';

import {useEffect,useState} from 'react';
import {GraduationCap,Hospital,LogOut,Mail,ShieldCheck,UserRound} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {RUTA_BASE,URL_INSTITUCIONES,tokenInstitucion,guardarTokenInstitucion} from './ipsepacs';

type Cuenta = {
  nombre?: string;
  usuario?: string;
  correo?: string;
  telefono?: string | null;
  rol?: string;
  institucion?: string;
  dominio?: string;
};

/** Cuando las tablas no tienen permiso, avisan por aquí y se abre esta hoja. */
export const AVISO_SIN_PERMISO = 'atlas:sin-permiso';

/* El ingreso del PACS es SU formulario, en la raíz del sistema. */
const ORIGEN_PACS = (() => {
  try {
    const h = window.location.hostname;
    const esLocal = h === 'localhost' || h === '127.0.0.1' || h === '' || /^192\.168\./.test(h);
    return esLocal ? `http://${h}:8081` : window.location.origin;
  } catch {
    return 'https://pacs.ipse.com.ec';
  }
})();

/* Si el atlas se abrió DESDE el PACS (su botón "Ver atlas"), la sesión del PACS
 * ya viene en la cookie: no hay que ofrecer "Iniciar sesión". Solo se ofrece
 * cuando se entra directo, sin sesión del PACS. */
const VIENE_DEL_PACS = (() => {
  try {
    const v = new URLSearchParams(window.location.search).get('pacs') ?? '';
    return /^(1|si|sí|true)$/i.test(v);
  } catch {
    return false;
  }
})();

async function pedirPortal(accion: string, datos?: Record<string, unknown>): Promise<Record<string, any>> {
  const o: RequestInit = {method: datos ? 'POST' : 'GET', headers: {}};
  if (datos) {
    (o.headers as Record<string, string>)['Content-Type'] = 'application/json';
    o.body = JSON.stringify(datos);
  }
  const t = tokenInstitucion();
  if (t) (o.headers as Record<string, string>)['X-Atlas-Token'] = t;
  try {
    let url = `${URL_INSTITUCIONES()}?accion=${accion}`;
    if (!datos) {
      const c = new URLSearchParams();
      if (t) c.set('atlas_token', t);
      if (c.toString()) url += `&${c.toString()}`;
    }
    const r = await fetch(url, o);
    return await r.json();
  } catch {
    return {ok: false, error: 'SIN_CONEXION'};
  }
}

const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');

const NOMBRE_ROL: Record<string, string> = {
  admin_institucion: 'Administrador de la institución',
  docente: 'Docente',
  estudiante: 'Estudiante'
};

/** El botón de la esquina y su hoja: entrar, o el perfil si ya entró. */
export default function Sesion() {
  const [abierto, setAbierto] = useState(false);
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [revisando, setRevisando] = useState(true);
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState('');

  const hayToken = tokenInstitucion() !== '';

  /* Al cargar: si ya hay permiso guardado, se pide el perfil. */
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!hayToken) { setRevisando(false); return; }
      const d = await pedirPortal('sesion');
      if (!vivo) return;
      if (d.ok) setCuenta(d.cuenta || {});
      else { guardarTokenInstitucion(''); }
      setRevisando(false);
    })();
    return () => { vivo = false; };
  }, [hayToken]);

  /* Las tablas avisan cuando el permiso no alcanza: se abre el ingreso. */
  useEffect(() => {
    const oyente = () => { setAbierto(true); setError(''); };
    window.addEventListener(AVISO_SIN_PERMISO, oyente);
    return () => window.removeEventListener(AVISO_SIN_PERMISO, oyente);
  }, []);

  const entrarInstitucion = async () => {
    if (!correo.trim() || !clave) { setError('Escriba su correo y su clave.'); return; }
    setEntrando(true); setError('');
    const d = await pedirPortal('login', {usuario: correo.trim(), clave});
    setEntrando(false);
    if (!d.ok) {
      setError(d.error === 'SIN_CONEXION'
        ? 'No hay conexión con el servidor.'
        : 'El correo o la clave no son correctos.');
      return;
    }
    guardarTokenInstitucion(d.token || '');
    setCuenta(d.cuenta || {});
    setClave('');
    // Con el permiso nuevo, las tablas se recargan solas en la próxima consulta.
    window.location.reload();
  };

  const salir = async () => {
    await pedirPortal('salir', {});
    guardarTokenInstitucion('');
    setCuenta(null);
    setAbierto(false);
    window.location.reload();
  };

  const nombre = (cuenta?.nombre || cuenta?.usuario || '').trim();

  return (
    <>
      {cuenta ? (
        <Button variant="ghost" className="sesion-boton" onClick={() => setAbierto(true)}
                aria-label={`Perfil de ${nombre || 'la cuenta'}`} title={nombre}>
          <span className="sesion-avatar">{iniciales(nombre) || <UserRound size={16}/>}</span>
          <span className="sesion-nombre">{nombre.split(' ')[0]}</span>
        </Button>
      ) : VIENE_DEL_PACS ? null : (
        <Button variant="ghost" onClick={() => { setAbierto(true); setError(''); }}
                aria-label="Iniciar sesión">
          <UserRound size={18}/><span>Iniciar sesión</span>
        </Button>
      )}

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent className="sesion-sheet glass">
          {cuenta ? (
            /* ---------------- Perfil ---------------- */
            <>
              <div className="perfil-cabeza">
                <span className="perfil-avatar">{iniciales(nombre) || <UserRound size={22}/>}</span>
                <div>
                  <SheetTitle className="perfil-nombre">{nombre || 'Su cuenta'}</SheetTitle>
                  <SheetDescription className="perfil-inst">
                    {cuenta.institucion || 'Institución educativa'}
                  </SheetDescription>
                </div>
              </div>

              <dl className="perfil-datos">
                {cuenta.correo && (<><dt><Mail size={14}/>Correo</dt><dd>{cuenta.correo}</dd></>)}
                {cuenta.telefono && (<><dt>Teléfono</dt><dd>{cuenta.telefono}</dd></>)}
                {/* El rol se quita: al usuario no le aporta. En su lugar va la
                    marca de IPSE, enlazada y en pestaña nueva. */}
                <dt>IPSE S.A.</dt>
                <dd><a className="perfil-enlace" href="https://ipse.com.ec" target="_blank"
                       rel="noreferrer">ipse.com.ec</a></dd>
                {cuenta.institucion && (
                  <><dt>Institución</dt><dd>{cuenta.institucion}{cuenta.dominio ? ` · @${cuenta.dominio}` : ''}</dd></>
                )}
              </dl>

              <p className="perfil-nota">
                <ShieldCheck size={14}/> Entró como institución educativa: el atlas se ve siempre y la
                información del PACS se muestra gracias a su permiso.
              </p>

              <Button variant="ghost" className="perfil-salir" onClick={salir}>
                <LogOut size={16}/><span>Salir de esta cuenta</span>
              </Button>
            </>
          ) : (
            /* ---------------- Entrar ---------------- */
            <>
              <SheetTitle className="sesion-titulo">Entrar</SheetTitle>
              <SheetDescription className="sesion-bajada">
                El atlas anatómico se ve siempre, sin cuenta. Lo que se abre con una cuenta es la
                información del PACS que aparece en las tablas.
              </SheetDescription>

              {/* 1. El ingreso del PACS: el de siempre, el del personal del sistema. */}
              <div className="opcion-ingreso">
                <div className="opcion-cabeza">
                  <span className="opcion-icono"><Hospital size={18}/></span>
                  <div>
                    <strong>Personal del PACS</strong>
                    <span>Con su usuario y clave del sistema, como siempre.</span>
                  </div>
                </div>
                <Button variant="ghost" className="opcion-boton"
                        onClick={() => { window.location.href = ORIGEN_PACS; }}>
                  Entrar al PACS
                </Button>
              </div>

              {/* 2. El ingreso de las instituciones educativas. */}
              <div className="opcion-ingreso">
                <div className="opcion-cabeza">
                  <span className="opcion-icono"><GraduationCap size={18}/></span>
                  <div>
                    <strong>Institución educativa</strong>
                    <span>Con el correo de su institución y la clave que creó.</span>
                  </div>
                </div>

                <label className="campo-sesion">
                  <span>Correo</span>
                  <input type="email" autoComplete="email" spellCheck={false}
                         value={correo} onChange={e => setCorreo(e.target.value)}
                         placeholder="nombre@suinstitucion.edu.ec"/>
                </label>
                <label className="campo-sesion">
                  <span>Clave</span>
                  <input type="password" autoComplete="current-password"
                         value={clave} onChange={e => setClave(e.target.value)}
                         onKeyDown={e => { if (e.key === 'Enter') entrarInstitucion(); }}/>
                </label>

                {error && <p className="ipse-note ipse-error">{error}</p>}

                <Button variant="ghost" className="opcion-boton principal"
                        disabled={entrando} onClick={entrarInstitucion}>
                  {entrando ? 'Entrando…' : 'Entrar'}
                </Button>
                <Button variant="ghost" className="opcion-enlace"
                        onClick={() => { window.location.href = `${RUTA_BASE}portal/`; }}>
                  ¿Primera vez? Cree su cuenta
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
