/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { CheckCircle2, AlertOctagon, ScanLine, LogOut, PackageCheck, Image as ImageIcon, Send, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';

type Modo = 'ENTREGA' | 'DEVOLUCAO' | 'DEVOLUCAO_GLOBAL';

interface ItemScanner {
  id?: string;
  status?: string;
  statusSeparacao?: boolean;
  statusDevolucao?: boolean;
  equipamento: {
    nome: string;
    codigoPatrimonio: string;
    fotoUrl?: string;
  };
}

interface RequisicaoScanner {
  id: string;
  status?: string;
  solicitanteNome?: string;
  departamento?: string;
  itens: ItemScanner[];
}

export default function ScannerQR() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [requisicaoId, setRequisicaoId] = useState(searchParams.get('req') || '');
  const paramModo = searchParams.get('modo') as Modo;
  const [modo, setModo] = useState<Modo>(paramModo || 'ENTREGA');
  const [fase, setFase] = useState<1 | 2 | 3>(searchParams.get('req') ? 2 : 1); // 1=Setup, 2=Leitura, 3=Conferencia
  const [cameraActive, setCameraActive] = useState(false);
  const [scannerInstance, setScannerInstance] = useState<any>(null);

  const [requisicao, setRequisicao] = useState<RequisicaoScanner | null>(null);
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [equipamentosExtras, setEquipamentosExtras] = useState<Record<string, any>>({});
  
  const [submitting, setSubmitting] = useState(false);
  
  const [avariasMap, setAvariasMap] = useState<Record<string, { temAvaria: boolean, descricao?: string, tipoId?: string }>>({});
  const [faltantesMap, setFaltantesMap] = useState<Record<string, string>>({}); // codigo -> descricao

  const [tiposAvaria, setTiposAvaria] = useState<any[]>([]);

  useEffect(() => {
    if (token) {
      fetch(api('/tipos-avaria'), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setTiposAvaria)
        .catch(console.error);
    }
  }, [token]);

  useEffect(() => {
    if (requisicaoId && token) {
      fetch(api('/requisicoes'), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const req = data.find((r: any) => r.id === requisicaoId);
            if (req) setRequisicao(req);
          }
        }).catch(console.error);
    }
  }, [requisicaoId, token]);

  const handleScan = async (decodedText: string) => {
    if (scannerInstance) scannerInstance.pause(true);
    let codigo = decodedText;
    if (decodedText.includes('/equipamento/')) {
      codigo = decodedText.split('/equipamento/')[1].split('/')[0];
    }

    if (modo === 'DEVOLUCAO_GLOBAL') {
      try {
        const res = await fetch(api(`/equipamentos/${codigo}/requisicao-ativa`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.requisicaoId) {
          setRequisicaoId(data.requisicaoId);
          setModo('DEVOLUCAO');
          setScannedCodes([codigo]);
        } else {
          toast.error('Nenhuma requisição ativa encontrada para este equipamento.');
        }
      } catch {
        toast.error('Erro ao buscar equipamento.');
      }
      if (scannerInstance) scannerInstance.resume();
      return;
    }

    if (!scannedCodes.includes(codigo)) {
      setScannedCodes(prev => [...prev, codigo]);

      if (modo === 'ENTREGA' && requisicao) {
        const isExpected = requisicao.itens.find((i: any) => i.equipamento.codigoPatrimonio === codigo);
        if (!isExpected) {
          fetch(api(`/equipamentos/${codigo}/info`), { headers: { Authorization: `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => {
              if (data.id) setEquipamentosExtras(prev => ({ ...prev, [codigo]: data }));
            }).catch(console.error);
        }
      }
    }
    
    if (navigator.vibrate) navigator.vibrate(200);
    
    setTimeout(() => {
      if (scannerInstance) scannerInstance.resume();
    }, 1500);
  };


  useEffect(() => {
    if (cameraActive) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      setScannerInstance(scanner);
      scanner.render(handleScan, () => {});
      return () => { scanner.clear().catch(console.error); };
    } else if (scannerInstance) {
      scannerInstance.clear().catch(console.error);
      setScannerInstance(null);
    }
  }, [cameraActive, modo, token]);

  const saveToOfflineSync = (url: string, payload: any) => {
    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    queue.push({ url, payload, token });
    localStorage.setItem('sync_queue', JSON.stringify(queue));
    toast.info('Salvo localmente. O app fará o sincronismo quando a internet voltar.');
  };

  const finalizarEntrega = async () => {
    setSubmitting(true);
    
    for (const codigo of scannedCodes) {
      try {
        const res = await fetch(api(`/requisicoes/${requisicaoId}/separar`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ codigoPatrimonio: codigo })
        });
        if (!res.ok) throw new Error('Falha');
      } catch {
        saveToOfflineSync(api(`/requisicoes/${requisicaoId}/separar`), { codigoPatrimonio: codigo });
      }
    }
    setSubmitting(false);
    toast.success('Entrega finalizada com sucesso!');
    navigate('/');
  };

  const finalizarDevolucao = async () => {
    setSubmitting(true);
    
    const itensProcessados = [];
    const esperados = requisicao?.itens.filter((i:any) => i.statusSeparacao && !i.statusDevolucao) || [];
    
    for (const item of esperados) {
      const cod = item.equipamento.codigoPatrimonio;
      const devolvido = scannedCodes.includes(cod);
      
      if (devolvido) {
        const av = avariasMap[cod];
        itensProcessados.push({
          codigoPatrimonio: cod,
          devolvido: true,
          avaria: av?.temAvaria || false,
          descricaoAvaria: av?.descricao || undefined,
          tipoAvariaId: av?.tipoId || undefined
        });
      } else {
        const obsFalta = faltantesMap[cod] || 'Não devolvido';
        itensProcessados.push({
          codigoPatrimonio: cod,
          devolvido: false,
          avaria: false,
          descricaoAvaria: obsFalta
        });
      }
    }

    try {
      const res = await fetch(api(`/requisicoes/${requisicaoId}/finalizar-devolucao`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itensProcessados })
      });
      if (!res.ok) throw new Error('Falha');
      toast.success('Devolução concluída!');
      navigate('/');
    } catch {
      saveToOfflineSync(api(`/requisicoes/${requisicaoId}/finalizar-devolucao`), { itensProcessados });
      navigate('/');
    }
    setSubmitting(false);
  };

  const removerDaLista = (codigo: string) => {
    setScannedCodes(prev => prev.filter(c => c !== codigo));
  };

  if (fase === 3) {
    if (modo === 'ENTREGA') {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><CheckCircle2 className="text-blue-500"/> Conferência de Entrega</h2>
            <button onClick={() => setFase(2)} className="text-slate-500 underline">Voltar</button>
          </div>
          
          <div className="space-y-4">
            {scannedCodes.map(codigo => {
              const expectedItem = requisicao?.itens.find((i:any) => i.equipamento.codigoPatrimonio === codigo);
              const extraItem = equipamentosExtras[codigo];
              const eq = expectedItem ? expectedItem.equipamento : extraItem;
              
              return (
                <div key={codigo} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
                  {eq?.fotoUrl ? (
                    <img src={eq.fotoUrl.startsWith('/uploads') ? api(eq.fotoUrl) : eq.fotoUrl} alt={eq.nome} className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400"><ImageIcon size={24}/></div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800">{eq?.nome || 'Item Desconhecido'}</h4>
                    <p className="text-sm text-slate-500 font-mono">{codigo}</p>
                    {!expectedItem && <span className="inline-block bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full mt-1">Item Extra</span>}
                  </div>
                  <button onClick={() => removerDaLista(codigo)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={20}/></button>
                </div>
              );
            })}
            {scannedCodes.length === 0 && <p className="text-center text-slate-500 py-8">Nenhum item bipado.</p>}
          </div>

          <button disabled={submitting || scannedCodes.length === 0} onClick={finalizarEntrega} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-md flex justify-center items-center gap-2 disabled:opacity-50">
            {submitting ? 'Processando...' : <><Send size={20}/> Confirmar e Entregar ({scannedCodes.length} itens)</>}
          </button>
        </motion.div>
      );
    }

    if (modo === 'DEVOLUCAO' && requisicao) {
      const itemsToRender = requisicao.itens.filter((i: ItemScanner) => i.status === 'PENDENTE' || i.status === 'AGUARDANDO_SEPARACAO' || i.status === 'EMPRESTADO');

      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><LogOut className="text-orange-500 rotate-180"/> Conferência de Devolução</h2>
            <button onClick={() => setFase(2)} className="text-slate-500 underline">Voltar</button>
          </div>

          <div className="space-y-6">
            {itemsToRender.map((item: ItemScanner) => {
              const eq = item.equipamento;
              const cod = eq.codigoPatrimonio;
              const devolvido = scannedCodes.includes(cod);
              const avariaInfo = avariasMap[cod];

              return (
                <div key={cod} className={`bg-white p-4 rounded-xl border-2 ${devolvido ? 'border-teal-400 bg-teal-50/10' : 'border-red-300 bg-red-50/30'} flex flex-col gap-3`}>
                  <div className="flex items-center gap-4">
                    {eq?.fotoUrl ? (
                      <img src={eq.fotoUrl.startsWith('/uploads') ? api(eq.fotoUrl) : eq.fotoUrl} alt={eq.nome} className="w-16 h-16 rounded-lg object-cover" />
                    ) : (
                      <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400"><ImageIcon size={24}/></div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800">{eq?.nome}</h4>
                      <p className="text-sm text-slate-500 font-mono">{cod}</p>
                    </div>
                    <div>
                      {devolvido ? (
                        <span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 size={14}/> Lido</span>
                      ) : (
                        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><AlertOctagon size={14}/> Faltante</span>
                      )}
                    </div>
                  </div>

                  {devolvido ? (
                    <div className="border-t border-slate-100 pt-3 mt-1">
                      <label className="flex items-center gap-2 text-sm font-bold text-red-700 cursor-pointer w-max">
                        <input type="checkbox" checked={avariaInfo?.temAvaria || false} onChange={e => setAvariasMap(prev => ({...prev, [cod]: {...(prev[cod]||{}), temAvaria: e.target.checked}}))} className="rounded border-red-300 text-red-600 focus:ring-red-500"/>
                        Registrar Avaria neste item
                      </label>
                      {avariaInfo?.temAvaria && (
                        <div className="mt-2 space-y-2">
                          <select value={avariaInfo.tipoId || ''} onChange={e => setAvariasMap(prev => ({...prev, [cod]: {...prev[cod], tipoId: e.target.value}}))} className="w-full text-sm rounded-lg border-slate-200">
                            <option value="">Tipo de Avaria (Opcional)</option>
                            {tiposAvaria.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                          </select>
                          <input type="text" placeholder="Descreva o defeito" value={avariaInfo.descricao || ''} onChange={e => setAvariasMap(prev => ({...prev, [cod]: {...prev[cod], descricao: e.target.value}}))} className="w-full text-sm rounded-lg border-slate-200"/>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border-t border-red-100 pt-3 mt-1">
                      <label className="block text-sm font-bold text-red-900 mb-1">Observação do Item Faltante:</label>
                      <input type="text" placeholder="Ex: Esqueceu em casa, vai trazer amanhã" value={faltantesMap[cod] || ''} onChange={e => setFaltantesMap(prev => ({...prev, [cod]: e.target.value}))} className="w-full text-sm rounded-lg border-red-200 bg-white"/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button disabled={submitting} onClick={finalizarDevolucao} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-2xl shadow-md flex justify-center items-center gap-2 disabled:opacity-50">
            {submitting ? 'Processando...' : <><CheckCircle2 size={20}/> Confirmar Recebimento</>}
          </button>
        </motion.div>
      );
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto space-y-6">
      {fase === 1 ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ScanLine size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Scanner de Estoque</h2>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setModo('ENTREGA')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${modo === 'ENTREGA' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
              <PackageCheck size={18} /> Entrega
            </button>
            <button onClick={() => setModo('DEVOLUCAO')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${modo === 'DEVOLUCAO' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
              <LogOut size={18} className="rotate-180"/> Devolução
            </button>
            <button onClick={() => setModo('DEVOLUCAO_GLOBAL')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${modo === 'DEVOLUCAO_GLOBAL' ? 'bg-white shadow-sm text-teal-600' : 'text-slate-500 hover:text-slate-700'}`}>
              <ScanLine size={18} /> Global
            </button>
          </div>

          {modo !== 'DEVOLUCAO_GLOBAL' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">ID da Requisição</label>
              <input value={requisicaoId} onChange={e => setRequisicaoId(e.target.value)} placeholder="Ex: 550e8400-..." className="w-full rounded-xl border-slate-200 shadow-sm p-4 text-center font-mono bg-slate-50" />
            </div>
          )}

          <button onClick={() => { setFase(2); setCameraActive(true); }} disabled={modo !== 'DEVOLUCAO_GLOBAL' && !requisicaoId} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 disabled:opacity-50">
            <ScanLine size={20} /> Iniciar Leitor
          </button>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
          <div className="mb-4 text-center w-full flex flex-col items-center gap-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${modo === 'ENTREGA' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
              {modo === 'ENTREGA' ? 'Separando: Entrega' : modo === 'DEVOLUCAO_GLOBAL' ? 'Recebendo: Devolução Global' : 'Recebendo: Devolução'}
            </span>
            <p className="text-xs text-slate-500">Requisição: {requisicaoId}</p>
          </div>

          <div className="w-full flex justify-end mb-2">
            <button 
              onClick={() => setCameraActive(!cameraActive)} 
              className="text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <ScanLine size={16}/> {cameraActive ? 'Desligar Câmera' : 'Ligar Câmera para Bipar'}
            </button>
          </div>

          {cameraActive && (
            <div id="reader" className="w-full rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50 mb-4"></div>
          )}

          {requisicao && (modo === 'ENTREGA' || modo === 'DEVOLUCAO') && (
            <div className="w-full mb-6 text-left">
              <div className="flex justify-between items-end mb-3">
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">
                  Lista de {modo === 'ENTREGA' ? 'Separação' : 'Devolução'}
                </h3>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(modo === 'ENTREGA' ? requisicao.itens : requisicao.itens.filter((i:any) => i.statusSeparacao && !i.statusDevolucao)).map((item: any) => {
                  const eq = item.equipamento;
                  const isScanned = scannedCodes.includes(eq.codigoPatrimonio);
                  
                  return (
                    <div 
                      key={eq.codigoPatrimonio} 
                      onClick={() => {
                        if (isScanned) {
                          setScannedCodes(prev => prev.filter(c => c !== eq.codigoPatrimonio));
                        } else {
                          setScannedCodes(prev => [...prev, eq.codigoPatrimonio]);
                        }
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isScanned ? 'bg-teal-50 border-teal-400 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isScanned ? 'bg-teal-500 border-teal-500' : 'border-slate-300'}`}>
                        {isScanned && <CheckCircle2 size={14} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold text-sm leading-tight transition-colors ${isScanned ? 'text-teal-900' : 'text-slate-800'}`}>{eq.nome}</p>
                        <p className={`text-xs font-mono mt-0.5 transition-colors ${isScanned ? 'text-teal-700' : 'text-slate-500'}`}>{eq.codigoPatrimonio}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ITENS EXTRAS BIPADOS */}
          {requisicao && scannedCodes.filter(c => !requisicao.itens.find((i:any) => i.equipamento.codigoPatrimonio === c)).length > 0 && (
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
              <p className="text-sm font-bold text-slate-700 mb-2">Itens Extras Adicionados:</p>
              <div className="flex flex-wrap gap-2">
                {scannedCodes.filter(c => !requisicao.itens.find((i:any) => i.equipamento.codigoPatrimonio === c)).map(c => 
                  <span key={c} className="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-1 rounded-md font-mono text-xs">{c}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-4 w-full pt-4 border-t border-slate-100">
            <button onClick={() => { setCameraActive(false); setFase(1); }} className="flex-1 bg-slate-100 text-slate-700 font-bold py-4 rounded-xl transition-colors">Voltar</button>
            <button onClick={() => { setCameraActive(false); setFase(3); }} disabled={scannedCodes.length === 0} className="flex-[2] bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl shadow-md transition-colors flex justify-center items-center gap-2">
              <PackageCheck size={20}/> Ir para Conferência
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
