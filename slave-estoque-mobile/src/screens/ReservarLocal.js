import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, SafeAreaView,
  KeyboardAvoidingView, Platform, ScrollView, Modal
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/database";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { Calendar, Clock, Building2, User, CheckCircle, ChevronDown, X, Plus } from "lucide-react-native";

const generateId = () => `res-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

export default function ReservarLocalScreen({ navigation }) {
  const keyboardHeight = useKeyboardHeight();
  const [locais, setLocais] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [reservas, setReservas] = useState([]);

  // Form states
  const [showModalReserva, setShowModalReserva] = useState(false);
  const [showModalLocal, setShowModalLocal] = useState(false);
  const [showModalUsuario, setShowModalUsuario] = useState(false);

  const [localSelecionado, setLocalSelecionado] = useState(null);
  const [solicitanteNome, setSolicitanteNome] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [dataEvento, setDataEvento] = useState(new Date().toISOString().split("T")[0]);
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("12:00");
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(() => {
    try {
      const locs = db.getAllSync("SELECT * FROM Local ORDER BY nome ASC");
      const usrs = db.getAllSync("SELECT * FROM Usuario ORDER BY nome ASC");
      const res = db.getAllSync(`
        SELECT r.*, l.nome as localNome 
        FROM ReservaLocal r 
        LEFT JOIN Local l ON r.localId = l.id 
        ORDER BY r.dataInicio DESC
      `);
      setLocais(locs);
      setUsuarios(usrs);
      setReservas(res);
    } catch (e) {
      console.error("Erro ao carregar dados de reservas:", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const handleSalvarReserva = async () => {
    if (!localSelecionado) {
      return Alert.alert("Atenção", "Selecione o local/sala para a reserva.");
    }
    if (!solicitanteNome.trim()) {
      return Alert.alert("Atenção", "Informe o nome do solicitante.");
    }

    setSaving(true);
    try {
      const id = generateId();
      const dataInicioStr = `${dataEvento}T${horaInicio}:00.000Z`;
      const dataFimStr = `${dataEvento}T${horaFim}:00.000Z`;

      db.runSync(
        `INSERT INTO ReservaLocal (id, localId, usuarioId, solicitanteNome, departamento, dataInicio, dataFim, status, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA', 0)`,
        [id, localSelecionado.id, null, solicitanteNome.trim(), departamento.trim(), dataInicioStr, dataFimStr]
      );

      db.runSync(
        `INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)`,
        [
          "NOVA_RESERVA_LOCAL",
          id,
          JSON.stringify({
            id,
            localId: localSelecionado.id,
            localNome: localSelecionado.nome,
            solicitanteNome: solicitanteNome.trim(),
            departamento: departamento.trim(),
            dataInicio: dataInicioStr,
            dataFim: dataFimStr
          }),
          new Date().toISOString()
        ]
      );

      Alert.alert("Reserva Confirmada!", `Espaço "${localSelecionado.nome}" reservado para ${solicitanteNome.trim()} em ${dataEvento}.`);
      setLocalSelecionado(null);
      setSolicitanteNome("");
      setDepartamento("");
      setShowModalReserva(false);
      carregar();
    } catch (e) {
      console.error("Erro ao salvar reserva:", e);
      Alert.alert("Erro", "Não foi possível registrar a reserva.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.mainActionBtn, { backgroundColor: "#059669" }]}
          onPress={() => setShowModalReserva(true)}
        >
          <Plus size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.mainActionBtnText}>+ Nova Reserva de Espaço</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={reservas}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.reservaCard}>
            <View style={styles.reservaHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Building2 size={16} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.reservaLocal}>{item.localNome || "Espaço / Sala"}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.status || "CONFIRMADA"}</Text>
              </View>
            </View>
            <Text style={styles.reservaUser}>Solicitante: {item.solicitanteNome || "Não informado"}</Text>
            {item.departamento ? <Text style={styles.reservaDept}>Depto: {item.departamento}</Text> : null}
            <View style={styles.reservaDateRow}>
              <Calendar size={13} color="#64748b" style={{ marginRight: 4 }} />
              <Text style={styles.reservaDate}>
                {item.dataInicio ? new Date(item.dataInicio).toLocaleDateString("pt-BR") : "Data Livre"}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Calendar size={40} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Nenhuma Reserva Ativa</Text>
            <Text style={styles.emptySubtitle}>Toque no botão acima para agendar o uso de salas ou estúdios.</Text>
          </View>
        )}
      />

      {/* MODAL NOVA RESERVA */}
      <Modal visible={showModalReserva} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
          <View style={styles.modalSheet}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova Reserva de Espaço</Text>
                <TouchableOpacity onPress={() => setShowModalReserva(false)}>
                  <X size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* SELEÇÃO DE LOCAL */}
              <Text style={styles.inputLabel}>Local / Espaço</Text>
              <TouchableOpacity
                style={[styles.selectorBtn, localSelecionado && styles.selectorBtnActive]}
                onPress={() => setShowModalLocal(true)}
              >
                <Text style={[styles.selectorText, localSelecionado && styles.selectorTextActive]}>
                  {localSelecionado ? localSelecionado.nome : "Selecione a sala ou estúdio..."}
                </Text>
                <ChevronDown size={18} color={localSelecionado ? "#059669" : "#94a3b8"} />
              </TouchableOpacity>

              {/* SOLICITANTE */}
              <Text style={styles.inputLabel}>Solicitante</Text>
              {usuarios.length > 0 && (
                <TouchableOpacity
                  style={styles.pickUserBtn}
                  onPress={() => setShowModalUsuario(true)}
                >
                  <Text style={styles.pickUserBtnText}>Escolher da lista de usuários</Text>
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

              {/* DEPARTAMENTO */}
              <Text style={styles.inputLabel}>Departamento</Text>
              <TextInput
                style={styles.input}
                value={departamento}
                onChangeText={setDepartamento}
                placeholder="Ex: Marketing, Diretoria, Produção..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
              />

              {/* DATA E HORÁRIOS */}
              <Text style={styles.inputLabel}>Data do Evento (AAAA-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={dataEvento}
                onChangeText={setDataEvento}
                placeholder="2026-08-25"
                placeholderTextColor="#94a3b8"
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Início</Text>
                  <TextInput
                    style={styles.input}
                    value={horaInicio}
                    onChangeText={setHoraInicio}
                    placeholder="08:00"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Término</Text>
                  <TextInput
                    style={styles.input}
                    value={horaFim}
                    onChangeText={setHoraFim}
                    placeholder="12:00"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.confirmBtn, saving && { opacity: 0.7 }]}
                onPress={handleSalvarReserva}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirmar Reserva</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL ESCOLHER LOCAL */}
      <Modal visible={showModalLocal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Espaço</Text>
              <TouchableOpacity onPress={() => setShowModalLocal(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={locais}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setLocalSelecionado(item);
                    setShowModalLocal(false);
                  }}
                >
                  <Building2 size={18} color="#059669" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{item.nome}</Text>
                    <Text style={styles.modalItemSub}>Capacidade: {item.capacidade || "Livre"} pessoas</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.emptyText}>Nenhum local cadastrado. Cadastre locais primeiro.</Text>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL ESCOLHER USUARIO */}
      <Modal visible={showModalUsuario} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Usuário</Text>
              <TouchableOpacity onPress={() => setShowModalUsuario(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={usuarios}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSolicitanteNome(item.nome);
                    setDepartamento(item.departamento || "");
                    setShowModalUsuario(false);
                  }}
                >
                  <User size={18} color="#059669" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{item.nome}</Text>
                    <Text style={styles.modalItemSub}>{item.departamento || "Sem departamento"}</Text>
                  </View>
                </TouchableOpacity>
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
  headerRow: { padding: 16, paddingBottom: 8 },
  mainActionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: 12,
    shadowColor: "#059669", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  mainActionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  listContainer: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  reservaCard: {
    backgroundColor: "#ffffff", borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0",
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  reservaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  reservaLocal: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  badge: { backgroundColor: "#d1fae5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { color: "#059669", fontSize: 11, fontWeight: "700" },
  reservaUser: { fontSize: 13, color: "#334155", fontWeight: "600" },
  reservaDept: { fontSize: 12, color: "#64748b", marginTop: 2 },
  reservaDateRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  reservaDate: { fontSize: 12, color: "#64748b", fontWeight: "500" },
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
  selectorBtnActive: { borderColor: "#059669", backgroundColor: "#ecfdf5" },
  selectorText: { fontSize: 14, color: "#94a3b8" },
  selectorTextActive: { color: "#059669", fontWeight: "600" },
  pickUserBtn: {
    backgroundColor: "#ecfdf5", borderRadius: 10, padding: 10,
    alignItems: "center", marginBottom: 8,
  },
  pickUserBtnText: { color: "#059669", fontWeight: "600", fontSize: 12 },
  confirmBtn: {
    backgroundColor: "#059669", borderRadius: 12, padding: 16,
    alignItems: "center", justifyContent: "center", marginTop: 16,
  },
  confirmBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  modalItem: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  modalItemName: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  modalItemSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  emptyText: { textAlign: "center", color: "#94a3b8", padding: 20 },
});
