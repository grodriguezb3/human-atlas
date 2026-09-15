import {createContext,useCallback,useContext,useEffect,useState,type ReactNode} from 'react';
import en from '../locales/en.json';
import es from '../locales/es.json';
import anatomyEs from '../locales/anatomy.es.json';

export type Locale='en'|'es';
export type Messages=typeof en;
type Paths<T>={[K in keyof T&string]:T[K] extends string?K:`${K}.${Paths<T[K]>}`}[keyof T&string];
export type MessageKey=Paths<Messages>;
export type MessageVars=Record<string,string|number>;

export const STORAGE_KEY='human-atlas-locale';
export const LOCALES:Locale[]=['en','es'];

/** Locale names for the language switcher (each shown in its own language). */
export const LOCALE_LABELS:Record<Locale,string>={en:'English',es:'Español'};

function detect():Locale{
 if(typeof window==='undefined')return 'en';
 try{
  const stored=window.localStorage.getItem(STORAGE_KEY);
  if(stored==='en'||stored==='es')return stored;
 }catch{}
 return typeof navigator!=='undefined'&&navigator.language?.toLowerCase().startsWith('es')?'es':'en';
}

/** es.json provides the Spanish bundle; per-key fallback to en below covers any gaps. */
const bundles:Record<Locale,Messages>={en,es};
let currentLocale:Locale=detect();

function lookup(bundle:Messages,key:string):string|undefined{
 let node:unknown=bundle;
 for(const part of key.split('.')){
  if(typeof node!=='object'||node===null)return undefined;
  node=(node as Record<string,unknown>)[part];
 }
 return typeof node==='string'?node:undefined;
}

/** ICU-lite: {var} substitution plus the single {n, plural, one {…} other {…}} form. */
export function format(message:string,vars?:MessageVars):string{
 let out=message.replace(/\{(\w+), plural, one \{([^{}]*)\} other \{([^{}]*)\}\}/g,(match,name,one,other)=>{
  const value=Number(vars?.[name]);
  if(Number.isNaN(value))return match;
  return value===1?one:other;
 });
 if(vars)out=out.replace(/\{(\w+)\}/g,(match,name)=>name in vars?String(vars[name]):match);
 return out;
}

/** Non-hook translator for module-level code paths (scene effects, model download). */
export function translate(key:MessageKey,vars?:MessageVars):string{
 const message=lookup(bundles[currentLocale],key)??lookup(en,key)??key;
 return format(message,vars);
}

/** Anatomy overlay: Spanish part names keyed by FJ part id (locales/anatomy.es.json). atlas.json stays the source of truth; unmapped ids fall back to the English name. */
export const ANATOMY_OVERLAY:Record<string,string>=anatomyEs;

/** Non-hook anatomy name resolver (scene hover etc.): es overlay when locale is es, English otherwise. */
export function anatomyName(partId:string,enName:string):string{
 return currentLocale==='es'?(ANATOMY_OVERLAY[partId]??enName):enName;
}

/** Nombre de una estructura en el idioma activo.
 *  Los conceptos del atlas agrupan varias piezas: si el concepto no tiene
 *  traduccion propia se usa la de su primera pieza traducida. */
export function estructuraNombre(id:string,enName:string,elementos:string[]=[]):string{
 if(currentLocale!=='es')return enName;
 const propia=ANATOMY_OVERLAY[id];
 if(propia)return propia;
 for(const e of elementos){const t=ANATOMY_OVERLAY[e];if(t)return t;}
 return enName;
}

/** Texto de busqueda de una estructura: nombre en ingles + traduccion, para que
 *  el buscador encuentre tanto "liver" como "hígado". */
export function estructuraBusqueda(id:string,enName:string,elementos:string[]=[]):string{
 const es=estructuraNombre(id,enName,elementos);
 return es===enName?enName:`${enName} ${es}`;
}

interface I18nValue{locale:Locale;setLocale:(next:Locale)=>void;t:(key:MessageKey,vars?:MessageVars)=>string}
const I18nContext=createContext<I18nValue>({locale:currentLocale,setLocale:()=>{},t:translate});

export function LocaleProvider({children}:{children:ReactNode}){
 const [locale,setLocaleState]=useState<Locale>(currentLocale);
 const setLocale=useCallback((next:Locale)=>{
  currentLocale=next;
  try{window.localStorage.setItem(STORAGE_KEY,next);}catch{}
  setLocaleState(next);
 },[]);
 useEffect(()=>{document.documentElement.lang=locale;},[locale]);
 const t=useCallback((key:MessageKey,vars?:MessageVars)=>translate(key,vars),[locale]);
 return <I18nContext.Provider value={{locale,setLocale,t}}>{children}</I18nContext.Provider>;
}

export function useT(){return useContext(I18nContext);}

/** Hook anatomy name resolver: re-renders on locale change, es overlay with English fallback. */
export function useAnatomyName(){
 const {locale}=useT();
 return useCallback((partId:string,enName:string)=>locale==='es'?(ANATOMY_OVERLAY[partId]??enName):enName,[locale]);
}
