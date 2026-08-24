const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export const api = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // Em produção (quando embutido no Painel via Electron), usamos o proxy do frontend na rota /api
  if (import.meta.env.PROD) {
    return `/api${cleanPath}`;
  }

  // Em desenvolvimento
  let finalUrl = `${BASE_URL}${cleanPath}`;
  
  if (typeof window !== 'undefined' && finalUrl.includes('localhost')) {
    // Se a API URL estiver apontando para localhost, trocamos pelo IP atual do frontend
    // Mantemos a porta original da API (ex: 3333)
    const currentHost = window.location.hostname;
    finalUrl = finalUrl.replace('localhost', currentHost);
    finalUrl = finalUrl.replace('127.0.0.1', currentHost);
  }
  
  return finalUrl;
};
