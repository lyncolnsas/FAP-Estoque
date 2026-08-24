import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadRoutes = Router();

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

uploadRoutes.post('/', upload.single('file'), (req, res) => {
  console.log('[UPLOAD] req.body:', req.body);
  console.log('[UPLOAD] req.file:', req.file);
  if (!req.file) {
    console.error('[UPLOAD] ERRO: Nenhum arquivo enviado. File is missing na requisição!');
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }
  
  // O arquivo estará acessível via path relativo /uploads/nome-do-arquivo.ext
  const url = `/uploads/${req.file.filename}`;
  console.log('[UPLOAD] SUCESSO. URL gerada:', url);
  res.json({ url });
});

export default uploadRoutes;
