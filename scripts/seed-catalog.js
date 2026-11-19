require('dotenv').config();

const mysql = require('mysql2/promise');
const productImages = require('./product-images.json');
const productImageByKey = new Map(productImages.map((photo) => [
  `${photo.category}::${photo.name}`,
  photo.localPath
]));

// Fotos genéricas de referência armazenadas localmente em public/products.
// Elas ilustram a categoria e podem não corresponder à marca/embalagem exata.
const photos = {
  whisky: '/products/catalog-whisky.jpg',
  beer: '/products/catalog-cerveja.jpg',
  soda: '/products/catalog-refrigerante.webp',
  ice: '/products/catalog-gelo.jpg',
  energy: '/products/catalog-energetico.png',
  water: '/products/catalog-agua-prata.png',
  snack: '/products/catalog-salgadinho.jpg',
  candy: '/products/catalog-doces.jpg'
};

const categories = [
  {
    name: 'Whiskeys', photo: photos.whisky, legacyPhoto: '/products/catalog-whisky.svg',
    remotePhoto: 'https://images.tcdn.com.br/img/img_prod/1270470/id343_verus_single_malt_whisky_43_variacao_77_2_90906e99f5da87626bd03659d374f1af.jpg',
    items: [
      ['Black & White Whisky 1 L', 'Whisky blended escocês, indicado para servir puro, com gelo ou em drinks.', 89.90, 12],
      ['Johnnie Walker Red Label 1 L', 'Whisky escocês de perfil marcante, indicado para drinks e para servir com gelo.', 119.90, 10],
      ['Johnnie Walker Black Label 12 anos 1 L', 'Whisky escocês envelhecido por 12 anos, com notas de frutas e madeira.', 219.90, 6],
      ["Ballantine's Finest 1 L", 'Blended Scotch Whisky de sabor equilibrado, para servir puro ou em coquetéis.', 109.90, 9],
      ['Chivas Regal 12 anos 1 L', 'Whisky escocês com perfil macio e notas adocicadas e frutadas.', 229.90, 5],
      ['Old Parr 12 anos 1 L', 'Whisky escocês de 12 anos, tradicional em encontros e celebrações.', 219.90, 5],
      ["Buchanan's Deluxe 12 anos 750 ml", 'Whisky blended de 12 anos, com notas suaves e final levemente adocicado.', 199.90, 4],
      ["Jack Daniel's Old No. 7 1 L", 'Whiskey do Tennessee com notas de caramelo, baunilha e madeira.', 189.90, 7],
      ['Jim Beam White 1 L', 'Bourbon americano com sabor de baunilha e carvalho, adequado para drinks.', 139.90, 6],
      ['Passport Scotch 1 L', 'Whisky escocês blended de perfil leve para servir em diferentes ocasiões.', 69.90, 14],
      ["Teacher's Highland Cream 1 L", 'Whisky escocês encorpado, com notas de malte e turfa.', 89.90, 10],
      ['White Horse 1 L', 'Whisky escocês blended de perfil defumado e sabor intenso.', 79.90, 11],
      ['Natu Nobilis 1 L', 'Whisky nacional blended, opção clássica para servir com gelo.', 39.90, 15],
      ['Evan Williams Black Label 1 L', 'Bourbon do Kentucky com notas de caramelo, baunilha e carvalho.', 149.90, 5],
      ['Lamas Verus Single Malt 720 ml', 'Single malt brasileiro de Minas Gerais, com maturação em dois tipos de madeira.', 399.90, 3]
    ]
  },
  {
    name: 'Cervejas', photo: photos.beer, legacyPhoto: '/products/catalog-cerveja.svg',
    remotePhoto: 'https://midia.agoranordeste.com.br/uploads/imagens/imagens_diversas/ambev-skol-brahma-antarctica.jpg',
    items: [
      ['Kilsen Pilsen lata 350 ml', 'Cerveja pilsen clara e leve, pronta para servir bem gelada.', 5.50, 48],
      ['Brahma Chopp lata 350 ml', 'Pilsen brasileira de sabor leve e refrescante.', 4.99, 48],
      ['Skol Pilsen lata 350 ml', 'Cerveja pilsen clara, de perfil leve e fácil de beber.', 4.99, 48],
      ['Antarctica Original garrafa 600 ml', 'Cerveja pilsen tradicional em garrafa retornável de 600 ml.', 10.99, 24],
      ['Itaipava Pilsen lata 350 ml', 'Cerveja pilsen brasileira, indicada para servir gelada.', 4.49, 36],
      ['Amstel Lager lata 350 ml', 'Lager puro malte de sabor equilibrado.', 5.49, 30],
      ['Heineken long neck 330 ml', 'Lager puro malte em garrafa individual de 330 ml.', 8.99, 24],
      ['Budweiser long neck 330 ml', 'American lager leve em garrafa long neck.', 7.99, 24],
      ['Spaten München lata 350 ml', 'Lager puro malte de inspiração alemã.', 6.49, 24],
      ['Bohemia Puro Malte lata 350 ml', 'Puro malte brasileiro com sabor equilibrado.', 5.49, 24],
      ['Eisenbahn Pilsen lata 350 ml', 'Pilsen puro malte de coloração dourada e amargor moderado.', 6.49, 18],
      ['Stella Artois long neck 330 ml', 'Lager premium em garrafa individual de 330 ml.', 8.99, 18],
      ['Brahma Duplo Malte lata 350 ml', 'Cerveja com combinação de maltes e sabor encorpado.', 5.49, 30],
      ['Petra Origem lata 350 ml', 'Pilsen puro malte, leve e refrescante.', 4.99, 24],
      ['Colorado Appia garrafa 600 ml', 'Cerveja de trigo com toque de mel de laranjeira.', 17.90, 8]
    ]
  },
  {
    name: 'Refrigerantes', photo: photos.soda, legacyPhoto: '/products/catalog-refrigerante.svg',
    remotePhoto: 'https://dcdn-us.mitiendanube.com/stores/005/194/756/products/img_3119-cf47fa1bcd1fbbbfb217283971449409-640-0.webp',
    items: [
      ['Coca-Cola Original 2 L', 'Refrigerante Coca-Cola sabor original em garrafa de 2 litros para compartilhar.', 10.99, 24],
      ['Coca-Cola Original lata 350 ml', 'Refrigerante de cola em lata individual de 350 ml.', 5.49, 36],
      ['Coca-Cola Sem Açúcar 2 L', 'Refrigerante de cola sem açúcar em embalagem de 2 litros.', 11.49, 18],
      ['Guaraná Antarctica 2 L', 'Refrigerante brasileiro de guaraná, ideal para compartilhar.', 9.99, 24],
      ['Guaraná Antarctica Zero 2 L', 'Refrigerante de guaraná sem açúcar em embalagem de 2 litros.', 10.49, 12],
      ['Pepsi Cola 2 L', 'Refrigerante de cola em garrafa de 2 litros.', 9.49, 18],
      ['Pepsi Black 2 L', 'Refrigerante de cola sem açúcar em embalagem de 2 litros.', 9.99, 12],
      ['Fanta Laranja 2 L', 'Refrigerante sabor laranja em garrafa para compartilhar.', 9.99, 18],
      ['Fanta Uva 2 L', 'Refrigerante sabor uva em embalagem de 2 litros.', 9.99, 15],
      ['Sprite Original 2 L', 'Refrigerante de limão em garrafa de 2 litros.', 9.99, 18],
      ['Sukita Laranja 2 L', 'Refrigerante de laranja em embalagem familiar.', 8.99, 12],
      ['Itubaína Original 2 L', 'Refrigerante brasileiro de tutti-frutti em garrafa de 2 litros.', 8.99, 10],
      ['Dolly Guaraná 2 L', 'Refrigerante de guaraná em embalagem econômica.', 6.99, 18],
      ['Mineirinho 2 L', 'Refrigerante mineiro de mate e guaraná em garrafa de 2 litros.', 8.99, 10],
      ['H2OH! Limão 500 ml', 'Bebida gaseificada sabor limão em garrafa individual.', 4.99, 20]
    ]
  },
  {
    name: 'Gelos Saborizados', photo: photos.ice, legacyPhoto: '/products/catalog-gelo.svg',
    remotePhoto: 'https://courier-images-prod.imgix.net/produc_variant/00023557_c0bfa8c7-5678-4210-af47-e91f54195206.jpg?auto=compress%2Cformat&fit=max',
    items: [
      ['Gelo saborizado de limão', 'Cubos de gelo com toque cítrico para refrescar água, sucos e drinks.', 8.50, 20],
      ['Gelo Ice Drinks de maracujá 1 kg', 'Cubos de gelo sabor maracujá em pacote de 1 kg.', 16.90, 12],
      ['Gelo saborizado de morango 1 kg', 'Cubos aromatizados de morango para bebidas e coquetéis.', 14.90, 10],
      ['Gelo saborizado de frutas vermelhas 1 kg', 'Mistura de frutas vermelhas em cubos para servir gelada.', 15.90, 10],
      ['Gelo saborizado de abacaxi 1 kg', 'Cubos com sabor tropical de abacaxi para bebidas.', 14.90, 10],
      ['Gelo saborizado de uva 1 kg', 'Gelo aromatizado de uva para sucos, refrigerantes e drinks.', 14.90, 8],
      ['Gelo saborizado Artic Ice manga 190 g', 'Gelo saborizado de manga Artic Ice em pacote de 190 g.', 6.90, 8],
      ['Gelo saborizado de maçã verde 1 kg', 'Gelo com perfil frutado e cítrico de maçã verde.', 15.90, 8],
      ['Gelo saborizado de melancia 1 kg', 'Cubos aromatizados de melancia para servir em bebidas geladas.', 14.90, 10],
      ['Gelo saborizado de laranja 1 kg', 'Gelo cítrico de laranja para refrigerantes e coquetéis.', 13.90, 10],
      ['Gelo saborizado de hortelã 1 kg', 'Cubos refrescantes com toque de hortelã para drinks.', 14.90, 8],
      ['Gelo saborizado de coco 1 kg', 'Gelo aromatizado de coco para bebidas tropicais.', 15.90, 8],
      ['Gelo saborizado de limão siciliano 1 kg', 'Cubos cítricos com perfil de limão siciliano.', 16.90, 8],
      ['Gelo saborizado de frutas tropicais 1 kg', 'Mix de sabores tropicais em cubos prontos para servir.', 15.90, 10],
      ['Gelo saborizado de açaí 1 kg', 'Cubos com sabor de açaí para bebidas e combinações geladas.', 16.90, 6]
    ]
  },
  {
    name: 'Energéticos Variados', photo: photos.energy, legacyPhoto: '/products/catalog-energetico.svg',
    remotePhoto: 'https://phygital-files.mercafacil.com/catalogo/uploads/produto/energ_tico_fusion_473ml_drink_5b97d398-a089-48f5-aadd-37672079a87a.png',
    items: [
      ['Energético OuMais sabor tropical 269 ml', 'Bebida energética OuMais com sabor tropical, em lata de 269 ml.', 8.90, 30],
      ['Red Bull Energy Drink 250 ml', 'Energético tradicional em lata individual de 250 ml.', 10.99, 24],
      ['Red Bull Sugarfree 250 ml', 'Versão sem açúcar do energético Red Bull em lata de 250 ml.', 10.99, 18],
      ['Red Bull Tropical 250 ml', 'Energético com sabor tropical em lata individual.', 11.49, 12],
      ['Monster Energy Original 473 ml', 'Energético original em lata de 473 ml.', 10.99, 18],
      ['Monster Mango Loco 473 ml', 'Energético sabor manga e frutas tropicais em lata grande.', 11.49, 12],
      ['Monster Ultra 473 ml', 'Energético sem açúcar em lata de 473 ml.', 10.99, 12],
      ['TNT Energy Drink Original 473 ml', 'Energético tradicional com taurina e cafeína.', 8.49, 18],
      ['TNT Energy Drink Zero Açaí 473 ml', 'Energético TNT zero açúcar com açaí e guaraná em lata de 473 ml.', 8.99, 12],
      ['Fusion Energy Drink Original 473 ml', 'Energético Fusion original em lata de 473 ml.', 7.99, 24],
      ['Fusion Energy Drink Tropical 473 ml', 'Energético Fusion com perfil tropical.', 7.99, 12],
      ['Baly Energy Drink Melancia 2 L', 'Energético sabor melancia em embalagem de 2 litros para compartilhar.', 12.99, 10],
      ['Baly Energy Drink Tradicional 2 L', 'Energético tradicional em garrafa de 2 litros.', 11.99, 10],
      ['Flying Horse Original 473 ml', 'Energético clássico em lata de 473 ml.', 8.49, 12],
      ['Vibe Energy Drink 2 L', 'Bebida energética em embalagem de 2 litros.', 10.99, 8]
    ]
  },
  {
    name: 'Águas', photo: photos.water, legacyPhoto: '/products/catalog-agua-prata.png',
    items: [
      ['Água mineral Prata', 'Água mineral natural em garrafa de vidro, ideal para acompanhar refeições.', 3.50, 36],
      ['Água Prata sem gás 510 ml', 'Água mineral natural sem gás em garrafa individual de 510 ml.', 3.49, 36],
      ['Água Prata com gás 510 ml', 'Água mineral gaseificada em garrafa individual de 510 ml.', 3.99, 24],
      ['Água Prata sem gás 1,5 L', 'Água mineral natural sem gás em garrafa de 1,5 litro.', 5.49, 18],
      ['Água Crystal sem gás 500 ml', 'Água mineral natural sem gás em garrafa de 500 ml.', 2.99, 36],
      ['Água Crystal com gás 500 ml', 'Água mineral com gás em garrafa individual de 500 ml.', 3.49, 24],
      ['Água Crystal sem gás 1,5 L', 'Água mineral natural em embalagem de 1,5 litro.', 4.99, 18],
      ['Água Minalba sem gás 510 ml', 'Água mineral natural em garrafa individual de 510 ml.', 3.29, 24],
      ['Água Indaiá sem gás 500 ml', 'Água mineral natural em garrafa prática de 500 ml.', 2.99, 24],
      ['Água Bonafont sem gás 1,5 L', 'Água mineral natural em garrafa de 1,5 litro.', 5.49, 15],
      ['Água São Lourenço com gás 300 ml', 'Água mineral naturalmente gaseificada em garrafa de 300 ml.', 5.99, 12],
      ['Água Lindoya Verão sem gás 510 ml', 'Água mineral natural em garrafa de 510 ml.', 2.99, 24],
      ['Água Serra Negra sem gás 510 ml', 'Água mineral natural em embalagem individual de 510 ml.', 2.99, 24],
      ['Água Petrópolis sem gás 1,5 L', 'Água mineral natural sem gás em garrafa de 1,5 litro.', 5.49, 12],
      ['Água mineral em galão 5 L', 'Água mineral natural em embalagem de 5 litros para consumo doméstico.', 12.90, 10]
    ]
  },
  {
    name: 'Salgadinhos', photo: photos.snack, legacyPhoto: '/products/catalog-salgadinho.svg',
    remotePhoto: 'https://down-br.img.susercontent.com/file/br-11134207-7qukw-lk1880zmf3iic1',
    items: [
      ['Salgadinho de milho sabor queijo', 'Salgadinho crocante de milho com sabor de queijo para dividir ou levar.', 7.50, 18],
      ['Fandangos Presunto 35 g', 'Salgadinho assado de milho sabor presunto em pacote individual.', 3.99, 20],
      ['Fandangos Queijo 35 g', 'Salgadinho assado de milho sabor queijo em pacote individual.', 3.99, 20],
      ['Cheetos Requeijão 45 g', 'Salgadinho de milho sabor requeijão em embalagem individual.', 4.49, 18],
      ['Cheetos Bola Queijo 45 g', 'Salgadinho Cheetos crocante em formato de bolinhas com sabor de queijo.', 4.49, 18],
      ['Ruffles Original 45 g', 'Batata ondulada sabor original em pacote individual.', 5.49, 18],
      ['Ruffles Churrasco 45 g', 'Batata ondulada com sabor churrasco em pacote individual.', 5.49, 15],
      ['Doritos Queijo Nacho 48 g', 'Tortilha crocante sabor queijo nacho em pacote individual.', 5.49, 18],
      ['Torcida Pimenta Mexicana 45 g', 'Salgadinho de trigo com sabor de pimenta mexicana.', 3.49, 18],
      ['Torcida Churrasco 45 g', 'Salgadinho de trigo sabor churrasco em embalagem individual.', 3.49, 18],
      ["Pingo d'Ouro Bacon 76 g", 'Salgadinho Pingo d’Ouro sabor bacon em pacote de 76 g.', 3.99, 16],
      ['Baconzitos 55 g', 'Salgadinho de milho sabor bacon em embalagem individual.', 3.99, 16],
      ['Fofura Queijo 60 g', 'Salgadinho de milho sabor queijo em pacote para lanche.', 3.49, 16],
      ['Stiksy tradicional 48 g', 'Palitos salgados crocantes para acompanhar bebidas e lanches.', 3.99, 14],
      ['Pringles Original 104 g', 'Batata crocante sabor original em tubo de 104 g.', 13.90, 10]
    ]
  },
  {
    name: 'Doces', photo: photos.candy, legacyPhoto: '/products/catalog-doces.svg',
    remotePhoto: 'https://www.supermercadonacional.com.br/upload/service/bala-gelat-fini-250g-pc-dentaduras-1.jpg',
    items: [
      ['Bala Icekiss sortida 100 g', 'Bala Icekiss com sabores variados em pacote de 100 g.', 5.00, 22],
      ['Paçoca rolha 20 g', 'Doce tradicional de amendoim em porção individual.', 1.50, 40],
      ['Dadinho tradicional 90 g', 'Doce de amendoim em cubinhos, clássico para compartilhar.', 6.99, 18],
      ['Bala 7Belo framboesa 100 g', 'Bala mastigável sabor framboesa em pacote de 100 g.', 4.99, 18],
      ['Sonho de Valsa unidade', 'Bombom de wafer, castanha e chocolate ao leite.', 2.49, 30],
      ['Ouro Branco unidade', 'Bombom crocante de wafer com recheio e cobertura sabor chocolate branco.', 2.49, 30],
      ['Serenata de Amor unidade', 'Bombom com wafer, recheio cremoso e cobertura de chocolate.', 2.49, 30],
      ['Bis ao leite 100,8 g', 'Wafer crocante coberto com chocolate ao leite em caixa.', 7.99, 18],
      ['KitKat ao leite 41,5 g', 'Wafer crocante coberto com chocolate ao leite.', 4.99, 18],
      ['Prestígio 33 g', 'Chocolate com recheio sabor coco em barra individual.', 3.49, 18],
      ['Chokito 32 g', 'Chocolate ao leite com flocos crocantes e recheio caramelizado.', 3.49, 18],
      ['Fini Dentaduras 90 g', 'Bala de gelatina sabor morango e framboesa em pacote de 90 g.', 7.99, 14],
      ['Fini Minhocas 90 g', 'Balas de gelatina em formato de minhoca e sabores frutados.', 7.99, 14],
      ['Halls Extra Forte 28 g', 'Bala refrescante de sabor mentolado em pacote individual.', 3.49, 18],
      ['Pirulito Pop Mania Bola 7 500 g', 'Pacote de pirulitos Pop Mania Bola 7 sabor framboesa com 500 g.', 14.90, 30]
    ]
  }
];

const products = categories.flatMap((category) => category.items.map(([name, description, price, stock]) => ({
  category: category.name,
  name,
  description,
  price,
  stock,
  imageUrl: productImageByKey.get(`${category.name}::${name}`)
})));

const productRenames = productImages
  .filter((photo) => photo.oldName)
  .map((photo) => ({ category: photo.category, oldName: photo.oldName, newName: photo.name }));
const demoPriceChanges = new Map([
  ['Gelos Saborizados::Gelo saborizado de manga 1 kg', { oldPrice: 15.90, newPrice: 6.90 }],
  ['Doces::Pirulito Pop 7 10 g', { oldPrice: 1.50, newPrice: 14.90 }]
]);
const defaultPhotoUrls = new Set(categories.flatMap((category) => [
  category.photo,
  category.legacyPhoto,
  category.remotePhoto
].filter(Boolean)));

async function main() {
  const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2
  });

  try {
    if (products.some((product) => !product.imageUrl)) {
      throw new Error('Há um produto sem imagem individual no arquivo scripts/product-images.json.');
    }
    const [columns] = await db.execute(
      `SELECT COUNT(*) AS found FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'category'`,
      [process.env.DB_NAME]
    );
    if (!Number(columns[0].found)) {
      throw new Error('A coluna de categoria ainda não existe. Execute database/migration-categories.sql no Workbench e rode este comando de novo.');
    }

    for (const rename of productRenames) {
      const [newRows] = await db.execute(
        'SELECT id FROM products WHERE category = ? AND name = ? LIMIT 1',
        [rename.category, rename.newName]
      );
      if (newRows.length) continue;
      const [oldRows] = await db.execute(
        'SELECT id FROM products WHERE category = ? AND name = ? LIMIT 1',
        [rename.category, rename.oldName]
      );
      if (!oldRows.length) continue;
      const priceChange = demoPriceChanges.get(`${rename.category}::${rename.oldName}`);
      if (priceChange) {
        await db.execute(
          `UPDATE products SET name = ?, price = CASE WHEN price = ? THEN ? ELSE price END
           WHERE category = ? AND name = ?`,
          [rename.newName, priceChange.oldPrice, priceChange.newPrice, rename.category, rename.oldName]
        );
      } else {
        await db.execute(
          'UPDATE products SET name = ? WHERE category = ? AND name = ?',
          [rename.newName, rename.category, rename.oldName]
        );
      }
    }

    // Atualiza apenas fotos de demonstração. Imagens enviadas pelo administrador permanecem intactas.
    for (const product of products) {
      const [existing] = await db.execute(
        'SELECT id, image_url FROM products WHERE category = ? AND name = ? LIMIT 1',
        [product.category, product.name]
      );
      if (!existing.length || !defaultPhotoUrls.has(existing[0].image_url)) continue;
      await db.execute(
        'UPDATE products SET image_url = ? WHERE id = ?',
        [product.imageUrl, existing[0].id]
      );
    }

    let added = 0;
    let skipped = 0;
    for (const product of products) {
      const [existing] = await db.execute(
        'SELECT id FROM products WHERE category = ? AND name = ? LIMIT 1',
        [product.category, product.name]
      );
      if (existing.length) {
        skipped += 1;
        continue;
      }
      await db.execute(
        `INSERT INTO products (name, category, description, price, stock, image_url, active)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [product.name, product.category, product.description, product.price, product.stock, product.imageUrl]
      );
      added += 1;
    }
    console.log(`Catálogo pronto: ${added} produtos adicionados; ${skipped} já existiam.`);
    console.log('Foram preparados 15 itens de demonstração por categoria (120 no total).');
    console.log('Preços e estoques são exemplos editáveis; cada produto usa uma foto própria salva em public/products/individual.');
  } catch (error) {
    console.error(`Não foi possível inserir o catálogo: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();
