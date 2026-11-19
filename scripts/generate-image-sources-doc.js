const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const photos = JSON.parse(fs.readFileSync(path.join(__dirname, 'product-images.json'), 'utf8'));
const tick = String.fromCharCode(96);
const escapeCell = (value) => String(value || '').replace(/\|/g, '\\|');
const lines = [
  '# Fontes das fotos do catálogo',
  '',
  'Cada produto usa um arquivo de imagem próprio em public/products/individual/. O navegador recebe as fotos do servidor local; o catálogo não busca imagens na internet em tempo de uso.',
  '',
  'As imagens foram obtidas em páginas públicas de produtos e lojas. A indicação da fonte serve para conferência; ela não concede licença de uso comercial. Para publicação comercial, substitua as imagens por fotos próprias ou autorizadas.',
  '',
  '| Categoria | Produto | Arquivo local | Fonte |',
  '| --- | --- | --- | --- |'
];
for (const photo of photos) {
  const source = photo.page === 'Arquivo fornecido pelo usuário'
    ? 'Imagem fornecida pelo usuário'
    : '[Página de origem](' + photo.page + ')';
  lines.push('| ' + escapeCell(photo.category) + ' | ' + escapeCell(photo.name) + ' | ' + tick + photo.localPath + tick + ' | ' + source + ' |');
}
fs.writeFileSync(path.join(root, 'FONTES-IMAGENS.md'), lines.join('\n') + '\n');

