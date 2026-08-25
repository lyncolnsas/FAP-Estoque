import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, SafeAreaView,
  KeyboardAvoidingView, Platform, ScrollView, Modal
} from "react-native";
import { db } from "../db/database";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { Package, Search, User, Building2, CheckCircle, X, ChevronDown } from "lucide-react-native";

const generateId = () => `offline-emp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function EmprestimoScreen({ navigation }) {
  const keyboardHeight = useKeyboardHeight();
  const [equipamentos, setEquipamentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [emprestimosOffline, setEmprestimosOffline] = useState([]);
  const [equipamentoSelecionado, setEquipamentoSelecionado] = useState(null);
  const [solicitanteNome, setSolicitanteNome] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [searchEquip, setSearchEquip] = useState("");
  const [searchUsuario, setSearchUsuario] = useState("");
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [showUsuarioModal, setShowUsuarioModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(() => {
    const eqs = db.getAllSync(
      "SELECT * FROM Equipamento WHERE statusCondicao = 'DISPONIVEL' AND permitirEmprestimo = 1 ORDER BY nome ASC"
    );
    setEquipamentos(eqs);
    const users = db.getAllSync("SELECT * FROM Usuario ORDER BY nome ASC");
    setUsuarios(users);
    const emps = db.getAllSync(
      "SELECT * FROM EmprestimoOffline WHERE synced = 0 ORDER BY dataCriacao DESC"
    );
    setEmprestimosOffline(emps);
  }, []);

  useEffect(() => {
    carregar();
    const unsubscribe = navigation.addListener("focus", carregar);
    return unsubscribe;
  }, [navigation, carregar]);

  const filteredEquipamentos = equipamentos.filter(eq =>
    eq.nome.toLowerCase().includes(searchEquip.toLowerCase()) ||
    eq.codigoPatrimonio.toLowerCase().includes(searchEquip.toLowerCase())
  );

  const filteredUsuarios = usuarios.filter(u =>
    u.nome.toLowerCase().includes(searchUsuario.toLowerCase()) ||
    (u.departamento || "").toLowerCase().includes(searchUsuario.toLowerCase())
  );

  const handleSelecionarUsuario = (u) => {
    setSolicitanteNome(u.nome);
    setDepartamento(u.departamento || "");
    setShowUsuarioModal(false);
  };

  const handleConfirmar = async () => {
    if (!equipamentoSelecionado) return Alert.alert("Atencao", "Selecione o equipamento para emprestimo.");
    if (!solicitanteNome.trim()) return Alert.alert("Atencao", "Informe o nome do solicitante.");
    if (!departamento.trim()) return Alert.alert("Atencao", "Informe o departamento.");

    setSaving(true);
    try {
      const id = generateId();
      const dataCriacao = new Date().toISOString();

      // 1. Salva na tabela EmprestimoOffline
      db.runSync(
        "INSERT INTO EmprestimoOffline (id, equipamentoId, equipamentoNome, patrimonio, solicitanteNome, departamento, dataCriacao, synced) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
        [id, equipamentoSelecionado.id, equipamentoSelecionado.nome, equipamentoSelecionado.codigoPatrimonio, solicitanteNome.trim(), departamento.trim(), dataCriacao]
      );

      // 2. Insere na tabela Requisicao local para visualização e impressão imediata
      db.runSync(
        "INSERT OR REPLACE INTO Requisicao (id, solicitanteNome, departamento, status) VALUES (?, ?, ?, 'EMPRESTADO')",
        [id, solicitanteNome.trim(), departamento.trim()]
      );

      // 3. Insere na tabela ItemRequisicao local
      const itemId = `item-${id}`;
      db.runSync(
        "INSERT OR REPLACE INTO ItemRequisicao (id, requisicaoId, equipamentoId, statusSeparacao, statusDevolucao, synced) VALUES (?, ?, ?, 1, 0, 0)",
        [itemId, id, equipamentoSelecionado.id]
      );

      // 4. Atualiza o status do Equipamento para EMPRESTADO
      db.runSync(
        "UPDATE Equipamento SET statusCondicao = 'EMPRESTADO', synced = 0 WHERE id = ?",
        [equipamentoSelecionado.id]
      );

      // 5. Cria o OfflineLog para sincronização com o servidor
      db.runSync(
        "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
        [
          "EMPRESTIMO_OFFLINE", id,
          JSON.stringify({
            requisicaoId: id,
            equipamentoId: equipamentoSelecionado.id,
            solicitanteNome: solicitanteNome.trim(),
            departamento: departamento.trim(),
            dataCriacao
          }),
          dataCriacao
        ]
      );

      Alert.alert(
        "Empréstimo Registrado!",
        `"${equipamentoSelecionado.nome}" registrado para ${solicitanteNome.trim()}.\n\nSalvo offline com sucesso e disponível para impressão na aba Requisições.`,
        [{ text: "OK" }]
      );

      setEquipamentoSelecionado(null);
      setSolicitanteNome("");
      setDepartamento("");
      setSearchEquip("");
      carregar();
    } catch (e) {
      console.error("Erro ao salvar emprestimo:", e);
      Alert.alert("Erro", "Nao foi possivel registrar o emprestimo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(120, keyboardHeight + 80) }]} keyboardShouldPersistTaps="handled">

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Package size={18} color="#4f46e5" />
              <Text style={styles.sectionTitle}>Equipamento</Text>
            </View>
            <TouchableOpacity
              style={[styles.selectorBtn, equipamentoSelecionado && styles.selectorBtnActive]}
              onPress={() => setShowEquipModal(true)}
            >
              <Text style={[styles.selectorText, equipamentoSelecionado && styles.selectorTextActive]} numberOfLines={1}>
                {equipamentoSelecionado
                  ? `${equipamentoSelecionado.nome} -- Patr: ${equipamentoSelecionado.codigoPatrimonio}`
                  : "Toque para selecionar o equipamento..."}
              </Text>
              <ChevronDown size={18} color={equipamentoSelecionado ? "#4f46e5" : "#94a3b8"} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={18} color="#4f46e5" />
              <Text style={styles.sectionTitle}>Solicitante</Text>
            </View>
            {usuarios.length > 0 && (
              <TouchableOpacity style={styles.pickUserBtn} onPress={() => setShowUsuarioModal(true)}>
                <Text style={styles.pickUserBtnText}>Selecionar da lista de usuarios cadastrados</Text>
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.input}
              value={solicitanteNome}
              onChangeText={setSolicitanteNome}
              placeholder="Nome completo do solicitante"
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Building2 size={18} color="#4f46e5" />
              <Text style={styles.sectionTitle}>Departamento</Text>
            </View>
            <TextInput
              style={styles.input}
              value={departamento}
              onChangeText={setDepartamento}
              placeholder="Ex: TI, Recursos Humanos, Financeiro..."
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
            />
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, saving && { opacity: 0.7 }]}
            onPress={handleConfirmar}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <CheckCircle size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.confirmBtnText}>Confirmar Emprestimo</Text>
              </View>
            )}
          </TouchableOpacity>

          {emprestimosOffline.length > 0 && (
            <View style={styles.pendingSection}>
              <Text style={styles.pendingTitle}>Emprestimos Pendentes de Sync ({emprestimosOffline.length})</Text>
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
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showEquipModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Equipamento</Text>
              <TouchableOpacity onPress={() => setShowEquipModal(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Search size={16} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                value={searchEquip}
                onChangeText={setSearchEquip}
                placeholder="Buscar por nome ou patrimonio..."
                placeholderTextColor="#94a3b8"
              />
            </View>
            <FlatList
              data={filteredEquipamentos}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setEquipamentoSelecionado(item); setShowEquipModal(false); setSearchEquip(""); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{item.nome}</Text>
                    <Text style={styles.modalItemSub}>Patr: {item.codigoPatrimonio}</Text>
                  </View>
                  <View style={styles.availableBadge}>
                    <Text style={styles.availableBadgeText}>Disponivel</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.emptyText}>Nenhum equipamento disponivel para emprestimo.</Text>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showUsuarioModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Usuario</Text>
              <TouchableOpacity onPress={() => setShowUsuarioModal(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Search size={16} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                value={searchUsuario}
                onChangeText={setSearchUsuario}
                placeholder="Buscar por nome ou departamento..."
                placeholderTextColor="#94a3b8"
              />
            </View>
            <FlatList
              data={filteredUsuarios}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleSelecionarUsuario(item)}>
                  <View>
                    <Text style={styles.modalItemName}>{item.nome}</Text>
                    <Text style={styles.modalItemSub}>{item.departamento}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.emptyText}>Nenhum usuario sincronizado. Digite manualmente.</Text>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: "#ffffff", borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginLeft: 8 },
  selectorBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 12, padding: 14,
  },
  selectorBtnActive: { borderColor: "#4f46e5", backgroundColor: "#eef2ff" },
  selectorText: { flex: 1, fontSize: 14, color: "#94a3b8" },
  selectorTextActive: { color: "#4f46e5", fontWeight: "600" },
  pickUserBtn: { backgroundColor: "#eff6ff", borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 10 },
  pickUserBtnText: { color: "#3b82f6", fontWeight: "600", fontSize: 13 },
  input: {
    backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 12, padding: 14, fontSize: 14, color: "#0f172a",
  },
  confirmBtn: {
    backgroundColor: "#4f46e5", borderRadius: 14, padding: 16,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
    shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  confirmBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  pendingSection: { marginTop: 4 },
  pendingTitle: { fontSize: 14, fontWeight: "700", color: "#64748b", marginBottom: 10 },
  pendingCard: {
    backgroundColor: "#ffffff", borderRadius: 12, padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderLeftColor: "#f59e0b",
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  pendingCardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  pendingEquipName: { fontSize: 14, fontWeight: "700", color: "#0f172a", flex: 1 },
  pendingBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pendingBadgeText: { fontSize: 11, fontWeight: "700", color: "#d97706" },
  pendingDetail: { fontSize: 12, color: "#64748b", marginTop: 2 },
  pendingDate: { fontSize: 11, color: "#94a3b8", marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", paddingBottom: 20 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  modalSearch: {
    flexDirection: "row", alignItems: "center", margin: 12,
    backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, paddingHorizontal: 12,
  },
  modalSearchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: "#0f172a" },
  modalItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  modalItemName: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  modalItemSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  availableBadge: { backgroundColor: "#e6f4ea", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  availableBadgeText: { fontSize: 11, fontWeight: "700", color: "#137333" },
  emptyText: { textAlign: "center", color: "#94a3b8", padding: 24, fontSize: 14 },
});
