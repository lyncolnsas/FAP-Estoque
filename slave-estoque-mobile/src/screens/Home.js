import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  TextInput,
  Image,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  StatusBar
} from 'react-native';
import { db } from '../db/database';
import { syncPull, syncPush, API_URL, setApiUrl, getApiUrl, getApiMemory, handshake } from '../services/api';
import { scanNetworkForServer } from '../services/discovery';
import { imprimirComprovante, imprimirEtiqueta } from '../services/printer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings, Upload, Download, PlusCircle, AlertTriangle, RefreshCw, Package, Printer, Server, Search, HandshakeIcon, Tag, Building2, Calendar, Wrench, FolderPlus, Layers, Edit3, QrCode, X } from 'lucide-react-native';

export default function HomeScreen({ navigation, route }) {
  const [activeTab, setActiveTab] = useState('DASHBOARD'); // 'DASHBOARD' | 'ACERVO' | 'AVARIAS' | 'REQUISICOES' | 'ACOES'
  const [offlineLogs, setOfflineLogs] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [avarias, setAvarias] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [requisicoes, setRequisicoes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showAutoConnect, setShowAutoConnect] = useState(false);
  const [autoConnecting, setAutoConnecting] = useState(false);
  
  // Senha de Autenticação Sync
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [syncPassword, setSyncPassword] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // Para retentar após salvar senha

  const handleSavePassword = async () => {
    await AsyncStorage.setItem('SYNC_PASSWORD', syncPassword);
    setShowPasswordPrompt(false);
    setSyncPassword('');
    // Retém a ação pendente e tenta automaticamente após salvar
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'push') handleSyncPushOnly();
    else if (action === 'pull') handleSyncPullOnly();
    else if (action === 'inteligente') handleSyncInteligente();
    else Alert.alert('Salvo', 'Palavra-passe salva! Tente sincronizar novamente.');
  };

  useEffect(() => {
    carregarDados();
    checkAutoConnect();
    const unsubscribe = navigation.addListener('focus', () => {
      carregarDados();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (route?.params?.requireAuth) {
      setShowPasswordPrompt(true);
      navigation.setParams({ requireAuth: undefined });
    }
  }, [route?.params?.requireAuth]);

  const checkAutoConnect = async () => {
    if (getApiUrl()) return; // Já conectado
    try {
      const lastDismissedStr = await AsyncStorage.getItem('LAST_SCAN_DISMISSED');
      if (lastDismissedStr) {
        const lastDismissed = parseInt(lastDismissedStr, 10);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - lastDismissed < sevenDays) {
          return;
        }
      }
      setShowAutoConnect(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDismissAutoConnect = async () => {
    try {
      await AsyncStorage.setItem('LAST_SCAN_DISMISSED', String(Date.now()));
    } catch (e) {}
    setShowAutoConnect(false);
  };

  const handleExecuteAutoConnect = async () => {
    setAutoConnecting(true);
    try {
      const memory = await getApiMemory();
      if (memory) {
        try {
          const success = await handshake(memory.ip, memory.port);
          if (success) {
             setApiUrl(memory.ip, memory.port);
             setShowAutoConnect(false);
             Alert.alert('Reconectado!', `Você foi reconectado ao servidor ${memory.ip} automaticamente.`);
             return;
          }
        } catch (err) {
          if (err.message === 'UNAUTHORIZED') {
            setApiUrl(memory.ip, memory.port);
            setShowAutoConnect(false);
            setShowPasswordPrompt(true);
            return;
          }
        }
      }
      
      const serverInfo = await scanNetworkForServer();
      setApiUrl(serverInfo.ip, serverInfo.port);
      setShowAutoConnect(false);
      if (serverInfo.needsAuth) {
        setShowPasswordPrompt(true);
      } else {
        Alert.alert('Sucesso', `Novo servidor encontrado: ${serverInfo.ip}`);
      }
    } catch (error) {
      Alert.alert('Falha', 'Não foi possível encontrar o computador na rede atual. Você continuará offline.');
      setShowAutoConnect(false);
    } finally {
      setAutoConnecting(false);
    }
  };

  const carregarDados = () => {
    try {
      // 1. Logs Offline
      const logs = db.getAllSync('SELECT * FROM OfflineLog WHERE synced = 0');
      setOfflineLogs(logs);
      
      // 2. Acervo (Equipamentos)
      const eqs = db.getAllSync('SELECT * FROM Equipamento ORDER BY nome ASC');
      setEquipamentos(eqs);

      // 3. Avarias
      const avs = db.getAllSync(`
        SELECT ha.*, eq.nome as eqNome, eq.codigoPatrimonio as eqPatrimonio, ta.nome as taNome 
        FROM HistoricoAvaria ha
        JOIN Equipamento eq ON ha.equipamentoId = eq.id
        LEFT JOIN TipoAvaria ta ON ha.tipoAvariaId = ta.id
        ORDER BY ha.dataRegistro DESC
      `);
      setAvarias(avs);

      // 4. Categorias
      const cats = db.getAllSync('SELECT * FROM Categoria ORDER BY nome ASC');
      setCategorias(cats);

      // 5. Requisições
      const reqs = db.getAllSync('SELECT * FROM Requisicao ORDER BY solicitanteNome ASC');
      setRequisicoes(reqs);

    } catch (e) {
      console.error('Erro ao carregar dados locais:', e);
    }
  };

  const handleSyncPushOnly = async () => {
    if (!getApiUrl()) return Alert.alert('Atenção', 'Você precisa configurar o IP primeiro.');
    setSyncing(true);
    try {
      const res = await syncPush();
      Alert.alert(res.temFalhas ? 'Atenção' : 'Sucesso', res.message || 'Tudo sincronizado');
      carregarDados();
    } catch (error) {
      if (error.message === 'UNAUTHORIZED') {
        setPendingAction('push');
        setShowPasswordPrompt(true);
      } else {
        Alert.alert('Falha', error.message || 'Erro ao enviar dados.');
      }
    } finally {
      setSyncing(false);
    }
  };


  const handleSyncPullOnly = async () => {
    if (!getApiUrl()) return Alert.alert('Atenção', 'Você precisa configurar o IP primeiro.');
    setSyncing(true);
    try {
      await syncPull();
      Alert.alert('Sucesso', 'Sincronização concluída!');
      carregarDados();
    } catch (error) {
      if (error.message === 'UNAUTHORIZED') {
        setPendingAction('pull');
        setShowPasswordPrompt(true);
      } else {
        Alert.alert('Falha', error.message || 'Erro ao baixar dados.');
      }
    } finally {
      setSyncing(false);
    }
  };


  const handleSyncInteligente = async () => {
    if (!getApiUrl()) return Alert.alert('Atenção', 'Você precisa configurar o IP primeiro.');
    setSyncing(true);
    try {
      const pushRes = await syncPush();
      await syncPull();
      
      let finalMessage = 'Dados atualizados com sucesso!';
      if (pushRes.message && pushRes.message !== 'Nenhuma ação offline pendente.') {
        finalMessage = `${pushRes.message}\n(Dados recebidos atualizados)`;
      } else {
        finalMessage = 'Base de dados atualizada (Pull concluído). Nenhuma nova ação para enviar.';
      }
      Alert.alert(pushRes.temFalhas ? 'Atenção' : 'Sincronização Concluída', finalMessage);
      carregarDados();
    } catch (error) {
      if (error.message === 'UNAUTHORIZED') {
        setPendingAction('inteligente');
        setShowPasswordPrompt(true);
      } else {
        Alert.alert('Falha', error.message || 'Erro na sincronização geral.');
      }
    } finally {
      setSyncing(false);
    }
  };


  const handlePrint = async (requisicao, formato) => {
    try {
      const itemsDb = db.getAllSync('SELECT equipamentoId FROM ItemRequisicao WHERE requisicaoId = ?', [requisicao.id]);
      if (itemsDb.length === 0) {
        return Alert.alert('Aviso', 'Nenhum equipamento vinculado a esta requisição localmente.');
      }
      const eqsIds = itemsDb.map(i => i.equipamentoId);
      const placeholders = eqsIds.map(() => '?').join(',');
      const equipamentosDaReq = db.getAllSync(`SELECT * FROM Equipamento WHERE id IN (${placeholders})`, eqsIds);
      
      await imprimirComprovante(requisicao, equipamentosDaReq, formato, requisicao.status === 'DEVOLVIDO' ? 'DEVOLUCAO' : 'SEPARACAO');
    } catch (e) {
      Alert.alert('Erro', 'Falha ao buscar itens para imprimir.');
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const serverInfo = await scanNetworkForServer();
      setApiUrl(serverInfo.ip, serverInfo.port);
      if (serverInfo.needsAuth) {
        // Servidor exige autenticação. Testa a senha salva.
        try {
          const success = await handshake(serverInfo.ip, serverInfo.port);
          if (success) {
            // Senha salva está correta — conectado silenciosamente!
            Alert.alert('Sucesso', `Servidor encontrado: ${serverInfo.ip}\nConectado com a palavra-passe salva.`);
            return;
          } else {
            // handshake retornou false = servidor respondeu mas senha está errada ou ausente
            // NÃO mostra "Conectado" — pede a senha correta
            Alert.alert(
              'Senha Necessária',
              `Servidor encontrado em ${serverInfo.ip}, mas a palavra-passe está incorreta ou não foi configurada.`
            );
            setPendingAction(null);
            setShowPasswordPrompt(true);
            return;
          }
        } catch (revalidateErr) {
          if (revalidateErr.message === 'UNAUTHORIZED') {
            // 401 confirmado com a senha salva → senha errada
            Alert.alert(
              'Senha Incorreta',
              `A palavra-passe salva não é aceita pelo servidor ${serverInfo.ip}. Digite a correta.`
            );
            setPendingAction(null);
            setShowPasswordPrompt(true);
            return;
          }
          // Erro de rede (timeout, etc.) — assume conectado e tenta
          Alert.alert('Sucesso', `Servidor encontrado: ${serverInfo.ip}`);
          return;
        }
      } else {
        Alert.alert('Sucesso', `Servidor encontrado: ${serverInfo.ip}`);
      }
    } catch (error) {
      Alert.alert('Falha no Scan', error.message);
    } finally {
      setScanning(false);
    }
  };


  const getStatusColor = (status) => {
    switch (status) {
      case 'DISPONIVEL':
        return { bg: '#e6f4ea', text: '#137333' }; // Green
      case 'EMPRESTADO':
        return { bg: '#fef7e0', text: '#b06000' }; // Yellow
      case 'COM_DEFEITO':
        return { bg: '#fce8e6', text: '#c5221f' }; // Red
      default:
        return { bg: '#f1f3f4', text: '#5f6368' }; // Gray
    }
  };
      const getStatusLabel = (status) => {
    switch (status) {
      case 'DISPONIVEL': return 'Disponível';
      case 'EMPRESTADO': return 'Emprestado';
      case 'COM_DEFEITO': return 'Com Defeito';
      default: return status || 'Indefinido';
    }
  };

  // Filtragem de Equipamentos segura e flexível
  const filteredEquipamentos = equipamentos.filter(eq => {
    const nomeOk = (eq.nome || '').toLowerCase();
    const patOk = (eq.codigoPatrimonio || '').toLowerCase();
    const searchLower = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !searchLower || nomeOk.includes(searchLower) || patOk.includes(searchLower);
    const matchesCategory = selectedCategory ? eq.categoriaId === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {/* Server Status Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Estoque Local</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: API_URL ? '#10b981' : '#ef4444' }]} />
            <Text style={styles.statusText}>{API_URL ? 'Conectado' : 'Modo Offline'}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.settingsBtn} 
          onPress={() => navigation.navigate('QRScanner')}
        >
          <Settings size={15} color="#2563eb" />
          <Text style={styles.settingsBtnText}>Servidor</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Tab Selector */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {[
            { id: 'DASHBOARD', label: 'Painel' },
            { id: 'ACERVO', label: 'Acervo' },
            { id: 'AVARIAS', label: 'Avarias' },
            { id: 'REQUISICOES', label: 'Requisições' },
            { id: 'DEVOLUCOES', label: 'Pendentes' },
            { id: 'ACOES', label: `Sincronizar (${offlineLogs.length})` }
          ].map(tab => (
            <TouchableOpacity 
              key={tab.id} 
              style={[styles.tabButton, activeTab === tab.id && styles.activeTabButton]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.tabButtonText, activeTab === tab.id && styles.activeTabButtonText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {syncing && (
        <View style={[styles.syncBanner, { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', flex: 1, height: '100%' }]}>
          <ActivityIndicator size="large" color="#ffffff" style={{ marginBottom: 16 }} />
          <Text style={[styles.syncBannerText, { fontSize: 18, textAlign: 'center', paddingHorizontal: 20 }]}>
             Aguarde, estamos sincronizando as informações...
          </Text>
        </View>
      )}

      {/* Content Render based on Active Tab */}
      <View style={styles.content}>
        {activeTab === 'DASHBOARD' && (
          <ScrollView contentContainerStyle={styles.dashboardContainer}>
            {/* Stats Cards (Clicáveis) */}
            <View style={styles.statsGrid}>
              <TouchableOpacity 
                style={styles.statCard} 
                activeOpacity={0.7}
                onPress={() => setActiveTab('ACERVO')}
              >
                <Text style={styles.statNumber}>{equipamentos.length}</Text>
                <Text style={styles.statLabel}>Equipamentos ›</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.statCard, { borderLeftColor: '#f59e0b', borderLeftWidth: 4 }]} 
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Emprestimo')}
              >
                <Text style={styles.statNumber}>
                  {equipamentos.filter(e => e.statusCondicao === 'EMPRESTADO').length}
                </Text>
                <Text style={styles.statLabel}>Emprestados ›</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.statCard, { borderLeftColor: '#ef4444', borderLeftWidth: 4 }]} 
                activeOpacity={0.7}
                onPress={() => setActiveTab('AVARIAS')}
              >
                <Text style={styles.statNumber}>
                  {avarias.filter(a => a.resolvido === 0).length}
                </Text>
                <Text style={styles.statLabel}>Avarias Ativas ›</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.statCard, { borderLeftColor: '#10b981', borderLeftWidth: 4 }]} 
                activeOpacity={0.7}
                onPress={() => setActiveTab('REQUISICOES')}
              >
                <Text style={styles.statNumber}>{requisicoes.length}</Text>
                <Text style={styles.statLabel}>Requisições Ativas ›</Text>
              </TouchableOpacity>
            </View>

            {/* Principal Actions */}
            <Text style={styles.sectionTitle}>Operações Rápidas</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: '#4f46e5' }]} 
                onPress={() => navigation.navigate('BarcodeScanner', { acao: 'SEPARACAO' })}
              >
                <View style={styles.actionIconContainer}>
                  <Upload size={24} color="#fff" />
                </View>
                <Text style={styles.actionText}>Liberar Item</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: '#10b981' }]} 
                onPress={() => navigation.navigate('BarcodeScanner', { acao: 'DEVOLUCAO' })}
              >
                <View style={styles.actionIconContainer}>
                  <Download size={24} color="#fff" />
                </View>
                <Text style={styles.actionText}>Devolver Item</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: '#db2777' }]} 
                onPress={() => navigation.navigate('BarcodeScanner', { acao: 'EDITAR' })}
              >
                <View style={styles.actionIconContainer}>
                  <QrCode size={24} color="#fff" />
                </View>
                <Text style={styles.actionText}>Escanear & Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: '#0ea5e9' }]} 
                onPress={() => navigation.navigate('Emprestimo')}
              >
                <View style={styles.actionIconContainer}>
                  <HandshakeIcon size={24} color="#fff" />
                </View>
                <Text style={styles.actionText}>Empréstimo</Text>
              </TouchableOpacity>
            </View>

            {/* Central de Cadastros Offline */}
            <Text style={styles.sectionTitle}>Central de Cadastros (Offline)</Text>
            <View style={styles.cadastrosGrid}>
              <TouchableOpacity 
                style={styles.cadastroCard}
                onPress={() => navigation.navigate('CadastrarEquipamento')}
              >
                <View style={[styles.cadastroIconBg, { backgroundColor: '#eff6ff' }]}>
                  <Package size={22} color="#2563eb" />
                </View>
                <Text style={styles.cadastroCardTitle}>Materiais & Lotes</Text>
                <Text style={styles.cadastroCardSub}>Novo equipamento</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cadastroCard}
                onPress={() => navigation.navigate('CadastrarCategoria')}
              >
                <View style={[styles.cadastroIconBg, { backgroundColor: '#eef2ff' }]}>
                  <FolderPlus size={22} color="#4f46e5" />
                </View>
                <Text style={styles.cadastroCardTitle}>Categorias & Tipos</Text>
                <Text style={styles.cadastroCardSub}>Classificações</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cadastroCard}
                onPress={() => navigation.navigate('CadastrarLocal')}
              >
                <View style={[styles.cadastroIconBg, { backgroundColor: '#f0f9ff' }]}>
                  <Building2 size={22} color="#0284c7" />
                </View>
                <Text style={styles.cadastroCardTitle}>Locais & Salas</Text>
                <Text style={styles.cadastroCardSub}>Espaços e estúdios</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cadastroCard}
                onPress={() => navigation.navigate('ReservarLocal')}
              >
                <View style={[styles.cadastroIconBg, { backgroundColor: '#ecfdf5' }]}>
                  <Calendar size={22} color="#059669" />
                </View>
                <Text style={styles.cadastroCardTitle}>Reservar Espaço</Text>
                <Text style={styles.cadastroCardSub}>Agenda de salas</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cadastroCard}
                onPress={() => navigation.navigate('CadastrarAvaria')}
              >
                <View style={[styles.cadastroIconBg, { backgroundColor: '#fef2f2' }]}>
                  <Wrench size={22} color="#dc2626" />
                </View>
                <Text style={styles.cadastroCardTitle}>Defeitos & Avarias</Text>
                <Text style={styles.cadastroCardSub}>Manutenções</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cadastroCard}
                onPress={() => navigation.navigate('Emprestimo')}
              >
                <View style={[styles.cadastroIconBg, { backgroundColor: '#fdf4ff' }]}>
                  <HandshakeIcon size={22} color="#a855f7" />
                </View>
                <Text style={styles.cadastroCardTitle}>Empréstimos</Text>
                <Text style={styles.cadastroCardSub}>Retiradas rápidas</Text>
              </TouchableOpacity>
            </View>

            {/* Sync Card */}
            <View style={styles.syncCard}>
              <Text style={styles.syncCardTitle}>Sincronização Local</Text>
              <Text style={styles.syncCardDesc}>
                Para baixar novas requisições e enviar as liberações ou novos cadastros feitos de forma offline.
              </Text>
              {API_URL ? (
                <Text style={styles.syncIpText}>Computador: {API_URL}</Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <AlertTriangle size={16} color="#c5221f" style={{ marginRight: 6 }} />
                  <Text style={styles.syncIpTextWarning}>Computador não conectado</Text>
                </View>
              )}
              <View style={{ flexDirection: 'column', gap: 10, marginTop: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <TouchableOpacity style={[styles.syncButton, { flex: 1, backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} onPress={handleSyncPushOnly} disabled={syncing}>
                    <Upload size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.syncButtonText}>Enviar Sync</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.syncButton, { flex: 1, backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} onPress={handleSyncPullOnly} disabled={syncing}>
                    <Download size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.syncButtonText}>Receber Sync</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.syncButton, { backgroundColor: '#8b5cf6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} onPress={handleSyncInteligente} disabled={syncing}>
                  <RefreshCw size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.syncButtonText}>{syncing ? 'Processando...' : 'Sync Inteligente (Geral)'}</Text>
                </TouchableOpacity>
                {!API_URL && (
                  <TouchableOpacity style={[styles.syncButton, { backgroundColor: '#0284c7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} onPress={() => navigation.navigate('QRScanner')}>
                    <QrCode size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.syncButtonText}>Ler QR Code do Servidor</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        )}

        {activeTab === 'ACERVO' && (
          <View style={{ flex: 1 }}>
            {/* Barra de Pesquisa */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputWrapper}>
                <Search size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput 
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Buscar por nome ou patrimônio..."
                  placeholderTextColor="#94a3b8"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                    <X size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Chips de Categorias */}
            <View style={{ backgroundColor: '#ffffff', paddingBottom: 10 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                <TouchableOpacity 
                  style={[styles.categoryFilter, !selectedCategory && styles.categoryFilterActive]}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text style={[styles.categoryFilterText, !selectedCategory && styles.categoryFilterTextActive]}>
                    Todos ({equipamentos.length})
                  </Text>
                </TouchableOpacity>
                {categorias.map(cat => {
                  const qtde = equipamentos.filter(eq => eq.categoriaId === cat.id).length;
                  if (qtde === 0) return null;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity 
                      key={cat.id} 
                      style={[styles.categoryFilter, isActive && styles.categoryFilterActive]}
                      onPress={() => setSelectedCategory(cat.id)}
                    >
                      <Text style={[styles.categoryFilterText, isActive && styles.categoryFilterTextActive]}>
                        {cat.nome} ({qtde})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Lista de Equipamentos com Card Responsivo */}
            <FlatList
              data={filteredEquipamentos}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 30, paddingTop: 6 }}
              renderItem={({ item }) => {
                const colors = getStatusColor(item.statusCondicao);
                return (
                  <View style={styles.itemCard}>
                    {/* Linha Superior: Foto, Dados e Status */}
                    <View style={styles.itemCardTopRow}>
                      {item.fotoUrl ? (
                        <Image
                          source={{ uri: item.fotoUrl.startsWith('/uploads') ? `${API_URL}${item.fotoUrl}` : item.fotoUrl }}
                          style={styles.itemThumb}
                        />
                      ) : (
                        <View style={styles.itemThumbPlaceholder}>
                          <Package size={22} color="#94a3b8" />
                        </View>
                      )}
                      <View style={styles.itemDetails}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.nome}</Text>
                        <Text style={styles.itemPatrimony}>Patr: {item.codigoPatrimonio}</Text>
                      </View>
                      <View style={styles.itemRight}>
                        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                          <Text style={[styles.badgeText, { color: colors.text }]}>
                            {getStatusLabel(item.statusCondicao)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Linha Inferior de Ações (Editar e Imprimir 58/80mm) */}
                    <View style={styles.itemCardActionsRow}>
                      <TouchableOpacity 
                        style={styles.actionPillEdit} 
                        onPress={() => navigation.navigate('CadastrarEquipamento', { equipamentoId: item.id, modoEdicao: true })}
                      >
                        <Edit3 size={13} color="#4338ca" />
                        <Text style={styles.actionPillEditText}>Editar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionPillPrint58} 
                        onPress={() => imprimirEtiqueta(item, '58mm')}
                      >
                        <Printer size={13} color="#1d4ed8" />
                        <Text style={styles.actionPillPrint58Text}>58mm</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionPillPrint80} 
                        onPress={() => imprimirEtiqueta(item, '80mm')}
                      >
                        <Printer size={13} color="#475569" />
                        <Text style={styles.actionPillPrint80Text}>80mm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyListTitle}>Nenhum equipamento encontrado</Text>
                  <Text style={styles.emptyListSub}>Tente alterar o termo da busca ou categoria selecionada.</Text>
                  {(searchQuery.length > 0 || selectedCategory) && (
                    <TouchableOpacity
                      style={styles.btnClearFilter}
                      onPress={() => { setSearchQuery(''); setSelectedCategory(null); }}
                    >
                      <Text style={styles.btnClearFilterText}>Limpar Filtros</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          </View>
        )}

        {activeTab === 'AVARIAS' && (
          <FlatList
            data={avarias}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 8, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={styles.avariaCard}>
                <View style={styles.avariaHeader}>
                  <Text style={styles.avariaEqName}>{item.eqNome}</Text>
                  <View style={[styles.badge, { backgroundColor: item.resolvido ? '#e6f4ea' : '#fce8e6' }]}>
                    <Text style={[styles.badgeText, { color: item.resolvido ? '#137333' : '#c5221f' }]}>
                      {item.resolvido ? 'Resolvida' : 'Ativa'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.avariaPatrimony}>Patrimônio: {item.eqPatrimonio}</Text>
                <Text style={styles.avariaType}>Tipo: {item.taNome || 'Geral'}</Text>
                <Text style={styles.avariaDesc}>Descrição: {item.descricao}</Text>
                <Text style={styles.avariaDate}>Registrado em: {new Date(item.dataRegistro).toLocaleDateString('pt-BR')}</Text>
              </View>
            )}
            ListEmptyComponent={() => (
              <Text style={styles.emptyListText}>Nenhuma avaria registrada localmente.</Text>
            )}
          />
        )}

        {activeTab === 'REQUISICOES' && (
          <FlatList
            data={requisicoes.filter(r => r.status !== 'AGUARDANDO_DEVOLUCAO')}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 8, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={styles.requisicaoCard}>
                <View style={styles.requisicaoHeader}>
                  <Text style={styles.solicitante}>{item.solicitanteNome}</Text>
                  <View style={[styles.badge, { backgroundColor: '#e8f0fe' }]}>
                    <Text style={[styles.badgeText, { color: '#1a73e8' }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.reqDetail}>Depto: {item.departamento}</Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                  <TouchableOpacity 
                    style={[styles.syncButton, { flex: 1, marginTop: 0, marginRight: 6, backgroundColor: '#1a73e8' }]} 
                    onPress={() => navigation.navigate('BarcodeScanner', { 
                      acao: 'SEPARACAO', 
                      requisicaoId: item.id, 
                      solicitante: item.solicitanteNome 
                    })}
                  >
                    <Text style={styles.syncButtonText}>Entrega / Separar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.syncButton, { flex: 1, marginTop: 0, marginLeft: 6, backgroundColor: '#d97706' }]} 
                    onPress={() => navigation.navigate('BarcodeScanner', { 
                      acao: 'DEVOLUCAO', 
                      requisicaoId: item.id, 
                      solicitante: item.solicitanteNome 
                    })}
                  >
                    <Text style={styles.syncButtonText}>Entrega / Retorno</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <TouchableOpacity style={[styles.syncButton, { flex: 1, marginTop: 0, marginRight: 4, backgroundColor: '#475569', paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]} onPress={() => handlePrint(item, 'A4')}>
                    <Printer size={12} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={[styles.syncButtonText, { fontSize: 12 }]}>A4</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.syncButton, { flex: 1, marginTop: 0, marginHorizontal: 4, backgroundColor: '#475569', paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]} onPress={() => handlePrint(item, '58mm')}>
                    <Printer size={12} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={[styles.syncButtonText, { fontSize: 12 }]}>58mm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.syncButton, { flex: 1, marginTop: 0, marginLeft: 4, backgroundColor: '#475569', paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]} onPress={() => handlePrint(item, '80mm')}>
                    <Printer size={12} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={[styles.syncButtonText, { fontSize: 12 }]}>80mm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={() => (
              <Text style={styles.emptyListText}>Nenhuma requisição de empréstimo sincronizada.</Text>
            )}
          />
        )}

        {activeTab === 'DEVOLUCOES' && (
          <FlatList
            data={requisicoes.filter(r => r.status === 'AGUARDANDO_DEVOLUCAO')}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 8, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.requisicaoCard}
                onPress={() => navigation.navigate('BarcodeScanner', { 
                  acao: 'DEVOLUCAO', 
                  requisicaoId: item.id, 
                  solicitante: item.solicitanteNome 
                })}
              >
                <View style={styles.requisicaoHeader}>
                  <Text style={styles.solicitante}>{item.solicitanteNome}</Text>
                  <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}>
                    <Text style={[styles.badgeText, { color: '#d97706' }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.reqDetail}>Depto: {item.departamento}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <Text style={styles.emptyListText}>Nenhuma devolução pendente no momento.</Text>
            )}
          />
        )}

        {activeTab === 'ACOES' && (
          <View style={{ flex: 1 }}>
            <View style={styles.actionsHeaderRow}>
              <Text style={styles.actionsSubtitle}>Operações Realizadas Offline</Text>
              {offlineLogs.length > 0 && (
                <TouchableOpacity style={[styles.clearBtn, { backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center' }]} onPress={handleSyncPushOnly}>
                  <Upload size={14} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={styles.clearBtnText}>Enviar Sync</Text>
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={offlineLogs}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <View style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logActionType}>
                      {item.tipo === 'SEPARACAO' && 'LIBERAÇÃO'}
                      {item.tipo === 'DEVOLUCAO' && 'DEVOLUÇÃO'}
                      {item.tipo === 'NOVO_EQUIPAMENTO' && 'NOVO EQUIPAMENTO'}
                      {item.tipo === 'EMPRESTIMO_OFFLINE' && 'NOVO EMPRÉSTIMO'}
                      {item.tipo === 'NOVA_CATEGORIA' && 'NOVA CATEGORIA'}
                      {item.tipo === 'NOVO_TIPO_EQUIPAMENTO' && 'NOVO SUBTIPO'}
                      {item.tipo === 'NOVO_LOCAL' && 'NOVO LOCAL'}
                      {item.tipo === 'NOVA_RESERVA_LOCAL' && 'RESERVA DE ESPAÇO'}
                      {item.tipo === 'NOVO_TIPO_AVARIA' && 'TIPO DE AVARIA'}
                      {item.tipo === 'NOVA_AVARIA_REGISTRO' && 'AVARIA REPORTADA'}
                      {item.tipo === 'RESOLVER_AVARIA' && 'AVARIA RESOLVIDA'}
                    </Text>
                    <Text style={styles.logTime}>
                      {new Date(item.data).toLocaleTimeString('pt-BR')}
                    </Text>
                  </View>
                  <Text style={styles.logDetails} numberOfLines={1}>
                    {item.tipo}: {item.itemId || ''}
                  </Text>
                </View>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyActionsContainer}>
                  <Text style={styles.emptyActionsIcon}>✓</Text>
                  <Text style={styles.emptyActionsText}>Tudo em ordem!</Text>
                  <Text style={styles.emptyActionsSub}>Nenhuma ação pendente de sincronização.</Text>
                </View>
              )}
            />
          </View>
        )}
      </View>

      {/* MODAL AUTO CONNECT */}
      <Modal visible={showAutoConnect} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sincronizar Estoque?</Text>
            <Text style={styles.modalText}>
              Deseja procurar o computador do estoque para habilitar requisições em tempo real? 
              Se recusar, você não será perguntado novamente por 7 dias.
            </Text>

            {autoConnecting ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator size="large" color="#4f46e5" />
                <Text style={{ marginTop: 10, color: '#64748b' }}>Procurando e testando rede...</Text>
              </View>
            ) : (
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f1f5f9' }]} onPress={handleDismissAutoConnect}>
                  <Text style={[styles.modalBtnText, { color: '#64748b' }]}>Trabalhar Offline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#4f46e5' }]} onPress={handleExecuteAutoConnect}>
                  <Text style={styles.modalBtnText}>Conectar Agora</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL SENHA */}
      <Modal visible={showPasswordPrompt} transparent={true} animationType="fade">
        <KeyboardAvoidingView style={styles.pwdModalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.pwdModalContent}>
            <Text style={styles.pwdModalTitle}>Autenticação Necessária</Text>
            <Text style={styles.pwdModalText}>
              Este servidor exige uma "Palavra-Passe" de sincronização para transmitir os dados com segurança.
            </Text>
            
            <TextInput
              style={styles.pwdInput}
              placeholder="Digite a Palavra-Passe"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={syncPassword}
              onChangeText={setSyncPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={true}
            />
            
            <View style={styles.pwdModalButtonsRow}>
              <TouchableOpacity style={[styles.pwdModalBtn, { backgroundColor: '#f1f5f9' }]} onPress={() => setShowPasswordPrompt(false)}>
                <Text style={[styles.pwdModalBtnText, { color: '#64748b' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pwdModalBtn, { backgroundColor: '#10b981' }]} onPress={handleSavePassword}>
                <Text style={[styles.pwdModalBtnText, { color: '#ffffff' }]}>Salvar e Autenticar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  headerTitleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#0f172a' 
  },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginLeft: 8, 
    backgroundColor: '#f1f5f9', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 12 
  },
  statusDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    marginRight: 4 
  },
  statusText: { 
    fontSize: 10, 
    fontWeight: '600', 
    color: '#64748b' 
  },
  settingsBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10,
    gap: 6
  },
  settingsBtnText: { 
    color: '#2563eb', 
    fontSize: 13, 
    fontWeight: '700' 
  },
  tabContainer: { 
    backgroundColor: '#ffffff', 
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  tabScroll: {
    paddingHorizontal: 12
  },
  tabButton: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    marginRight: 8, 
    backgroundColor: '#f1f5f9' 
  },
  activeTabButton: { 
    backgroundColor: '#4f46e5' 
  },
  tabButtonText: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#64748b' 
  },
  activeTabButtonText: { 
    color: '#ffffff' 
  },
  syncBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#4f46e5', 
    paddingVertical: 8 
  },
  syncBannerText: { 
    color: '#ffffff', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  content: { 
    flex: 1 
  },
  dashboardContainer: { 
    padding: 16 
  },
  statsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    marginBottom: 20
  },
  statCard: { 
    width: '48%', 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  statNumber: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#0f172a' 
  },
  statLabel: { 
    fontSize: 12, 
    color: '#64748b', 
    marginTop: 4 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0f172a', 
    marginBottom: 12 
  },
  actionGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  actionCard: { 
    width: '48%',
    borderRadius: 16, 
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  actionIcon: { 
    fontSize: 24, 
    marginBottom: 6 
  },
  actionText: { 
    color: '#ffffff', 
    fontSize: 11, 
    fontWeight: '700', 
    textAlign: 'center' 
  },
  syncCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  syncCardTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#0f172a' 
  },
  syncCardDesc: { 
    fontSize: 12, 
    color: '#64748b', 
    marginTop: 4, 
    lineHeight: 18 
  },
  syncIpText: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#10b981', 
    marginTop: 12 
  },
  syncIpTextWarning: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#f59e0b', 
    marginTop: 12 
  },
  syncButton: { 
    backgroundColor: '#4f46e5', 
    paddingVertical: 12, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginTop: 14 
  },
  syncButtonText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '700' 
  },
  // Acervo styles
  searchContainer: { 
    padding: 12, 
    backgroundColor: '#ffffff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    padding: 0,
  },
  categoryScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  categoryFilter: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryFilterActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4338ca',
  },
  categoryFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryFilterTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  itemCard: { 
    flexDirection: 'column', 
    backgroundColor: '#ffffff', 
    marginHorizontal: 12, 
    marginTop: 10, 
    borderRadius: 14, 
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  itemCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemCardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  actionPillEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  actionPillEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338ca',
  },
  actionPillPrint58: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  actionPillPrint58Text: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  actionPillPrint80: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  actionPillPrint80Text: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 20,
  },
  emptyListTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptyListSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 14,
  },
  btnClearFilter: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  btnClearFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center'
  },
  modalText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  modalBtnText: {
    fontWeight: '700',
    fontSize: 14,
    color: '#ffffff'
  },
  itemThumb: { 
    width: 50, 
    height: 50, 
    borderRadius: 8 
  },
  itemThumbPlaceholder: { 
    width: 50, 
    height: 50, 
    borderRadius: 8, 
    backgroundColor: '#f1f5f9', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  itemThumbPlaceholderText: { 
    fontSize: 20 
  },
  itemDetails: { 
    flex: 1, 
    marginLeft: 12 
  },
  itemName: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#0f172a' 
  },
  itemPatrimony: { 
    fontSize: 12, 
    color: '#64748b', 
    marginTop: 2 
  },
  notSyncedBadge: { 
    backgroundColor: '#ffedd5', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 6, 
    marginTop: 4 
  },
  notSyncedText: { 
    color: '#ea580c', 
    fontSize: 9, 
    fontWeight: '700' 
  },
  itemRight: { 
    alignItems: 'flex-end' 
  },
  badge: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  badgeText: { 
    fontSize: 11, 
    fontWeight: '700' 
  },
  emptyListText: { 
    textAlign: 'center', 
    color: '#94a3b8', 
    marginTop: 40 
  },
  // Avarias styles
  avariaCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1 
  },
  avariaHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 8
  },
  avariaEqName: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#0f172a' 
  },
  avariaPatrimony: { 
    fontSize: 12, 
    color: '#64748b' 
  },
  avariaType: { 
    fontSize: 12, 
    color: '#ef4444', 
    marginTop: 2,
    fontWeight: '600'
  },
  avariaDesc: { 
    fontSize: 13, 
    color: '#334155', 
    marginTop: 6, 
    backgroundColor: '#f8fafc', 
    padding: 8, 
    borderRadius: 8 
  },
  avariaDate: { 
    fontSize: 11, 
    color: '#94a3b8', 
    marginTop: 8, 
    textAlign: 'right' 
  },
  // Requisições styles
  requisicaoCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1 
  },
  requisicaoHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 6
  },
  solicitante: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#0f172a' 
  },
  reqDetail: { 
    fontSize: 12, 
    color: '#64748b' 
  },
  // Ações Offline (Logs) styles
  actionsHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12 
  },
  actionsSubtitle: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#64748b' 
  },
  clearBtn: { 
    backgroundColor: '#4f46e5', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8 
  },
  clearBtnText: { 
    color: '#ffffff', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  logCard: { 
    backgroundColor: '#ffffff', 
    marginHorizontal: 12, 
    marginBottom: 8, 
    borderRadius: 10, 
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b'
  },
  logHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  logActionType: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#0f172a' 
  },
  logTime: { 
    fontSize: 11, 
    color: '#94a3b8' 
  },
  logDetails: { 
    fontSize: 12, 
    color: '#64748b', 
    marginTop: 4 
  },
  emptyActionsContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 40 
  },
  emptyActionsIcon: { 
    fontSize: 48, 
    color: '#10b981', 
    marginBottom: 10 
  },
  emptyActionsText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0f172a' 
  },
  emptyActionsSub: { 
    fontSize: 12, 
    color: '#64748b', 
    marginTop: 4,
    textAlign: 'center'
  },
  // Central de Cadastros Offline
  cadastrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  cadastroCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  cadastroIconBg: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  cadastroCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2
  },
  cadastroCardSub: {
    fontSize: 11,
    color: '#64748b'
  },
  pwdModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  pwdModalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8
  },
  pwdModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8
  },
  pwdModalText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16
  },
  pwdInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f172a',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 18
  },
  pwdModalButtonsRow: {
    flexDirection: 'row',
    gap: 10
  },
  pwdModalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pwdModalBtnText: {
    fontSize: 14,
    fontWeight: '700'
  }
});
