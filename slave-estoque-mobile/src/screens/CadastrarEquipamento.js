import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, Alert, ScrollView, Modal, FlatList,
  ActivityIndicator, SafeAreaView, Platform, StatusBar
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { CameraView, useCameraPermissions } from "expo-camera";
import { db } from "../db/database";
import { imprimirEtiqueta } from "../services/printer";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { API_URL } from "../services/api";
import {
  Camera, Image as ImageIcon, Plus, CheckSquare,
  Square, ChevronDown, Barcode, Trash2, X, RefreshCw,
  Crop, Sliders, Check, QrCode, Save, Wrench, AlertTriangle, CheckCircle2,
  RotateCw, FlipHorizontal
} from "lucide-react-native";

export default function CadastrarEquipamentoScreen({ navigation, route }) {
  const keyboardHeight = useKeyboardHeight();
  const { equipamentoId, modoEdicao, codigoPatrimonio: codigoPatrimonioParam } = route?.params || {};
  const isEditing = Boolean(equipamentoId || modoEdicao);

  // Form State
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [codigoPatrimonio, setCodigoPatrimonio] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [permitirEmprestimo, setPermitirEmprestimo] = useState(true);
  const [statusCondicao, setStatusCondicao] = useState("DISPONIVEL");
  const [recebeuComDefeito, setRecebeuComDefeito] = useState(false);
  const [avariaId, setAvariaId] = useState("");
  const [avariaDescricao, setAvariaDescricao] = useState("");
  const [fotoUri, setFotoUri] = useState(null);

  // Crop & Rotation Studio
  const [cropImageRaw, setCropImageRaw] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);

  // Auxiliares
  const [categorias, setCategorias] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [tiposAvaria, setTiposAvaria] = useState([]);

  // Modais de Seleção
  const [showModalCat, setShowModalCat] = useState(false);
  const [showModalTipo, setShowModalTipo] = useState(false);
  const [showModalAvaria, setShowModalAvaria] = useState(false);

  // Modais de Criação Rápida
  const [showModalCriarCat, setShowModalCriarCat] = useState(false);
  const [showModalCriarTipo, setShowModalCriarTipo] = useState(false);
  const [novaCatNome, setNovaCatNome] = useState("");
  const [novoTipoNome, setNovoTipoNome] = useState("");

  // Scanner
  const [scannerVisible, setScannerVisible] = useState(false);
  const [hasCameraPermission, requestCameraPermission] = useCameraPermissions();
  const [saving, setSaving] = useState(false);

  const carregarAuxiliares = useCallback(() => {
    try {
      const cats = db.getAllSync("SELECT * FROM Categoria ORDER BY nome ASC");
      const avarias = db.getAllSync("SELECT * FROM TipoAvaria ORDER BY nome ASC");
      setCategorias(cats);
      setTiposAvaria(avarias);
    } catch (e) {
      console.error("Erro ao carregar tabelas auxiliares:", e);
    }
  }, []);

  useEffect(() => {
    carregarAuxiliares();
  }, [carregarAuxiliares]);

  // Carregar dados para edição se houver equipamentoId ou parametro
  useEffect(() => {
    if (equipamentoId) {
      try {
        const eqRows = db.getAllSync(
          "SELECT * FROM Equipamento WHERE id = ? OR codigoPatrimonio = ?",
          [equipamentoId, equipamentoId]
        );
        if (eqRows.length > 0) {
          const eq = eqRows[0];
          setNome(eq.nome || "");
          setCodigoPatrimonio(eq.codigoPatrimonio || "");
          setCategoriaId(eq.categoriaId || "");
          setTipoId(eq.tipoId || "");
          setPermitirEmprestimo(eq.permitirEmprestimo === 1 || eq.permitirEmprestimo === true);
          setStatusCondicao(eq.statusCondicao || "DISPONIVEL");
          setFotoUri(eq.fotoUrl || null);

          if (eq.categoriaId) {
            const filteredTipos = db.getAllSync(
              "SELECT * FROM TipoEquipamento WHERE categoriaId = ? ORDER BY nome ASC",
              [eq.categoriaId]
            );
            setTipos(filteredTipos);
          }

          // Carrega avaria ativa
          const avs = db.getAllSync(
            "SELECT * FROM HistoricoAvaria WHERE equipamentoId = ? AND (resolvido = 0 OR resolvido IS NULL) ORDER BY dataRegistro DESC",
            [eq.id]
          );
          if (avs.length > 0) {
            setRecebeuComDefeito(true);
            setAvariaId(avs[0].tipoAvariaId || "");
            setAvariaDescricao(avs[0].descricao || "");
          } else {
            setRecebeuComDefeito(eq.statusCondicao === "COM_DEFEITO");
          }
        }
      } catch (e) {
        console.error("Erro ao carregar equipamento para edição:", e);
      }
    } else if (codigoPatrimonioParam) {
      setCodigoPatrimonio(codigoPatrimonioParam);
    }
  }, [equipamentoId, codigoPatrimonioParam]);

  const handleSelectCategoria = (cat) => {
    setCategoriaId(cat.id);
    setTipoId("");
    try {
      const filteredTipos = db.getAllSync(
        "SELECT * FROM TipoEquipamento WHERE categoriaId = ? ORDER BY nome ASC",
        [cat.id]
      );
      setTipos(filteredTipos);
    } catch (e) {
      console.error("Erro ao carregar tipos:", e);
    }
    setShowModalCat(false);
  };

  const tirarFoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        return Alert.alert("Permissão", "É necessária permissão para usar a câmera.");
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFotoUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error("Erro ao tirar foto:", e);
      Alert.alert("Erro", "Falha ao abrir a câmera.");
    }
  };

  const escolherGaleria = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return Alert.alert("Permissão", "É necessária permissão para acessar a galeria.");
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFotoUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error("Erro ao selecionar imagem:", e);
      Alert.alert("Erro", "Falha ao acessar a galeria.");
    }
  };

  const handleGirar90 = async () => {
    if (!fotoUri) return;
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        fotoUri,
        [{ rotate: 90 }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      setFotoUri(manipResult.uri);
    } catch (e) {
      console.error("Erro ao girar imagem:", e);
    }
  };

  const handleEspelhar = async () => {
    if (!fotoUri) return;
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        fotoUri,
        [{ flip: ImageManipulator.FlipType.Horizontal }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      setFotoUri(manipResult.uri);
    } catch (e) {
      console.error("Erro ao espelhar imagem:", e);
    }
  };

  const gerarCodigoBase = () => {
    const cat = categorias.find(c => c.id === categoriaId);
    const tipo = tipos.find(t => t.id === tipoId);

    let prefixoCat = "EQP";
    if (cat?.nome) {
      prefixoCat = cat.nome.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(3, "X");
    } else if (nome.trim()) {
      prefixoCat = nome.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(3, "X");
    }

    let prefixoTipo = "GER";
    if (tipo?.nome) {
      prefixoTipo = tipo.nome.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(3, "X");
    } else if (nome.trim()) {
      const words = nome.trim().split(" ");
      if (words.length > 1) {
        prefixoTipo = words[1].substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(3, "X");
      }
    }

    return `${prefixoCat}-${prefixoTipo}`;
  };

  const gerarPatrimonioUnico = () => {
    if (!nome.trim() && !categoriaId) {
      return Alert.alert("Atenção", "Selecione a categoria ou digite o nome primeiro.");
    }
    const prefix = gerarCodigoBase();
    let codigoGerado = "";
    let existe = true;
    while (existe) {
      const num = Math.floor(1000 + Math.random() * 90000);
      codigoGerado = `${prefix}-${num}`;
      const check = db.getAllSync("SELECT id FROM Equipamento WHERE codigoPatrimonio = ?", [codigoGerado]);
      if (check.length === 0) existe = false;
    }
    setCodigoPatrimonio(codigoGerado);
  };

  const handleCriarCategoriaRapida = () => {
    if (!novaCatNome.trim()) return Alert.alert("Atenção", "Digite o nome da categoria.");
    const id = `cat-${Date.now()}`;
    const nomeUp = novaCatNome.trim().toUpperCase();
    try {
      db.runSync("INSERT INTO Categoria (id, nome) VALUES (?, ?)", [id, nomeUp]);
      db.runSync(
        "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
        ["NOVA_CATEGORIA", id, JSON.stringify({ id, nome: nomeUp }), new Date().toISOString()]
      );
      carregarAuxiliares();
      setCategoriaId(id);
      setNovaCatNome("");
      setShowModalCriarCat(false);
      Alert.alert("Sucesso", `Categoria "${nomeUp}" criada e selecionada!`);
    } catch (e) {
      Alert.alert("Erro", "Falha ao criar categoria.");
    }
  };

  const handleCriarTipoRapido = () => {
    if (!categoriaId) return Alert.alert("Atenção", "Selecione a categoria primeiro.");
    if (!novoTipoNome.trim()) return Alert.alert("Atenção", "Digite o nome do subtipo.");
    const id = `tip-${Date.now()}`;
    const nomeTipo = novoTipoNome.trim();
    try {
      db.runSync("INSERT INTO TipoEquipamento (id, categoriaId, nome) VALUES (?, ?, ?)", [id, categoriaId, nomeTipo]);
      db.runSync(
        "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
        ["NOVO_TIPO_EQUIPAMENTO", id, JSON.stringify({ id, categoriaId, nome: nomeTipo }), new Date().toISOString()]
      );
      const filteredTipos = db.getAllSync(
        "SELECT * FROM TipoEquipamento WHERE categoriaId = ? ORDER BY nome ASC",
        [categoriaId]
      );
      setTipos(filteredTipos);
      setTipoId(id);
      setNovoTipoNome("");
      setShowModalCriarTipo(false);
      Alert.alert("Sucesso", `Subtipo "${nomeTipo}" criado e selecionado!`);
    } catch (e) {
      Alert.alert("Erro", "Falha ao criar subtipo.");
    }
  };

  const handleSalvarEquipamento = () => {
    if (!nome.trim()) {
      return Alert.alert("Atenção", "Preencha o nome do equipamento.");
    }
    const qty = parseInt(quantidade, 10) || 1;
    if (qty === 1 && !codigoPatrimonio.trim()) {
      return Alert.alert("Atenção", "Informe ou gere o código de patrimônio.");
    }

    setSaving(true);
    try {
      // ----------------------------------------------------
      // FLUXO DE EDIÇÃO
      // ----------------------------------------------------
      if (isEditing && equipamentoId) {
        let statusFinal = statusCondicao;
        if (recebeuComDefeito && statusFinal !== "EM_MANUTENCAO") {
          statusFinal = "COM_DEFEITO";
        } else if (!recebeuComDefeito && statusFinal === "COM_DEFEITO") {
          statusFinal = "DISPONIVEL";
        }

        db.runSync(
          `UPDATE Equipamento 
           SET nome = ?, codigoPatrimonio = ?, categoriaId = ?, tipoId = ?, statusCondicao = ?, permitirEmprestimo = ?, recebeuComDefeito = ?, fotoUrl = ?, synced = 0
           WHERE id = ?`,
          [
            nome.trim(),
            codigoPatrimonio.trim(),
            categoriaId || "",
            tipoId || "",
            statusFinal,
            permitirEmprestimo ? 1 : 0,
            recebeuComDefeito ? 1 : 0,
            fotoUri,
            equipamentoId
          ]
        );

        if (recebeuComDefeito && avariaId) {
          const idAvaria = `av-${Date.now()}`;
          db.runSync(
            `INSERT INTO HistoricoAvaria (id, equipamentoId, requisicaoId, tipoAvariaId, descricao, resolvido, dataRegistro, synced)
             VALUES (?, ?, null, ?, ?, 0, ?, 0)`,
            [idAvaria, equipamentoId, avariaId, avariaDescricao.trim() || "Avaria atualizada no app", new Date().toISOString()]
          );
        } else if (statusFinal === "DISPONIVEL") {
          db.runSync(
            `UPDATE HistoricoAvaria SET resolvido = 1, dataResolucao = ?, synced = 0 WHERE equipamentoId = ? AND resolvido = 0`,
            [new Date().toISOString(), equipamentoId]
          );
        }

        const payload = JSON.stringify({
          id: equipamentoId,
          nome: nome.trim(),
          codigoPatrimonio: codigoPatrimonio.trim(),
          categoriaId: categoriaId || "",
          tipoId: tipoId || "",
          statusCondicao: statusFinal,
          permitirEmprestimo,
          recebeuComDefeito,
          avariaId: recebeuComDefeito ? avariaId : null,
          avariaDescricao: recebeuComDefeito ? avariaDescricao : null,
          fotoUrl: fotoUri
        });

        db.runSync(
          `INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)`,
          ["EDITAR_EQUIPAMENTO", equipamentoId, payload, new Date().toISOString()]
        );

        Alert.alert(
          "Alterações Salvas!",
          `O equipamento "${nome}" foi atualizado com sucesso no banco offline.`,
          [
            { text: "Concluir", onPress: () => navigation.goBack() },
            {
              text: "Imprimir Etiqueta",
              onPress: async () => {
                await imprimirEtiqueta({ nome: nome.trim(), codigoPatrimonio: codigoPatrimonio.trim() }, "58mm");
                navigation.goBack();
              }
            }
          ]
        );
        return;
      }

      // ----------------------------------------------------
      // FLUXO DE NOVO CADASTRO
      // ----------------------------------------------------
      if (qty < 1) {
        return Alert.alert("Atenção", "A quantidade deve ser pelo menos 1.");
      }
      if (recebeuComDefeito && qty > 1) {
        return Alert.alert("Atenção", "Não é possível cadastrar itens em lote com defeito inicial. Cadastre individualmente se houver avaria.");
      }
      if (recebeuComDefeito && !avariaId) {
        return Alert.alert("Atenção", "Selecione o tipo de avaria inicial.");
      }

      const prefix = gerarCodigoBase();
      const statusCondicaoFinal = recebeuComDefeito ? "COM_DEFEITO" : "DISPONIVEL";
      const itensCriados = [];

      for (let i = 0; i < qty; i++) {
        const idOffline = `eq-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`;
        
        let code = "";
        if (qty === 1 && codigoPatrimonio.trim()) {
          code = codigoPatrimonio.trim();
        } else {
          let existe = true;
          while (existe) {
            const num = Math.floor(1000 + Math.random() * 90000);
            code = `${prefix}-${num}`;
            const check = db.getAllSync("SELECT id FROM Equipamento WHERE codigoPatrimonio = ?", [code]);
            if (check.length === 0 && !itensCriados.some(it => it.codigoPatrimonio === code)) {
              existe = false;
            }
          }
        }

        db.runSync(
          `INSERT INTO Equipamento (id, codigoPatrimonio, nome, categoriaId, tipoId, statusCondicao, permitirEmprestimo, recebeuComDefeito, fotoUrl, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            idOffline, code, nome.trim(), categoriaId || "", tipoId || "",
            statusCondicaoFinal, permitirEmprestimo ? 1 : 0, recebeuComDefeito ? 1 : 0, fotoUri
          ]
        );

        if (recebeuComDefeito) {
          const idAvaria = `av-${Date.now()}-${i}`;
          db.runSync(
            `INSERT INTO HistoricoAvaria (id, equipamentoId, requisicaoId, tipoAvariaId, descricao, resolvido, dataRegistro, synced)
             VALUES (?, ?, null, ?, ?, 0, ?, 0)`,
            [idAvaria, idOffline, avariaId, avariaDescricao.trim() || "Defeito inicial cadastrado no app", new Date().toISOString()]
          );
        }

        const payload = JSON.stringify({
          id: idOffline,
          nome: nome.trim(),
          codigoPatrimonio: code,
          categoriaId: categoriaId || "",
          tipoId: tipoId || "",
          statusCondicao: statusCondicaoFinal,
          permitirEmprestimo,
          recebeuComDefeito,
          avariaId: recebeuComDefeito ? avariaId : null,
          avariaDescricao: recebeuComDefeito ? avariaDescricao : null,
          fotoUrl: fotoUri
        });

        db.runSync(
          `INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)`,
          ["NOVO_EQUIPAMENTO", idOffline, payload, new Date().toISOString()]
        );

        itensCriados.push({ nome: nome.trim(), codigoPatrimonio: code });
      }

      Alert.alert(
        "Cadastro Realizado!",
        qty === 1
          ? `Equipamento "${nome}" salvo offline!\nDeseja imprimir a etiqueta?`
          : `${qty} equipamentos salvos com sucesso em lote!`,
        [
          { text: "Concluir", onPress: () => navigation.goBack() },
          {
            text: "Imprimir Etiqueta (58mm)",
            onPress: async () => {
              for (const item of itensCriados) {
                await imprimirEtiqueta(item, "58mm");
              }
              navigation.goBack();
            }
          }
        ]
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Não foi possível salvar o equipamento.");
    } finally {
      setSaving(false);
    }
  };

  const catSelecionada = categorias.find(c => c.id === categoriaId);
  const tipoSelecionado = tipos.find(t => t.id === tipoId);
  const avariaSelecionada = tiposAvaria.find(a => a.id === avariaId);
  const qtyNum = parseInt(quantidade, 10) || 1;

  // Imagem para exibição
  const displayImageUri = fotoUri
    ? (fotoUri.startsWith('/uploads') ? `${API_URL}${fotoUri}` : fotoUri)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(140, keyboardHeight + 80) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* CABEÇALHO DO MODO */}
          {isEditing && (
            <View style={styles.editModeHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <QrCode size={20} color="#4f46e5" />
                <View>
                  <Text style={styles.editModeTitle}>Modo de Edição de Equipamento</Text>
                  <Text style={styles.editModeSub}>Patrimônio: {codigoPatrimonio}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.btnScanAnother}
                onPress={() => navigation.replace("BarcodeScanner", { acao: "EDITAR" })}
              >
                <Barcode size={16} color="#4f46e5" />
                <Text style={styles.btnScanAnotherText}>Outro QR</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* FOTO COM CORTE NATIVO 1:1 E FERRAMENTAS RÁPIDAS */}
          <Text style={styles.sectionLabel}>Foto (Formato Quadrado 1:1)</Text>
          {displayImageUri ? (
            <View style={styles.squarePhotoWrapper}>
              <View style={styles.squarePhotoContainer}>
                <Image source={{ uri: displayImageUri }} style={styles.squarePhoto} resizeMode="cover" />
              </View>
              <View style={styles.photoControlsRow}>
                <TouchableOpacity style={styles.photoControlBtn} onPress={handleGirar90}>
                  <RotateCw size={16} color="#4f46e5" />
                  <Text style={styles.photoControlBtnText}>Girar 90°</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoControlBtn} onPress={handleEspelhar}>
                  <FlipHorizontal size={16} color="#4f46e5" />
                  <Text style={styles.photoControlBtnText}>Espelhar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoControlBtn} onPress={tirarFoto}>
                  <Camera size={16} color="#2563eb" />
                  <Text style={styles.photoControlBtnText}>Nova Foto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoControlBtn, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}
                  onPress={() => setFotoUri(null)}
                >
                  <Trash2 size={16} color="#dc2626" />
                  <Text style={[styles.photoControlBtnText, { color: "#dc2626" }]}>Remover</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.photoPickerBox}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={styles.photoActionBtn} onPress={tirarFoto}>
                  <Camera size={20} color="#4f46e5" />
                  <Text style={styles.photoActionBtnText}>Tirar Foto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoActionBtn} onPress={escolherGaleria}>
                  <ImageIcon size={20} color="#4f46e5" />
                  <Text style={styles.photoActionBtnText}>Galeria</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.photoHelperText}>Corte nativo com pinça e enquadramento 1:1 a 60/120 FPS</Text>
            </View>
          )}

          {/* NOME */}
          <Text style={styles.sectionLabel}>Nome do Material / Equipamento</Text>
          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: Câmera Sony A7III, Microfone Hollyland..."
            placeholderTextColor="#94a3b8"
            autoCapitalize="words"
          />

          {/* QUANTIDADE E CÓDIGO */}
          {!isEditing ? (
            <View style={styles.row}>
              <View style={{ width: 110, marginRight: 10 }}>
                <Text style={styles.sectionLabel}>Quantidade</Text>
                <TextInput
                  style={styles.input}
                  value={quantidade}
                  onChangeText={setQuantidade}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>
                  {qtyNum > 1 ? "Geração em Lote" : "Código de Patrimônio"}
                </Text>
                {qtyNum > 1 ? (
                  <View style={styles.batchInfoBox}>
                    <Text style={styles.batchInfoText}>
                      Gerará {qtyNum} código(s) automático(s)
                    </Text>
                  </View>
                ) : (
                  <View style={styles.patrimonioRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 6 }]}
                      value={codigoPatrimonio}
                      onChangeText={setCodigoPatrimonio}
                      placeholder="Ex: CAM-10492"
                      placeholderTextColor="#94a3b8"
                    />
                    <TouchableOpacity style={styles.iconBtn} onPress={gerarPatrimonioUnico}>
                      <RefreshCw size={18} color="#4f46e5" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: "#f1f5f9" }]}
                      onPress={async () => {
                        if (!hasCameraPermission?.granted) await requestCameraPermission();
                        setScannerVisible(true);
                      }}
                    >
                      <Barcode size={18} color="#0f172a" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.sectionLabel}>Código de Patrimônio (Identificador)</Text>
              <View style={styles.patrimonioRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 6 }]}
                  value={codigoPatrimonio}
                  onChangeText={setCodigoPatrimonio}
                  placeholder="Ex: CAM-10492"
                  placeholderTextColor="#94a3b8"
                />
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: "#f1f5f9" }]}
                  onPress={async () => {
                    if (!hasCameraPermission?.granted) await requestCameraPermission();
                    setScannerVisible(true);
                  }}
                >
                  <Barcode size={18} color="#0f172a" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STATUS DE CONDIÇÃO (SE MODO EDIÇÃO) */}
          {isEditing && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionLabel}>Status Atual de Funcionamento</Text>
              <View style={styles.statusOptionsRow}>
                <TouchableOpacity
                  style={[
                    styles.statusOptionBtn,
                    statusCondicao === "DISPONIVEL" && styles.statusOptionDisponivelActive
                  ]}
                  onPress={() => {
                    setStatusCondicao("DISPONIVEL");
                    setRecebeuComDefeito(false);
                  }}
                >
                  <CheckCircle2 size={16} color={statusCondicao === "DISPONIVEL" ? "#059669" : "#64748b"} />
                  <Text style={[styles.statusOptionText, statusCondicao === "DISPONIVEL" && styles.statusOptionDisponivelText]}>
                    Disponível
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusOptionBtn,
                    statusCondicao === "COM_DEFEITO" && styles.statusOptionDefeitoActive
                  ]}
                  onPress={() => {
                    setStatusCondicao("COM_DEFEITO");
                    setRecebeuComDefeito(true);
                  }}
                >
                  <AlertTriangle size={16} color={statusCondicao === "COM_DEFEITO" ? "#dc2626" : "#64748b"} />
                  <Text style={[styles.statusOptionText, statusCondicao === "COM_DEFEITO" && styles.statusOptionDefeitoText]}>
                    Com Defeito
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusOptionBtn,
                    statusCondicao === "EM_MANUTENCAO" && styles.statusOptionManutencaoActive
                  ]}
                  onPress={() => {
                    setStatusCondicao("EM_MANUTENCAO");
                    setRecebeuComDefeito(true);
                  }}
                >
                  <Wrench size={16} color={statusCondicao === "EM_MANUTENCAO" ? "#d97706" : "#64748b"} />
                  <Text style={[styles.statusOptionText, statusCondicao === "EM_MANUTENCAO" && styles.statusOptionManutencaoText]}>
                    Manutenção
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* CATEGORIA E TIPO */}
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <View style={styles.labelWithAdd}>
                <Text style={styles.sectionLabel}>Categoria</Text>
                <TouchableOpacity onPress={() => setShowModalCriarCat(true)}>
                  <Text style={styles.addInlineText}>+ Nova</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.selectorBtn, catSelecionada && styles.selectorBtnActive]}
                onPress={() => setShowModalCat(true)}
              >
                <Text style={[styles.selectorText, catSelecionada && styles.selectorTextActive]} numberOfLines={1}>
                  {catSelecionada ? catSelecionada.nome : "Selecione..."}
                </Text>
                <ChevronDown size={16} color={catSelecionada ? "#4f46e5" : "#94a3b8"} />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, marginLeft: 6 }}>
              <View style={styles.labelWithAdd}>
                <Text style={styles.sectionLabel}>Tipo</Text>
                {categoriaId ? (
                  <TouchableOpacity onPress={() => setShowModalCriarTipo(true)}>
                    <Text style={styles.addInlineText}>+ Novo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.selectorBtn, tipoSelecionado && styles.selectorBtnActive]}
                onPress={() => {
                  if (!categoriaId) return Alert.alert("Aviso", "Selecione uma Categoria primeiro.");
                  setShowModalTipo(true);
                }}
              >
                <Text style={[styles.selectorText, tipoSelecionado && styles.selectorTextActive]} numberOfLines={1}>
                  {tipoSelecionado ? tipoSelecionado.nome : "Selecione..."}
                </Text>
                <ChevronDown size={16} color={tipoSelecionado ? "#4f46e5" : "#94a3b8"} />
              </TouchableOpacity>
            </View>
          </View>

          {/* CHECKBOX: DEFEITO / AVARIA */}
          {!isEditing && (
            <TouchableOpacity
              style={[styles.cardCheckbox, recebeuComDefeito && styles.cardCheckboxDefeito]}
              onPress={() => setRecebeuComDefeito(!recebeuComDefeito)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {recebeuComDefeito ? (
                  <CheckSquare size={20} color="#dc2626" />
                ) : (
                  <Square size={20} color="#94a3b8" />
                )}
                <Text style={[styles.cardCheckboxText, recebeuComDefeito && { color: "#dc2626", fontWeight: "700" }]}>
                  Registrar com defeito inicial
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {recebeuComDefeito && (
            <View style={styles.defeitoBox}>
              <Text style={styles.sectionLabel}>Tipo de Avaria / Defeito</Text>
              <TouchableOpacity
                style={[styles.selectorBtn, avariaSelecionada && styles.selectorBtnActive]}
                onPress={() => setShowModalAvaria(true)}
              >
                <Text style={[styles.selectorText, avariaSelecionada && styles.selectorTextActive]}>
                  {avariaSelecionada ? avariaSelecionada.nome : "Selecione o defeito..."}
                </Text>
                <ChevronDown size={16} color={avariaSelecionada ? "#dc2626" : "#94a3b8"} />
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>Descrição do Problema</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: "top" }]}
                value={avariaDescricao}
                onChangeText={setAvariaDescricao}
                placeholder="Descreva o defeito apresentado..."
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
          )}

          {/* CHECKBOX: VISÍVEL PARA EMPRÉSTIMO */}
          <TouchableOpacity
            style={[styles.cardCheckbox, permitirEmprestimo && styles.cardCheckboxEmprestimo]}
            onPress={() => setPermitirEmprestimo(!permitirEmprestimo)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {permitirEmprestimo ? (
                <CheckSquare size={20} color="#2563eb" />
              ) : (
                <Square size={20} color="#94a3b8" />
              )}
              <Text style={[styles.cardCheckboxText, permitirEmprestimo && { color: "#1d4ed8", fontWeight: "700" }]}>
                Visível para Solicitação (Empréstimo Público)
              </Text>
            </View>
          </TouchableOpacity>

          {/* BOTÃO SALVAR / CADASTRAR */}
          <TouchableOpacity
            style={[
              styles.btnCadastrar,
              isEditing && { backgroundColor: "#4f46e5" },
              saving && { opacity: 0.7 }
            ]}
            onPress={handleSalvarEquipamento}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {isEditing ? (
                  <Save size={20} color="#fff" style={{ marginRight: 6 }} />
                ) : (
                  <Plus size={20} color="#fff" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.btnCadastrarText}>
                  {isEditing ? "Salvar Alterações" : "Cadastrar Equipamento"}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* MODAL ESCOLHER CATEGORIA */}
      <Modal visible={showModalCat} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Categoria</Text>
              <TouchableOpacity onPress={() => setShowModalCat(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={categorias}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectCategoria(item)}>
                  <Text style={styles.modalItemName}>{item.nome}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL ESCOLHER TIPO */}
      <Modal visible={showModalTipo} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Subtipo</Text>
              <TouchableOpacity onPress={() => setShowModalTipo(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={tipos}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setTipoId(item.id);
                    setShowModalTipo(false);
                  }}
                >
                  <Text style={styles.modalItemName}>{item.nome}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.emptyText}>Nenhum subtipo cadastrado nesta categoria.</Text>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL ESCOLHER AVARIA */}
      <Modal visible={showModalAvaria} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tipo de Avaria</Text>
              <TouchableOpacity onPress={() => setShowModalAvaria(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={tiposAvaria}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setAvariaId(item.id);
                    setShowModalAvaria(false);
                  }}
                >
                  <Text style={styles.modalItemName}>{item.nome}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL CRIAR CATEGORIA RÁPIDA */}
      <Modal visible={showModalCriarCat} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
          <View style={styles.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Criar Categoria</Text>
                <TouchableOpacity onPress={() => setShowModalCriarCat(false)}>
                  <X size={22} color="#64748b" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={novaCatNome}
                onChangeText={setNovaCatNome}
                placeholder="Ex: FOTOGRAFIA, ÁUDIO..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                autoFocus
              />
              <TouchableOpacity style={styles.btnCadastrar} onPress={handleCriarCategoriaRapida}>
                <Text style={styles.btnCadastrarText}>Salvar Categoria</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL CRIAR TIPO RÁPIDO */}
      <Modal visible={showModalCriarTipo} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
          <View style={styles.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Criar Subtipo</Text>
                <TouchableOpacity onPress={() => setShowModalCriarTipo(false)}>
                  <X size={22} color="#64748b" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={novoTipoNome}
                onChangeText={setNovoTipoNome}
                placeholder="Ex: Câmera Mirrorless, Microfone..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
                autoFocus
              />
              <TouchableOpacity style={styles.btnCadastrar} onPress={handleCriarTipoRapido}>
                <Text style={styles.btnCadastrarText}>Salvar Subtipo</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL CAMERA SCANNER */}
      <Modal visible={scannerVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          {scannerVisible && (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["code128", "qr", "ean13", "ean8"] }}
              onBarcodeScanned={({ data }) => {
                let code = data;
                if (code.includes("/")) code = code.split("/").pop();
                setCodigoPatrimonio(code);
                setScannerVisible(false);
              }}
            />
          )}
          <TouchableOpacity
            style={styles.closeScannerBtn}
            onPress={() => setScannerVisible(false)}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Cancelar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0,
  },
  scroll: { padding: 20, paddingBottom: 140 },
  editModeHeader: {
    backgroundColor: "#eef2ff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#c7d2fe"
  },
  editModeTitle: { fontSize: 14, fontWeight: "700", color: "#3730a3" },
  editModeSub: { fontSize: 12, color: "#4f46e5", fontWeight: "600", marginTop: 2 },
  btnScanAnother: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  btnScanAnotherText: { fontSize: 12, fontWeight: "700", color: "#4f46e5" },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6, marginTop: 12 },
  labelWithAdd: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addInlineText: { fontSize: 12, fontWeight: "700", color: "#2563eb", marginTop: 12 },
  input: {
    backgroundColor: "#ffffff", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 12, padding: 14, fontSize: 15, color: "#0f172a", marginBottom: 4,
  },
  row: { flexDirection: "row", alignItems: "center" },
  patrimonioRow: { flexDirection: "row", alignItems: "center" },
  iconBtn: {
    backgroundColor: "#eef2ff", borderRadius: 12, padding: 14,
    alignItems: "center", justifyContent: "center", marginLeft: 6,
  },
  batchInfoBox: {
    backgroundColor: "#eff6ff", borderRadius: 12, padding: 14,
    alignItems: "center", justifyContent: "center",
  },
  batchInfoText: { color: "#2563eb", fontWeight: "600", fontSize: 13 },
  statusOptionsRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  statusOptionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc"
  },
  statusOptionText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  statusOptionDisponivelActive: { borderColor: "#10b981", backgroundColor: "#ecfdf5" },
  statusOptionDisponivelText: { color: "#059669", fontWeight: "700" },
  statusOptionDefeitoActive: { borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  statusOptionDefeitoText: { color: "#dc2626", fontWeight: "700" },
  statusOptionManutencaoActive: { borderColor: "#f59e0b", backgroundColor: "#fffbeb" },
  statusOptionManutencaoText: { color: "#d97706", fontWeight: "700" },
  selectorBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#ffffff", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 12, padding: 14,
  },
  selectorBtnActive: { borderColor: "#2563eb", backgroundColor: "#f8fafc" },
  selectorText: { fontSize: 14, color: "#94a3b8" },
  selectorTextActive: { color: "#0f172a", fontWeight: "600" },
  photoPickerBox: {
    backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderStyle: "dashed", borderRadius: 14, padding: 16, alignItems: "center",
  },
  photoHelperText: { fontSize: 11, color: "#94a3b8", marginTop: 8 },
  photoActionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0",
    borderRadius: 10, paddingVertical: 12, gap: 6,
  },
  photoActionBtnText: { color: "#4f46e5", fontSize: 13, fontWeight: "600" },
  squarePhotoWrapper: { marginTop: 4, marginBottom: 10 },
  squarePhotoContainer: {
    width: "100%", aspectRatio: 1, borderRadius: 16,
    overflow: "hidden", backgroundColor: "#0f172a", position: "relative",
  },
  squarePhoto: { width: "100%", height: "100%" },
  photoControlsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  photoControlBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0",
    borderRadius: 10, paddingVertical: 10, gap: 5,
  },
  photoControlBtnText: { fontSize: 12, fontWeight: "600", color: "#334155" },
  cardCheckbox: {
    backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 14, padding: 16, marginTop: 14,
  },
  cardCheckboxDefeito: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  cardCheckboxEmprestimo: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  cardCheckboxText: { fontSize: 14, color: "#334155", marginLeft: 10, fontWeight: "500" },
  defeitoBox: {
    backgroundColor: "#fff5f5", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#fed7d7", marginTop: 8,
  },
  btnCadastrar: {
    backgroundColor: "#2563eb", borderRadius: 14, paddingVertical: 16,
    alignItems: "center", justifyContent: "center", marginTop: 24,
    shadowColor: "#2563eb", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnCadastrarText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%", paddingBottom: 24 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalItemName: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  emptyText: { textAlign: "center", color: "#94a3b8", padding: 20 },
  closeScannerBtn: {
    position: "absolute", bottom: 40, alignSelf: "center",
    backgroundColor: "#ef4444", paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 20,
  },
});
