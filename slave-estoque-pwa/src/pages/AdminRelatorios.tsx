import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  FileText, Download, TrendingUp, AlertTriangle, Package, CheckCircle, Clock, Users, Wrench, Activity
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../lib/api';

interface RelatorioGeral {
  resumo: {
    totalEquipamentos: number;
    equipamentosComDefeito: number;
    equipamentosEmprestados: number;
    equipamentosDisponiveis: number;
    equipamentosBaixados: number;
  };
  rankingUsuarios: { nome: string, totalRequisicoes: number, totalItensEmprestados: number }[];
  equipamentos: any[];
  historicoAvarias: any[];
  requisicoes: any[];
}

export default function AdminRelatorios() {
  const [data, setData] = useState<RelatorioGeral | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('visao-geral');
  const { token } = useAuth();

  useEffect(() => {
    fetchRelatorio();
  }, []);

  const fetchRelatorio = async () => {
    try {
      const response = await fetch(api('/relatorios/geral'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const json = await response.json();
        setData(json);
      } else {
        console.error('Falha ao buscar relatório');
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    if (!data) return;

    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();

    // Título
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text('Relatório Geral - Controle de Estoque', pageWidth / 2, 40, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, 55, { align: 'center' });

    // Resumo
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('1. Resumo do Acervo', 40, 90);

    const resumoBody = [
      ['Total de Equipamentos', data.resumo.totalEquipamentos.toString()],
      ['Equipamentos em Funcionamento (Disp.)', data.resumo.equipamentosDisponiveis.toString()],
      ['Equipamentos Emprestados', data.resumo.equipamentosEmprestados.toString()],
      ['Equipamentos em Manutenção/Avaria', (data.resumo.equipamentosComDefeito || 0).toString()],
      ['Equipamentos Dados Baixa', (data.resumo.equipamentosBaixados || 0).toString()],
    ];

    autoTable(doc, {
      startY: 100,
      head: [['Métrica', 'Quantidade']],
      body: resumoBody,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }
    });

    // Avarias Recentes
    const finalYResumo = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(14);
    doc.text('2. Últimas Avarias Registradas', 40, finalYResumo + 30);

    const avariasBody = data.historicoAvarias.map(avaria => [
      new Date(avaria.dataRegistro).toLocaleDateString('pt-BR'),
      avaria.equipamento?.nome || 'N/A',
      avaria.equipamento?.codigoPatrimonio || 'N/A',
      avaria.descricao
    ]);

    autoTable(doc, {
      startY: finalYResumo + 40,
      head: [['Data', 'Equipamento', 'Patrimônio', 'Descrição da Avaria']],
      body: avariasBody,
      theme: 'striped',
      headStyles: { fillColor: [231, 76, 60] }
    });

    // Ranking Usuários
    const finalYAvarias = (doc as any).lastAutoTable.finalY || 250;
    doc.setFontSize(14);
    doc.text('3. Ranking de Usuários (Quem mais pegou)', 40, finalYAvarias + 30);

    const rankingUsuariosArray = data.rankingUsuarios || [];
    const rankingBody = rankingUsuariosArray.map(u => [
      u.nome || 'Desconhecido',
      (u.totalRequisicoes || 0).toString(),
      (u.totalItensEmprestados || 0).toString()
    ]);

    autoTable(doc, {
      startY: finalYAvarias + 40,
      head: [['Solicitante', 'Qtd. Requisições (Vezes que pegou)', 'Total de Itens Pegos']],
      body: rankingBody,
      theme: 'striped',
      headStyles: { fillColor: [155, 89, 182] }
    });

    // Requisições Pendentes/Ativas
    const finalYRanking = (doc as any).lastAutoTable.finalY || 250;
    doc.setFontSize(14);
    doc.text('4. Requisições Ativas', 40, finalYRanking + 30);

    const reqsBody = data.requisicoes.map(req => [
      new Date(req.criadoEm).toLocaleDateString('pt-BR'),
      req.solicitanteNome,
      req.departamento,
      req.status,
      req.itens?.length?.toString() || '0'
    ]);

    autoTable(doc, {
      startY: finalYRanking + 40,
      head: [['Data Solicitação', 'Solicitante', 'Departamento', 'Status', 'Qtd. Itens']],
      body: reqsBody,
      theme: 'striped',
      headStyles: { fillColor: [46, 204, 113] }
    });

    // Aparelhos Emprestados
    doc.addPage();
    doc.setFontSize(14);
    doc.text('5. Aparelhos Emprestados', 40, 40);

    const emprestados = data.equipamentos.filter(e => e.statusCondicao === 'EMPRESTADO');
    const emprestadosBody = emprestados.map(eq => {
      const activeReq = eq.itensRequisicao?.[0]?.requisicao;
      return [
        eq.nome,
        eq.codigoPatrimonio,
        activeReq ? activeReq.solicitanteNome : 'N/A',
        activeReq ? new Date(activeReq.dataInicioEvento).toLocaleDateString('pt-BR') : 'N/A',
        (eq.quantidadeUso || 0).toString()
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [['Equipamento', 'Patrimônio', 'Quem Pegou', 'Data Início', 'Vezes Usado']],
      body: emprestadosBody,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] }
    });

    // Aparelhos com Defeito / Avaria
    const finalYEmprestados = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(14);
    doc.text('6. Aparelhos em Manutenção / Com Avaria', 40, finalYEmprestados + 30);

    const comDefeito = data.equipamentos.filter(e => 
      e.statusCondicao === 'COM_DEFEITO' || 
      e.recebeuComDefeito || 
      (e.historicoAvarias && e.historicoAvarias.some((a: any) => !a.resolvido))
    );
    
    const comDefeitoBody = comDefeito.map(eq => {
      const avariaAtiva = eq.historicoAvarias?.find((a: any) => !a.resolvido);
      let motivo = 'Sinalizado com defeito';
      if (avariaAtiva) motivo = avariaAtiva.descricao;
      else if (eq.recebeuComDefeito) motivo = 'Recebido com defeito';
      
      return [
        eq.nome,
        eq.codigoPatrimonio,
        eq.statusCondicao,
        motivo,
        (eq.historicoAvarias?.length || 0).toString()
      ];
    });

    autoTable(doc, {
      startY: finalYEmprestados + 40,
      head: [['Equipamento', 'Patrimônio', 'Status', 'Avaria/Motivo', 'Vezes na Manutenção']],
      body: comDefeitoBody,
      theme: 'striped',
      headStyles: { fillColor: [231, 76, 60] }
    });

    // Salvando
    doc.save('relatorio-analitico-estoque.pdf');
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando dados do relatório...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Erro ao carregar os dados.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-blue-500" /> Relatórios
          </h2>
          <p className="text-slate-500">Visão consolidada e exportação de dados.</p>
        </div>
        <button 
          onClick={exportPDF}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition shadow-sm"
        >
          <Download size={20} />
          Exportar para PDF
        </button>
      </div>

      {/* Navegação por Abas */}
      <div className="flex overflow-x-auto border-b border-slate-200 gap-8 hide-scrollbar">
        <button 
          onClick={() => setActiveTab('visao-geral')}
          className={`pb-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === 'visao-geral' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Activity size={18} /> Visão Geral
        </button>
        <button 
          onClick={() => setActiveTab('emprestados')}
          className={`pb-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === 'emprestados' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <TrendingUp size={18} /> Itens Emprestados
        </button>
        <button 
          onClick={() => setActiveTab('avarias')}
          className={`pb-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === 'avarias' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Wrench size={18} /> Em Manutenção / Avarias
        </button>
        <button 
          onClick={() => setActiveTab('ranking')}
          className={`pb-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === 'ranking' ? 'border-purple-500 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Users size={18} /> Ranking de Usuários
        </button>
      </div>

      {activeTab === 'visao-geral' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Package size={24} /></div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Acervo</p>
                <p className="text-2xl font-bold text-slate-800">{data.resumo.totalEquipamentos}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-green-100 text-green-600 rounded-lg"><CheckCircle size={24} /></div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Disponíveis</p>
                <p className="text-2xl font-bold text-slate-800">{data.resumo.equipamentosDisponiveis}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-lg"><TrendingUp size={24} /></div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Emprestados</p>
                <p className="text-2xl font-bold text-slate-800">{data.resumo.equipamentosEmprestados}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-lg"><AlertTriangle size={24} /></div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Com Defeito</p>
                <p className="text-2xl font-bold text-slate-800">{data.resumo.equipamentosComDefeito}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-slate-100 text-slate-600 rounded-lg"><FileText size={24} /></div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Baixados</p>
                <p className="text-2xl font-bold text-slate-800">{data.resumo.equipamentosBaixados || 0}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" /> Últimas Avarias
              </h3>
              <div className="space-y-4">
                {data.historicoAvarias.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nenhuma avaria recente.</p>
                ) : (
                  data.historicoAvarias.slice(0, 5).map(avaria => (
                    <div key={avaria.id} className="p-3 border border-slate-100 rounded-lg text-sm">
                      <div className="flex justify-between font-medium text-slate-800">
                        <span>{avaria.equipamento?.nome}</span>
                        <span className="text-slate-500 text-xs">{new Date(avaria.dataRegistro).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-600 mt-1">{avaria.descricao}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={20} className="text-blue-500" /> Requisições Ativas
              </h3>
              <div className="space-y-4">
                {data.requisicoes.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nenhuma requisição ativa.</p>
                ) : (
                  data.requisicoes.slice(0, 5).map(req => (
                    <div key={req.id} className="p-3 border border-slate-100 rounded-lg flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-slate-800">{req.solicitanteNome}</p>
                        <p className="text-slate-500">{req.departamento}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                          {req.status}
                        </span>
                        <p className="text-slate-500 text-xs mt-1">{new Date(req.criadoEm).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'emprestados' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                  <th className="p-4 font-medium">Equipamento</th>
                  <th className="p-4 font-medium">Patrimônio</th>
                  <th className="p-4 font-medium">Responsável Atual</th>
                  <th className="p-4 font-medium">Data Empréstimo</th>
                  <th className="p-4 font-medium text-center">Frequência de Uso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.equipamentos.filter(e => e.statusCondicao === 'EMPRESTADO').length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">Nenhum equipamento emprestado no momento.</td>
                  </tr>
                ) : (
                  data.equipamentos.filter(e => e.statusCondicao === 'EMPRESTADO').map(eq => {
                    const activeReq = eq.itensRequisicao?.[0]?.requisicao;
                    return (
                      <tr key={eq.id} className="hover:bg-slate-50 transition-colors text-sm">
                        <td className="p-4 font-medium text-slate-800">{eq.nome}</td>
                        <td className="p-4 text-slate-600">{eq.codigoPatrimonio}</td>
                        <td className="p-4 text-slate-600">{activeReq ? activeReq.solicitanteNome : 'N/A'}</td>
                        <td className="p-4 text-slate-600">{activeReq ? new Date(activeReq.dataInicioEvento).toLocaleDateString('pt-BR') : 'N/A'}</td>
                        <td className="p-4 text-center">
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium text-xs">
                            {eq.quantidadeUso || 0} vezes
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'avarias' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                  <th className="p-4 font-medium">Equipamento</th>
                  <th className="p-4 font-medium">Patrimônio</th>
                  <th className="p-4 font-medium">Status Atual</th>
                  <th className="p-4 font-medium">Motivo / Última Avaria</th>
                  <th className="p-4 font-medium text-center">Vezes na Manutenção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.equipamentos.filter(e => e.statusCondicao === 'COM_DEFEITO' || e.recebeuComDefeito || (e.historicoAvarias && e.historicoAvarias.some((a: any) => !a.resolvido))).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">Nenhum equipamento com avaria registrado.</td>
                  </tr>
                ) : (
                  data.equipamentos.filter(e => e.statusCondicao === 'COM_DEFEITO' || e.recebeuComDefeito || (e.historicoAvarias && e.historicoAvarias.some((a: any) => !a.resolvido))).map(eq => {
                    const avariaAtiva = eq.historicoAvarias?.find((a: any) => !a.resolvido);
                    let motivo = 'Sinalizado com defeito';
                    if (avariaAtiva) motivo = avariaAtiva.descricao;
                    else if (eq.recebeuComDefeito) motivo = 'Recebido com defeito';
                    
                    return (
                      <tr key={eq.id} className="hover:bg-slate-50 transition-colors text-sm">
                        <td className="p-4 font-medium text-slate-800">{eq.nome}</td>
                        <td className="p-4 text-slate-600">{eq.codigoPatrimonio}</td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-red-50 text-red-700 rounded-md font-medium text-xs uppercase tracking-wider">
                            {eq.statusCondicao.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 max-w-md truncate" title={motivo}>{motivo}</td>
                        <td className="p-4 text-center">
                          <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full font-medium text-xs">
                            {eq.historicoAvarias?.length || 0} vezes
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ranking' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {(!data.rankingUsuarios || data.rankingUsuarios.length === 0) ? (
            <div className="col-span-full p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-100">
              Nenhum dado de ranking disponível.
            </div>
          ) : (
            data.rankingUsuarios.map((u, idx) => (
              <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                {idx === 0 && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-100 flex items-start justify-end p-2 rounded-bl-full">
                    <span className="text-yellow-600 font-bold text-lg">#1</span>
                  </div>
                )}
                {idx === 1 && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-slate-100 flex items-start justify-end p-2 rounded-bl-full">
                    <span className="text-slate-500 font-bold text-lg">#2</span>
                  </div>
                )}
                {idx === 2 && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 flex items-start justify-end p-2 rounded-bl-full">
                    <span className="text-orange-700 font-bold text-lg">#3</span>
                  </div>
                )}
                {idx > 2 && (
                  <div className="absolute top-4 right-4 text-slate-300 font-bold">
                    #{idx + 1}
                  </div>
                )}
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  {(u.nome || 'U')[0].toUpperCase()}
                </div>
                <h4 className="text-lg font-bold text-slate-800 mb-1">{u.nome || 'Desconhecido'}</h4>
                
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Requisições Totais</span>
                    <span className="font-bold text-slate-700">{u.totalRequisicoes || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Itens Pegos</span>
                    <span className="font-bold text-slate-700">{u.totalItensEmprestados || 0}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
