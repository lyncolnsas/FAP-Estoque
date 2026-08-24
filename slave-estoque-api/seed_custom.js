const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const https = require('https');

const prisma = new PrismaClient();

const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 && res.headers.location) {
        https.get(res.headers.location, (resRedirect) => {
          const fileStream = fs.createWriteStream(filepath);
          resRedirect.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });
          fileStream.on('error', reject);
        }).on('error', reject);
      } else {
        const fileStream = fs.createWriteStream(filepath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        fileStream.on('error', reject);
      }
    }).on('error', reject);
  });
};

async function main() {
  const uploadDir = path.join(process.cwd(), 'src', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const categorias = await prisma.categoria.findMany({ include: { tipos: true } });
  
  if (categorias.length === 0) {
    console.log("Nenhuma categoria encontrada.");
    return;
  }

  let defectCount = 0;
  const targetDefects = 3;

  for (const cat of categorias) {
    let tipos = cat.tipos;
    
    if (tipos.length === 0) {
      const newTipo = await prisma.tipoEquipamento.create({
        data: {
          nome: 'Geral',
          categoriaId: cat.id
        }
      });
      tipos = [newTipo];
    }

    console.log(`Cadastrando 4 itens para a categoria: ${cat.nome}`);
    
    for (let i = 1; i <= 4; i++) {
      const tipo = tipos[(i - 1) % tipos.length];
      const isDefective = defectCount < targetDefects && Math.random() > 0.5 || (cat.nome === 'Sem Categoria' && defectCount < targetDefects);
      
      let condicao = 'DISPONIVEL';
      let comDefeito = false;
      
      if (isDefective || (defectCount < targetDefects && cat.id === categorias[categorias.length-1].id && i > 1)) {
        condicao = 'MANUTENCAO';
        comDefeito = true;
        defectCount++;
      }
      
      const codigo = `${cat.nome.substring(0, 3).toUpperCase()}-${tipo.nome.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const filename = `img-${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
      const filepath = path.join(uploadDir, filename);
      console.log(`Baixando imagem para ${codigo}...`);
      await downloadImage('https://picsum.photos/400/400', filepath);

      const novoItem = await prisma.equipamento.create({
        data: {
          codigoPatrimonio: codigo,
          nome: `${tipo.nome} - Modelo ${i}`,
          categoriaId: cat.id,
          tipoId: tipo.id,
          statusCondicao: condicao,
          recebeuComDefeito: comDefeito,
          permitirEmprestimo: !comDefeito,
          quantidadeUso: 0,
          fotoUrl: `/uploads/${filename}`
        }
      });
      
      console.log(`  Criado: ${codigo} - ${novoItem.nome} (Defeito: ${comDefeito})`);
    }
  }

  while (defectCount < targetDefects) {
    const cat = categorias[0];
    const tipo = cat.tipos[0];
    const codigo = `DEF-${Math.floor(1000 + Math.random() * 9000)}`;
    const filename = `img-${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
    const filepath = path.join(uploadDir, filename);
    await downloadImage('https://picsum.photos/400/400', filepath);

    const novoItem = await prisma.equipamento.create({
      data: {
        codigoPatrimonio: codigo,
        nome: `Item com Defeito Extra`,
        categoriaId: cat.id,
        tipoId: tipo.id,
        statusCondicao: 'MANUTENCAO',
        recebeuComDefeito: true,
        permitirEmprestimo: false,
        quantidadeUso: 0,
        fotoUrl: `/uploads/${filename}`
      }
    });
    console.log(`  Criado Defeito Extra: ${codigo}`);
    defectCount++;
  }

  console.log("Processo concluído!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
