import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, SafeAreaView,
  KeyboardAvoidingView, Platform, ScrollView, Modal
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/database";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { Tag, Plus, FolderPlus, Layers, Trash2, X, ChevronRight } from "lucide-react-native";

const generateId = () => `cat-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

export default function CadastrarCategoriaScreen({ navigation }) {
  const keyboardHeight = useKeyboardHeight();
  const [categorias, setCategorias] = useState([]);
  const [tipos, setTipos] = useState([]);
  
  // Modais
  const [showModalCat, setShowModalCat] = useState(false);
  const [showModalTipo, setShowModalTipo] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(null);

  // Inputs
  const [nomeCategoria, setNomeCategoria] = useState("");
  const [nomeTipo, setNomeTipo] = useState("");
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(() => {
    try {
      const cats = db.getAllSync("SELECT * FROM Categoria ORDER BY nome ASC");
      const tps = db.getAllSync("SELECT * FROM TipoEquipamento ORDER BY nome ASC");
      setCategorias(cats);
      setTipos(tps);
    } catch (e) {
      console.error("Erro ao carregar categorias:", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const handleSalvarCategoria = async () => {
    if (!nomeCategoria.trim()) {
      return Alert.alert("Atenção", "Digite o nome da categoria.");
    }
    setSaving(true);
    try {
      const id = generateId();
      const nome = nomeCategoria.trim().toUpperCase();

      db.runSync("INSERT INTO Categoria (id, nome) VALUES (?, ?)", [id, nome]);
      db.runSync(
        "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
        ["NOVA_CATEGORIA", id, JSON.stringify({ id, nome }), new Date().toISOString()]
      );

      Alert.alert("Sucesso", `Categoria "${nome}" cadastrada com sucesso!`);
      setNomeCategoria("");
      setShowModalCat(false);
      carregar();
    } catch (e) {
      Alert.alert("Erro", "Falha ao salvar categoria.");
    } finally {
      setSaving(false);
    }
  };

  const handleSalvarTipo = async () => {
    if (!categoriaSelecionada) {
      return Alert.alert("Atenção", "Selecione a categoria para o tipo.");
    }
    if (!nomeTipo.trim()) {
      return Alert.alert("Atenção", "Digite o nome do subtipo.");
    }
    setSaving(true);
    try {
      const id = generateId();
      const nome = nomeTipo.trim();

      db.runSync(
        "INSERT INTO TipoEquipamento (id, categoriaId, nome) VALUES (?, ?, ?)",
        [id, categoriaSelecionada.id, nome]
      );
      db.runSync(
        "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
        [
          "NOVO_TIPO_EQUIPAMENTO",
          id,
          JSON.stringify({ id, categoriaId: categoriaSelecionada.id, categoriaNome: categoriaSelecionada.nome, nome }),
          new Date().toISOString()
        ]
      );

      Alert.alert("Sucesso", `Subtipo "${nome}" adicionado em "${categoriaSelecionada.nome}"!`);
      setNomeTipo("");
      setShowModalTipo(false);
      carregar();
    } catch (e) {
      Alert.alert("Erro", "Falha ao salvar tipo de equipamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.mainActionBtn, { backgroundColor: "#4f46e5" }]}
          onPress={() => setShowModalCat(true)}
        >
          <FolderPlus size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.mainActionBtnText}>+ Nova Categoria</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categorias}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => {
          const tiposDaCat = tipos.filter(t => t.categoriaId === item.id);
          return (
            <View style={styles.catCard}>
              <View style={styles.catCardHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Tag size={18} color="#4f46e5" style={{ marginRight: 8 }} />
                  <Text style={styles.catTitle}>{item.nome}</Text>
                </View>
                <TouchableOpacity
                  style={styles.addTipoBtn}
                  onPress={() => {
                    setCategoriaSelecionada(item);
                    setShowModalTipo(true);
                  }}
                >
                  <Plus size={14} color="#4f46e5" />
                  <Text style={styles.addTipoBtnText}>Subtipo</Text>
                </TouchableOpacity>
              </View>

              {tiposDaCat.length > 0 ? (
                <View style={styles.tiposChipsContainer}>
                  {tiposDaCat.map(t => (
                    <View key={t.id} style={styles.tipoChip}>
                      <Layers size={12} color="#64748b" style={{ marginRight: 4 }} />
                      <Text style={styles.tipoChipText}>{t.nome}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyTiposText}>Nenhum subtipo cadastrado nesta categoria.</Text>
              )}
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Tag size={40} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Nenhuma Categoria Cadastrada</Text>
            <Text style={styles.emptySubtitle}>Toque no botão acima para criar sua primeira categoria.</Text>
          </View>
        )}
      />

      {/* MODAL NOVA CATEGORIA */}
      <Modal visible={showModalCat} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Categoria</Text>
              <TouchableOpacity onPress={() => setShowModalCat(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.inputLabel}>Nome da Categoria</Text>
              <TextInput
                style={styles.input}
                value={nomeCategoria}
                onChangeText={setNomeCategoria}
                placeholder="Ex: FOTOGRAFIA, ILUMINAÇÃO, ÁUDIO..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.confirmBtn, saving && { opacity: 0.7 }]}
                onPress={handleSalvarCategoria}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Salvar Categoria</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL NOVO TIPO */}
      <Modal visible={showModalTipo} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Novo Subtipo</Text>
                <Text style={styles.modalSubtitle}>
                  Categoria: {categoriaSelecionada?.nome}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowModalTipo(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.inputLabel}>Nome do Subtipo / Tipo</Text>
              <TextInput
                style={styles.input}
                value={nomeTipo}
                onChangeText={setNomeTipo}
                placeholder="Ex: Câmera Mirrorless, Microfone Lapela, Softbox..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.confirmBtn, saving && { opacity: 0.7 }]}
                onPress={handleSalvarTipo}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Salvar Subtipo</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
    shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  mainActionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  listContainer: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  catCard: {
    backgroundColor: "#ffffff", borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0",
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  catCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  addTipoBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#eef2ff", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  addTipoBtnText: { color: "#4f46e5", fontSize: 12, fontWeight: "700", marginLeft: 4 },
  tiposChipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  tipoChip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
  },
  tipoChipText: { fontSize: 12, color: "#334155", fontWeight: "500" },
  emptyTiposText: { fontSize: 12, color: "#94a3b8", fontStyle: "italic", marginTop: 10 },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#64748b", marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 4, paddingHorizontal: 30 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  modalSubtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  input: {
    backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 12, padding: 14, fontSize: 15, color: "#0f172a", marginBottom: 16,
  },
  confirmBtn: {
    backgroundColor: "#4f46e5", borderRadius: 12, padding: 16,
    alignItems: "center", justifyContent: "center",
  },
  confirmBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
});
