import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, SafeAreaView,
  KeyboardAvoidingView, Platform, ScrollView, Modal, StatusBar, Image
} from "react-native";
import { db } from "../db/database";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { syncPush, getApiUrl } from "../services/api";
import {
  Package, Search, User, Building2, CheckCircle, X,
  ChevronDown, Plus, Minus, Trash2, Layers, RefreshCw,
  Phone, UserCheck, UserPlus, Sparkles
} from "lucide-react-native";

const generateId = () => `offline-emp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function EmprestimoScreen({ navigation }) {
  const keyboardHeight = useKeyboardHeight();

  // Estados de Dados
  const [equipamentos, setEquipamentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [emprestimosOffline, setEmprestimosOffline] = useState([]);

  // Carrinho de Modelos: { [nomeDoModelo]: quantidadeSelecionada }
  const [carrinho, setCarrinho] = useState({});

  // Solicitante
  const [solicitanteNome, setSolicitanteNome] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Modais e Filtros
  const [searchEquip, setSearchEquip] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState(null);
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Carregar dados locais do SQLite
  const carregar = useCallback(() => {
    try {
      const eqs = db.getAllSync(
        "SELECT * FROM Equipamento WHERE statusCondicao = 'DISPONIVEL' AND permitirEmprestimo = 1 ORDER BY nome ASC"
      );
      setEquipamentos(eqs || []);

      const users = db.getAllSync("SELECT * FROM Usuario ORDER BY nome ASC");
      setUsuarios(users || []);

      const cats = db.getAllSync("SELECT * FROM Categoria ORDER BY nome ASC");
      setCategorias(cats || []);

      const emps = db.getAllSync(
        "SELECT * FROM EmprestimoOffline WHERE synced = 0 ORDER BY dataCriacao DESC"
      );
      setEmprestimosOffline(emps || []);
    } catch (e) {
      console.error("Erro ao carregar dados SQLite:", e);
    }
  }, []);

  useEffect(() => {
    carregar();
    const unsubscribe = navigation.addListener("focus", carregar);
    return unsubscribe;
  }, [navigation, carregar]);

  // Agrupamento de Equipamentos por Nome / Modelo
  const eqGroups = useMemo(() => {
    const groups = {};
    for (const eq of equipamentos) {
      const nomeKey = (eq.nome || "Equipamento Sem Nome").trim();
      if (!groups[nomeKey]) {
        const cat = categorias.find(c => c.id === eq.categoriaId);
        groups[nomeKey] = {
          nome: nomeKey,
          fotoUrl: eq.fotoUrl || null,
          categoriaId: eq.categoriaId || null,
          categoriaNome: cat?.nome || "Geral",
          equipamentos: []
        };
      }
      groups[nomeKey].equipamentos.push(eq);
    }
    return Object.values(groups);
  }, [equipamentos, categorias]);

  // Grupos Filtrados na Busca da Modal
  const filteredEqGroups = useMemo(() => {
    return eqGroups.filter(g => {
      const matchSearch =
        (g.nome || "").toLowerCase().includes(searchEquip.toLowerCase()) ||
        (g.categoriaNome || "").toLowerCase().includes(searchEquip.toLowerCase());
      const matchCat = !categoriaFiltro || g.categoriaId === categoriaFiltro;
      return matchSearch && matchCat;
    });
  }, [eqGroups, searchEquip, categoriaFiltro]);

  // Total de Itens Físicos Escolhidos
  const totalItensSelecionados = useMemo(() => {
    return Object.values(carrinho).reduce((acc, q) => acc + q, 0);
  }, [carrinho]);

  // Manipulação de Quantidade no Carrinho
  const handleUpdateCarrinho = (nomeGrupo, delta, max) => {
    setCarrinho(prev => {
      const atual = prev[nomeGrupo] || 0;
      const novo = atual + delta;
      if (novo < 0 || novo > max) return prev;
      const copy = { ...prev };
      if (novo === 0) {
        delete copy[nomeGrupo];
      } else {
        copy[nomeGrupo] = novo;
      }
      return copy;
    });
  };

  const handleRemoverGrupo = (nomeGrupo) => {
    setCarrinho(prev => {
      const copy = { ...prev };
      delete copy[nomeGrupo];
      return copy;
    });
  };

  // Helper para resolver URI da Foto
  const getFotoUri = (fotoUrl) => {
    if (!fotoUrl) return null;
    if (
      fotoUrl.startsWith("file://") ||
      fotoUrl.startsWith("http://") ||
      fotoUrl.startsWith("https://") ||
      fotoUrl.startsWith("data:")
    ) {
      return fotoUrl;
    }
    const apiUrl = getApiUrl();
    if (apiUrl && fotoUrl.startsWith("/uploads/")) {
      return `${apiUrl}${fotoUrl}`;
    }
    return fotoUrl;
  };

  // Sugestões de Autocomplete de Usuários
  const sugestoesUsuarios = useMemo(() => {
    if (!solicitanteNome.trim() || selectedUser) return [];
    const term = solicitanteNome.toLowerCase().trim();
    return usuarios.filter(u =>
      (u.nome || "").toLowerCase().includes(term) ||
      (u.whatsapp && u.whatsapp.replace(/\D/g, "").includes(term))
    );
  }, [usuarios, solicitanteNome, selectedUser]);

  const handleSelectUsuario = (u) => {
    setSolicitanteNome(u.nome);
    setDepartamento(u.departamento || "");
    setWhatsapp(u.whatsapp || "");
    setSelectedUser(u);
    setShowUserDropdown(false);
  };

  const handleTypedNome = (text) => {
    setSolicitanteNome(text);
    if (selectedUser && selectedUser.nome !== text) {
      setSelectedUser(null);
    }
    setShowUserDropdown(true);
  };

  // Confirmar Registro de Empréstimo
  const handleConfirmar = async () => {
    if (totalItensSelecionados === 0) {
      return Alert.alert("Atenção", "Selecione pelo menos um equipamento no carrinho.");
    }
    if (!solicitanteNome.trim()) {
      return Alert.alert("Atenção", "Informe o nome do solicitante.");
    }
    if (!departamento.trim()) {
      return Alert.alert("Atenção", "Informe o departamento ou setor.");
    }

    setSaving(true);
    try {
      const reqId = generateId();
      const dataCriacao = new Date().toISOString();
      const nomeLimpo = solicitanteNome.trim();
      const deptoLimpo = departamento.trim();
      const waLimpo = whatsapp.trim();

      // 1. Cria ou Atualiza Usuário Local (Evita Duplicação)
      let targetUser = selectedUser;
      if (!targetUser) {
        targetUser = usuarios.find(
          u => u.nome.toLowerCase().trim() === nomeLimpo.toLowerCase()
        );
      }

      let finalUserId = targetUser?.id;
      if (!targetUser) {
        finalUserId = `usr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        db.runSync(
          "INSERT OR REPLACE INTO Usuario (id, nome, departamento, whatsapp, fotoUrl, role) VALUES (?, ?, ?, ?, ?, 'AVULSO')",
          [finalUserId, nomeLimpo, deptoLimpo, waLimpo || null, null]
        );
        db.runSync(
          "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
          [
            "NOVO_USUARIO",
            finalUserId,
            JSON.stringify({ id: finalUserId, nome: nomeLimpo, departamento: deptoLimpo, whatsapp: waLimpo || null, role: 'AVULSO' }),
            dataCriacao
          ]
        );
      } else if (waLimpo && !targetUser.whatsapp) {
        db.runSync("UPDATE Usuario SET whatsapp = ? WHERE id = ?", [waLimpo, targetUser.id]);
      }

      // 2. Insere a Requisição
      db.runSync(
        "INSERT OR REPLACE INTO Requisicao (id, solicitanteNome, departamento, status) VALUES (?, ?, ?, 'EMPRESTADO')",
        [reqId, nomeLimpo, deptoLimpo]
      );

      // 3. Mapeia quantidades do carrinho para itens físicos reais
      let itensProcessados = 0;
      for (const [nomeGrupo, qtd] of Object.entries(carrinho)) {
        const grupo = eqGroups.find(g => g.nome === nomeGrupo);
        if (!grupo || qtd <= 0) continue;

        const unidades = grupo.equipamentos.slice(0, qtd);
        for (const eq of unidades) {
          const empId = `emp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          const itemId = `item-${reqId}-${eq.id}`;

          db.runSync(
            "INSERT INTO EmprestimoOffline (id, equipamentoId, equipamentoNome, patrimonio, solicitanteNome, departamento, dataCriacao, synced) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
            [empId, eq.id, eq.nome, eq.codigoPatrimonio, nomeLimpo, deptoLimpo, dataCriacao]
          );

          db.runSync(
            "INSERT OR REPLACE INTO ItemRequisicao (id, requisicaoId, equipamentoId, statusSeparacao, statusDevolucao, synced) VALUES (?, ?, ?, 1, 0, 0)",
            [itemId, reqId, eq.id]
          );

          db.runSync(
            "UPDATE Equipamento SET statusCondicao = 'EMPRESTADO', synced = 0 WHERE id = ?",
            [eq.id]
          );

          db.runSync(
            "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
            [
              "EMPRESTIMO_OFFLINE",
              reqId,
              JSON.stringify({
                requisicaoId: reqId,
                equipamentoId: eq.id,
                patrimonio: eq.codigoPatrimonio,
                solicitanteNome: nomeLimpo,
                departamento: deptoLimpo,
                whatsapp: waLimpo || null,
                usuarioId: finalUserId || null,
                dataCriacao
              }),
              dataCriacao
            ]
          );
          itensProcessados++;
        }
      }

      // Envia em tempo real ao servidor se conectado
      syncPush().catch(() => {});

      Alert.alert(
        "Empréstimo Registrado com Sucesso!",
        `${itensProcessados} equipamento(s) registrado(s) para ${nomeLimpo}.\n\nSalvo offline e pronto para conferência.`,
        [{ text: "OK" }]
      );

      // Limpar formulário
      setCarrinho({});
      setSolicitanteNome("");
      setDepartamento("");
      setWhatsapp("");
      setSelectedUser(null);
      carregar();
    } catch (e) {
      console.error("Erro ao registrar empréstimo:", e);
      Alert.alert("Erro", "Ocorreu um erro ao salvar o empréstimo offline.");
    } finally {
      setSaving(false);
    }
  };

  // Ações nos Cards de Pendentes
  const handleDarBaixaPendente = (emp) => {
    Alert.alert(
      "Confirmar Devolução",
      `Deseja dar baixa/devolução no empréstimo de "${emp.equipamentoNome}" (${emp.patrimonio}) para ${emp.solicitanteNome}? O item voltará ao estoque disponível.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar Devolução",
          onPress: async () => {
            try {
              db.runSync(
                "UPDATE Equipamento SET statusCondicao = 'DISPONIVEL', synced = 0 WHERE id = ? OR codigoPatrimonio = ?",
                [emp.equipamentoId, emp.patrimonio]
              );
              db.runSync("UPDATE EmprestimoOffline SET synced = 1 WHERE id = ?", [emp.id]);
              db.runSync("UPDATE ItemRequisicao SET statusDevolucao = 1, synced = 0 WHERE requisicaoId = ?", [emp.id]);
              db.runSync("UPDATE Requisicao SET status = 'DEVOLVIDO' WHERE id = ?", [emp.id]);

              const dataHora = new Date().toISOString();
              db.runSync(
                "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
                [
                  "DEVOLUCAO",
                  `item-${emp.id}`,
                  JSON.stringify({
                    requisicaoId: emp.id,
                    equipamentoId: emp.equipamentoId,
                    patrimonio: emp.patrimonio,
                    solicitanteNome: emp.solicitanteNome
                  }),
                  dataHora
                ]
              );

              syncPush().catch(() => {});
              Alert.alert("Sucesso", `Baixa realizada! "${emp.equipamentoNome}" está de volta ao estoque.`);
              carregar();
            } catch (e) {
              console.error("Erro ao dar baixa pendente:", e);
              Alert.alert("Erro", "Não foi possível dar baixa no empréstimo.");
            }
          }
        }
      ]
    );
  };

  const handleForcarSincronizacao = async (emp) => {
    try {
      setSaving(true);
      db.runSync(
        "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
        [
          "EMPRESTIMO_OFFLINE",
          emp.id,
          JSON.stringify({
            requisicaoId: emp.id,
            equipamentoId: emp.equipamentoId,
            patrimonio: emp.patrimonio,
            solicitanteNome: emp.solicitanteNome,
            departamento: emp.departamento,
            dataCriacao: emp.dataCriacao
          }),
          emp.dataCriacao || new Date().toISOString()
        ]
      );
      const res = await syncPush();
      if (res && res.success) {
        Alert.alert("Sincronizado!", `Empréstimo de "${emp.equipamentoNome}" sincronizado com sucesso!`);
      } else {
        Alert.alert("Aviso", "Empréstimo mantido offline. Conecte-se ao servidor para sincronizar.");
      }
      carregar();
    } catch (e) {
      Alert.alert("Aviso", `Servidor inacessível no momento (${e.message}). O empréstimo continua seguro offline.`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelarPendente = (emp) => {
    Alert.alert(
      "Cancelar Registro",
      `Deseja cancelar este registro pendente? O equipamento "${emp.equipamentoNome}" voltará ao estoque disponível.`,
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, Cancelar",
          style: "destructive",
          onPress: () => {
            try {
              db.runSync("UPDATE Equipamento SET statusCondicao = 'DISPONIVEL', synced = 0 WHERE id = ? OR codigoPatrimonio = ?", [emp.equipamentoId, emp.patrimonio]);
              db.runSync("DELETE FROM EmprestimoOffline WHERE id = ?", [emp.id]);
              db.runSync("DELETE FROM OfflineLog WHERE itemId = ? OR (tipo = 'EMPRESTIMO_OFFLINE' AND dados LIKE ?)", [emp.id, `%${emp.equipamentoId || emp.patrimonio}%`]);
              db.runSync("DELETE FROM ItemRequisicao WHERE requisicaoId = ?", [emp.id]);
              db.runSync("DELETE FROM Requisicao WHERE id = ?", [emp.id]);
              Alert.alert("Cancelado", "Registro removido e equipamento liberado.");
              carregar();
            } catch (e) {
              console.error(e);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 40 + keyboardHeight }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* SEÇÃO 1: SELEÇÃO DE EQUIPAMENTOS POR MODELO / LOTE */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Layers size={18} color="#4f46e5" />
              <Text style={styles.sectionTitle}>Equipamentos para Empréstimo</Text>
            </View>

            {/* BOTÃO ABRIR CATÁLOGO */}
            <TouchableOpacity
              style={[styles.catalogOpenBtn, totalItensSelecionados > 0 && styles.catalogOpenBtnActive]}
              onPress={() => setShowEquipModal(true)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Package size={20} color={totalItensSelecionados > 0 ? "#4f46e5" : "#64748b"} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.catalogOpenTitle, totalItensSelecionados > 0 && styles.catalogOpenTitleActive]}>
                    {totalItensSelecionados > 0
                      ? `${totalItensSelecionados} item(s) selecionado(s) em ${Object.keys(carrinho).length} modelo(s)`
                      : "Abrir Catálogo de Equipamentos"}
                  </Text>
                  <Text style={styles.catalogOpenSub}>
                    {totalItensSelecionados > 0
                      ? "Toque para adicionar mais ou alterar quantidades"
                      : "Escolha modelos e defina a quantidade desejada"}
                  </Text>
                </View>
              </View>
              <ChevronDown size={18} color={totalItensSelecionados > 0 ? "#4f46e5" : "#94a3b8"} />
            </TouchableOpacity>

            {/* LISTA DE MODELOS NO CARRINHO */}
            {Object.keys(carrinho).length > 0 && (
              <View style={styles.cartContainer}>
                {Object.entries(carrinho).map(([nomeGrupo, qtd]) => {
                  const grupo = eqGroups.find(g => g.nome === nomeGrupo);
                  const maxDisp = grupo?.equipamentos.length || 0;
                  const fotoUri = getFotoUri(grupo?.fotoUrl);

                  return (
                    <View key={nomeGrupo} style={styles.cartCard}>
                      {fotoUri ? (
                        <Image source={{ uri: fotoUri }} style={styles.cartCardImg} />
                      ) : (
                        <View style={styles.cartCardPlaceholder}>
                          <Package size={20} color="#818cf8" />
                        </View>
                      )}

                      <View style={{ flex: 1, paddingHorizontal: 10 }}>
                        <Text style={styles.cartCardName} numberOfLines={1}>
                          {nomeGrupo}
                        </Text>
                        <Text style={styles.cartCardStock}>
                          Disp: {maxDisp} un. em estoque
                        </Text>
                      </View>

                      {/* STEPPER DE QUANTIDADE */}
                      <View style={styles.stepperRow}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => handleUpdateCarrinho(nomeGrupo, -1, maxDisp)}
                        >
                          <Minus size={14} color="#475569" />
                        </TouchableOpacity>

                        <Text style={styles.stepperValue}>{qtd}</Text>

                        <TouchableOpacity
                          style={[styles.stepperBtn, qtd >= maxDisp && { opacity: 0.3 }]}
                          disabled={qtd >= maxDisp}
                          onPress={() => handleUpdateCarrinho(nomeGrupo, 1, maxDisp)}
                        >
                          <Plus size={14} color="#4f46e5" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.cartRemoveBtn}
                          onPress={() => handleRemoverGrupo(nomeGrupo)}
                        >
                          <Trash2 size={15} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* SEÇÃO 2: DADOS DO SOLICITANTE COM AUTOCOMPLETE */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={18} color="#4f46e5" />
              <Text style={styles.sectionTitle}>Solicitante do Empréstimo</Text>
            </View>

            {/* STATUS DO USUÁRIO IDENTIFICADO */}
            {selectedUser ? (
              <View style={styles.userStatusBadgeCadastrado}>
                <UserCheck size={14} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.userStatusTextCadastrado}>
                  Usuário Cadastrado: {selectedUser.nome}
                </Text>
                <TouchableOpacity onPress={() => setSelectedUser(null)} style={{ marginLeft: "auto" }}>
                  <X size={14} color="#059669" />
                </TouchableOpacity>
              </View>
            ) : solicitanteNome.trim().length > 0 ? (
              <View style={styles.userStatusBadgeNovo}>
                <UserPlus size={14} color="#2563eb" style={{ marginRight: 6 }} />
                <Text style={styles.userStatusTextNovo}>
                  Novo Solicitante Avulso (será salvo automaticamente)
                </Text>
              </View>
            ) : null}

            {/* CAMPO NOME DO SOLICITANTE */}
            <View style={{ position: "relative", zIndex: 10 }}>
              <TextInput
                style={styles.input}
                value={solicitanteNome}
                onChangeText={handleTypedNome}
                placeholder="Nome completo do solicitante"
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
              />

              {/* DROPDOWN DE AUTOCOMPLETE DE USUÁRIOS */}
              {showUserDropdown && sugestoesUsuarios.length > 0 && (
                <View style={styles.autocompleteDropdown}>
                  <Text style={styles.autocompleteHeader}>Sugestões de Usuários Cadastrados:</Text>
                  {sugestoesUsuarios.slice(0, 5).map(u => {
                    const avatarUri = getFotoUri(u.fotoUrl);
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={styles.autocompleteItem}
                        onPress={() => handleSelectUsuario(u)}
                      >
                        {avatarUri ? (
                          <Image source={{ uri: avatarUri }} style={styles.autocompleteAvatar} />
                        ) : (
                          <View style={styles.autocompleteAvatarPlaceholder}>
                            <Text style={styles.autocompleteAvatarInitials}>
                              {(u.nome || "U").substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={styles.autocompleteItemName}>{u.nome}</Text>
                            {u.role === 'AVULSO' && (
                              <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                <Text style={{ color: '#d97706', fontSize: 10, fontWeight: '700' }}>Avulso</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.autocompleteItemSub}>
                            {u.departamento || "Sem depto"} {u.whatsapp ? `• ${u.whatsapp}` : ""}
                          </Text>
                        </View>
                        <UserCheck size={16} color={u.role === 'AVULSO' ? '#d97706' : '#4f46e5'} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* CAMPO DEPARTAMENTO */}
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Building2 size={15} color="#64748b" style={{ marginRight: 6 }} />
                <Text style={styles.inputLabel}>Departamento / Setor</Text>
              </View>
              <TextInput
                style={styles.input}
                value={departamento}
                onChangeText={setDepartamento}
                placeholder="Ex: TI, Eventos, Comunicação, RH..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
              />
            </View>

            {/* CAMPO WHATSAPP */}
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Phone size={15} color="#64748b" style={{ marginRight: 6 }} />
                <Text style={styles.inputLabel}>WhatsApp (para notificações e busca de foto)</Text>
              </View>
              <TextInput
                style={styles.input}
                value={whatsapp}
                onChangeText={setWhatsapp}
                placeholder="Ex: (11) 99999-9999"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* BOTÃO CONFIRMAR */}
          <TouchableOpacity
            style={[styles.confirmBtn, (saving || totalItensSelecionados === 0) && { opacity: 0.6 }]}
            onPress={handleConfirmar}
            disabled={saving || totalItensSelecionados === 0}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <CheckCircle size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.confirmBtnText}>
                  Confirmar Empréstimo ({totalItensSelecionados} {totalItensSelecionados === 1 ? "item" : "itens"})
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* PENDENTES DE SYNC COM BOTÕES DE AÇÃO */}
          {emprestimosOffline.length > 0 && (
            <View style={styles.pendingSection}>
              <Text style={styles.pendingTitle}>
                Empréstimos Pendentes de Sincronização ({emprestimosOffline.length})
              </Text>
              {emprestimosOffline.map(emp => (
                <View key={emp.id} style={styles.pendingCard}>
                  <View style={styles.pendingCardRow}>
                    <Text style={styles.pendingEquipName} numberOfLines={1}>{emp.equipamentoNome}</Text>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Offline</Text>
                    </View>
                  </View>
                  <Text style={styles.pendingDetail}>Patr: {emp.patrimonio}</Text>
                  <Text style={styles.pendingDetail}>Solicitante: {emp.solicitanteNome}</Text>
                  <Text style={styles.pendingDetail}>Depto: {emp.departamento}</Text>
                  <Text style={styles.pendingDate}>{new Date(emp.dataCriacao).toLocaleString("pt-BR")}</Text>

                  {/* AÇÕES NO EMPRÉSTIMO PENDENTE */}
                  <View style={styles.pendingActionsRow}>
                    <TouchableOpacity
                      style={styles.pendingActionDevolverBtn}
                      onPress={() => handleDarBaixaPendente(emp)}
                    >
                      <CheckCircle size={14} color="#059669" style={{ marginRight: 4 }} />
                      <Text style={styles.pendingActionDevolverText}>Dar Baixa / Devolver</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.pendingActionSyncBtn}
                      onPress={() => handleForcarSincronizacao(emp)}
                    >
                      <RefreshCw size={14} color="#4f46e5" style={{ marginRight: 4 }} />
                      <Text style={styles.pendingActionSyncText}>Reenviar Sync</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.pendingActionCancelBtn}
                      onPress={() => handleCancelarPendente(emp)}
                    >
                      <Trash2 size={15} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL CATÁLOGO AGRUPADO DE EQUIPAMENTOS */}
      <Modal visible={showEquipModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* CABEÇALHO MODAL */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Catálogo de Equipamentos</Text>
                <Text style={styles.modalSubtitle}>
                  {totalItensSelecionados} item(s) selecionado(s)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowEquipModal(false)} style={styles.modalCloseBtn}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* BUSCA */}
            <View style={styles.modalSearchRow}>
              <View style={styles.modalSearch}>
                <Search size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalSearchInput}
                  value={searchEquip}
                  onChangeText={setSearchEquip}
                  placeholder="Buscar modelo ou categoria..."
                  placeholderTextColor="#94a3b8"
                />
                {searchEquip.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchEquip("")}>
                    <X size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* LISTAGEM DE MODELOS */}
            <FlatList
              data={filteredEqGroups}
              keyExtractor={item => item.nome}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
              renderItem={({ item }) => {
                const qtd = carrinho[item.nome] || 0;
                const maxDisp = item.equipamentos.length;
                const fotoUri = getFotoUri(item.fotoUrl);

                return (
                  <View style={[styles.groupCard, qtd > 0 && styles.groupCardSelected]}>
                    {fotoUri ? (
                      <Image source={{ uri: fotoUri }} style={styles.groupCardImg} />
                    ) : (
                      <View style={styles.groupCardPlaceholder}>
                        <Package size={24} color="#818cf8" />
                      </View>
                    )}

                    <View style={{ flex: 1, paddingHorizontal: 12 }}>
                      <Text style={styles.groupCardName} numberOfLines={1}>
                        {item.nome}
                      </Text>
                      <Text style={styles.groupCardCat}>
                        {item.categoriaNome}
                      </Text>
                      <View style={styles.groupCardStockBadge}>
                        <Text style={styles.groupCardStockText}>
                          {maxDisp} disponível{maxDisp === 1 ? "" : "is"}
                        </Text>
                      </View>
                    </View>

                    {/* CONTROLES DE QUANTIDADE */}
                    <View style={styles.groupStepperContainer}>
                      <TouchableOpacity
                        style={[styles.stepperBtnModal, qtd === 0 && { opacity: 0.3 }]}
                        disabled={qtd === 0}
                        onPress={() => handleUpdateCarrinho(item.nome, -1, maxDisp)}
                      >
                        <Minus size={16} color="#475569" />
                      </TouchableOpacity>

                      <View style={styles.stepperValueBox}>
                        <Text style={[styles.stepperValueText, qtd > 0 && { color: "#4f46e5", fontWeight: "700" }]}>
                          {qtd}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.stepperBtnModal, qtd >= maxDisp && { opacity: 0.3 }]}
                        disabled={qtd >= maxDisp}
                        onPress={() => handleUpdateCarrinho(item.nome, 1, maxDisp)}
                      >
                        <Plus size={16} color="#4f46e5" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={() => (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Package size={40} color="#cbd5e1" style={{ marginBottom: 10 }} />
                  <Text style={styles.emptyText}>Nenhum equipamento disponível encontrado.</Text>
                </View>
              )}
            />

            {/* RODAPÉ DO MODAL */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalConfirmSelectionBtn}
                onPress={() => setShowEquipModal(false)}
              >
                <Text style={styles.modalConfirmSelectionBtnText}>
                  Concluir Seleção ({totalItensSelecionados} itens)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0
  },
  scroll: { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginLeft: 8 },

  // Botão Abrir Catálogo
  catalogOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 14
  },
  catalogOpenBtnActive: { borderColor: "#4f46e5", backgroundColor: "#eef2ff" },
  catalogOpenTitle: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  catalogOpenTitleActive: { color: "#4f46e5", fontWeight: "700" },
  catalogOpenSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  // Carrinho na tela principal
  cartContainer: { marginTop: 12, gap: 8 },
  cartCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 8
  },
  cartCardImg: { width: 44, height: 44, borderRadius: 8, backgroundColor: "#e2e8f0" },
  cartCardPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center"
  },
  cartCardName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  cartCardStock: { fontSize: 11, color: "#64748b", marginTop: 2 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center"
  },
  stepperValue: { fontSize: 14, fontWeight: "700", color: "#0f172a", minWidth: 20, textAlign: "center" },
  cartRemoveBtn: { padding: 6, backgroundColor: "#fee2e2", borderRadius: 6, marginLeft: 4 },

  // Badges de Status do Solicitante
  userStatusBadgeCadastrado: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10
  },
  userStatusTextCadastrado: { color: "#059669", fontSize: 12, fontWeight: "700" },
  userStatusBadgeNovo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10
  },
  userStatusTextNovo: { color: "#2563eb", fontSize: 12, fontWeight: "600" },

  inputLabel: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#0f172a"
  },

  // Autocomplete Dropdown
  autocompleteDropdown: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#c7d2fe",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
    padding: 6
  },
  autocompleteHeader: { fontSize: 11, fontWeight: "700", color: "#64748b", padding: 6 },
  autocompleteItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9"
  },
  autocompleteAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#e2e8f0", marginRight: 8 },
  autocompleteAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8
  },
  autocompleteAvatarInitials: { fontSize: 11, fontWeight: "700", color: "#4f46e5" },
  autocompleteItemName: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  autocompleteItemSub: { fontSize: 11, color: "#64748b" },

  // Botão Confirmar
  confirmBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  confirmBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },

  // Pendentes Offline
  pendingSection: { marginTop: 4 },
  pendingTitle: { fontSize: 14, fontWeight: "700", color: "#64748b", marginBottom: 10 },
  pendingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  pendingCardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  pendingEquipName: { fontSize: 14, fontWeight: "700", color: "#0f172a", flex: 1 },
  pendingBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pendingBadgeText: { fontSize: 11, fontWeight: "700", color: "#d97706" },
  pendingDetail: { fontSize: 12, color: "#64748b", marginTop: 2 },
  pendingDate: { fontSize: 11, color: "#94a3b8", marginTop: 6, marginBottom: 8 },
  pendingActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8
  },
  pendingActionDevolverBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 8,
    paddingVertical: 8
  },
  pendingActionDevolverText: { color: "#059669", fontSize: 12, fontWeight: "700" },
  pendingActionSyncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  pendingActionSyncText: { color: "#4f46e5", fontSize: 12, fontWeight: "600" },
  pendingActionCancelBtn: {
    padding: 8,
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },

  // Modal Catálogo
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    position: "relative"
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9"
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  modalSubtitle: { fontSize: 12, color: "#64748b", marginTop: 2 },
  modalCloseBtn: { padding: 4 },
  modalSearchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  modalSearch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12
  },
  modalSearchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: "#0f172a" },

  // Card do Grupo no Modal
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 10,
    marginBottom: 8
  },
  groupCardSelected: {
    borderColor: "#818cf8",
    backgroundColor: "#f5f3ff"
  },
  groupCardImg: { width: 56, height: 56, borderRadius: 10, backgroundColor: "#e2e8f0" },
  groupCardPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center"
  },
  groupCardName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  groupCardCat: { fontSize: 11, color: "#64748b", marginTop: 2 },
  groupCardStockBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4
  },
  groupCardStockText: { fontSize: 10, fontWeight: "700", color: "#059669" },
  groupStepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 2
  },
  stepperBtnModal: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  stepperValueBox: { minWidth: 32, alignItems: "center", justifyContent: "center" },
  stepperValueText: { fontSize: 14, fontWeight: "600", color: "#475569" },

  emptyText: { textAlign: "center", color: "#94a3b8", fontSize: 14 },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff"
  },
  modalConfirmSelectionBtn: {
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  modalConfirmSelectionBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" }
});
