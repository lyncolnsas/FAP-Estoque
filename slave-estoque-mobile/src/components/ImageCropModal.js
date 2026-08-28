import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Image, Dimensions, ActivityIndicator, SafeAreaView,
  PanResponder, StatusBar, Platform
} from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import {
  X, Check, RotateCcw, RotateCw, RefreshCw,
  FlipHorizontal
} from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CROP_BOX_SIZE = Math.min(SCREEN_WIDTH - 32, 330);

export default function ImageCropModal({
  visible,
  imageUri,
  onClose,
  onConfirm
}) {
  // Transform states
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [angle, setAngle] = useState(0); // in degrees
  const [isFlippedH, setIsFlippedH] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 800, height: 800 });

  // Refs for tracking active gestures
  const transformRef = useRef({
    scale: 1,
    translateX: 0,
    translateY: 0,
    angle: 0,
    isFlippedH: false,
    initialDistance: 0,
    initialAngle: 0,
    initialScale: 1,
    initialTouchAngle: 0,
    startPanX: 0,
    startPanY: 0,
    lastTapTime: 0
  });

  // Sync ref with state
  transformRef.current.scale = scale;
  transformRef.current.translateX = translateX;
  transformRef.current.translateY = translateY;
  transformRef.current.angle = angle;
  transformRef.current.isFlippedH = isFlippedH;

  // Reset when opening modal with new image
  useEffect(() => {
    if (visible && imageUri) {
      setScale(1);
      setTranslateX(0);
      setTranslateY(0);
      setAngle(0);
      setIsFlippedH(false);
      setProcessing(false);

      Image.getSize(
        imageUri,
        (w, h) => {
          setImageDimensions({ width: w, height: h });
        },
        () => {
          setImageDimensions({ width: 800, height: 800 });
        }
      );
    }
  }, [visible, imageUri]);

  // Helper functions for 2-finger calculations
  const getDistance = (t1, t2) => {
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.hypot(dx, dy);
  };

  const getTouchAngle = (t1, t2) => {
    const dx = t2.pageX - t1.pageX;
    const dy = t2.pageY - t1.pageY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  // Direct Gestures PanResponder (Pan, Pinch, Rotate, Double-Tap)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        const now = Date.now();

        // Double tap detection (< 300ms)
        if (touches.length === 1) {
          if (now - transformRef.current.lastTapTime < 300) {
            // Toggle between 1.0x and 2.0x zoom
            if (transformRef.current.scale > 1.2) {
              setScale(1);
              setTranslateX(0);
              setTranslateY(0);
            } else {
              setScale(2);
            }
            transformRef.current.lastTapTime = 0;
            return;
          }
          transformRef.current.lastTapTime = now;
        }

        if (touches.length === 2) {
          // Pinch & 2-finger rotation start
          const dist = getDistance(touches[0], touches[1]);
          const touchAngle = getTouchAngle(touches[0], touches[1]);
          transformRef.current.initialDistance = dist;
          transformRef.current.initialScale = transformRef.current.scale;
          transformRef.current.initialTouchAngle = touchAngle;
          transformRef.current.initialAngle = transformRef.current.angle;
        } else if (touches.length === 1) {
          // 1-finger pan start
          transformRef.current.startPanX = transformRef.current.translateX;
          transformRef.current.startPanY = transformRef.current.translateY;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 2) {
          // 2 FINGERS: Pinch Zoom & Rotation
          const currentDist = getDistance(touches[0], touches[1]);
          if (transformRef.current.initialDistance > 0) {
            const factor = currentDist / transformRef.current.initialDistance;
            const newScale = Math.max(1, Math.min(4.0, parseFloat((transformRef.current.initialScale * factor).toFixed(2))));
            setScale(newScale);
          }

          const currentTouchAngle = getTouchAngle(touches[0], touches[1]);
          const angleDelta = Math.round(currentTouchAngle - transformRef.current.initialTouchAngle);
          let newAngle = (transformRef.current.initialAngle + angleDelta) % 360;
          if (newAngle > 180) newAngle -= 360;
          if (newAngle < -180) newAngle += 360;
          setAngle(newAngle);
        } else if (touches.length === 1) {
          // 1 FINGER: Drag / Pan across image
          const newX = transformRef.current.startPanX + gestureState.dx;
          const newY = transformRef.current.startPanY + gestureState.dy;

          // Limit bounds based on scale
          const maxPan = (CROP_BOX_SIZE * (transformRef.current.scale - 0.9)) / 2 + 80;
          const clampedX = Math.max(-maxPan, Math.min(maxPan, newX));
          const clampedY = Math.max(-maxPan, Math.min(maxPan, newY));

          setTranslateX(clampedX);
          setTranslateY(clampedY);
        }
      },
      onPanResponderRelease: () => {
        transformRef.current.initialDistance = 0;
      },
      onPanResponderTerminate: () => {
        transformRef.current.initialDistance = 0;
      }
    })
  ).current;

  // Quick Action Handlers
  const rotateBy90 = (direction) => {
    setAngle((prev) => {
      let next = prev + (direction === "cw" ? 90 : -90);
      next = ((next + 180) % 360) - 180;
      return next;
    });
  };

  const handleReset = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    setAngle(0);
    setIsFlippedH(false);
  };

  const handleConfirm = async () => {
    if (!imageUri) return;
    setProcessing(true);

    try {
      const actions = [];

      // 1. Horizontal Flip
      if (isFlippedH) {
        actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      }

      // 2. Rotation
      if (angle !== 0) {
        actions.push({ rotate: angle });
      }

      // 3. Crop Calculation (Square 1:1 based on visible viewport center and scale)
      const origW = imageDimensions.width || 800;
      const origH = imageDimensions.height || 800;
      const minDim = Math.min(origW, origH);
      
      // Target crop window inside original image
      const cropSize = minDim / scale;
      const normalizedOffsetX = (translateX / CROP_BOX_SIZE) * minDim;
      const normalizedOffsetY = (translateY / CROP_BOX_SIZE) * minDim;

      let originX = (origW - cropSize) / 2 - normalizedOffsetX;
      let originY = (origH - cropSize) / 2 - normalizedOffsetY;

      // Safe bounds clamping
      originX = Math.max(0, Math.min(origW - cropSize, originX));
      originY = Math.max(0, Math.min(origH - cropSize, originY));

      if (cropSize > 20 && cropSize <= origW && cropSize <= origH) {
        actions.push({
          crop: {
            originX: Math.round(originX),
            originY: Math.round(originY),
            width: Math.round(cropSize),
            height: Math.round(cropSize)
          }
        });
      }

      // 4. Standard 800x800 output
      actions.push({ resize: { width: 800, height: 800 } });

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        actions,
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      onConfirm(result.uri);
      onClose();
    } catch (e) {
      console.error("Erro ao aplicar manipulação de imagem:", e);
      // Fallback sem crop estrito
      try {
        const fallback = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 800, height: 800 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        onConfirm(fallback.uri);
      } catch (err) {
        onConfirm(imageUri);
      }
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent={false}>
      <StatusBar barStyle="light-content" backgroundColor="#07090e" />
      <SafeAreaView style={styles.container}>
        {/* CABEÇALHO COM SAFE AREA */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onClose}
            disabled={processing}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={24} color="#94a3b8" />
          </TouchableOpacity>

          <View style={{ alignItems: "center" }}>
            <Text style={styles.title}>Editor de Foto (1:1)</Text>
            <Text style={styles.subtitle}>Arraste e ajuste com os dedos</Text>
          </View>

          <TouchableOpacity
            style={[styles.btnConfirmar, processing && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Check size={18} color="#fff" />
                <Text style={styles.btnConfirmarText}>Cortar</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* VIEWPORT INTERATIVO DE GESTOS (1 DEDO ARRASTA, 2 DEDOS ZOOM/ROTAÇÃO) */}
        <View style={styles.cropViewport}>
          <View style={styles.cropFrame} {...panResponder.panHandlers}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={[
                  styles.imagePreview,
                  {
                    transform: [
                      { translateX },
                      { translateY },
                      { scaleX: isFlippedH ? -1 : 1 },
                      { rotate: `${angle}deg` },
                      { scale }
                    ]
                  }
                ]}
                resizeMode="contain"
              />
            ) : null}

            {/* MARCADORES DE CANTO */}
            <View style={[styles.corner, styles.cornerTL]} pointerEvents="none" />
            <View style={[styles.corner, styles.cornerTR]} pointerEvents="none" />
            <View style={[styles.corner, styles.cornerBL]} pointerEvents="none" />
            <View style={[styles.corner, styles.cornerBR]} pointerEvents="none" />
          </View>

          {/* STATUS EM TEMPO REAL */}
          <View style={styles.infoBadgeRow}>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeText}>
                {angle > 0 ? `+${angle}°` : `${angle}°`}
              </Text>
            </View>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeText}>{scale.toFixed(1)}x Zoom</Text>
            </View>
            {isFlippedH && (
              <View style={[styles.infoBadge, { backgroundColor: "#1e1b4b", borderColor: "#4338ca" }]}>
                <Text style={[styles.infoBadgeText, { color: "#a5b4fc" }]}>Espelhado</Text>
              </View>
            )}
          </View>

          {/* DICA DE GESTOS */}
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>
              👆 <Text style={{ fontWeight: "700", color: "#38bdf8" }}>1 dedo:</Text> Arrastar • ✌️ <Text style={{ fontWeight: "700", color: "#38bdf8" }}>2 dedos:</Text> Zoom & Giro • ⚡ <Text style={{ fontWeight: "700", color: "#38bdf8" }}>2 toques:</Text> Zoom rápido
            </Text>
          </View>
        </View>

        {/* BARRA DE AÇÕES RÁPIDAS */}
        <View style={styles.controlsContainer}>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickActionBtn} onPress={() => rotateBy90("ccw")}>
              <RotateCcw size={20} color="#38bdf8" />
              <Text style={styles.quickActionText}>-90°</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionBtn} onPress={() => rotateBy90("cw")}>
              <RotateCw size={20} color="#38bdf8" />
              <Text style={styles.quickActionText}>+90°</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionBtn, isFlippedH && styles.quickActionBtnActive]}
              onPress={() => setIsFlippedH(!isFlippedH)}
            >
              <FlipHorizontal size={20} color={isFlippedH ? "#38bdf8" : "#94a3b8"} />
              <Text style={[styles.quickActionText, isFlippedH && { color: "#38bdf8" }]}>Espelhar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.quickActionBtn, styles.quickActionBtnReset]} onPress={handleReset}>
              <RefreshCw size={18} color="#f87171" />
              <Text style={[styles.quickActionText, { color: "#f87171" }]}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07090e",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 6 : 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#171f2e",
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#111827",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  btnConfirmar: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    elevation: 3,
  },
  btnConfirmarText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  cropViewport: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  cropFrame: {
    width: CROP_BOX_SIZE,
    height: CROP_BOX_SIZE,
    backgroundColor: "#000000",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#38bdf8",
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: "#38bdf8",
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  infoBadgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  infoBadge: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#38bdf8",
  },
  hintContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  hintText: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 16,
  },
  controlsContainer: {
    backgroundColor: "#0b0f19",
    borderTopWidth: 1,
    borderTopColor: "#171f2e",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
  quickActionBtnActive: {
    borderColor: "#38bdf8",
    backgroundColor: "#082f49",
  },
  quickActionBtnReset: {
    backgroundColor: "#2a1215",
    borderColor: "#451a1a",
  },
  quickActionText: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "700",
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: "#2563eb",
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  tabBtnTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  tabContent: {
    marginTop: 4,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sliderLabelSide: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    width: 32,
    textAlign: "center",
  },
  sliderTrack: {
    flex: 1,
    height: 28,
    backgroundColor: "#1e293b",
    borderRadius: 14,
    position: "relative",
    justifyContent: "center",
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  centerIndicator: {
    position: "absolute",
    left: "50%",
    width: 2,
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  sliderThumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#38bdf8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 4,
    top: 1,
  },
  thumbDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0f172a",
  },
  stepButtonsRow: {
    flexDirection: "row",
    gap: 6,
  },
  stepBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  stepBtnText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
  },
});
