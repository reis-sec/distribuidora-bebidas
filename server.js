require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const cookieSession = require('cookie-session');
const { rateLimit } = require('express-rate-limit');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'SESSION_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Variável obrigatória ausente: ${key}`);
}
if (process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET precisa ter pelo menos 32 caracteres.');
}

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const productCategories = [
  'Whiskeys',
  'Cervejas',
  'Refrigerantes',
  'Gelos Saborizados',
  'Energéticos Variados',
  'Águas',
  'Salgadinhos',
  'Doces',
  'Outros'
];
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'));
fs.mkdirSync(uploadDir, { recursive: true });

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

app.disable('x-powered-by');
app.set('trust proxy', 1);

const secureCookies = process.env.SESSION_COOKIE_SECURE === 'true';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", 'data:'],
      upgradeInsecureRequests: null
    }
  },
  strictTransportSecurity: secureCookies ? undefined : false
}));
app.use(cookieSession({
  name: 'bebidas_session',
  keys: [process.env.SESSION_SECRET],
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.SESSION_COOKIE_SECURE === 'true',
  maxAge: 7 * 24 * 60 * 60 * 1000
}));
app.use(express.json({ limit: '20kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }
});

const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${extensions[file.mimetype]}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!extensions[file.mimetype]) return callback(new Error('Envie uma imagem JPG, PNG ou WEBP.'));
    callback(null, true);
  }
});

function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Faça login para continuar.' });
  next();
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role !== 'admin') return res.status(403).json({ error: 'Acesso exclusivo do administrador.' });
  next();
}

function checkOrigin(req, res, next) {
  const origin = req.get('origin');
  const expected = process.env.WEB_ORIGIN;
  if (origin && expected && origin.replace(/\/$/, '') !== expected.replace(/\/$/, '')) {
    return res.status(403).json({ error: 'Origem da solicitação não autorizada.' });
  }
  next();
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function productInput(body) {
  const name = cleanText(body.name, 140);
  const category = cleanText(body.category, 80);
  const description = cleanText(body.description, 2000);
  const priceText = String(body.price ?? '').trim().replace(',', '.');
  const price = Number(priceText);
  const stockText = String(body.stock ?? '').trim();
  const stock = Number(stockText);
  const active = body.active === 'false' || body.active === false ? 0 : 1;
  if (!name) return { error: 'Informe o nome do produto.' };
  if (!productCategories.includes(category)) return { error: 'Selecione uma categoria válida.' };
  if (!/^\d+(\.\d{1,2})?$/.test(priceText) || !Number.isFinite(price) || price <= 0 || price > 99999999) {
    return { error: 'Informe um preço válido, maior que zero e com até duas casas decimais.' };
  }
  if (!/^\d+$/.test(stockText) || !Number.isSafeInteger(stock) || stock < 0 || stock > 1000000) {
    return { error: 'Informe um estoque inteiro entre 0 e 1.000.000.' };
  }
  return { values: { name, category, description: description || null, price, stock, active } };
}

function imagePathFromUrl(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) return null;
  const fileName = path.basename(imageUrl);
  return path.join(uploadDir, fileName);
}

async function removeImage(imageUrl) {
  const imagePath = imagePathFromUrl(imageUrl);
  if (!imagePath) return;
  try { await fs.promises.unlink(imagePath); } catch (error) {
    if (error.code !== 'ENOENT') console.error('Falha ao remover imagem antiga:', error.message);
  }
}

app.use('/uploads', express.static(uploadDir, { fallthrough: false, maxAge: '1d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

app.get('/api/me', (req, res) => res.json({ user: req.session?.user || null }));

app.post('/api/register', checkOrigin, authLimiter, async (req, res, next) => {
  try {
    const name = cleanText(req.body.name, 120);
    const email = cleanText(req.body.email, 190).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 72 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Informe nome, e-mail válido e senha entre 8 e 72 caracteres simples.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, \'customer\')',
      [name, email, passwordHash]
    );
    req.session = { user: { id: result.insertId, name, email, role: 'customer' } };
    res.status(201).json({ message: 'Cadastro realizado com sucesso.', user: req.session.user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    next(error);
  }
});

app.post('/api/login', checkOrigin, authLimiter, async (req, res, next) => {
  try {
    const email = cleanText(req.body.email, 190).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const [rows] = await db.execute(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ? AND active = TRUE LIMIT 1',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    req.session = { user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    res.json({ message: 'Login realizado.', user: req.session.user });
  } catch (error) { next(error); }
});

app.post('/api/logout', checkOrigin, requireAuth, (req, res) => {
  req.session = null;
  res.json({ message: 'Sessão encerrada.' });
});

app.get('/api/products', requireAuth, async (req, res, next) => {
  try {
    const admin = req.session.user.role === 'admin';
    const [rows] = await db.query(
      `SELECT id, name, category, description, price, stock, image_url AS imageUrl, active, created_at AS createdAt
       FROM products ${admin ? '' : 'WHERE active = TRUE'} ORDER BY category, name`
    );
    res.json({ products: rows });
  } catch (error) { next(error); }
});

app.post('/api/products', requireAuth, requireAdmin, imageUpload.single('image'), async (req, res, next) => {
  try {
    const input = productInput(req.body);
    if (input.error) {
      if (req.file) await removeImage(`/uploads/${req.file.filename}`);
      return res.status(400).json({ error: input.error });
    }
    const { name, category, description, price, stock, active } = input.values;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await db.execute(
      'INSERT INTO products (name, category, description, price, stock, image_url, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, category, description, price, stock, imageUrl, active]
    );
    res.status(201).json({ message: 'Produto cadastrado.', id: result.insertId });
  } catch (error) {
    if (req.file) await removeImage(`/uploads/${req.file.filename}`);
    next(error);
  }
});

app.put('/api/products/:id', requireAuth, requireAdmin, imageUpload.single('image'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      if (req.file) await removeImage(`/uploads/${req.file.filename}`);
      return res.status(400).json({ error: 'Identificador inválido.' });
    }
    const input = productInput(req.body);
    if (input.error) {
      if (req.file) await removeImage(`/uploads/${req.file.filename}`);
      return res.status(400).json({ error: input.error });
    }
    const [found] = await db.execute('SELECT image_url FROM products WHERE id = ? LIMIT 1', [id]);
    if (!found.length) {
      if (req.file) await removeImage(`/uploads/${req.file.filename}`);
      return res.status(404).json({ error: 'Bebida não encontrada.' });
    }
    const { name, category, description, price, stock, active } = input.values;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : found[0].image_url;
    await db.execute(
      'UPDATE products SET name = ?, category = ?, description = ?, price = ?, stock = ?, image_url = ?, active = ? WHERE id = ?',
      [name, category, description, price, stock, imageUrl, active, id]
    );
    if (req.file && found[0].image_url) await removeImage(found[0].image_url);
    res.json({ message: 'Produto atualizado.' });
  } catch (error) {
    if (req.file) await removeImage(`/uploads/${req.file.filename}`);
    next(error);
  }
});

app.delete('/api/products/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador inválido.' });
    const [found] = await db.execute('SELECT image_url FROM products WHERE id = ? LIMIT 1', [id]);
    if (!found.length) return res.status(404).json({ error: 'Bebida não encontrada.' });
    await db.execute('DELETE FROM products WHERE id = ?', [id]);
    await removeImage(found[0].image_url);
    res.json({ message: 'Produto removido.' });
  } catch (error) { next(error); }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, role, active, created_at AS createdAt FROM users ORDER BY created_at DESC LIMIT 200'
    );
    res.json({ users });
  } catch (error) { next(error); }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'A imagem deve ter no máximo 5 MB.' : 'Não foi possível processar a imagem.';
    return res.status(400).json({ error: message });
  }
  if (error.message === 'Envie uma imagem JPG, PNG ou WEBP.') return res.status(400).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: 'Ocorreu um erro no servidor. Tente novamente.' });
});

const server = app.listen(port, host, () => {
  console.log(`Aplicação disponível em http://${host}:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await db.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
