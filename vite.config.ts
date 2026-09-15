import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
const path=(relative:string)=>fileURLToPath(new URL(relative,import.meta.url));
// VITE_BASE permite publicar el visor en una subcarpeta (p. ej. /atlas/ del PACS)
// sin romper el desarrollo local, que sigue sirviendo desde la raiz.
export default defineConfig({base:process.env.VITE_BASE??'/',root:path('./web'),publicDir:path('./public'),plugins:[react()],resolve:{alias:{'@':path('./')}},css:{postcss:{plugins:[tailwindcss()]}},server:{watch:{usePolling:true}},build:{outDir:path('./dist'),emptyOutDir:true}});
