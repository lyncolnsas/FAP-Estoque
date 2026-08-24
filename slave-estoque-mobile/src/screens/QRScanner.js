import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { InteractionManager } from 'react-native';
import { parseQrCode, handshake, setApiUrl } from '../services/api';

const { width } = Dimensions.get('window');
const qrSize = width * 0.7;

export default function QRScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const isFocused = useIsFocused();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [connectingManual, setConnectingManual] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        setIsCameraReady(true);
      });

      return () => {
        task.cancel();
        setIsCameraReady(false);
      };
    }, [])
  );

  useEffect(() => {
    (async () => {
      if (permission && !permission.granted && permission.canAskAgain) {
        await requestPermission();
      }
    })();
  }, [permission]);

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Carregando câmera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Acesso à Câmera</Text>
          <Text style={styles.permissionText}>
            Precisamos de permissão para utilizar a câmera do celular para escanear o QR Code de sincronismo do servidor.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Permitir Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.btnTextOnly]} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonTextCancel}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ type, data }) => {
    setScanned(true);
    const result = parseQrCode(data);
    if (result && result.ips && result.port) {
      let connectedIp = null;
      try {
        const testIp = async (ip) => {
          const isConnected = await handshake(ip, result.port);
          if (isConnected) return ip;
          throw new Error('Not connected');
        };
        // Test all IPs in parallel. The first one to succeed resolves the promise.
        connectedIp = await Promise.any(result.ips.map(testIp));
      } catch (error) {
        connectedIp = null;
      }

      if (connectedIp) {
        setApiUrl(connectedIp, result.port);
        alert('Servidor configurado e conectado com sucesso!');
        navigation.goBack();
      } else {
        alert(`Falha de conexão.\nTestamos: ${result.ips.join(', ')}.\n\nVerifique se o celular está no mesmo Wi-Fi que o PC e se não está no 4G. Verifique também o Firewall do Windows!`);
        setTimeout(() => setScanned(false), 4000);
      }
    } else {
      alert('QR Code inválido ou chave secreta incorreta.');
      setTimeout(() => setScanned(false), 2000);
    }
  };

  const handleManualConnect = async () => {
    if (!manualIp) {
      alert('Digite um IP válido.');
      return;
    }
    setConnectingManual(true);
    try {
      const isConnected = await handshake(manualIp.trim(), 3333);
      if (isConnected) {
        setApiUrl(manualIp.trim(), 3333);
        alert('Servidor configurado e conectado com sucesso!');
        navigation.goBack();
      } else {
        alert('Falha ao conectar no IP informado. Verifique se o IP está correto, se o PC e celular estão na mesma rede, e verifique o Firewall.');
      }
    } catch (error) {
      alert('Erro ao tentar conectar.');
    } finally {
      setConnectingManual(false);
    }
  };

  if (showManual) {
    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.manualScroll}>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Conexão Manual</Text>
            <Text style={styles.permissionText}>
              Se o QR Code falhou, digite o IP IPv4 do computador onde o painel está rodando (ex: 192.168.1.10).
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Ex: 192.168.1.10"
              placeholderTextColor="#94a3b8"
              value={manualIp}
              onChangeText={setManualIp}
              keyboardType="decimal-pad"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity 
              style={[styles.button, connectingManual && { opacity: 0.7 }]} 
              onPress={handleManualConnect}
              disabled={connectingManual}
            >
              {connectingManual ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Conectar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.btnTextOnly]} 
              onPress={() => setShowManual(false)}
              disabled={connectingManual}
            >
              <Text style={styles.buttonTextCancel}>Voltar para o QR Code</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />
      
      {/* Scanner Overlay */}
      <View style={styles.overlayContainer}>
        <View style={styles.unfocusedContainer} />
        <View style={styles.middleContainer}>
          <View style={styles.unfocusedContainer} />
          <View style={styles.focusedContainer}>
            {/* Corner Borders */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            
            {scanned && (
              <View style={styles.scanningOverlay}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.scanningText}>Conectando...</Text>
              </View>
            )}
          </View>
          <View style={styles.unfocusedContainer} />
        </View>
        <View style={styles.unfocusedContainer}>
          <Text style={styles.helperText}>Aponte a câmera para o QR Code no seu computador</Text>
        </View>
      </View>

      {scanned && (
        <TouchableOpacity style={styles.resetButton} onPress={() => setScanned(false)}>
          <Text style={styles.resetButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      )}

      {!scanned && (
        <TouchableOpacity style={styles.manualButton} onPress={() => setShowManual(true)}>
          <Text style={styles.manualButtonText}>Digitar IP Manualmente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'transparent' 
  },
  loadingText: { 
    marginTop: 12, 
    color: '#94a3b8', 
    fontSize: 16 
  },
  permissionCard: {
    margin: 24,
    padding: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    width: '100%',
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnTextOnly: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextCancel: {
    color: '#94a3b8',
    fontSize: 16,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  unfocusedContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  middleContainer: {
    height: qrSize,
    flexDirection: 'row',
  },
  focusedContainer: {
    width: qrSize,
    height: qrSize,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#4f46e5',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  helperText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 16,
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
  resetButton: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualButton: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
    textAlign: 'center',
  },
});
