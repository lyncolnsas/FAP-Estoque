import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator, SafeAreaView,
  Platform, ScrollView, Modal, Image, StatusBar
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/database";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { API_URL } from "../services/api";
import {
  Building2, Users, Camera, Image as ImageIcon, Plus, X, Trash2,
  Crop, RotateCw, FlipHorizontal
} from "lucide-react-native";

const generateId = () => `loc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

export default function CadastrarLocalScreen({ navigation }) {
  const keyboardHeight = useKeyboardHeight();
  const [locais, setLocais] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [nome, setNome] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [fotoUri, setFotoUri] = useState(null);
  const [saving, setSaving] = useState(false);

  const getFotoUri = (url) => {
    if (!url) return null;
    if (url.startsWith("/uploads/")) {
      return `${API_URL}${url}`;
    }
    return url;
  };

  const carregar = useCallback(() => {
    try {
      const data = db.getAllSync("SELECT * FROM Local ORDER BY nome ASC");
      setLocais(data);
    } catch (e) {
      console.error("Erro ao carregar locais:", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        return Alert.alert("Permissão", "Precisamos de acesso às suas fotos.");
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
    } catch (err) {
      console.error("Erro ao selecionar foto:", err);
      Alert.alert("Erro", "Não foi possível carregar a imagem da galeria.");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        return Alert.alert("Permissão", "Precisamos de acesso à câmera.");
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
    } catch (err) {
      console.error("Erro ao abrir câmera:", err);
      Alert.alert("Erro", "Não foi possível acionar a câmera.");
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

  const handleSalvar = async () => {
    if (!nome.trim()) {
      return Alert.alert("Atenção", "Digite o nome do local ou espaço.");
    }
    setSaving(true);
    try {
      const id = generateId();
      const capNum = capacidade ? parseInt(capacidade, 10) : 0;

      db.runSync(
        "INSERT OR REPLACE INTO Local (id, nome, capacidade, fotoUrl, synced) VALUES (?, ?, ?, ?, 0)",
        [id, nome.trim(), capNum, fotoUri || null]
      );

      db.runSync(
        "INSERT INTO OfflineLog (tipo, itemId, dados, data, synced) VALUES (?, ?, ?, ?, 0)",
        [
          "NOVO_LOCAL",
          id,
          JSON.stringify({ id, nome: nome.trim(), capacidade: capNum, fotoUrl: fotoUri || null }),
          new Date().toISOString()
        ]
      );

      Alert.alert("Sucesso", `Local "${nome.trim()}" cadastrado com sucesso!`);
      setNome("");
      setCapacidade("");
      setFotoUri(null);
      setShowModal(false);
      carregar();
    } catch (e) {
      console.error("Erro ao salvar local:", e);
      Alert.alert("Erro", "Falha ao cadastrar local.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.mainActionBtn, { backgroundColor: "#0284c7" }]}
          onPress={() => setShowModal(true)}
        >
          <Plus size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.mainActionBtnText}>+ Novo Local / Sala</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={locais}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => {
          const foto = getFotoUri(item.fotoUrl);
          return (
            <View style={styles.localCard}>
              {foto ? (
                <Image source={{ uri: foto }} style={styles.localImage} resizeMode="cover" />
              ) : (
                <View style={styles.localImagePlaceholder}>
                  <Building2 size={32} color="#94a3b8" />
                </View>
              )}
              <View style={styles.localInfo}>
                <Text style={styles.localName}>{item.nome}</Text>
                <View style={styles.capacidadeRow}>
                  <Users size={14} color="#64748b" style={{ marginRight: 4 }} />
                  <Text style={styles.capacidadeText}>
                    Capacidade: {item.capacidade > 0 ? `${item.capacidade} pessoas` : "Livre"}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Building2 size={40} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Nenhum Local Cadastrado</Text>
            <Text style={styles.emptySubtitle}>Cadastre estúdios, auditórios e salas de reunião disponíveis para reserva.</Text>
          </View>
        )}
      />

      {/* MODAL NOVO LOCAL */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
          <View style={styles.modalSheet}>
            <ScrollView
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Novo Local / Espaço</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <X size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* FOTO */}
              <Text style={styles.inputLabel}>Foto do Espaço (Formato Quadrado 1:1)</Text>
              {fotoUri ? (
                <View style={styles.squarePhotoWrapper}>
                  <View style={styles.squarePhotoContainer}>
                    <Image source={{ uri: fotoUri }} style={styles.squarePhoto} resizeMode="cover" />
                  </View>
                  <View style={styles.photoControlsRow}>
                    <TouchableOpacity style={styles.photoControlBtn} onPress={handleGirar90}>
                      <RotateCw size={16} color="#0284c7" />
                      <Text style={styles.photoControlBtnText}>Girar 90°</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoControlBtn} onPress={handleEspelhar}>
                      <FlipHorizontal size={16} color="#0284c7" />
                      <Text style={styles.photoControlBtnText}>Espelhar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoControlBtn} onPress={handleTakePhoto}>
                      <Camera size={16} color="#0284c7" />
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
                <View style={styles.photoActionsRow}>
                  <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto}>
                    <Camera size={18} color="#0284c7" />
                    <Text style={styles.photoBtnText}>Câmera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={handlePickImage}>
                    <ImageIcon size={18} color="#0284c7" />
                    <Text style={styles.photoBtnText}>Galeria</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* NOME */}
              <Text style={styles.inputLabel}>Nome do Local</Text>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Ex: Estúdio A, Auditório Principal, Sala 02..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
              />

              {/* CAPACIDADE */}
              <Text style={styles.inputLabel}>Capacidade Máxima (Pessoas)</Text>
              <TextInput
                style={styles.input}
                value={capacidade}
                onChangeText={setCapacidade}
                placeholder="Ex: 20"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.confirmBtn, saving && { opacity: 0.7 }]}
                onPress={handleSalvar}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Salvar Local</Text>
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
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0
  },
  headerRow: { padding: 16, paddingBottom: 8 },
  mainActionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: 12,
    shadowColor: "#0284c7", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  mainActionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  listContainer: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  localCard: {
    backgroundColor: "#ffffff", borderRadius: 14, overflow: "hidden",
    marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0",
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  localImage: { width: "100%", height: 140 },
  localImagePlaceholder: {
    width: "100%", height: 100, backgroundColor: "#f1f5f9",
    alignItems: "center", justifyContent: "center",
  },
  localInfo: { padding: 14 },
  localName: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  capacidadeRow: { flexDirection: "row", alignItems: "center" },
  capacidadeText: { fontSize: 13, color: "#64748b" },
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
  photoActionsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  photoBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#f0f9ff", borderWidth: 1.5, borderColor: "#bae6fd",
    borderRadius: 12, paddingVertical: 14, gap: 6,
  },
  photoBtnText: { color: "#0284c7", fontSize: 13, fontWeight: "600" },
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
  confirmBtn: {
    backgroundColor: "#0284c7", borderRadius: 12, padding: 16,
    alignItems: "center", justifyContent: "center", marginTop: 16,
  },
  confirmBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
});
