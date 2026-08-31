import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback
} from "react-native";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Check,
  X
} from "lucide-react-native";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const HORARIOS_RAPIDOS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
  "19:00", "20:00", "21:00", "22:00"
];

export default function DateTimePickerModal({
  visible,
  mode = "date", // 'date' | 'time'
  value = "",
  title = "",
  themeColor = "#2563eb",
  onConfirm,
  onClose
}) {
  const today = new Date();
  
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
  const [tempSelectedDate, setTempSelectedDate] = useState(""); // YYYY-MM-DD
  const [tempSelectedHour, setTempSelectedHour] = useState("08");
  const [tempSelectedMinute, setTempSelectedMinute] = useState("00");

  useEffect(() => {
    if (!visible) return;

    if (mode === "date") {
      let initDate = value;
      if (!initDate || initDate.length < 10) {
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        initDate = `${y}-${m}-${d}`;
      }
      const parts = initDate.substring(0, 10).split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        setViewYear(y);
        setViewMonth(m);
        setTempSelectedDate(initDate.substring(0, 10));
      }
    } else {
      let initTime = value || "08:00";
      const parts = initTime.split(":");
      if (parts.length >= 2) {
        setTempSelectedHour(parts[0].padStart(2, "0"));
        setTempSelectedMinute(parts[1].padStart(2, "0"));
      } else {
        setTempSelectedHour("08");
        setTempSelectedMinute("00");
      }
    }
  }, [visible, mode, value]);

  // Cálculos do Calendário Mensal
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Domingo
    const totalDaysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDaysCount = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];

    // Dias do mês anterior para completar primeira semana
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDaysCount - i,
        month: viewMonth - 1,
        year: viewYear,
        isCurrentMonth: false
      });
    }

    // Dias do mês atual
    for (let d = 1; d <= totalDaysInMonth; d++) {
      days.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true
      });
    }

    // Dias do próximo mês para completar grid de semanas
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        month: viewMonth + 1,
        year: viewYear,
        isCurrentMonth: false
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (cell) => {
    let y = cell.year;
    let m = cell.month;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    const str = `${y}-${String(m + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
    setTempSelectedDate(str);
    if (!cell.isCurrentMonth) {
      setViewYear(y);
      setViewMonth(m);
    }
  };

  const setQuickDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const str = `${y}-${m}-${day}`;
    setViewYear(y);
    setViewMonth(d.getMonth());
    setTempSelectedDate(str);
  };

  const handleConfirm = () => {
    if (mode === "date") {
      onConfirm(tempSelectedDate);
    } else {
      onConfirm(`${tempSelectedHour}:${tempSelectedMinute}`);
    }
    onClose();
  };

  const isToday = (cell) => {
    if (!cell.isCurrentMonth) return false;
    return (
      cell.year === today.getFullYear() &&
      cell.month === today.getMonth() &&
      cell.day === today.getDate()
    );
  };

  const isSelected = (cell) => {
    if (!tempSelectedDate) return false;
    let y = cell.year;
    let m = cell.month;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    const str = `${y}-${String(m + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
    return str === tempSelectedDate;
  };

  const formatHeaderDate = (dateStr) => {
    if (!dateStr || dateStr.length < 10) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* CABEÇALHO DO MODAL */}
              <View style={[styles.header, { borderBottomColor: "#f1f5f9" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {mode === "date" ? (
                    <CalendarIcon size={20} color={themeColor} />
                  ) : (
                    <Clock size={20} color={themeColor} />
                  )}
                  <Text style={styles.headerTitle}>
                    {title || (mode === "date" ? "Selecionar Data" : "Selecionar Horário")}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* CONTEÚDO: MODO DATA (CALENDÁRIO) */}
              {mode === "date" && (
                <View style={styles.body}>
                  {/* Navegação Mês / Ano */}
                  <View style={styles.monthNavRow}>
                    <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrowBtn}>
                      <ChevronLeft size={22} color="#334155" />
                    </TouchableOpacity>
                    <Text style={styles.monthYearText}>
                      {MESES[viewMonth]} <Text style={{ fontWeight: "400", color: "#64748b" }}>{viewYear}</Text>
                    </Text>
                    <TouchableOpacity onPress={handleNextMonth} style={styles.navArrowBtn}>
                      <ChevronRight size={22} color="#334155" />
                    </TouchableOpacity>
                  </View>

                  {/* Cabeçalho dos Dias da Semana */}
                  <View style={styles.weekHeaderRow}>
                    {DIAS_SEMANA.map((d, i) => (
                      <View key={i} style={styles.weekHeaderCell}>
                        <Text style={[styles.weekHeaderText, i === 0 || i === 6 ? { color: "#94a3b8" } : null]}>
                          {d}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Grid de Dias */}
                  <View style={styles.daysGrid}>
                    {calendarDays.map((cell, idx) => {
                      const sel = isSelected(cell);
                      const tod = isToday(cell);
                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => handleSelectDay(cell)}
                          style={[
                            styles.dayCell,
                            sel && [styles.dayCellSelected, { backgroundColor: themeColor }],
                            tod && !sel && styles.dayCellToday
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              !cell.isCurrentMonth && styles.dayTextMuted,
                              tod && !sel && [styles.dayTextToday, { color: themeColor }],
                              sel && styles.dayTextSelected
                            ]}
                          >
                            {cell.day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Atalhos Rápidos */}
                  <View style={styles.quickChipsRow}>
                    <TouchableOpacity
                      style={[styles.quickChip, tempSelectedDate === new Date().toISOString().split("T")[0] && { borderColor: themeColor, backgroundColor: "#eff6ff" }]}
                      onPress={() => setQuickDate(0)}
                    >
                      <Text style={[styles.quickChipText, tempSelectedDate === new Date().toISOString().split("T")[0] && { color: themeColor, fontWeight: "700" }]}>
                        Hoje
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickChip}
                      onPress={() => setQuickDate(1)}
                    >
                      <Text style={styles.quickChipText}>Amanhã</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickChip}
                      onPress={() => setQuickDate(7)}
                    >
                      <Text style={styles.quickChipText}>+7 Dias</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* CONTEÚDO: MODO HORÁRIO (TIME PICKER) */}
              {mode === "time" && (
                <View style={styles.body}>
                  {/* Mostrador Grande de Hora e Minuto */}
                  <View style={styles.timeDisplayBox}>
                    <View style={styles.timeSelectorBox}>
                      <Text style={styles.timeSelectorLabel}>Hora</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.timeScrollRow}
                      >
                        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(h => (
                          <TouchableOpacity
                            key={h}
                            style={[
                              styles.timeChip,
                              tempSelectedHour === h && [styles.timeChipSelected, { backgroundColor: themeColor }]
                            ]}
                            onPress={() => setTempSelectedHour(h)}
                          >
                            <Text style={[styles.timeChipText, tempSelectedHour === h && styles.timeChipTextSelected]}>
                              {h}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    <View style={[styles.timeSelectorBox, { marginTop: 12 }]}>
                      <Text style={styles.timeSelectorLabel}>Minutos</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.timeScrollRow}
                      >
                        {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map(m => (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.timeChip,
                              tempSelectedMinute === m && [styles.timeChipSelected, { backgroundColor: themeColor }]
                            ]}
                            onPress={() => setTempSelectedMinute(m)}
                          >
                            <Text style={[styles.timeChipText, tempSelectedMinute === m && styles.timeChipTextSelected]}>
                              {m}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>

                  {/* Horários Padrão */}
                  <Text style={styles.quickPresetsTitle}>Sugestões Rápidas</Text>
                  <View style={styles.quickTimeGrid}>
                    {HORARIOS_RAPIDOS.map(t => {
                      const isCur = `${tempSelectedHour}:${tempSelectedMinute}` === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.quickTimeBtn,
                            isCur && [styles.quickTimeBtnSelected, { borderColor: themeColor, backgroundColor: "#eff6ff" }]
                          ]}
                          onPress={() => {
                            const [h, m] = t.split(":");
                            setTempSelectedHour(h);
                            setTempSelectedMinute(m);
                          }}
                        >
                          <Text style={[styles.quickTimeBtnText, isCur && { color: themeColor, fontWeight: "700" }]}>
                            {t}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* RODAPÉ COM BOTÕES */}
              <View style={styles.footer}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: themeColor }]}
                  onPress={handleConfirm}
                >
                  <Check size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmBtnText}>
                    {mode === "date"
                      ? `Confirmar (${formatHeaderDate(tempSelectedDate) || "OK"})`
                      : `Confirmar (${tempSelectedHour}:${tempSelectedMinute})`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a"
  },
  closeBtn: {
    padding: 4
  },
  body: {
    padding: 14
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 4
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a"
  },
  navArrowBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9"
  },
  weekHeaderRow: {
    flexDirection: "row",
    marginBottom: 6
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4
  },
  weekHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b"
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 4
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: "#cbd5e1"
  },
  dayCellSelected: {
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3
  },
  dayText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b"
  },
  dayTextMuted: {
    color: "#cbd5e1",
    fontWeight: "400"
  },
  dayTextToday: {
    fontWeight: "700"
  },
  dayTextSelected: {
    color: "#ffffff",
    fontWeight: "700"
  },
  quickChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9"
  },
  quickChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center"
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569"
  },
  timeDisplayBox: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  timeSelectorBox: {
    gap: 6
  },
  timeSelectorLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase"
  },
  timeScrollRow: {
    gap: 6,
    paddingVertical: 2
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1"
  },
  timeChipSelected: {
    borderColor: "transparent"
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155"
  },
  timeChipTextSelected: {
    color: "#ffffff",
    fontWeight: "700"
  },
  quickPresetsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    marginTop: 12,
    marginBottom: 8,
    textTransform: "uppercase"
  },
  quickTimeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  quickTimeBtn: {
    width: "23%",
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center"
  },
  quickTimeBtnSelected: {},
  quickTimeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569"
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9"
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b"
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff"
  }
});
