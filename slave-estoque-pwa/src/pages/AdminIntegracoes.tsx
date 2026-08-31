import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { formatPhoneMask } from '../lib/utils';

export default function AdminIntegracoes() {
  const { token } = useAuth();
  
  // WhatsApp State
  const [waStatus, setWaStatus] = useState<string>('CARREGANDO');
  const [waQr, setWaQr] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [searchingPhoto, setSearchingPhoto] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Sync Mobile State
  const [syncQr, setSyncQr] = useState<string | null>(null);
  const [syncPassword, setSyncPassword] = useState('');

  // Email State
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  
  const [loading, setLoading] = useState(false);

  const carregarIntegracoes = async () => {
    try {
      const waRes = await fetch(api('/configuracoes/whatsapp/status'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (waRes.ok) {
        const waData = await waRes.json();
        setWaStatus(waData.status);
        setWaQr(waData.qr);
      }

      const emailRes = await fetch(api('/configuracoes/email'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (emailRes.ok) {
        const emailData = await emailRes.json();
        setSmtpHost(emailData.smtpHost);
        setSmtpPort(emailData.smtpPort);
        setSmtpUser(emailData.smtpUser);
        setSmtpPass(emailData.smtpPass);
      }

      const syncRes = await fetch(api('/sync/qr-payload'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        setSyncQr(syncData.encryptedPayload);
      }

      const passRes = await fetch(api('/configuracoes/sync-password'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (passRes.ok) {
        const passData = await passRes.json();
        setSyncPassword(passData.password);
      }
    } catch (err) {
      console.error('Erro ao carregar integrações:', err);
    }
  };

  useEffect(() => {
    carregarIntegracoes();
    // Auto refresh mais frequente quando aguardando QR ou reconectando
    const interval = setInterval(() => {
      if (
        waStatus === 'AGUARDANDO_QR' ||
        waStatus === 'CARREGANDO' ||
        waStatus === 'DESCONECTADO' ||
        waStatus === 'MODO_ESPERA'
      ) {
        carregarIntegracoes();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [waStatus, token]);

  const reconectarWhatsapp = async () => {
    try {
      setWaStatus('CARREGANDO');
      setWaQr(null);
      await fetch(api('/configuracoes/whatsapp/reconectar'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      // Inicia polling agressivo para pegar o QR logo que aparecer
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await carregarIntegracoes();
        if (attempts >= 20) clearInterval(poll); // Para após 60s
      }, 3000);
    } catch (err) {
      console.error(err);
      setWaStatus('MODO_ESPERA');
    }
  };

  const desconectarWhatsapp = () => {
    toast.warning("Deseja realmente desconectar o robô do WhatsApp?", {
      action: {
        label: "Desconectar",
        onClick: async () => {
          try {
            setWaStatus('CARREGANDO');
            await fetch(api('/configuracoes/whatsapp/desconectar'), {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Robô desconectado do WhatsApp');
            carregarIntegracoes();
          } catch (err) {
            console.error(err);
            toast.error('Erro ao desconectar robô');
          }
        }
      }
    });
  };

  const testarMensagemWa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      toast.error('Informe um número com DDD para o teste.');
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch(api('/configuracoes/whatsapp/teste'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phone: testPhone.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Mensagem de teste enviada com sucesso ao WhatsApp!');
      } else {
        toast.error(data.error || 'Erro ao enviar mensagem de teste.');
      }
    } catch (err: any) {
      toast.error('Erro de conexão ao testar WhatsApp.');
    } finally {
      setSendingTest(false);
    }
  };

  const testarBuscaFoto = async () => {
    if (!testPhone.trim()) {
      toast.error('Informe um número com DDD para buscar a foto.');
      return;
    }
    setSearchingPhoto(true);
    setPreviewPhoto(null);
    try {
      const res = await fetch(api('/configuracoes/whatsapp/buscar-foto'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phone: testPhone.trim() })
      });
      const data = await res.json();
      if (res.ok && data.fotoUrl) {
        setPreviewPhoto(data.fotoUrl);
        toast.success('Foto de perfil encontrada no WhatsApp!');
      } else {
        toast.info(data.error || 'Foto não encontrada ou perfil privado.');
      }
    } catch (err) {
      toast.error('Erro ao buscar foto.');
    } finally {
      setSearchingPhoto(false);
    }
  };

  const salvarEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(api('/configuracoes/email'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ smtpHost, smtpPort, smtpUser, smtpPass })
      });
      if (res.ok) {
        toast.success('Configurações de E-mail salvas com sucesso!');
      } else {
        toast.error('Erro ao salvar configurações.');
      }
    } catch (error) {
      toast.error('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const salvarSyncPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(api('/configuracoes/sync-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: syncPassword || '' })
      });
      if (res.ok) {
        toast.success('Senha de sincronização salva!');
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Erro ao salvar senha.');
      }
    } catch (error) {
      toast.error('Erro de conexão.');
    }
  };

  const limparPedidos = () => {
    const code = window.prompt("Digite 'CONFIRMAR' para apagar todas as requisições e reservas do sistema. Essa ação não pode ser desfeita!");
    if (code !== 'CONFIRMAR') {
      toast.info('Operação cancelada.');
      return;
    }
    
    toast.promise(
      fetch(api('/database/limpar-pedidos'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).then(async res => {
        if (!res.ok) throw new Error('Falha ao limpar');
        return res.json();
      }),
      {
        loading: 'Limpando banco de dados...',
        success: 'Todos os pedidos e reservas foram apagados!',
        error: 'Erro ao limpar banco de dados'
      }
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="max-w-4xl mx-auto space-y-8 pb-10"
    >
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Integrações & Sistema</h1>
          <p className="text-slate-500 mt-1">Conecte o sistema ao WhatsApp, E-mail e gerencie dados sensíveis.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* App Sync Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden md:col-span-2 lg:col-span-1">
          <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center gap-3">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
            <h2 className="text-lg font-semibold text-indigo-900">Sincronização do App Offline</h2>
          </div>
          <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
            {syncQr ? (
              <div className="text-center space-y-4">
                <h3 className="font-semibold text-slate-800">Conectar Aplicativo</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">Abra o aplicativo móvel do estoque e escaneie este QR Code para configurar o servidor de sincronização offline.</p>
                <div className="bg-white p-4 rounded-xl border inline-block shadow-sm">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(syncQr)}`} alt="App Sync QR Code" className="mx-auto" />
                </div>
                
                <form onSubmit={salvarSyncPassword} className="mt-6 w-full max-w-sm border-t border-slate-100 pt-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2 text-left">Palavra-passe de Autenticação</label>
                  <div className="flex gap-2">
                    <input 
                      value={syncPassword} 
                      onChange={e => setSyncPassword(e.target.value)} 
                      type="text" 
                      placeholder="Deixe vazio para login livre" 
                      className="flex-1 rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2" 
                    />
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">Salvar</button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-left">Se configurado, o aplicativo só poderá sincronizar dados enviando esta senha exata.</p>
                </form>
              </div>
            ) : (
              <div className="text-center text-slate-500 animate-pulse">
                Gerando QR Code de sincronização...
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${waStatus === 'CONECTADO' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
            <h2 className="text-lg font-semibold text-emerald-900">Conexão WhatsApp</h2>
          </div>
          <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
            {waStatus === 'CONECTADO' ? (
              <div className="w-full space-y-5 text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Robô Conectado & Ativo</h3>
                  <p className="text-slate-500 text-xs mt-1">O sistema está pronto para enviar notificações e buscar fotos de perfil dos contatos.</p>
                </div>

                {/* PAINEL DE TESTE RÁPIDO */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Testar Conexão e Busca de Foto</h4>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="DDD + Número (ex: (99) 99156-1407)"
                      value={testPhone}
                      onChange={e => setTestPhone(formatPhoneMask(e.target.value))}
                      className="w-full text-xs rounded-lg border-slate-300 px-3 py-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={testarMensagemWa}
                        disabled={sendingTest || !testPhone}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-2 px-3 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                      >
                        {sendingTest ? 'Enviando...' : '💬 Enviar Teste'}
                      </button>
                      <button
                        type="button"
                        onClick={testarBuscaFoto}
                        disabled={searchingPhoto || !testPhone}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs py-2 px-3 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                      >
                        {searchingPhoto ? 'Buscando...' : '🔍 Buscar Foto'}
                      </button>
                    </div>

                    {previewPhoto && (
                      <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-emerald-200 mt-2">
                        <img 
                          src={previewPhoto.startsWith('/uploads/') ? api(previewPhoto) : previewPhoto} 
                          alt="Foto WhatsApp" 
                          className="w-10 h-10 rounded-full object-cover border border-emerald-300"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-emerald-800">Foto Obtida com Sucesso!</p>
                          <p className="text-[10px] text-slate-500 truncate">{previewPhoto}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button onClick={desconectarWhatsapp} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-medium transition-colors text-xs">
                    Desconectar Robô
                  </button>
                </div>
              </div>
            ) : waStatus === 'MODO_ESPERA' ? (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h3 className="text-xl font-bold text-amber-800">Modo de Espera</h3>
                <p className="text-slate-500 text-sm">A conexão não foi estabelecida ou o QR Code expirou.</p>
                <button onClick={reconectarWhatsapp} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-medium transition-colors shadow-sm">Gerar Novo QR Code</button>
              </div>
            ) : waStatus === 'AGUARDANDO_QR' && waQr ? (
              <div className="text-center space-y-4">
                <h3 className="font-semibold text-slate-800">Escaneie o QR Code</h3>
                <p className="text-xs text-slate-500 max-w-xs">Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie o código abaixo:</p>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(waQr)}`} alt="WhatsApp QR Code" className="mx-auto rounded-xl border p-2 shadow-sm" />
                <button onClick={desconectarWhatsapp} className="mt-4 px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-medium transition-colors text-sm">Cancelar</button>
              </div>
            ) : (
              <div className="text-center text-slate-500 flex flex-col items-center">
                <div className="animate-pulse mb-4">Aguardando inicialização do serviço...</div>
                {waStatus === 'DESCONECTADO' && (
                  <button onClick={reconectarWhatsapp} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-medium transition-colors shadow-sm">Iniciar Conexão</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* E-mail Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            <h2 className="text-lg font-semibold text-blue-900">Servidor de E-mail (SMTP)</h2>
          </div>
          <div className="p-6">
            <form onSubmit={salvarEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Host SMTP</label>
                <input required value={smtpHost} onChange={e => setSmtpHost(e.target.value)} type="text" placeholder="smtp.gmail.com" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Porta SMTP</label>
                <input required value={smtpPort} onChange={e => setSmtpPort(e.target.value)} type="number" placeholder="465 ou 587" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de Envio</label>
                <input required value={smtpUser} onChange={e => setSmtpUser(e.target.value)} type="email" placeholder="sistema@empresa.com" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha (App Password)</label>
                <input value={smtpPass} onChange={e => setSmtpPass(e.target.value)} type="password" placeholder="******" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" />
                <p className="text-xs text-slate-400 mt-1">Se usar Gmail, ative a Verificação em 2 Etapas e crie uma Senha de App.</p>
              </div>
              <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-xl shadow-sm transition-colors mt-2">
                {loading ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </form>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 rounded-2xl shadow-sm border border-red-100 overflow-hidden md:col-span-2">
          <div className="bg-red-100 px-6 py-4 border-b border-red-200 flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <h2 className="text-lg font-semibold text-red-900">Zona de Perigo</h2>
          </div>
          <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="max-w-lg">
              <h3 className="font-bold text-red-900">Limpar Banco de Dados (Pedidos e Reservas)</h3>
              <p className="text-red-700 text-sm mt-1">Isso irá apagar todas as requisições (pedidos), avarias ligadas a elas, e reservas locais. Todos os equipamentos voltarão para o status DISPONÍVEL (exceto os em manutenção ou com defeito). Esta ação não pode ser desfeita.</p>
            </div>
            <button 
              onClick={limparPedidos} 
              className="whitespace-nowrap px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-sm"
            >
              Limpar Tudo
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
