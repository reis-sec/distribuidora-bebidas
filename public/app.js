const categories = [
  'Whiskeys', 'Cervejas', 'Refrigerantes', 'Gelos Saborizados',
  'Energéticos Variados', 'Águas', 'Salgadinhos', 'Doces'
];
const state = { user: null, products: [], selectedCategory: 'Todas', toastTimer: null };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  return data;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function showAuth(register = false) {
  $('#auth-screen').hidden = false;
  $('#app-screen').hidden = true;
  $('#login-view').hidden = register;
  $('#register-view').hidden = !register;
}

function showApp(user) {
  state.user = user;
  $('#auth-screen').hidden = true;
  $('#app-screen').hidden = false;
  $('#user-name').textContent = user.name.split(' ')[0];
  $$('.admin-only').forEach((item) => { item.hidden = user.role !== 'admin'; });
  setSection('catalog');
  loadProducts();
}

function setSection(section) {
  const allowed = ['catalog', 'manage', 'users'];
  if (!allowed.includes(section)) section = 'catalog';
  if (state.user?.role !== 'admin' && section !== 'catalog') section = 'catalog';
  $('#catalog-section').hidden = section !== 'catalog';
  $('#manage-section').hidden = section !== 'manage';
  $('#users-section').hidden = section !== 'users';
  $$('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.section === section));
  if (section === 'users') loadUsers();
}

function safeImageUrl(value) {
  if (/^\/uploads\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(value || '')) return value;
  if (/^\/products\/catalog-[a-z0-9-]+\.(jpg|png|svg|webp)$/.test(value || '')) return value;
  if (/^\/products\/individual\/[a-z0-9-]+\.(jpg|png|webp|avif)$/.test(value || '')) return value;
  return '';
}

function imageMarkup(url, name, inventory = false) {
  const safeUrl = safeImageUrl(url);
  const alt = `Foto de ${escapeHtml(name)}`;
  const cssClass = inventory ? 'inventory-image' : 'product-photo';
  if (!safeUrl) return `<div class="${cssClass}"><span class="photo-placeholder">SEM FOTO</span></div>`;
  return `<div class="${cssClass}"><img src="${safeUrl}" alt="${alt}" loading="lazy"></div>`;
}

function renderProducts() {
  const admin = state.user?.role === 'admin';
  const grid = $('#product-grid');
  const visibleProducts = state.selectedCategory === 'Todas'
    ? state.products
    : state.products.filter((product) => product.category === state.selectedCategory);
  const filterCategories = [...categories];
  if (state.products.some((product) => product.category === 'Outros')) filterCategories.push('Outros');
  $('#category-filters').innerHTML = ['Todas', ...filterCategories].map((category) =>
    `<button class="category-filter${state.selectedCategory === category ? ' active' : ''}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${state.selectedCategory === category}">${escapeHtml(category)}</button>`
  ).join('');
  $('#product-count').textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? 'produto' : 'produtos'}`;
  $('#inventory-count').textContent = state.products.length;
  $('#empty-catalog').hidden = state.products.length > 0;
  $('#empty-filter').hidden = state.products.length === 0 || visibleProducts.length > 0;
  grid.innerHTML = visibleProducts.map((product) => {
    const stock = Number(product.stock);
    const description = product.description || 'Uma opção para completar bons momentos.';
    const availability = product.active ? (stock > 0 ? `${stock} em estoque` : 'Indisponível') : 'Oculta do catálogo';
    const availabilityClass = stock > 0 && product.active ? '' : ' low';
    return `<article class="product-card">
      ${imageMarkup(product.imageUrl, product.name)}
      <div class="product-info">
        <span class="category-tag">${escapeHtml(product.category || 'Outros')}</span>
        <h2>${escapeHtml(product.name)}</h2>
        <p class="product-description">${escapeHtml(description)}</p>
        <div class="product-meta"><span class="product-price">${Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><span class="stock-label${availabilityClass}">${escapeHtml(availability)}</span></div>
        ${admin ? `<div class="product-admin-actions"><button class="small-action" type="button" data-edit="${Number(product.id)}">Editar</button><button class="small-action danger" type="button" data-delete="${Number(product.id)}">Remover</button></div>` : ''}
      </div>
    </article>`;
  }).join('');

  $('#inventory-list').innerHTML = state.products.length ? state.products.map((product) => `
    <article class="inventory-item">
      ${imageMarkup(product.imageUrl, product.name, true)}
      <div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.category || 'Outros')} · ${Number(product.stock)} un. · ${Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p><span class="inventory-status${product.active ? '' : ' off'}">${product.active ? 'Disponível' : 'Oculta'}</span></div>
      <div class="inventory-actions"><button class="small-action" type="button" data-edit="${Number(product.id)}">Editar</button><button class="small-action danger" type="button" data-delete="${Number(product.id)}" aria-label="Remover ${escapeHtml(product.name)}">×</button></div>
    </article>`).join('') : '<p class="muted">Nenhuma bebida cadastrada ainda.</p>';

  document.querySelectorAll('#product-grid img, #inventory-list img').forEach((image) => image.addEventListener('error', () => {
    const wrapper = image.parentElement;
    wrapper.innerHTML = '<span class="photo-placeholder">SEM FOTO</span>';
  }, { once: true }));
}

async function loadProducts() {
  const notice = $('#catalog-message');
  notice.hidden = true;
  try {
    const result = await api('/api/products');
    state.products = result.products;
    renderProducts();
  } catch (error) {
    notice.textContent = error.message;
    notice.hidden = false;
    state.products = [];
    renderProducts();
  }
}

function clearProductForm() {
  $('#product-form').reset();
  $('#product-id').value = '';
  $('#product-form-title').textContent = 'Adicionar produto';
  $('#save-product').textContent = 'Salvar produto';
  $('#cancel-edit').hidden = true;
  $('#product-error').textContent = '';
}

function editProduct(id) {
  const product = state.products.find((item) => Number(item.id) === Number(id));
  if (!product) return;
  setSection('manage');
  $('#product-id').value = product.id;
  $('#product-category').value = product.category || 'Outros';
  $('#product-name').value = product.name;
  $('#product-description').value = product.description || '';
  $('#product-price').value = Number(product.price).toFixed(2);
  $('#product-stock').value = product.stock;
  $('#product-active').value = product.active ? 'true' : 'false';
  $('#product-form-title').textContent = 'Editar bebida';
  $('#save-product').textContent = 'Salvar alterações';
  $('#cancel-edit').hidden = false;
  $('#product-image').value = '';
  $('#product-name').focus();
}

async function deleteProduct(id) {
  const product = state.products.find((item) => Number(item.id) === Number(id));
  if (!product || !window.confirm(`Remover "${product.name}" do catálogo?`)) return;
  try {
    const result = await api(`/api/products/${Number(id)}`, { method: 'DELETE' });
    showToast(result.message);
    await loadProducts();
  } catch (error) { showToast(error.message); }
}

async function loadUsers() {
  const message = $('#users-message');
  message.hidden = true;
  try {
    const result = await api('/api/admin/users');
    $('#users-table').innerHTML = result.users.map((user) => {
      const created = new Date(user.createdAt).toLocaleDateString('pt-BR');
      const role = user.role === 'admin' ? 'Administrador' : 'Cliente';
      const status = user.active ? 'Ativo' : 'Inativo';
      return `<tr><td>${escapeHtml(user.name)}<br><small>${role}</small></td><td>${escapeHtml(user.email)}</td><td>${created}</td><td><span class="status-dot${user.active ? '' : ' inactive'}">${status}</span></td></tr>`;
    }).join('') || '<tr><td colspan="4">Nenhuma conta encontrada.</td></tr>';
  } catch (error) {
    message.textContent = error.message;
    message.hidden = false;
  }
}

$$('[data-show-register]').forEach((button) => button.addEventListener('click', () => showAuth(true)));
$$('[data-show-login]').forEach((button) => button.addEventListener('click', () => showAuth(false)));
$$('.nav-link').forEach((button) => button.addEventListener('click', () => setSection(button.dataset.section)));

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const errorEl = $('#login-error');
  errorEl.textContent = '';
  button.disabled = true;
  try {
    const form = new FormData(event.currentTarget);
    const result = await api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
    showApp(result.user);
  } catch (error) { errorEl.textContent = error.message; }
  finally { button.disabled = false; }
});

$('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const errorEl = $('#register-error');
  errorEl.textContent = '';
  button.disabled = true;
  try {
    const form = new FormData(event.currentTarget);
    const result = await api('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
    showApp(result.user);
    showToast(result.message);
  } catch (error) { errorEl.textContent = error.message; }
  finally { button.disabled = false; }
});

$('#logout-button').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch { /* A tela local é encerrada mesmo se a rede cair. */ }
  state.user = null;
  state.products = [];
  showAuth(false);
});

$('#product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = $('#product-id').value;
  const button = $('#save-product');
  $('#product-error').textContent = '';
  button.disabled = true;
  try {
    const data = new FormData(form);
    const result = await api(id ? `/api/products/${Number(id)}` : '/api/products', { method: id ? 'PUT' : 'POST', body: data });
    clearProductForm();
    await loadProducts();
    showToast(result.message);
  } catch (error) { $('#product-error').textContent = error.message; }
  finally { button.disabled = false; }
});

$('#cancel-edit').addEventListener('click', clearProductForm);
document.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit]');
  const deleteButton = event.target.closest('[data-delete]');
  if (editButton) editProduct(editButton.dataset.edit);
  if (deleteButton) deleteProduct(deleteButton.dataset.delete);
  const categoryButton = event.target.closest('[data-category]');
  if (categoryButton) {
    state.selectedCategory = categoryButton.dataset.category;
    renderProducts();
  }
});

(async function initialize() {
  try {
    const result = await api('/api/me');
    if (result.user) showApp(result.user);
    else showAuth(false);
  } catch {
    showAuth(false);
    $('#login-error').textContent = 'Não foi possível conectar ao servidor. Tente novamente em instantes.';
  }
})();
