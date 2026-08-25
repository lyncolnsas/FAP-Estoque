import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Image, Dimensions, ActivityIndicator, SafeAreaView, PanResponder
} from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import {
  X, Check, RotateCcw, RotateCw, RefreshCw, ZoomIn, ZoomOut, Maximize2
} from "lucide-react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CROP_BOX_SIZE = Math.min(SCREEN_WIDTH - 48, 320);
const SLIDER_WIDTH = SCREEN_WIDTH - 80;

export default function ImageCropModal({
  visible,
  imageUri,
  onClose,
  onConfirm
}) {
  const [angle, setAngle] = useState(0); // -180 to 180
  const [zoom, setZoom] = useState(1); // 1.0 to 3.0
  const [processing, setProcessing] = useState(false);

  const sliderTrackRef = useRef(null);
  const [trackLayout, setTrackLayout] = useState({ x: 0, width: SLIDER_WIDTH });

  useEffect(() => {
    if (visible) {
      setAngle(0);
      setZoom(1);
      setProcessing(false);
    }
  }, [visible, imageUri]);

  // PanResponder para o Slider de Rotação (-180° a +180°)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        handleTouchSlider(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt, gestureState) => {
        handleMoveSlider(gestureState.dx);
      },
    })
  ).current;

  const currentAngleRef = useRef(0);
  currentAngleRef.current = angle;

  const handleTouchSlider = (touchX) => {
    const width = trackLayout.width || SLIDER_WIDTH;
    const clampedX = Math.max(0, Math.min(touchX, width));
    const ratio = clampedX / width; // 0 to 1
    const newAngle = Math.round((ratio - 0.5) * 360); // -180 to 180
    setAngle(newAngle);
  };

  const handleMoveSlider = (dx) => {
    const width = trackLayout.width || SLIDER_WIDTH;
    const deltaDeg = Math.round((dx / width) * 360);
    const newAngle = Math.max(-180, Math.min(180, currentAngleRef.current + deltaDeg));
    setAngle(newAngle);
  };

  const adjustAngle = (delta) => {
    setAngle((prev) => {
      let next = prev + delta;
      if (next > 180) next = 180;
      if (next < -180) next = -180;
      return next;
    });
  };

  const adjustZoom = (delta) => {
    setZoom((prev) => {
      const next = Math.max(1, Math.min(3, parseFloat((prev + delta).toFixed(2))));
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!imageUri) return;
    setProcessing(true);
    try {
      const actions = [];
      if (angle !== 0) {
        actions.push({ rotate: angle });
      }
      actions.push({ resize: { width: 800, height: 800 } });

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        actions,
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      onConfirm(result.uri);
      onClose();
    } catch (e) {
      console.error("Erro ao cortar/rotacionar imagem:", e);
      onConfirm(imageUri);
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  // Posição do indicador no slider (-180° = 0%, 0° = 50%, +180° = 100%)
  const thumbPercent = ((angle + 180) / 360) * 100;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* CABEÇALHO */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose} disabled={processing}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.title}>Ajuste & Corte Quadrado</Text>
            <Text style={styles.subtitle}>Gire livremente e redimensione antes de cortar</Text>
          </View>
          <TouchableOpacity
            style={styles.btnConfirmar}
            onPress={handleConfirm}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Check size={18} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.btnConfirmarText}>Cortar</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ÁREA DE CORTE QUADRADO 1:1 COM VISUALIZAÇÃO EM TEMPO REAL */}
        <View style={styles.cropViewport}>
          <View style={styles.cropFrame}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={[
                  styles.imagePreview,
                  {
                    transform: [
                      { rotate: `${angle}deg` },
                      { scale: zoom }
                    ]
                  }
                ]}
                resizeMode="contain"
              />
            ) : null}

            {/* GRADE 3x3 */}
            <View style={styles.gridOverlay} pointerEvents="none">
              <View style={styles.gridRow}>
                <View style={styles.gridCell} />
                <View style={styles.gridCell} />
                <View style={styles.gridCell} />
              </View>
              <View style={styles.gridRow}>
                <View style={styles.gridCell} />
                <View style={styles.gridCell} />
                <View style={styles.gridCell} />
              </View>
              <View style={styles.gridRow}>
                <View style={styles.gridCell} />
                <View style={styles.gridCell} />
                <View style={styles.gridCell} />
              </View>
            </View>

            {/* MARCADORES DE CANTO DE CORTE */}
            <View style={[styles.corner, styles.cornerTL]} pointerEvents="none" />
            <View style={[styles.corner, styles.cornerTR]} pointerEvents="none" />
            <View style={[styles.corner, styles.cornerBL]} pointerEvents="none" />
            <View style={[styles.corner, styles.cornerBR]} pointerEvents="none" />
          </View>

          {/* INDICADORES EM TEMPO REAL */}
          <View style={styles.infoBadgeRow}>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeText}>
                Rotação: {angle > 0 ? `+${angle}°` : `${angle}°`}
              </Text>
            </View>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeText}>Zoom: {zoom.toFixed(1)}x</Text>
            </View>
          </View>
        </View>

        {/* CONTROLES DE ROTAÇÃO E ZOOM */}
        <View style={styles.controlsContainer}>
          {/* 1. SLIDER CENTRAL DE ROTAÇÃO GRADUAL (-180° a +180°) */}
          <Text style={styles.controlSectionLabel}>Girar Imagem (-180° a +180°)</Text>

          <View style={styles.sliderWrapper}>
            <Text style={styles.sliderLimitText}>-180°</Text>

            <View
              style={styles.sliderTrack}
              onLayout={(e) => setTrackLayout(e.nativeEvent.layout)}
              {...panResponder.panHandlers}
            >
              {/* Linha de centro 0° */}
              <View style={styles.centerIndicator} />
              {/* Barra ativa a partir do centro */}
              {angle >= 0 ? (
                <View
                  style={[
                    styles.activeTrackRight,
                    { width: `${(angle / 360) * 100}%` }
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.activeTrackLeft,
                    { width: `${Math.abs(angle / 360) * 100}%` }
                  ]}
                />
              )}
              {/* Knob / Thumb do Slider */}
              <View
                style={[
                  styles.sliderThumb,
                  { left: `${Math.max(0, Math.min(96, thumbPercent))}%` }
                ]}
              >
                <View style={styles.thumbCenterDot} />
              </View>
            </View>

            <Text style={styles.sliderLimitText}>+180°</Text>
          </View>

          {/* BOTÕES DE AJUSTE FINO DE ROTAÇÃO */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustAngle(-90)}>
              <RotateCcw size={13} color="#94a3b8" />
              <Text style={styles.stepBtnText}>-90°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustAngle(-15)}>
              <Text style={styles.stepBtnText}>-15°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustAngle(-1)}>
              <Text style={styles.stepBtnText}>-1°</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={() => setAngle(0)}>
              <RefreshCw size={12} color="#fff" style={{ marginRight: 3 }} />
              <Text style={styles.resetBtnText}>0°</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustAngle(1)}>
              <Text style={styles.stepBtnText}>+1°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustAngle(15)}>
              <Text style={styles.stepBtnText}>+15°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustAngle(90)}>
              <RotateCw size={13} color="#94a3b8" />
              <Text style={styles.stepBtnText}>+90°</Text>
            </TouchableOpacity>
          </View>

          {/* 2. REDIMENSIONAMENTO / ZOOM */}
          <View style={styles.zoomRow}>
            <Text style={styles.controlSectionLabel}>Redimensionar / Zoom</Text>
            <View style={styles.zoomBtnGroup}>
              <TouchableOpacity style={styles.zoomBtn} onPress={() => adjustZoom(-0.1)}>
                <ZoomOut size={16} color="#94a3b8" />
                <Text style={styles.zoomBtnText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomResetBtn} onPress={() => setZoom(1)}>
                <Maximize2 size={13} color="#38bdf8" style={{ marginRight: 4 }} />
                <Text style={styles.zoomResetBtnText}>1.0x</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomBtn} onPress={() => adjustZoom(0.1)}>
                <ZoomIn size={16} color="#94a3b8" />
                <Text style={styles.zoomBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f19" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1e293b",
  },
  iconBtn: { padding: 6 },
  title: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  subtitle: { fontSize: 11, color: "#64748b", marginTop: 2 },
  btnConfirmar: {
    backgroundColor: "#2563eb", paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8,
  },
  btnConfirmarText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  cropViewport: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 16,
  },
  cropFrame: {
    width: CROP_BOX_SIZE, height: CROP_BOX_SIZE,
    backgroundColor: "#020617", borderRadius: 14, overflow: "hidden",
    borderWidth: 2, borderColor: "#38bdf8", position: "relative",
  },
  imagePreview: { width: "100%", height: "100%" },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "column",
  },
  gridRow: { flex: 1, flexDirection: "row" },
  gridCell: {
    flex: 1, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.12)",
  },
  corner: {
    position: "absolute", width: 18, height: 18,
    borderColor: "#38bdf8",
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  infoBadgeRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  infoBadge: {
    backgroundColor: "#1e293b", paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1, borderColor: "#334155",
  },
  infoBadgeText: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  controlsContainer: {
    backgroundColor: "#111827", padding: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: "#1f2937",
  },
  controlSectionLabel: {
    fontSize: 12, fontWeight: "700", color: "#94a3b8", textAlign: "center", marginBottom: 8,
  },
  sliderWrapper: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12, paddingHorizontal: 4,
  },
  sliderLimitText: { color: "#64748b", fontSize: 11, fontWeight: "600", width: 36, textAlign: "center" },
  sliderTrack: {
    flex: 1, height: 28, backgroundColor: "#1f2937",
    borderRadius: 14, position: "relative", justifyContent: "center",
    marginHorizontal: 8, overflow: "hidden",
  },
  centerIndicator: {
    position: "absolute", left: "50%", width: 2, height: "100%",
    backgroundColor: "rgba(255,255,255,0.3)", zIndex: 1,
  },
  activeTrackRight: {
    position: "absolute", left: "50%", height: "100%",
    backgroundColor: "rgba(56, 189, 248, 0.25)",
  },
  activeTrackLeft: {
    position: "absolute", right: "50%", height: "100%",
    backgroundColor: "rgba(56, 189, 248, 0.25)",
  },
  sliderThumb: {
    position: "absolute", width: 22, height: 22,
    borderRadius: 11, backgroundColor: "#38bdf8",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 3, elevation: 4,
    zIndex: 2,
  },
  thumbCenterDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0f172a" },
  buttonRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 4, marginBottom: 14,
  },
  stepBtn: {
    flex: 1, backgroundColor: "#1f2937", paddingVertical: 8,
    borderRadius: 8, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 2,
  },
  stepBtnText: { color: "#e2e8f0", fontSize: 11, fontWeight: "600" },
  resetBtn: {
    backgroundColor: "#ef4444", paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, alignItems: "center", justifyContent: "center",
    flexDirection: "row",
  },
  resetBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  zoomRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 6, borderTopWidth: 1, borderTopColor: "#1f2937",
  },
  zoomBtnGroup: { flexDirection: "row", gap: 8 },
  zoomBtn: {
    backgroundColor: "#1f2937", width: 44, height: 34,
    borderRadius: 8, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 3,
  },
  zoomBtnText: { color: "#e2e8f0", fontSize: 13, fontWeight: "700" },
  zoomResetBtn: {
    backgroundColor: "#1e293b", paddingHorizontal: 12, height: 34,
    borderRadius: 8, alignItems: "center", justifyContent: "center",
    flexDirection: "row", borderWidth: 1, borderColor: "#334155",
  },
  zoomResetBtnText: { color: "#38bdf8", fontSize: 12, fontWeight: "700" },
});
