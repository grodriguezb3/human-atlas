import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import {LocaleProvider} from '../app/i18n';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(<LocaleProvider><Home/></LocaleProvider>);
