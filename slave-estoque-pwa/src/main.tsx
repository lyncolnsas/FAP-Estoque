import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { toast } from 'sonner'

// Interceptador global de fetch para ajustar localhost para o IP atual (útil em mobile) e tratar erros
const originalFetch = window.fetch;
window.fetch = async function () {
  let [resource, config] = arguments;
  
  if (typeof resource === 'string' && resource.includes('localhost:')) {
    // Substitui localhost pelo hostname atual (para funcionar no celular se estiver na mesma rede)
    resource = resource.replace('localhost', window.location.hostname);
  } else if (resource instanceof Request && resource.url.includes('localhost:')) {
    // Se for um objeto Request, a URL é somente leitura, mas podemos recriar
    resource = new Request(resource.url.replace('localhost', window.location.hostname), resource);
  }

  try {
    const response = await originalFetch(resource, config);
    return response;
  } catch (error: any) {
    console.error('Fetch error interceptor:', error);
    // Verifica se é o erro "Failed to fetch"
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      toast.error('Erro de conexão com o servidor. O sistema não conseguiu se conectar ao backend. Se você estiver no celular, certifique-se de estar na mesma rede Wi-Fi que o servidor.');
    }
    throw error;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
