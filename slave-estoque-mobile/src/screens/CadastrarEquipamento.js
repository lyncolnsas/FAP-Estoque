import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  Alert, 
  ScrollView, 
  Switch, 
  Modal, 
  FlatList,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { db } from '../db/database';
import { imprimirEtiqueta } from '../services/printer';

export default function CadastrarEquipamentoScreen({ navigation }) {
  // Form State
  const [nome, setNome] = useState('');
  const [codigoPatrimonio, setCodigoPatrimonio] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [permitirEmprestimo, setPermitirEmprestimo] = useState(true);
  const [recebeuComDefeito, setRecebeuComDefeito] = useState(false);
  const [avariaId, setAvariaId] = useState('');
  const [avariaDescricao, setAvariaDescricao] = useState('');
  const [fotoUri, setFotoUri] = useState(null);

  // Lists from DB
  const [categorias, setCategorias] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [tiposAvaria, setTiposAvaria] = useState([]);

  // UI State
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [pickerType, setPickerType] = useState(''); // 'CATEGORIA' | 'TIPO' | 'AVARIA'
  const [scannerModalVisible, setScannerModalVisible] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [hasCameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    carregarAuxiliares();
  }, []);

  const carregarAuxiliares = () => {
    try {
      const cats = db.getAllSync('SELECT * FROM Categoria ORDER BY nome ASC');
      const avarias = db.getAllSync('SELECT * FROM TipoAvaria ORDER BY nome ASC');
      setCategorias(cats);
      setTiposAvaria(avarias);
    } catch (e) {
      console.error('Erro ao carregar tabelas auxiliares:', e);
    }
  };

  const handleSelectCategoria = (catId) => {
    setCategoriaId(catId);
    setTipoId(''); // Reset tipo
    try {
      const filteredTipos = db.getAllSync('SELECT * FROM TipoEquipamento WHERE categoriaId = ? ORDER BY nome ASC', [catId]);
      setTipos(filteredTipos);
    } catch (e) {
      console.error('Erro ao carregar tipos para categoria:', e);
    }
  };

  const processImage = async (uri) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }], // Reduz a resolução
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG } // Compressão forte para ficar < 500kb
      );
      setFotoUri(manipResult.uri);
    } catch (e) {
      console.error('Erro ao comprimir imagem:', e);
      setFotoUri(uri);
    }
  };

  const tirarFoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão', 'É necessária permissão para usar a câmera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      await processImage(result.assets[0].uri);
    }
  };

  const escolherGaleria = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão', 'É necessária permissão para acessar a galeria.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      await processImage(result.assets[0].uri);
    }
  };

  const abrirScanner = async () => {
    if (!hasCameraPermission || !hasCameraPermission.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert('Permissão', 'É necessário acesso à câmera para ler código de barras.');
        return;
      }
    }
    setScannerModalVisible(true);
    setTimeout(() => {
      setIsCameraReady(true);
    }, 400); // Wait for modal animation
  };

  const fecharScanner = () => {
    setIsCameraReady(false);
    setScannerModalVisible(false);
  };

  const handleBarcodeScanned = ({ data }) => {
    setCodigoPatrimonio(data);
    fecharScanner();
  };

  const gerarPatrimonio = () => {
    if (!nome) {
      Alert.alert('Atenção', 'Digite o nome do equipamento primeiro para gerar o código corretamente.');
      return;
    }
    const prefix = nome.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(n => n.length > 0).map(n => n.substring(0, 3).toUpperCase()).slice(0, 2).join('-');
    const randomCode = prefix + '-' + Math.floor(Math.random() * 90000 + 10000);
    setCodigoPatrimonio(randomCode);
  };

  const salvarOffline = () => {
    if (!nome || !codigoPatrimonio) {
      Alert.alert('Atenção', 'Preencha o nome e o código de patrimônio.');
      return;
    }
    if (recebeuComDefeito && !avariaId) {
      Alert.alert('Atenção', 'Selecione o tipo de avaria.');
      return;
    }

    try {
      const idOffline = 'eq-' + Math.random().toString(36).substring(7);
      const statusCondicao = recebeuComDefeito ? 'COM_DEFEITO' : 'DISPONIVEL';

      // Salva no banco SQLite local
      db.runSync(`
        INSERT INTO Equipamento (id, codigoPatrimonio, nome, categoriaId, tipoId, statusCondicao, permitirEmprestimo, recebeuComDefeito, fotoUrl, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, [
        idOffline, 
        codigoPatrimonio, 
        nome, 
        categoriaId || '', 
        tipoId || '', 
        statusCondicao, 
        permitirEmprestimo ? 1 : 0, 
        recebeuComDefeito ? 1 : 0,
        fotoUri
      ]);

      // Se tiver avaria inicial, insere localmente na tabela HistoricoAvaria
      if (recebeuComDefeito) {
        const idAvaria = 'av-' + Math.random().toString(36).substring(7);
        db.runSync(`
          INSERT INTO HistoricoAvaria (id, equipamentoId, requisicaoId, tipoAvariaId, descricao, resolvido, dataRegistro)
          VALUES (?, ?, null, ?, ?, 0, ?)
        `, [
          idAvaria,
          idOffline,
          avariaId,
          avariaDescricao || 'Defeito inicial cadastrado via app offline',
          new Date().toISOString()
        ]);
      }

      // Cria a ação no OfflineLog
      const payload = JSON.stringify({
        id: idOffline,
        nome,
        codigoPatrimonio,
        categoriaId: categoriaId || '',
        tipoId: tipoId || '',
        statusCondicao,
        permitirEmprestimo,
        recebeuComDefeito,
        avariaId: recebeuComDefeito ? avariaId : null,
        avariaDescricao: recebeuComDefeito ? avariaDescricao : null,
        fotoUrl: fotoUri
      });

      db.runSync(`INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)`, 
        ['NOVO_EQUIPAMENTO', idOffline, payload, new Date().toISOString()]);

      Alert.alert(
        'Sucesso', 
        'Equipamento salvo offline! Deseja imprimir a etiqueta agora?',
        [
          { text: 'Não', onPress: () => navigation.goBack() },
          { text: 'Sim (58mm)', onPress: async () => { await imprimirEtiqueta({ nome, codigoPatrimonio }, '58mm'); navigation.goBack(); } },
          { text: 'Sim (80mm)', onPress: async () => { await imprimirEtiqueta({ nome, codigoPatrimonio }, '80mm'); navigation.goBack(); } }
        ]
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível salvar o equipamento offline.');
    }
  };

  const getNomeCategoria = () => {
    const cat = categorias.find(c => c.id === categoriaId);
    return cat ? cat.nome : 'Selecione uma Categoria';
  };

  const getNomeTipo = () => {
    const t = tipos.find(x => x.id === tipoId);
    return t ? t.nome : 'Selecione um Tipo';
  };

  const getNomeAvaria = () => {
    const a = tiposAvaria.find(x => x.id === avariaId);
    return a ? a.nome : 'Selecione o Tipo de Avaria';
  };

  const showPicker = (type) => {
    if (type === 'TIPO' && !categoriaId) {
      Alert.alert('Aviso', 'Selecione uma Categoria primeiro.');
      return;
    }
    setPickerType(type);
    setPickerModalVisible(true);
  };

  const selectPickerItem = (item) => {
    if (pickerType === 'CATEGORIA') {
      handleSelectCategoria(item.id);
    } else if (pickerType === 'TIPO') {
      setTipoId(item.id);
    } else if (pickerType === 'AVARIA') {
      setAvariaId(item.id);
    }
    setPickerModalVisible(false);
  };

  const getPickerData = () => {
    if (pickerType === 'CATEGORIA') return categorias;
    if (pickerType === 'TIPO') return tipos;
    if (pickerType === 'AVARIA') return tiposAvaria;
    return [];
  };

  return (
    <View style={styles.mainContainer}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Informações Gerais</Text>

          <Text style={styles.label}>Nome do Equipamento *</Text>
          <TextInput 
            style={styles.input} 
            value={nome} 
            onChangeText={setNome} 
            placeholder="Ex: Projetor Epson X41" 
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Código de Patrimônio *</Text>
          <View style={styles.patrimonyRow}>
            <TextInput 
              style={[styles.input, styles.patrimonyInput]} 
              value={codigoPatrimonio} 
              onChangeText={setCodigoPatrimonio} 
              placeholder="Ex: PAT-998822" 
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity style={[styles.scanButton, { backgroundColor: '#10b981', marginRight: 8 }]} onPress={gerarPatrimonio}>
              <Text style={styles.scanBtnText}>🔄 Gerar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scanButton} onPress={abrirScanner}>
              <Text style={styles.scanBtnText}>📷 Escanear</Text>
            </TouchableOpacity>
          </View>

          {/* Categoria Dropdown */}
          <Text style={styles.label}>Categoria</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => showPicker('CATEGORIA')}>
            <Text style={[styles.dropdownText, !categoriaId && styles.placeholderText]}>
              {getNomeCategoria()}
            </Text>
            <Text style={styles.arrowIcon}>▼</Text>
          </TouchableOpacity>

          {/* Tipo Dropdown */}
          <Text style={styles.label}>Tipo de Equipamento</Text>
          <TouchableOpacity style={[styles.dropdown, !categoriaId && styles.dropdownDisabled]} onPress={() => showPicker('TIPO')}>
            <Text style={[styles.dropdownText, !tipoId && styles.placeholderText]}>
              {getNomeTipo()}
            </Text>
            <Text style={styles.arrowIcon}>▼</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Regras & Condições</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchTextContainer}>
              <Text style={styles.switchLabel}>Disponível para Empréstimo</Text>
              <Text style={styles.switchSubLabel}>Permite reservar e retirar este item.</Text>
            </View>
            <Switch 
              value={permitirEmprestimo} 
              onValueChange={setPermitirEmprestimo}
              trackColor={{ false: '#cbd5e1', true: '#a7f3d0' }}
              thumbColor={permitirEmprestimo ? '#10b981' : '#64748b'}
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.switchRow}>
            <View style={styles.switchTextContainer}>
              <Text style={styles.switchLabel}>Cadastrar com Defeito / Avaria</Text>
              <Text style={styles.switchSubLabel}>Ative se o item já foi recebido com problemas.</Text>
            </View>
            <Switch 
              value={recebeuComDefeito} 
              onValueChange={setRecebeuComDefeito}
              trackColor={{ false: '#cbd5e1', true: '#fecaca' }}
              thumbColor={recebeuComDefeito ? '#ef4444' : '#64748b'}
            />
          </View>

          {/* Condicional de Avaria */}
          {recebeuComDefeito && (
            <View style={styles.avariaContainer}>
              <Text style={styles.label}>Tipo de Avaria *</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => showPicker('AVARIA')}>
                <Text style={[styles.dropdownText, !avariaId && styles.placeholderText]}>
                  {getNomeAvaria()}
                </Text>
                <Text style={styles.arrowIcon}>▼</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Descrição da Avaria</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                value={avariaDescricao} 
                onChangeText={setAvariaDescricao} 
                placeholder="Descreva o problema detalhadamente..." 
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
              />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Mídia do Equipamento</Text>
          <Text style={styles.switchSubLabel}>Adicione uma foto tirando na hora ou da galeria.</Text>

          <View style={styles.mediaButtons}>
            <TouchableOpacity style={styles.mediaBtn} onPress={tirarFoto}>
              <Text style={styles.mediaBtnText}>📸 Tirar Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mediaBtn, styles.mediaBtnOutline]} onPress={escolherGaleria}>
              <Text style={styles.mediaBtnTextOutline}>🖼️ Galeria</Text>
            </TouchableOpacity>
          </View>

          {fotoUri && (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: fotoUri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.deleteImageBtn} onPress={() => setFotoUri(null)}>
                <Text style={styles.deleteImageText}>Remover Foto</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={salvarOffline}>
          <Text style={styles.submitButtonText}>Salvar Offline</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Select Picker Modal */}
      <Modal visible={pickerModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {pickerType === 'CATEGORIA' && 'Selecionar Categoria'}
                {pickerType === 'TIPO' && 'Selecionar Tipo'}
                {pickerType === 'AVARIA' && 'Selecionar Avaria'}
              </Text>
              <TouchableOpacity onPress={() => setPickerModalVisible(false)}>
                <Text style={styles.closePickerBtn}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <FlatList 
              data={getPickerData()}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => selectPickerItem(item)}>
                  <Text style={styles.pickerItemText}>{item.nome}</Text>
                  {item.descricao && <Text style={styles.pickerItemDesc}>{item.descricao}</Text>}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.pickerSeparator} />}
              ListEmptyComponent={() => (
                <Text style={styles.emptyPickerText}>Nenhum item disponível.</Text>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal visible={scannerModalVisible} animationType="fade">
        <View style={styles.scannerModalContainer}>
          {isCameraReady && (
            <View style={StyleSheet.absoluteFillObject}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39"],
                }}
              />
            </View>
          )}
          <View style={styles.scannerModalOverlay}>
            <View style={styles.scannerModalHeader}>
              <Text style={styles.scannerModalTitle}>Escaneie o Código de Barras</Text>
            </View>
            <View style={styles.scannerTargetBox} />
            <TouchableOpacity style={styles.closeScannerButton} onPress={fecharScanner}>
              <Text style={styles.closeScannerText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { 
    flex: 1, 
    backgroundColor: '#f1f5f9' 
  },
  scrollContainer: { 
    padding: 16, 
    paddingBottom: 40 
  },
  card: { 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#0f172a', 
    marginBottom: 16 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#334155', 
    marginBottom: 6,
    marginTop: 10
  },
  input: { 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#cbd5e1', 
    borderRadius: 10,
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    fontSize: 15,
    color: '#0f172a',
  },
  patrimonyRow: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  patrimonyInput: { 
    flex: 1, 
    marginRight: 10 
  },
  scanButton: { 
    backgroundColor: '#4f46e5', 
    borderRadius: 10, 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scanBtnText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  dropdown: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#cbd5e1', 
    borderRadius: 10,
    paddingHorizontal: 14, 
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 10
  },
  dropdownDisabled: {
    backgroundColor: '#e2e8f0',
    borderColor: '#cbd5e1',
    opacity: 0.6
  },
  dropdownText: { 
    fontSize: 15, 
    color: '#0f172a' 
  },
  placeholderText: { 
    color: '#94a3b8' 
  },
  arrowIcon: { 
    fontSize: 10, 
    color: '#64748b' 
  },
  switchRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 8
  },
  switchTextContainer: { 
    flex: 0.85 
  },
  switchLabel: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#334155' 
  },
  switchSubLabel: { 
    fontSize: 12, 
    color: '#64748b', 
    marginTop: 2 
  },
  separator: { 
    height: 1, 
    backgroundColor: '#e2e8f0', 
    marginVertical: 10 
  },
  avariaContainer: { 
    backgroundColor: '#fef2f2', 
    padding: 12, 
    borderRadius: 12, 
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  textArea: { 
    minHeight: 80, 
    textAlignVertical: 'top' 
  },
  mediaButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 12 
  },
  mediaBtn: { 
    flex: 0.48, 
    backgroundColor: '#4f46e5', 
    padding: 12, 
    borderRadius: 10, 
    alignItems: 'center' 
  },
  mediaBtnOutline: { 
    backgroundColor: 'transparent', 
    borderWidth: 1, 
    borderColor: '#4f46e5' 
  },
  mediaBtnText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  mediaBtnTextOutline: { 
    color: '#4f46e5', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  imagePreviewContainer: { 
    alignItems: 'center', 
    marginTop: 16 
  },
  imagePreview: { 
    width: 200, 
    height: 200, 
    borderRadius: 12 
  },
  deleteImageBtn: { 
    marginTop: 8, 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    backgroundColor: '#ef4444', 
    borderRadius: 8 
  },
  deleteImageText: { 
    color: '#ffffff', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  submitButton: { 
    backgroundColor: '#10b981', 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    marginVertical: 20,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3
  },
  submitButtonText: { 
    color: '#ffffff', 
    fontSize: 16, 
    fontWeight: '700' 
  },
  // Modal Picker
  modalBg: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.6)', 
    justifyContent: 'flex-end' 
  },
  pickerCard: { 
    backgroundColor: '#ffffff', 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    maxHeight: '60%', 
    padding: 16 
  },
  pickerHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  pickerTitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#0f172a' 
  },
  closePickerBtn: { 
    color: '#4f46e5', 
    fontWeight: '600', 
    fontSize: 15 
  },
  pickerItem: { 
    paddingVertical: 14, 
    paddingHorizontal: 8 
  },
  pickerItemText: { 
    fontSize: 15, 
    color: '#1e293b', 
    fontWeight: '600' 
  },
  pickerItemDesc: { 
    fontSize: 12, 
    color: '#64748b', 
    marginTop: 2 
  },
  pickerSeparator: { 
    height: 1, 
    backgroundColor: '#f1f5f9' 
  },
  emptyPickerText: { 
    textAlign: 'center', 
    color: '#94a3b8', 
    padding: 24 
  },
  // Scanner Modal
  scannerModalContainer: { 
    flex: 1, 
    backgroundColor: 'transparent' 
  },
  scannerModalOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 40 
  },
  scannerModalHeader: { 
    backgroundColor: 'rgba(15, 23, 42, 0.8)', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20 
  },
  scannerModalTitle: { 
    color: '#ffffff', 
    fontSize: 15, 
    fontWeight: '600' 
  },
  scannerTargetBox: { 
    width: 250, 
    height: 150, 
    borderColor: '#4f46e5', 
    borderWidth: 2, 
    borderRadius: 12, 
    backgroundColor: 'transparent' 
  },
  closeScannerButton: { 
    backgroundColor: '#ef4444', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 12 
  },
  closeScannerText: { 
    color: '#ffffff', 
    fontSize: 15, 
    fontWeight: '600' 
  }
});
