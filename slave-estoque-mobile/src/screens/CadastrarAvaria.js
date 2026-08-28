import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, SafeAreaView,
  KeyboardAvoidingView, Platform, ScrollView, Modal, StatusBar
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/database";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { Wrench, AlertTriangle, CheckCircle, Plus, Trash2, X, ChevronRight, RefreshCw, Search, ChevronDown } from "lucide-react-native";

const generateId = () => `av-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

export default function CadastrarAvariaScreen({ navigation }) {
  const keyboardHeight = useKeyboardHeight();
  const [equipamentos, setEquipamentos] = useState([]);
  const [tiposAvaria, setTiposAvaria] = useState([]);
  const [historicoAvarias, setHistoricoAvarias] = useState([]);

  // Modais de Criação
  const [showModalNovoTipo, setShowModalNovoTipo] = useState(false);
  const [showModalNovaAvaria, setShowModalNovaAvaria] = useState(false);
  const [showModalEquip, setShowModalEquip] = useState(false);
  const [showModalTipoSelect, setShowModalTipoSelect] = useState(false);

  // Form Registro Avaria
  const [equipamentoSelecionado, setEquipamentoSelecionado] = useState(null);
  const [tipoAvariaSelecionado, setTipoAvariaSelecionado] = useState(null);
  const [descricaoAvaria, setDescricaoAvaria] = useState("");
  const [searchEquip, setSearchEquip] = useState("");

  // Form Novo Tipo de Avaria
  const [nomeTipo, setNomeTipo] = useState("");
  const [descTipo, setDescTipo] = useState("");

  const [saving, setSaving] = useState(false);

  const carregar = useCallback(() => {
    try {
      const eqs = db.getAllSync("SELECT * FROM Equipamento ORDER BY nome ASC");
      const tps = db.getAllSync("SELECT * FROM TipoAvaria ORDER BY nome ASC");
      const hist = db.getAllSync(`
        SELECT ha.*, eq.nome as equipNome, eq.codigoPatrimonio as patrimonio, ta.nome as tipoNome 
        FROM HistoricoAvaria ha
        LEFT JOIN Equipamento eq ON ha.equipamentoId = eq.id
        LEFT JOIN TipoAvaria ta ON ha.tipoAvariaId = ta.id
        ORDER BY ha.dataRegistro DESC
      `);
      setEquipamentos(eqs);
      setTiposAvaria(tps);
      setHistoricoAvarias(hist);
    } catch (e) {
      console.error("Erro ao carregar avarias:", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const handleSalvarTipoAvaria = async () => {
    if (!nomeTipo.trim()) {
      return Alert.alert("Atenção", "Digite o nome do tipo de defeito.");
    }
    setSaving(true);
    try {
      const id = generateId();
      const nome = nomeTipo.trim();
      const descricao = descTipo.trim() || null;

      db.runSync("INSERT INTO TipoAvaria (id, nome, descricao) VALUES (?, ?, ?)", [id, nome, descricao]);
      db.runSync(
        "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
        ["NOVO_TIPO_AVARIA", id, JSON.stringify({ id, nome, descricao }), new Date().toISOString()]
      );

      Alert.alert("Sucesso", `Tipo de avaria "${nome}" cadastrado!`);
      setNomeTipo("");
      setDescTipo("");
      setShowModalNovoTipo(false);
      carregar();
    } catch (e) {
      Alert.alert("Erro", "Falha ao cadastrar tipo de avaria.");
    } finally {
      setSaving(false);
    }
  };

  const handleRegistrarAvaria = async () => {
    if (!equipamentoSelecionado) {
      return Alert.alert("Atenção", "Selecione o equipamento com defeito.");
    }
    if (!descricaoAvaria.trim()) {
      return Alert.alert("Atenção", "Descreva o problema ou avaria do aparelho.");
    }

    setSaving(true);
    try {
      const id = generateId();
      const dataRegistro = new Date().toISOString();

      db.runSync(
        `INSERT INTO HistoricoAvaria (id, equipamentoId, requisicaoId, tipoAvariaId, descricao, resolvido, dataRegistro, synced)
         VALUES (?, ?, ?, ?, ?, 0, ?, 0)`,
        [id, equipamentoSelecionado.id, null, tipoAvariaSelecionado ? tipoAvariaSelecionado.id : null, descricaoAvaria.trim(), dataRegistro]
      );

      // Marca o equipamento como COM_DEFEITO no banco local
      db.runSync("UPDATE Equipamento SET statusCondicao = 'COM_DEFEITO', synced = 0 WHERE id = ?", [equipamentoSelecionado.id]);

      db.runSync(
        "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
        [
          "NOVA_AVARIA_REGISTRO",
          id,
          JSON.stringify({
            id,
            equipamentoId: equipamentoSelecionado.id,
            tipoAvariaId: tipoAvariaSelecionado ? tipoAvariaSelecionado.id : null,
            descricao: descricaoAvaria.trim(),
            dataRegistro
          }),
          dataRegistro
        ]
      );

      Alert.alert("Avaria Registrada!", `Equipamento "${equipamentoSelecionado.nome}" marcado como COM DEFEITO.`);
      setEquipamentoSelecionado(null);
      setTipoAvariaSelecionado(null);
      setDescricaoAvaria("");
      setShowModalNovaAvaria(false);
      carregar();
    } catch (e) {
      console.error("Erro ao registrar avaria:", e);
      Alert.alert("Erro", "Falha ao registrar avaria.");
    } finally {
      setSaving(false);
    }
  };

  const handleResolverAvaria = (item) => {
    Alert.alert(
      "Confirmar Resolução",
      `Deseja marcar esta avaria como resolvida/consertada?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sim, Resolvido",
          onPress: async () => {
            try {
              const dataResolucao = new Date().toISOString();
              db.runSync("UPDATE HistoricoAvaria SET resolvido = 1, dataResolucao = ?, synced = 0 WHERE id = ?", [dataResolucao, item.id]);

              // Se não houver outras avarias ativas no mesmo equipamento, retorna para DISPONIVEL
              const pendentes = db.getAllSync(
                "SELECT id FROM HistoricoAvaria WHERE equipamentoId = ? AND resolvido = 0 AND id != ?",
                [item.equipamentoId, item.id]
              );
              if (pendentes.length === 0 && item.equipamentoId) {
                db.runSync("UPDATE Equipamento SET statusCondicao = 'DISPONIVEL', synced = 0 WHERE id = ?", [item.equipamentoId]);
              }

              db.runSync(
                "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
                [
                  "RESOLVER_AVARIA",
                  item.id,
                  JSON.stringify({ avariaId: item.id, equipamentoId: item.equipamentoId }),
                  dataResolucao
                ]
              );

              Alert.alert("Sucesso", "Avaria marcada como resolvida!");
              carregar();
            } catch (e) {
              Alert.alert("Erro", "Falha ao resolver avaria.");
            }
          }
        }
      ]
    );
  };

  const filteredEquipamentos = equipamentos.filter(eq =>
    (eq.nome || "").toLowerCase().includes(searchEquip.toLowerCase()) ||
    (eq.codigoPatrimonio || "").toLowerCase().includes(searchEquip.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.mainActionBtn, { backgroundColor: "#dc2626", flex: 1, marginRight: 8 }]}
          onPress={() => setShowModalNovaAvaria(true)}
        >
          <AlertTriangle size={16} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.mainActionBtnText}>Reportar Defeito</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainActionBtn, { backgroundColor: "#475569", width: 140 }]}
          onPress={() => setShowModalNovoTipo(true)}
        >
          <Plus size={16} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.mainActionBtnText}>Tipo de Defeito</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={historicoAvarias}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <View style={[styles.avariaCard, item.resolvido === 1 && styles.avariaCardResolvido]}>
            <View style={styles.avariaCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.avariaEquipName}>{item.equipNome || "Equipamento"}</Text>
                <Text style={styles.avariaPatr}>Patr: {item.patrimonio || "N/D"}</Text>
              </View>
              <View style={[styles.badge, item.resolvido === 1 ? styles.badgeResolvido : styles.badgePendente]}>
                <Text style={[styles.badgeText, item.resolvido === 1 ? styles.badgeTextResolvido : styles.badgeTextPendente]}>
                  {item.resolvido === 1 ? "RESOLVIDO" : "PENDENTE"}
                </Text>
              </View>
            </View>

            {item.tipoNome ? (
              <View style={styles.tipoBadge}>
                <Text style={styles.tipoBadgeText}>Defeito: {item.tipoNome}</Text>
              </View>
            ) : null}

            <Text style={styles.avariaDesc}>{item.descricao}</Text>
            <Text style={styles.avariaData}>{new Date(item.dataRegistro).toLocaleString("pt-BR")}</Text>

            {item.resolvido === 0 && (
              <TouchableOpacity
                style={styles.resolverBtn}
                onPress={() => handleResolverAvaria(item)}
              >
                <CheckCircle size={14} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.resolverBtnText}>Marcar como Consertado / Resolvido</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <CheckCircle size={40} color="#10b981" />
            <Text style={styles.emptyTitle}>Nenhuma Avaria Ativa</Text>
            <Text style={styles.emptySubtitle}>Todos os equipamentos estão funcionando normalmente.</Text>
          </View>
        )}
      />

      {/* MODAL REPORTAR AVARIA */}
      <Modal visible={showModalNovaAvaria} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
          <View style={styles.modalSheet}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Reportar Defeito em Aparelho</Text>
                <TouchableOpacity onPress={() => setShowModalNovaAvaria(false)}>
                  <X size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* EQUIPAMENTO */}
              <Text style={styles.inputLabel}>Equipamento com Defeito</Text>
              <TouchableOpacity
                style={[styles.selectorBtn, equipamentoSelecionado && styles.selectorBtnActive]}
                onPress={() => setShowModalEquip(true)}
              >
                <Text style={[styles.selectorText, equipamentoSelecionado && styles.selectorTextActive]} numberOfLines={1}>
                  {equipamentoSelecionado
                    ? `${equipamentoSelecionado.nome} (Patr: ${equipamentoSelecionado.codigoPatrimonio})`
                    : "Toque para selecionar o equipamento..."}
                </Text>
                <ChevronDown size={18} color={equipamentoSelecionado ? "#dc2626" : "#94a3b8"} />
              </TouchableOpacity>

              {/* TIPO DE DEFEITO */}
              <Text style={styles.inputLabel}>Tipo de Defeito (Opcional)</Text>
              <TouchableOpacity
                style={[styles.selectorBtn, tipoAvariaSelecionado && styles.selectorBtnActive]}
                onPress={() => setShowModalTipoSelect(true)}
              >
                <Text style={[styles.selectorText, tipoAvariaSelecionado && styles.selectorTextActive]}>
                  {tipoAvariaSelecionado ? tipoAvariaSelecionado.nome : "Selecione o tipo de avaria..."}
                </Text>
                <ChevronDown size={18} color={tipoAvariaSelecionado ? "#dc2626" : "#94a3b8"} />
              </TouchableOpacity>

              {/* DESCRIÇÃO */}
              <Text style={styles.inputLabel}>Descrição Detalhada do Problema</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                value={descricaoAvaria}
                onChangeText={setDescricaoAvaria}
                placeholder="Ex: Cabo com mau contato, tela trincada, botão quebrado..."
                placeholderTextColor="#94a3b8"
                multiline
              />

              <TouchableOpacity
                style={[styles.confirmBtn, saving && { opacity: 0.7 }]}
                onPress={handleRegistrarAvaria}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Registrar Avaria</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL NOVO TIPO DE AVARIA */}
      <Modal visible={showModalNovoTipo} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
          <View style={styles.modalSheet}>
            <View style={{ padding: 20 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Novo Tipo de Defeito</Text>
                <TouchableOpacity onPress={() => setShowModalNovoTipo(false)}>
                  <X size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Nome do Defeito</Text>
              <TextInput
                style={styles.input}
                value={nomeTipo}
                onChangeText={setNomeTipo}
                placeholder="Ex: Cabo Rompido, Não Liga, Lente Riscada..."
                placeholderTextColor="#94a3b8"
                autoFocus
              />

              <Text style={styles.inputLabel}>Descrição / Orientação (Opcional)</Text>
              <TextInput
                style={styles.input}
                value={descTipo}
                onChangeText={setDescTipo}
                placeholder="Ex: Enviar para assistência técnica autorizada"
                placeholderTextColor="#94a3b8"
              />

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: "#475569" }, saving && { opacity: 0.7 }]}
                onPress={handleSalvarTipoAvaria}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Salvar Tipo de Defeito</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL SELEÇÃO DE EQUIPAMENTO */}
      <Modal visible={showModalEquip} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "85%" }]}>
            <View style={[styles.modalHeader, { paddingHorizontal: 20, paddingTop: 18 }]}>
              <Text style={styles.modalTitle}>Selecionar Equipamento</Text>
              <TouchableOpacity onPress={() => setShowModalEquip(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Search size={16} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                value={searchEquip}
                onChangeText={setSearchEquip}
                placeholder="Buscar por nome ou patrimônio..."
                placeholderTextColor="#94a3b8"
              />
            </View>
            <FlatList
              data={filteredEquipamentos}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setEquipamentoSelecionado(item);
                    setShowModalEquip(false);
                    setSearchEquip("");
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{item.nome}</Text>
                    <Text style={styles.modalItemSub}>Patr: {item.codigoPatrimonio} • Status: {item.statusCondicao}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.emptyText}>Nenhum equipamento encontrado.</Text>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL SELEÇÃO TIPO DE AVARIA */}
      <Modal visible={showModalTipoSelect} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "80%" }]}>
            <View style={[styles.modalHeader, { paddingHorizontal: 20, paddingTop: 18 }]}>
              <Text style={styles.modalTitle}>Tipo de Defeito</Text>
              <TouchableOpacity onPress={() => setShowModalTipoSelect(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={tiposAvaria}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setTipoAvariaSelecionado(item);
                    setShowModalTipoSelect(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{item.nome}</Text>
                    {item.descricao ? <Text style={styles.modalItemSub}>{item.descricao}</Text> : null}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.emptyText}>Nenhum tipo cadastrado. Você pode cadastrar acima.</Text>
              )}
            />
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
  headerRow: { flexDirection: "row", padding: 16, paddingBottom: 8 },
  mainActionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: 12,
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  mainActionBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  listContainer: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  avariaCard: {
    backgroundColor: "#ffffff", borderRadius: 14, padding: 16,
    marginBottom: 12, borderLeftWidth: 4, borderLeftColor: "#ef4444",
    borderWidth: 1, borderColor: "#e2e8f0",
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  avariaCardResolvido: { borderLeftColor: "#10b981", opacity: 0.8 },
  avariaCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  avariaEquipName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  avariaPatr: { fontSize: 12, color: "#64748b" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgePendente: { backgroundColor: "#fee2e2" },
  badgeResolvido: { backgroundColor: "#d1fae5" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeTextPendente: { color: "#dc2626" },
  badgeTextResolvido: { color: "#059669" },
  tipoBadge: { backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", marginTop: 4 },
  tipoBadgeText: { fontSize: 11, color: "#475569", fontWeight: "600" },
  avariaDesc: { fontSize: 13, color: "#334155", marginTop: 8, lineHeight: 18 },
  avariaData: { fontSize: 11, color: "#94a3b8", marginTop: 8 },
  resolverBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0",
    borderRadius: 8, paddingVertical: 8, marginTop: 10,
  },
  resolverBtnText: { color: "#059669", fontSize: 12, fontWeight: "700" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#64748b", marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 4, paddingHorizontal: 30 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 12, padding: 14, fontSize: 15, color: "#0f172a", marginBottom: 6,
  },
  selectorBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 12, padding: 14, marginBottom: 6,
  },
  selectorBtnActive: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  selectorText: { fontSize: 14, color: "#94a3b8" },
  selectorTextActive: { color: "#dc2626", fontWeight: "600" },
  confirmBtn: {
    backgroundColor: "#dc2626", borderRadius: 12, padding: 16,
    alignItems: "center", justifyContent: "center", marginTop: 16,
  },
  confirmBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  modalSearch: {
    flexDirection: "row", alignItems: "center", margin: 16,
    backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0",
    borderRadius: 12, paddingHorizontal: 12,
  },
  modalSearchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: "#0f172a" },
  modalItem: {
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  modalItemName: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  modalItemSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  emptyText: { textAlign: "center", color: "#94a3b8", padding: 20 },
});
