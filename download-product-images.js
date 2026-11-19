const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public', 'products', 'individual');
const sourcesFile = path.join(__dirname, 'product-image-sources.json');

function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 58);
}
function extFromType(contentType) {
  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') return '.jpg';
  if (type === 'image/png') return '.png';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/avif') return '.avif';
  return null;
}
async function download(record, index) {
  const base = String(index + 1).padStart(3, '0') + '-' + slug(record.name || 'produto');
  const existing = (await fs.readdir(publicDir)).find(filename => filename.startsWith(base + '.'));
  if (existing) {
    record.localPath = '/products/individual/' + existing;
    return { ok: true, name: record.name, localPath: record.localPath, cached: true };
  }
  if (record.local) {
    const extension = path.extname(record.local);
    const sourcePath = path.join(root, 'public', record.local.replace(/^\/products\//, 'products/'));
    const filename = base + extension;
    await fs.copyFile(sourcePath, path.join(publicDir, filename));
    record.localPath = '/products/individual/' + filename;
    return { ok: true, name: record.name, localPath: record.localPath, local: true };
  }
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(record.url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
          'accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const contentType = response.headers.get('content-type') || '';
      const extension = extFromType(contentType);
      if (!extension) throw new Error('Tipo de imagem não aceito: ' + contentType);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 2048) throw new Error('Arquivo pequeno demais (' + bytes.length + ' bytes)');
      const filename = base + extension;
      await fs.writeFile(path.join(publicDir, filename), bytes);
      record.localPath = '/products/individual/' + filename;
      record.contentType = contentType;
      record.bytes = bytes.length;
      return { ok: true, name: record.name, localPath: record.localPath, bytes: bytes.length };
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
  return { ok: false, name: record.name, url: record.url, error: String(lastError?.message || lastError) };
}
async function main() {
  await fs.mkdir(publicDir, { recursive: true });
  const manifest = JSON.parse(await fs.readFile(sourcesFile, 'utf8'));
  const results = new Array(manifest.records.length);
  let next = 0;
  const workers = Array.from({ length: 8 }, async () => {
    while (true) {
      const index = next++;
      if (index >= manifest.records.length) return;
      results[index] = await download(manifest.records[index], index);
      console.log((index + 1) + '/' + manifest.records.length + ' ' +
        (results[index].ok ? 'OK ' : 'ERRO ') + results[index].name +
        (results[index].error ? ' — ' + results[index].error : ''));
    }
  });
  await Promise.all(workers);
  await fs.writeFile(sourcesFile, JSON.stringify(manifest, null, 2) + '\n');
  const succeeded = results.filter(result => result.ok).length;
  const failed = results.filter(result => !result.ok);
  const imageMap = manifest.records.filter(record => record.localPath).map(({ category, name, localPath, oldName, url, page, title }) =>
    ({ category, name, oldName: oldName || null, localPath, url, page, title }));
  await fs.writeFile(path.join(__dirname, 'product-images.json'), JSON.stringify(imageMap, null, 2) + '\n');
  await fs.writeFile(path.join(__dirname, 'product-image-download-errors.json'), JSON.stringify(failed, null, 2) + '\n');
  console.log('Resultado: ' + succeeded + '/' + results.length + ' fotos baixadas; erros: ' + failed.length);
  if (failed.length) process.exitCode = 2;
}
main().catch(error => { console.error(error); process.exitCode = 1; });

