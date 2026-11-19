require('dotenv').config();

const { createInterface } = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function askLine(prompt) {
  const rl = createInterface({ input, output });
  try { return await rl.question(prompt); }
  finally { rl.close(); }
}

async function askHidden(prompt) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') return askLine(prompt);
  output.write(prompt);
  input.setRawMode(true);
  input.resume();
  return new Promise((resolve) => {
    let value = '';
    const onData = (buffer) => {
      for (const character of buffer.toString()) {
        if (character === '\u0003') {
          input.setRawMode(false);
          input.removeListener('data', onData);
          output.write('\n');
          process.exit(130);
        }
        if (character === '\r' || character === '\n') {
          input.setRawMode(false);
          input.removeListener('data', onData);
          output.write('\n');
          resolve(value);
        } else if (character === '\u007f' || character === '\b') {
          if (value.length) {
            value = value.slice(0, -1);
            output.write('\b \b');
          }
        } else if (character >= ' ') {
          value += character;
          output.write('*');
        }
      }
    };
    input.on('data', onData);
  });
}

async function main() {
  let pool;
  try {
    const name = (await askLine('Nome do administrador: ')).trim();
    const email = (await askLine('E-mail do administrador: ')).trim().toLowerCase();
    const password = await askHidden('Senha (mínimo 10 caracteres): ');
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('Informe nome, e-mail válido e senha com 10 a 72 caracteres simples.');
    }

    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 2
    });
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, \'admin\')',
      [name, email, passwordHash]
    );
    console.log(`Administrador ${email} criado.`);
  } catch (error) {
    console.error(`Não foi possível criar o administrador: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}

main();
