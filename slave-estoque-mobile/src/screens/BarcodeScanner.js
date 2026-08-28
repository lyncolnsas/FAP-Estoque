import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, ActivityIndicator, Modal, Image, FlatList, Switch, TextInput, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { InteractionManager } from 'react-native';
import { db } from '../db/database';
import { API_URL, syncPush } from '../services/api';

const { width } = Dimensions.get('window');
const scannerSize = width * 0.75;

export default function BarcodeScannerScreen({ route, navigation }) {
  const { acao, requisicaoId, solicitante } = route.params || {}; // 'SEPARACAO' | 'DEVOLUCAO' | 'EDITAR'
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  // Buffer state
  const [sessionScannedItems, setSessionScannedItems] = useState([]);
  
  // Modals state
  const [showListModal, setShowListModal] = useState(false);
  const [observacaoModalVisible, setObservacaoModalVisible] = useState(false);
  
  // Solicitante / Avulso state
  const [showSolicitanteModal, setShowSolicitanteModal] = useState(false);
  const [usuariosDb, setUsuariosDb] = useState([]);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoDepto, setNovoDepto] = useState('');
  const [novoWhatsApp, setNovoWhatsApp] = useState('');
  const [isNovoUsuario, setIsNovoUsuario] = useState(false);
  
  // Observation state
  const [selectedItemForObs, setSelectedItemForObs] = useState(null);
  const [hasAvaria, setHasAvaria] = useState(false);
  const [avariaDesc, setAvariaDesc] = useState('');

  const isFocused = useIsFocused();

  useFocusEffect(
    React.useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        setIsCameraReady(true);
      });
      return () => {
        task.cancel();
        setIsCameraReady(false);
      };
    }, [])
  );

  useEffect(() => {
    (async () => {
      if (permission && !permission.granted && permission.canAskAgain) {
        await requestPermission();
      }
    })();
  }, [permission]);

  useEffect(() => {
    if (acao === 'SEPARACAO' && !requisicaoId) {
      const u = db.getAllSync('SELECT * FROM Usuario ORDER BY nome ASC');
      setUsuariosDb(u);
    }
  }, [acao, requisicaoId]);

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Carregando câmera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Acesso à Câmera</Text>
          <Text style={styles.permissionText}>
            Precisamos de permissão para utilizar a câmera do celular para escanear os códigos de patrimônio dos equipamentos.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Permitir Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.btnTextOnly]} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonTextCancel}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBarcodeScanned = ({ type, data }) => {
    setScanned(true);

    let codigoBipado = data;
    if (codigoBipado.includes('/')) {
      codigoBipado = codigoBipado.split('/').pop();
    }

    // Modo EDITAR: Lê o QR Code e abre a edição completa do equipamento
    if (acao === 'EDITAR') {
      const equipamentos = db.getAllSync(
        'SELECT * FROM Equipamento WHERE codigoPatrimonio = ? OR id = ?',
        [codigoBipado, codigoBipado]
      );
      if (equipamentos.length > 0) {
        const eq = equipamentos[0];
        navigation.replace('CadastrarEquipamento', { equipamentoId: eq.id, modoEdicao: true });
      } else {
        Alert.alert(
          'Não Encontrado',
          `Equipamento com código "${codigoBipado}" não foi localizado no banco de dados local.`,
          [
            { text: 'Escanear Outro', onPress: () => setTimeout(() => setScanned(false), 500) },
            { 
              text: 'Cadastrar Novo', 
              onPress: () => navigation.replace('CadastrarEquipamento', { codigoPatrimonio: codigoBipado }) 
            }
          ]
        );
      }
      return;
    }

    // Verifica se já bipou nesta sessão
    if (sessionScannedItems.find(i => i.codigoPatrimonio === codigoBipado)) {
      Alert.alert('Aviso', 'Item já escaneado nesta sessão!');
      setTimeout(() => setScanned(false), 2000);
      return;
    }

    const equipamentos = db.getAllSync('SELECT * FROM Equipamento WHERE codigoPatrimonio = ?', [codigoBipado]);
    
    if (equipamentos.length > 0) {
      const eq = equipamentos[0];
      
      const eqAtual = db.getAllSync('SELECT * FROM Equipamento WHERE id = ?', [eq.id]);
      if (acao === 'SEPARACAO' && eqAtual.length > 0 && eqAtual[0].statusCondicao === 'EMPRESTADO') {
         Alert.alert('Aviso', `Equipamento ${eq.codigoPatrimonio} já está emprestado!`);
         setTimeout(() => setScanned(false), 2000);
         return;
      }

      if (acao === 'DEVOLUCAO' && requisicaoId) {
        const items = db.getAllSync('SELECT * FROM ItemRequisicao WHERE equipamentoId = ? AND requisicaoId = ? LIMIT 1', [eq.id, requisicaoId]);
        if (items.length === 0) {
           Alert.alert('Aviso', 'Este equipamento não pertence à lista desta requisição.');
           setTimeout(() => setScanned(false), 2000);
           return;
        }
      }

      // Adiciona ao buffer
      setSessionScannedItems(prev => [...prev, {
        ...eq,
        avaria: false,
        avariaDescricao: ''
      }]);
      
      // Feedback visual leve (sem modal parando)
      Alert.alert('Lido!', `Patrimônio: ${eq.codigoPatrimonio}`, [
        { text: 'OK', onPress: () => setTimeout(() => setScanned(false), 500) }
      ]);
    } else {
      Alert.alert('Aviso', `Equipamento com patrimônio "${codigoBipado}" não encontrado no banco offline.`);
      setTimeout(() => setScanned(false), 2000);
    }
  };

  const removeItemFromBuffer = (id) => {
    setSessionScannedItems(prev => prev.filter(item => item.id !== id));
  };

  const openObservationModal = (item) => {
    setSelectedItemForObs(item);
    setHasAvaria(item.avaria || false);
    setAvariaDesc(item.avariaDescricao || '');
    setObservacaoModalVisible(true);
  };

  const saveObservation = () => {
    setSessionScannedItems(prev => prev.map(item => {
      if (item.id === selectedItemForObs.id) {
        return {
          ...item,
          avaria: hasAvaria,
          avariaDescricao: hasAvaria ? avariaDesc : ''
        };
      }
      return item;
    }));
    setObservacaoModalVisible(false);
  };

  const registrarAcaoOffline = async (eq, reqIdOverride = null) => {
    let finalReqId = reqIdOverride || requisicaoId;
    if (!finalReqId && acao === 'DEVOLUCAO') {
      const itemEmprestado = db.getFirstSync(
        'SELECT requisicaoId FROM ItemRequisicao WHERE equipamentoId = ? AND (statusDevolucao = 0 OR statusDevolucao IS NULL) ORDER BY id DESC',
        [eq.id]
      );
      finalReqId = itemEmprestado?.requisicaoId || 'req-offline';
    }
    if (!finalReqId) finalReqId = 'req-offline';

    try {
      let itemId = null;
      const items = db.getAllSync('SELECT * FROM ItemRequisicao WHERE equipamentoId = ? AND requisicaoId = ? LIMIT 1', [eq.id, finalReqId]);
      
      if (items.length > 0) {
        itemId = items[0].id;
      } else {
        itemId = 'offline-' + Math.random().toString(36).substring(7);
        db.runSync(`INSERT INTO ItemRequisicao (id, requisicaoId, equipamentoId, statusSeparacao, statusDevolucao, synced, offlineAcao)
                    VALUES (?, ?, ?, ?, ?, 0, ?)`, 
          [itemId, finalReqId, eq.id, acao === 'SEPARACAO' ? 1 : 0, acao === 'DEVOLUCAO' ? 1 : 0, acao]);
      }

      const dataHora = new Date().toISOString();
      const payloadObj = { requisicaoId: finalReqId, equipamentoId: eq.id };
      if (eq.avaria) {
          payloadObj.avaria = true;
          payloadObj.avariaDescricao = eq.avariaDescricao;
      }
      const payload = JSON.stringify(payloadObj);
      db.runSync('INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)', [acao, itemId, payload, dataHora]);

      if (acao === 'SEPARACAO') {
        db.runSync('UPDATE ItemRequisicao SET statusSeparacao = 1, synced = 0 WHERE id = ?', [itemId]);
        db.runSync('UPDATE Equipamento SET statusCondicao = "EMPRESTADO", synced = 0 WHERE id = ?', [eq.id]);
      } else if (acao === 'DEVOLUCAO') {
        db.runSync('UPDATE ItemRequisicao SET statusDevolucao = 1, synced = 0 WHERE id = ? OR equipamentoId = ?', [itemId, eq.id]);
        db.runSync('UPDATE Equipamento SET statusCondicao = "DISPONIVEL", synced = 0 WHERE id = ?', [eq.id]);
        db.runSync('UPDATE EmprestimoOffline SET synced = 1 WHERE equipamentoId = ? OR patrimonio = ?', [eq.id, eq.codigoPatrimonio]);
        if (finalReqId && finalReqId !== 'req-offline') {
          db.runSync('UPDATE Requisicao SET status = "DEVOLVIDO" WHERE id = ?', [finalReqId]);
        }
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const finalizarTudo = async () => {
    if (sessionScannedItems.length === 0) {
      Alert.alert('Aviso', 'Nenhum item escaneado!');
      return;
    }
    
    // Se for avulso (não tem requisicaoId prévia), abre modal do solicitante em vez de salvar cego
    if (acao === 'SEPARACAO' && !requisicaoId && !showSolicitanteModal) {
      setShowListModal(false);
      setShowSolicitanteModal(true);
      return;
    }
    
    executarFinalizacao();
  };

  const confirmarSolicitante = () => {
    if (isNovoUsuario) {
      if (!novoNome || !novoDepto) {
        Alert.alert('Aviso', 'Preencha Nome e Departamento.');
        return;
      }
    } else {
      if (!selectedUsuarioId) {
        Alert.alert('Aviso', 'Selecione um usuário ou escolha cadastrar novo.');
        return;
      }
    }

    const offlineReqId = 'req-offline-' + Math.random().toString(36).substring(7);
    const dataHora = new Date().toISOString();

    let solicitanteNome = '';
    let departamento = '';
    let whatsapp = '';
    let usrId = null;

    if (isNovoUsuario) {
      solicitanteNome = novoNome;
      departamento = novoDepto;
      whatsapp = novoWhatsApp;
    } else {
      const u = usuariosDb.find(x => x.id === selectedUsuarioId);
      if (u) {
        solicitanteNome = u.nome;
        departamento = u.departamento;
        whatsapp = u.whatsapp;
        usrId = u.id;
      }
    }

    const payloadObj = {
      requisicaoId: offlineReqId,
      solicitanteNome,
      departamento,
      whatsapp,
      usuarioId: usrId
    };

    db.runSync('INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)', ['NOVA_REQUISICAO_AVULSA', offlineReqId, JSON.stringify(payloadObj), dataHora]);

    executarFinalizacao(offlineReqId);
  };

  const executarFinalizacao = async (reqIdOverride = null) => {
    let sucessos = 0;
    for (const item of sessionScannedItems) {
      const ok = await registrarAcaoOffline(item, reqIdOverride);
      if (ok) sucessos++;
    }

    setShowListModal(false);
    setShowSolicitanteModal(false);
    syncPush().catch(() => {});
    
    Alert.alert('Sucesso', `${sucessos} itens processados e salvos offline!`, [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  };

  return (
    <View style={styles.container}>
      {/* CameraView como base — ocupa todo o espaço do container flex:1 */}
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39"],
        }}
      />
      
      {/* Scanner Overlay — position absolute sobre a câmera */}
      <View style={styles.overlayContainer} pointerEvents="box-none">
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>
            {acao === 'SEPARACAO' ? 'LIBERAÇÃO' : 'DEVOLUÇÃO'}
            {solicitante ? `\nPara: ${solicitante}` : ''}
          </Text>
        </View>
        <View style={styles.middleContainer}>
          <View style={styles.unfocusedSide} />
          <View style={styles.focusedContainer}>
            {/* Corner Borders */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.unfocusedSide} />
        </View>
        <View style={styles.footerContainer}>
          <Text style={styles.helperText}>
            {acao === 'EDITAR'
              ? 'Aponte a câmera para o QR Code para abrir a edição'
              : 'Bipe o código de barras ou o QR Code do equipamento'}
          </Text>
          {acao === 'EDITAR' ? (
            <TouchableOpacity style={[styles.finishBtn, { backgroundColor: '#64748b' }]} onPress={() => navigation.goBack()}>
              <Text style={styles.finishBtnText}>Voltar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.finishBtn} onPress={() => setShowListModal(true)}>
              <Text style={styles.finishBtnText}>✅ Conferir e Finalizar ({sessionScannedItems.length})</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conference Modal */}
      <Modal visible={showListModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { height: '85%', padding: 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lista de Conferência</Text>
              <Text style={{color: '#64748b', marginTop: 4}}>{sessionScannedItems.length} itens bipados</Text>
            </View>
            
            <FlatList
              data={sessionScannedItems}
              keyExtractor={item => item.id}
              style={{ width: '100%', flex: 1 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.listItem, item.avaria && styles.listItemAvaria]}
                  onPress={() => acao === 'DEVOLUCAO' ? openObservationModal(item) : null}
                >
                  {item.fotoUrl ? (
                    <Image source={{ uri: item.fotoUrl.startsWith('/uploads') ? `${API_URL}${item.fotoUrl}` : item.fotoUrl }} style={styles.listItemImage} />
                  ) : (
                    <View style={styles.listItemImagePlaceholder}><Text>📦</Text></View>
                  )}
                  <View style={styles.listItemInfo}>
                    <Text style={styles.listItemName} numberOfLines={1}>{item.nome}</Text>
                    <Text style={styles.listItemPat}>{item.codigoPatrimonio}</Text>
                    {item.avaria && <Text style={{color: '#ef4444', fontSize: 12}}>⚠️ Com avaria</Text>}
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => removeItemFromBuffer(item.id)}>
                    <Text style={styles.deleteBtnText}>❌</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={{ textAlign: 'center', marginTop: 40, color: '#64748b' }}>Nenhum item bipado.</Text>
              )}
            />
            
            <View style={{ flexDirection: 'row', width: '100%', marginTop: 16 }}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#cbd5e1', flex: 1, marginRight: 8 }]} onPress={() => setShowListModal(false)}>
                <Text style={[styles.modalButtonText, { color: '#475569' }]}>Continuar Bipando</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#10b981', flex: 1, marginLeft: 8 }]} onPress={finalizarTudo}>
                <Text style={styles.modalButtonText}>Concluir Tudo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Observation Modal (Devolução) */}
      <Modal visible={observacaoModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { padding: 24, width: '90%' }]}>
            <Text style={styles.modalTitle}>Observação do Item</Text>
            <Text style={{color: '#64748b', marginBottom: 16, textAlign: 'center'}}>{selectedItemForObs?.nome}</Text>
            
            <View style={{ width: '100%', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' }}>
                <Text style={{ color: '#1e293b', fontWeight: 'bold' }}>Equipamento com Avaria?</Text>
                <Switch value={hasAvaria} onValueChange={setHasAvaria} />
              </View>
              {hasAvaria && (
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, color: '#1e293b', minHeight: 80, textAlignVertical: 'top' }}
                  placeholder="Descreva a avaria/defeito..."
                  placeholderTextColor="#94a3b8"
                  value={avariaDesc}
                  onChangeText={setAvariaDesc}
                  multiline
                />
              )}
            </View>

            <View style={{ flexDirection: 'row', width: '100%' }}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#cbd5e1', flex: 1, marginRight: 8 }]} onPress={() => setObservacaoModalVisible(false)}>
                <Text style={[styles.modalButtonText, { color: '#475569' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#4f46e5', flex: 1, marginLeft: 8 }]} onPress={saveObservation}>
                <Text style={styles.modalButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Solicitante Modal (Avulso) */}
      <Modal visible={showSolicitanteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { padding: 24, width: '90%', maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Informações da Liberação</Text>
            <Text style={{color: '#64748b', marginBottom: 16, textAlign: 'center'}}>Selecione para quem os equipamentos serão entregues.</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
              <Text style={{ color: '#1e293b', fontWeight: 'bold' }}>Cadastrar novo na hora?</Text>
              <Switch value={isNovoUsuario} onValueChange={setIsNovoUsuario} />
            </View>

            {isNovoUsuario ? (
              <View style={{ width: '100%' }}>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, color: '#1e293b', marginBottom: 12 }}
                  placeholder="Nome do Solicitante"
                  placeholderTextColor="#94a3b8"
                  value={novoNome}
                  onChangeText={setNovoNome}
                />
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, color: '#1e293b', marginBottom: 12 }}
                  placeholder="Departamento"
                  placeholderTextColor="#94a3b8"
                  value={novoDepto}
                  onChangeText={setNovoDepto}
                />
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, color: '#1e293b', marginBottom: 12 }}
                  placeholder="WhatsApp (ex: 11999999999)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={novoWhatsApp}
                  onChangeText={setNovoWhatsApp}
                />
              </View>
            ) : (
              <ScrollView style={{ width: '100%', maxHeight: 200, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 12 }}>
                {usuariosDb.map((u) => (
                  <TouchableOpacity 
                    key={u.id} 
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: selectedUsuarioId === u.id ? '#e0e7ff' : '#fff' }}
                    onPress={() => setSelectedUsuarioId(u.id)}
                  >
                    <Text style={{ fontWeight: 'bold', color: selectedUsuarioId === u.id ? '#4f46e5' : '#334155' }}>{u.nome}</Text>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>{u.departamento}</Text>
                  </TouchableOpacity>
                ))}
                {usuariosDb.length === 0 && (
                  <Text style={{ padding: 12, color: '#64748b', textAlign: 'center' }}>Nenhum usuário sincronizado.</Text>
                )}
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', width: '100%', marginTop: 8 }}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#cbd5e1', flex: 1, marginRight: 8 }]} onPress={() => setShowSolicitanteModal(false)}>
                <Text style={[styles.modalButtonText, { color: '#475569' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#10b981', flex: 1, marginLeft: 8 }]} onPress={confirmarSolicitante}>
                <Text style={styles.modalButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'transparent' 
  },
  loadingText: { 
    marginTop: 12, 
    color: '#94a3b8', 
    fontSize: 16 
  },
  permissionCard: {
    margin: 24,
    padding: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    width: '100%',
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnTextOnly: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextCancel: {
    color: '#94a3b8',
    fontSize: 16,
  },
  headerContainer: {
    flex: 1.2,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
    textAlign: 'center'
  },
  middleContainer: {
    height: scannerSize,
    flexDirection: 'row',
  },
  unfocusedSide: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  focusedContainer: {
    width: scannerSize,
    height: scannerSize,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#10b981',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  footerContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '95%',
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    marginBottom: 12,
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  finishBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  finishBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    width: '100%',
  },
  listItemAvaria: {
    backgroundColor: '#fef2f2'
  },
  listItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12
  },
  listItemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  listItemPat: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    fontSize: 16,
  }
});
