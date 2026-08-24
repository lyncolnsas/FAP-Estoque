import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ShieldAlert, Image as ImageIcon, QrCode, Printer, X, Edit2, CheckCircle2, Trash2, LayoutGrid, List, Maximize2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import AdminAvarias from './AdminAvarias';
import { api } from '../lib/api';
import { toast } from 'sonner';

export default function AdminEquipamentos() {
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [nome, setNome] = useState('');
  const [codigoPatrimonio, setCodigoPatrimonio] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [categoriaId, setCategoriaId] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [recebeuComDefeito, setRecebeuComDefeito] = useState(false);
  const [avariaId, setAvariaId] = useState('');
  const [permitirEmprestimo, setPermitirEmprestimo] = useState(true);
  const [statusCondicao, setStatusCondicao] = useState('DISPONIVEL');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [showAvariaModal, setShowAvariaModal] = useState(false);
  const [novaAvariaNome, setNovaAvariaNome] = useState('');
  const [novaAvariaDescricao, setNovaAvariaDescricao] = useState('');
  const [isSavingAvaria, setIsSavingAvaria] = useState(false);
  
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  const [tiposAvaria, setTiposAvaria] = useState<any[]>([]);
  const [filtroAvaria, setFiltroAvaria] = useState<string>('');
  const [categoriasList, setCategoriasList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'acervo' | 'avarias'>('acervo');

  // Novos estados para filtros e visualização
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [equipamentoDetalhe, setEquipamentoDetalhe] = useState<any | null>(null);

  const { token, user } = useAuth();

  const carregarEquipamentos = () => {
    fetch(api('/equipamentos'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setEquipamentos)
      .catch(console.error);
  };

  useEffect(() => {
    if (token) {
      carregarEquipamentos();
      fetch(api('/tipos-avaria'), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setTiposAvaria)
        .catch(console.error);
        
      fetch(api('/categorias'), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          setCategoriasList(data);
          if (data.length > 0 && !categoriaId) {
            setCategoriaId(data[0].id);
          }
        })
        .catch(console.error);
    }
  }, [token]);

  const toggleSelect = (id: string) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selecionados.length === equipamentos.length) {
      setSelecionados([]);
    } else {
      setSelecionados(equipamentos.map(e => e.id));
    }
  };

  const handleEdit = (eq: any) => {
    setEditandoId(eq.id);
    setNome(eq.nome);
    setCodigoPatrimonio(eq.codigoPatrimonio);
    setCategoriaId(eq.categoriaId || '');
    setTipoId(eq.tipoId || '');
    setStatusCondicao(eq.statusCondicao);
    setPermitirEmprestimo(eq.permitirEmprestimo !== undefined ? eq.permitirEmprestimo : true);
    setFotoFile(null); // Ignora a foto antiga no input file, se quiser mudar, ele envia uma nova
    setFotoPreview(eq.fotoUrl || null);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setNome('');
    setCodigoPatrimonio('');
    setQuantidade(1);
    if (categoriasList.length > 0) setCategoriaId(categoriasList[0].id);
    setTipoId('');
    setRecebeuComDefeito(false);
    setAvariaId('');
    setPermitirEmprestimo(true);
    setStatusCondicao('DISPONIVEL');
    setFotoFile(null);
    setFotoPreview(null);
  };



  const handleCriarOuEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let fotoUrl = null;

      // 1. Upload da foto se houver
      if (fotoFile) {
        const formData = new FormData();
        formData.append('file', fotoFile);
        const uploadRes = await fetch(api('/upload'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          fotoUrl = uploadData.url;
        }
      }

      if (editandoId) {
        // Enviar PUT
        const bodyReq: any = { nome, codigoPatrimonio, categoriaId, tipoId, statusCondicao, permitirEmprestimo };
        if (fotoUrl) bodyReq.fotoUrl = fotoUrl;
        if (avariaId) bodyReq.avariaId = avariaId;

        const reqRes = await fetch(api(`/equipamentos/${editandoId}`), {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(bodyReq)
        });
        if (!reqRes.ok) {
          const err = await reqRes.json();
          throw new Error(err.error || 'Erro ao atualizar equipamento');
        }
        toast.success('Equipamento atualizado com sucesso!');
      } else {
        // Criar equipamento
        const reqRes = await fetch(api('/equipamentos'), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ nome, quantidade: Number(quantidade), categoriaId, tipoId, recebeuComDefeito, avariaId: recebeuComDefeito ? avariaId : undefined, permitirEmprestimo, fotoUrl })
        });
        if (!reqRes.ok) {
          const err = await reqRes.json();
          throw new Error(err.error || 'Erro ao criar equipamento');
        }
        toast.success('Equipamento cadastrado com sucesso!');
      }
      
      cancelarEdicao();
      carregarEquipamentos();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar equipamento');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    toast.warning('Tem certeza que deseja excluir este equipamento? Todo o histórico de avarias e requisições vinculadas também serão removidos. Esta ação não pode ser desfeita.', {
      action: {
        label: 'Excluir',
        onClick: async () => {
          try {
            const reqRes = await fetch(api(`/equipamentos/${id}`), {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (!reqRes.ok) {
              const err = await reqRes.json();
              throw new Error(err.error || 'Erro ao excluir equipamento');
            }
            toast.success('Equipamento excluído com sucesso');
            carregarEquipamentos();
          } catch (err: any) {
            toast.error(err.message || 'Erro ao excluir equipamento');
          }
        }
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const equipamentosFiltrados = equipamentos.filter(eq => {
    if (filtroCategoria && eq.categoriaId !== filtroCategoria) return false;
    if (filtroTipo && eq.tipoId !== filtroTipo) return false;
    if (filtroAvaria) {
      if (filtroAvaria === 'COM_DEFEITO') return eq.statusCondicao === 'COM_DEFEITO';
      return eq.historicoAvarias?.some((h: any) => h.tipoAvariaId === filtroAvaria && !h.resolvido);
    }
    return true;
  });

  if (user?.role !== 'ADMIN') {
    return (
      <div className="text-center mt-20 text-red-400">
        <ShieldAlert size={48} className="mx-auto mb-4" />
        <h2 className="text-2xl font-bold">Acesso Negado</h2>
        <p>Você não tem permissão de Administrador.</p>
      </div>
    );
  }

  if (activeTab === 'avarias') {
    return (
      <div className="space-y-4">
        <div className="print:hidden flex gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 max-w-fit mx-auto mb-4">
          <button onClick={() => setActiveTab('acervo')} className="px-6 py-2 rounded-xl text-slate-500 hover:text-slate-800 font-medium transition-colors">Acervo</button>
          <button className="px-6 py-2 rounded-xl bg-blue-50 text-blue-600 font-medium transition-colors">Tipos de Avaria</button>
        </div>
        <AdminAvarias />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-8">
      <div className="print:hidden flex gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 max-w-fit mx-auto mb-4">
        <button className="px-6 py-2 rounded-xl bg-blue-50 text-blue-600 font-medium transition-colors">Acervo</button>
        <button onClick={() => setActiveTab('avarias')} className="px-6 py-2 rounded-xl text-slate-500 hover:text-slate-800 font-medium transition-colors">Tipos de Avaria</button>
      </div>
      
      {/* Esconde tudo que não é modal durante a impressão */}
      <div className="print:hidden flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Acervo de Equipamentos</h1>
          <p className="text-slate-500 mt-1">Gerencie materiais e imprima etiquetas QR Code.</p>
        </div>
        {selecionados.length > 0 && (
          <button 
            onClick={() => setShowPrintModal(true)}
            className="bg-slate-800 hover:bg-slate-900 text-white font-medium py-2 px-4 rounded-xl shadow-sm flex items-center gap-2 transition-colors"
          >
            <QrCode size={18} /> Imprimir {selecionados.length} Etiquetas
          </button>
        )}
      </div>

      <div className="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleCriarOuEditar} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 relative">
            {editandoId && (
              <button type="button" onClick={cancelarEdicao} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            )}
            
            <h3 className="text-xl font-bold text-slate-800 mb-4">{editandoId ? 'Editar Material' : 'Novo Material'}</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{editandoId ? 'Nova Foto (Opcional)' : 'Foto (Opcional)'}</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 transition-colors relative overflow-hidden flex flex-col items-center justify-center">
                <input type="file" accept="image/*" onChange={async e => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    try {
                      const compressedFile = await imageCompression(file, {
                        maxSizeMB: 0.5,
                        maxWidthOrHeight: 1024,
                        useWebWorker: true
                      });
                      setFotoFile(compressedFile as File);
                      setFotoPreview(URL.createObjectURL(compressedFile));
                    } catch (err) {
                      console.error('Erro ao comprimir imagem:', err);
                    }
                  } else {
                    setFotoFile(null);
                    setFotoPreview(editandoId ? equipamentos.find(eq => eq.id === editandoId)?.fotoUrl || null : null);
                  }
                }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                {fotoPreview ? (
                  <div className="w-full h-32 relative">
                    <img src={fotoPreview.startsWith('/uploads') ? api(fotoPreview) : fotoPreview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                  </div>
                ) : (
                  <span className="text-sm text-slate-500 flex flex-col items-center gap-1">
                    <ImageIcon size={20} className="text-slate-400"/>
                    Clique ou arraste uma foto
                  </span>
                )}
                {fotoFile && !fotoPreview && (
                   <span className="text-sm font-medium text-blue-600 flex items-center justify-center gap-2 mt-2">
                     <ImageIcon size={16}/> {fotoFile.name}
                   </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
              <input required value={nome} onChange={e => setNome(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" placeholder="Ex: Câmera Sony A7III" />
            </div>
            
            {!editandoId ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade a Cadastrar</label>
                <div className="flex flex-col xl:flex-row gap-2">
                  <input type="number" min="1" required value={quantidade} onChange={e => setQuantidade(Number(e.target.value))} className="w-full xl:flex-1 rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" placeholder="Ex: 10" />
                  <div className="w-full xl:w-auto bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-xs font-medium flex items-center justify-center whitespace-nowrap text-center">
                    Gerará {quantidade} código(s) automático(s)
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Patrimônio / N.S.</label>
                <input required value={codigoPatrimonio} onChange={e => setCodigoPatrimonio(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 bg-slate-50 text-slate-500" placeholder="Ex: CAM-001" disabled />
                <p className="text-[10px] text-slate-400 mt-1">O código de patrimônio não pode ser alterado após o cadastro.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                <select value={categoriaId} onChange={e => { setCategoriaId(e.target.value); setTipoId(''); }} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2">
                  <option value="">Selecione...</option>
                  {categoriasList.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select value={tipoId} onChange={e => setTipoId(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2">
                  <option value="">Selecione o tipo...</option>
                  {categoriasList.find(c => c.id === categoriaId)?.tipos?.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {editandoId ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status Conservação</label>
                  <select value={statusCondicao} onChange={e => setStatusCondicao(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2">
                    <option value="DISPONIVEL">Disponível</option>
                    <option value="EMPRESTADO">Emprestado</option>
                    <option value="COM_DEFEITO">Com Defeito</option>
                    <option value="INDISPONIVEL">Indisponível (Perdido/Quebrado)</option>
                    <option value="EM_MANUTENCAO">Em Manutenção</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deseja registrar uma avaria?</label>
                  <div className="flex gap-2">
                    <select value={avariaId} onChange={e => setAvariaId(e.target.value)} className="flex-1 rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2">
                      <option value="">Nenhuma / Sem nova avaria</option>
                      {tiposAvaria.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowAvariaModal(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 rounded-xl text-sm font-medium transition-colors" title="Adicionar Novo Tipo de Avaria">
                      + Novo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer mt-4 bg-red-50 p-3 rounded-xl border border-red-100">
                  <input type="checkbox" checked={recebeuComDefeito} onChange={e => { setRecebeuComDefeito(e.target.checked); if(!e.target.checked) setAvariaId(''); }} className="rounded text-red-600 focus:ring-red-500" />
                  <span className="text-sm font-medium text-red-900">Registrar com defeito inicial</span>
                </label>
                {recebeuComDefeito && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Qual é a avaria?</label>
                    <div className="flex gap-2">
                      <select value={avariaId} onChange={e => setAvariaId(e.target.value)} className="flex-1 rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" required>
                        <option value="">Selecione a avaria...</option>
                        {tiposAvaria.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </select>
                      <button type="button" onClick={() => setShowAvariaModal(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 rounded-xl text-sm font-medium transition-colors" title="Adicionar Novo Tipo de Avaria">
                        + Novo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer mt-4 bg-blue-50 p-3 rounded-xl border border-blue-100">
              <input type="checkbox" checked={permitirEmprestimo} onChange={e => setPermitirEmprestimo(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
              <span className="text-sm font-medium text-blue-900">Visível para Solicitação (Empréstimo Público)</span>
            </label>

            <button disabled={isUploading} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 mt-4">
              {isUploading ? 'Salvando...' : editandoId ? <><CheckCircle2 size={20} /> Salvar Alterações</> : <><Plus size={20} /> Cadastrar Equipamento</>}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center flex-1">
              <select 
                value={filtroCategoria} 
                onChange={e => { setFiltroCategoria(e.target.value); setFiltroTipo(''); }}
                className="rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 bg-slate-50 min-w-[150px]"
              >
                <option value="">Todas as Categorias</option>
                {categoriasList.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>

              <select 
                value={filtroTipo} 
                onChange={e => setFiltroTipo(e.target.value)}
                className="rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 bg-slate-50 min-w-[150px]"
                disabled={!filtroCategoria}
              >
                <option value="">Todos os Tipos</option>
                {categoriasList.find(c => c.id === filtroCategoria)?.tipos?.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>

              <select 
                value={filtroAvaria} 
                onChange={e => setFiltroAvaria(e.target.value)}
                className="rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 bg-slate-50 min-w-[150px]"
              >
                <option value="">Filtro Avaria: Todos</option>
                <option value="COM_DEFEITO">Qualquer Defeito</option>
                {tiposAvaria.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('table')} 
                className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                title="Visualização em Tabela"
              >
                <List size={20} />
              </button>
              <button 
                onClick={() => setViewMode('grid')} 
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                title="Visualização em Grade"
              >
                <LayoutGrid size={20} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="hidden md:table-header-group bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">
                        <input type="checkbox" className="rounded text-blue-600" onChange={selectAll} checked={selecionados.length === equipamentos.length && equipamentos.length > 0} />
                      </th>
                      <th className="px-6 py-4">Equipamento</th>
                      <th className="px-6 py-4">Patrimônio</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 block md:table-row-group">
                    {equipamentosFiltrados.map((eq) => (
                      <tr key={eq.id} className={`block md:table-row hover:bg-slate-50 transition-colors cursor-pointer border-b md:border-b-0 border-slate-100 ${selecionados.includes(eq.id) ? 'bg-blue-50/50' : ''}`} onClick={(e) => { if ((e.target as any).tagName !== 'INPUT' && (e.target as any).tagName !== 'BUTTON' && !(e.target as any).closest('button')) setEquipamentoDetalhe(eq); }}>
                        <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell md:w-auto">
                          <div className="flex items-center justify-between md:justify-start gap-4">
                            <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Selecionar</span>
                            <input type="checkbox" className="rounded text-blue-600" checked={selecionados.includes(eq.id)} onChange={() => toggleSelect(eq.id)} onClick={(e) => e.stopPropagation()} />
                          </div>
                        </td>
                        <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                          <div className="flex items-center gap-3">
                            {eq.fotoUrl ? (
                              <img src={eq.fotoUrl.startsWith('/uploads') ? api(eq.fotoUrl) : eq.fotoUrl} alt={eq.nome} className="w-12 h-12 md:w-10 md:h-10 rounded-lg object-cover bg-slate-100 border border-slate-200" />
                            ) : (
                              <div className="w-12 h-12 md:w-10 md:h-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                                <ImageIcon size={16} className="text-slate-400" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-slate-900">{eq.nome}</div>
                              <div className="text-xs text-slate-500">{eq.categoria?.nome} • {eq.tipo?.nome}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                           <div className="flex justify-between items-center md:block">
                             <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Patrimônio</span>
                             <span className="font-mono text-xs text-slate-700 bg-slate-100 md:bg-transparent px-2 py-1 md:p-0 rounded">{eq.codigoPatrimonio}</span>
                           </div>
                        </td>
                        <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                          <div className="flex justify-between items-center md:block">
                            <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Status</span>
                            <div>
                              {eq.statusCondicao === 'DISPONIVEL' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Disponível</span>}
                              {eq.statusCondicao === 'EMPRESTADO' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Emprestado</span>}
                              {eq.statusCondicao === 'COM_DEFEITO' && (
                                <div className="flex flex-col gap-1 items-end md:items-start">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 w-fit">Com Defeito</span>
                                  {eq.historicoAvarias?.map((h: any) => (
                                    <span key={h.id} className="text-[10px] text-red-600 truncate max-w-[150px]" title={h.tipoAvaria?.nome || h.descricao}>
                                      • {h.tipoAvaria?.nome || 'Avaria Geral'}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-t md:border-t-0 border-slate-50 md:text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(eq); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 p-2 rounded-lg bg-blue-50 md:bg-transparent md:hover:bg-blue-50 transition-colors font-medium" title="Editar">
                              <Edit2 size={16} /> <span className="md:hidden text-sm">Editar</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(eq.id); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 text-red-600 hover:text-red-800 p-2 rounded-lg bg-red-50 md:bg-transparent md:hover:bg-red-50 transition-colors font-medium" title="Excluir">
                              <Trash2 size={16} /> <span className="md:hidden text-sm">Excluir</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {equipamentosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Nenhum equipamento cadastrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 bg-slate-50">
                {equipamentosFiltrados.map((eq) => (
                  <div 
                    key={eq.id} 
                    onClick={() => setEquipamentoDetalhe(eq)}
                    className={`relative flex flex-col bg-white rounded-2xl shadow-sm border ${selecionados.includes(eq.id) ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'} p-4 cursor-pointer hover:shadow-md transition-all`}
                  >
                    <div className="absolute top-4 left-4 z-10">
                      <input type="checkbox" className="rounded text-blue-600 w-5 h-5 shadow-sm" checked={selecionados.includes(eq.id)} onChange={() => toggleSelect(eq.id)} onClick={(e) => e.stopPropagation()} />
                    </div>
                    
                    <div className="w-full h-40 bg-slate-100 rounded-xl mb-4 overflow-hidden flex items-center justify-center relative group">
                      {eq.fotoUrl ? (
                        <img src={eq.fotoUrl.startsWith('/uploads') ? api(eq.fotoUrl) : eq.fotoUrl} alt={eq.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <ImageIcon size={48} className="text-slate-300" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" size={32} />
                      </div>
                    </div>
                    
                    <h4 className="font-bold text-slate-800 line-clamp-1">{eq.nome}</h4>
                    <p className="text-xs text-slate-500 mt-1">{eq.categoria?.nome} • {eq.tipo?.nome}</p>
                    <p className="text-xs font-mono text-slate-600 mt-2 bg-slate-50 px-2 py-1 rounded w-fit border border-slate-100">{eq.codigoPatrimonio}</p>
                    
                    <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-100">
                      <div>
                        {eq.statusCondicao === 'DISPONIVEL' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Disponível</span>}
                        {eq.statusCondicao === 'EMPRESTADO' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Emprestado</span>}
                        {eq.statusCondicao === 'COM_DEFEITO' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Com Defeito</span>}
                      </div>
                      
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(eq); }} className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors" title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(eq.id); }} className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {equipamentosFiltrados.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-500">Nenhum equipamento cadastrado.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE IMPRESSÃO */}
      <AnimatePresence>
        {showPrintModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white sm:bg-slate-900/50 sm:backdrop-blur-sm overflow-y-auto print:bg-white print:static print:block"
          >
            <div className="min-h-screen sm:py-8 px-4 sm:px-6 lg:px-8 print:p-0">
              <div className="bg-white sm:max-w-4xl sm:mx-auto sm:rounded-2xl sm:shadow-2xl print:shadow-none print:max-w-full">
                
                <div className="print:hidden flex justify-between items-center p-6 border-b border-slate-100">
                  <h2 className="text-xl font-bold text-slate-800">Visualização de Etiquetas</h2>
                  <div className="flex items-center gap-3">
                    <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors">
                      <Printer size={16} /> Imprimir Agora
                    </button>
                    <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-slate-600 p-2">
                      <X size={24} />
                    </button>
                  </div>
                </div>

                <div className="p-8 print:p-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
                    {equipamentos.filter(eq => selecionados.includes(eq.id)).map(eq => (
                      <div key={eq.id} className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center print:break-inside-avoid print:border-solid print:border-black">
                        <QRCodeSVG 
                          value={`${window.location.origin}/equipamento/${eq.codigoPatrimonio}`} 
                          size={120}
                          level="H"
                          includeMargin={false}
                        />
                        <div className="mt-3">
                          <p className="font-bold text-xs text-slate-900 leading-tight print:text-black">{eq.codigoPatrimonio}</p>
                          <p className="text-[10px] text-slate-500 truncate w-full max-w-[120px] print:text-black">{eq.nome}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL NOVA AVARIA */}
      <AnimatePresence>
        {showAvariaModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 print:hidden"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative"
            >
              <button onClick={() => setShowAvariaModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              
              <h3 className="text-xl font-bold text-slate-800 mb-4">Novo Tipo de Avaria</h3>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingAvaria(true);
                try {
                  const res = await fetch(api('/tipos-avaria'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ nome: novaAvariaNome, descricao: novaAvariaDescricao })
                  });
                  if (res.ok) {
                    const novo = await res.json();
                    setTiposAvaria(prev => [...prev, novo]);
                    setAvariaId(novo.id);
                    setShowAvariaModal(false);
                    setNovaAvariaNome('');
                    setNovaAvariaDescricao('');
                    toast.success('Tipo de avaria criado com sucesso!');
                  } else {
                    toast.error("Erro ao criar tipo de avaria");
                  }
                } catch(err) {
                  toast.error("Erro ao criar tipo de avaria");
                } finally {
                  setIsSavingAvaria(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Avaria</label>
                  <input required value={novaAvariaNome} onChange={e => setNovaAvariaNome(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" placeholder="Ex: Tela trincada" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (Opcional)</label>
                  <textarea rows={3} value={novaAvariaDescricao} onChange={e => setNovaAvariaDescricao(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" placeholder="Detalhes adicionais..." />
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setShowAvariaModal(false)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors">Cancelar</button>
                  <button type="submit" disabled={isSavingAvaria} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {isSavingAvaria ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL DETALHE EQUIPAMENTO */}
      <AnimatePresence>
        {equipamentoDetalhe && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEquipamentoDetalhe(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 flex items-center justify-between p-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">Detalhes do Equipamento</h3>
                <button onClick={() => setEquipamentoDetalhe(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-1/2">
                    <div className="bg-slate-100 rounded-2xl overflow-hidden aspect-square flex items-center justify-center border border-slate-200">
                      {equipamentoDetalhe.fotoUrl ? (
                        <img 
                          src={equipamentoDetalhe.fotoUrl.startsWith('/uploads') ? api(equipamentoDetalhe.fotoUrl) : equipamentoDetalhe.fotoUrl} 
                          alt={equipamentoDetalhe.nome} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <ImageIcon size={64} className="text-slate-300" />
                      )}
                    </div>
                  </div>
                  
                  <div className="w-full md:w-1/2 space-y-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 leading-tight">{equipamentoDetalhe.nome}</h2>
                      <div className="flex gap-2 mt-2">
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{equipamentoDetalhe.categoria?.nome}</span>
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">{equipamentoDetalhe.tipo?.nome}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Patrimônio</p>
                        <p className="font-mono text-slate-800 mt-1">{equipamentoDetalhe.codigoPatrimonio}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Status Atual</p>
                        <div className="mt-1">
                          {equipamentoDetalhe.statusCondicao === 'DISPONIVEL' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Disponível</span>}
                          {equipamentoDetalhe.statusCondicao === 'EMPRESTADO' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Emprestado</span>}
                          {equipamentoDetalhe.statusCondicao === 'COM_DEFEITO' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Com Defeito</span>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Permite Empréstimo?</p>
                      <p className="text-slate-800 mt-1">{equipamentoDetalhe.permitirEmprestimo ? 'Sim' : 'Não'}</p>
                    </div>

                    {equipamentoDetalhe.historicoAvarias && equipamentoDetalhe.historicoAvarias.length > 0 && (
                      <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-2 flex items-center gap-1"><ShieldAlert size={14} className="text-red-500" /> Histórico de Avarias</p>
                        <ul className="space-y-2">
                          {equipamentoDetalhe.historicoAvarias.map((avaria: any) => (
                            <li key={avaria.id} className="text-sm bg-red-50 text-red-800 p-3 rounded-lg border border-red-100">
                              <div className="font-semibold">{avaria.tipoAvaria?.nome || 'Avaria Geral'}</div>
                              {avaria.descricao && <div className="text-xs mt-1 opacity-80">{avaria.descricao}</div>}
                              <div className="text-[10px] mt-2 opacity-60">Registrado em {new Date(avaria.dataRegistro).toLocaleDateString()}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
