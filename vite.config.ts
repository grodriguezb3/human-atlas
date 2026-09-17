import {fileURLToPath} from 'node:url';
import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
const path=(relative:string)=>fileURLToPath(new URL(relative,import.meta.url));
// VITE_BASE permite publicar el visor en una subcarpeta (p. ej. /atlas/ del PACS)
// sin romper el desarrollo local, que sigue sirviendo desde la raiz.
export default defineConfig(({mode})=>{/* La base y la API salen del .env (por modo) o del entorno: asi el build de
   produccion se hace con solo 'npm run build', sin prefijos de variables. */
const env=loadEnv(mode,process.cwd(),'VITE_');
return {base:env.VITE_BASE||process.env.VITE_BASE||'/',/* los .env viven en la raiz del repo, no en web/ (que es el root de Vite) */envDir:path('./'),root:path('./web'),publicDir:path('./public'),plugins:[react()],resolve:{alias:{'@':path('./')}},css:{postcss:{plugins:[tailwindcss()]}},server:{watch:{usePolling:true}},build:{outDir:path('./dist'),emptyOutDir:true}};})
