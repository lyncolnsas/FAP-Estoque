import * as Network from 'expo-network';

export const scanNetworkForServer = async (onProgress) => {
  try {
    const ip = await Network.getIpAddressAsync();
    if (!ip || ip === '0.0.0.0') {
      throw new Error('Não foi possível obter o IP do dispositivo.');
    }

    // Pega a subrede, ex: '192.168.1.'
    const subnet = ip.substring(0, ip.lastIndexOf('.') + 1);
    
    const MAX_IP = 254;
    const CONCURRENCY = 15; // Reduzido para evitar sobrecarga de rede no celular
    let foundServer = null;

    const testIp = async (targetIp) => {
      if (foundServer) return null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // Aumentado para 2000ms
        
        const response = await fetch(`http://${targetIp}:3333/sync/ping`, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.service === 'slave-estoque-server') {
             foundServer = { ip: targetIp, port: 3333 };
             return foundServer;
          }
        }
      } catch (err) {
        // Silencioso para não poluir
      }
      return null;
    };

    for (let i = 1; i <= MAX_IP; i += CONCURRENCY) {
      if (foundServer) break;
      
      const promises = [];
      for (let j = 0; j < CONCURRENCY && (i + j) <= MAX_IP; j++) {
        const targetIp = `${subnet}${i + j}`;
        promises.push(testIp(targetIp));
      }
      
      const results = await Promise.all(promises);
      const success = results.find(r => r !== null);
      if (success) {
        return success;
      }
    }

    throw new Error('Nenhum servidor ativo encontrado nesta rede WiFi.');
  } catch (error) {
    throw error;
  }
};
