import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Calendar as CalendarIcon, Clock, X } from "lucide-react-native";
import DateTimePickerModal from "./DateTimePickerModal";

export default function SplitDateTimeField({
  label,
  icon: Icon,
  value = "",
  onChange,
  required = false,
  themeColor = "#2563eb",
  bgColor = "#ffffff",
  borderColor = "#e2e8f0",
  textColor = "#1e293b",
  allowClear = true
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (value && value.includes("T")) {
      const parts = value.split("T");
      setDate(parts[0]);
      setTime(parts[1].substring(0, 5));
    } else if (value && value.length === 10) {
      setDate(value);
      setTime("08:00");
    } else {
      setDate("");
      setTime("");
    }
  }, [value]);

  const handleDateConfirm = (newDate) => {
    setDate(newDate);
    const targetTime = time || "08:00";
    setTime(targetTime);
    if (newDate) {
      onChange(`${newDate}T${targetTime}`);
    } else {
      onChange("");
    }
  };

  const handleTimeConfirm = (newTime) => {
    setTime(newTime);
    let targetDate = date;
    if (!targetDate) {
      const today = new Date().toISOString().split("T")[0];
      targetDate = today;
      setDate(today);
    }
    onChange(`${targetDate}T${newTime}`);
  };

  const handleClear = () => {
    setDate("");
    setTime("");
    onChange("");
  };

  const formatDateDisplay = (isoDate) => {
    if (!isoDate || isoDate.length < 10) return "Toque p/ selecionar";
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <View style={[styles.card, { backgroundColor: bgColor, borderColor: borderColor }]}>
      {/* CABEÇALHO DO CAMPO COM ÍCONE E RÓTULO */}
      <View style={styles.headerRow}>
        <View style={styles.labelContainer}>
          {Icon && <Icon size={18} color={themeColor} style={{ marginRight: 6 }} />}
          <Text style={[styles.label, { color: textColor }]}>
            {label} {required && <Text style={{ color: "#ef4444" }}>*</Text>}
          </Text>
        </View>

        {allowClear && !required && (date || time) ? (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <X size={15} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* LINHA COM DOIS BOTÕES DE SELEÇÃO: DATA E HORÁRIO */}
      <View style={styles.inputsRow}>
        {/* BOTÃO DA DATA */}
        <View style={styles.inputColDate}>
          <Text style={[styles.subLabel, { color: textColor }]}>Data</Text>
          <TouchableOpacity
            style={[
              styles.pickerBtn,
              date ? styles.pickerBtnFilled : styles.pickerBtnEmpty
            ]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <CalendarIcon size={16} color={date ? themeColor : "#94a3b8"} style={{ marginRight: 6 }} />
            <Text
              style={[
                styles.pickerBtnText,
                date ? { color: "#0f172a", fontWeight: "700" } : { color: "#94a3b8" }
              ]}
              numberOfLines={1}
            >
              {formatDateDisplay(date)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* BOTÃO DO HORÁRIO */}
        <View style={styles.inputColTime}>
          <Text style={[styles.subLabel, { color: textColor }]}>Horário</Text>
          <TouchableOpacity
            style={[
              styles.pickerBtn,
              time ? styles.pickerBtnFilled : styles.pickerBtnEmpty
            ]}
            onPress={() => setShowTimePicker(true)}
            activeOpacity={0.7}
          >
            <Clock size={16} color={time ? themeColor : "#94a3b8"} style={{ marginRight: 6 }} />
            <Text
              style={[
                styles.pickerBtnText,
                time ? { color: "#0f172a", fontWeight: "700" } : { color: "#94a3b8" }
              ]}
              numberOfLines={1}
            >
              {time || "--:--"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL DE CALENDÁRIO */}
      <DateTimePickerModal
        visible={showDatePicker}
        mode="date"
        title={`Data: ${label}`}
        value={date}
        themeColor={themeColor}
        onConfirm={handleDateConfirm}
        onClose={() => setShowDatePicker(false)}
      />

      {/* MODAL DE HORÁRIO */}
      <DateTimePickerModal
        visible={showTimePicker}
        mode="time"
        title={`Horário: ${label}`}
        value={time}
        themeColor={themeColor}
        onConfirm={handleTimeConfirm}
        onClose={() => setShowTimePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  label: {
    fontSize: 14,
    fontWeight: "700"
  },
  clearBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  inputsRow: {
    flexDirection: "row",
    gap: 10
  },
  inputColDate: {
    flex: 1.4
  },
  inputColTime: {
    flex: 1
  },
  subLabel: {
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.8,
    marginBottom: 4,
    textTransform: "uppercase"
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  pickerBtnFilled: {
    borderColor: "#cbd5e1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  pickerBtnEmpty: {
    borderStyle: "dashed"
  },
  pickerBtnText: {
    fontSize: 13,
    fontWeight: "600"
  }
});
