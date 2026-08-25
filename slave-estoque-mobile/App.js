import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text } from 'react-native';
import { initDB } from './src/db/database';
import { API_URL, syncPush, syncPull } from './src/services/api';

import HomeScreen from './src/screens/Home';
import QRScannerScreen from './src/screens/QRScanner';
import BarcodeScannerScreen from './src/screens/BarcodeScanner';
import CadastrarEquipamentoScreen from './src/screens/CadastrarEquipamento';
import EmprestimoScreen from './src/screens/EmprestimoScreen';
import CadastrarCategoriaScreen from './src/screens/CadastrarCategoria';
import CadastrarLocalScreen from './src/screens/CadastrarLocal';
import ReservarLocalScreen from './src/screens/ReservarLocal';
import CadastrarAvariaScreen from './src/screens/CadastrarAvaria';

const Stack = createNativeStackNavigator();

export default function App() {
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    try {
      initDB();
      setDbInitialized(true);
    } catch (e) {
      console.error('Erro ao inicializar DB:', e);
    }
    
    // Auto-Sync Background
    const interval = setInterval(async () => {
      if (API_URL) {
        try {
          await syncPush();
          await syncPull();
        } catch (err) {
          // Silent fail para não poluir
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (!dbInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Inicializando Banco de Dados Offline...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Painel Offline' }} />
        <Stack.Screen 
          name="QRScanner" 
          component={QRScannerScreen} 
          options={{ 
            title: 'Ler QR do Servidor',
            contentStyle: { backgroundColor: 'transparent' }
          }} 
        />
        <Stack.Screen 
          name="BarcodeScanner" 
          component={BarcodeScannerScreen} 
          options={{ 
            title: 'Escanear Equipamento',
            contentStyle: { backgroundColor: 'transparent' }
          }} 
        />
        <Stack.Screen name="CadastrarEquipamento" component={CadastrarEquipamentoScreen} options={{ title: 'Novo Material / Equipamento' }} />
        <Stack.Screen name="Emprestimo" component={EmprestimoScreen} options={{ title: 'Novo Empréstimo', headerStyle: { backgroundColor: '#4f46e5' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } }} />
        <Stack.Screen name="CadastrarCategoria" component={CadastrarCategoriaScreen} options={{ title: 'Categorias & Subtipos' }} />
        <Stack.Screen name="CadastrarLocal" component={CadastrarLocalScreen} options={{ title: 'Locais & Espaços' }} />
        <Stack.Screen name="ReservarLocal" component={ReservarLocalScreen} options={{ title: 'Reserva de Espaço' }} />
        <Stack.Screen name="CadastrarAvaria" component={CadastrarAvariaScreen} options={{ title: 'Avarias & Manutenções' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
