(() => {
  'use strict';

  const recipes = [
    ['gaina', 'Întreg = găină', { 'Găină': 1 }],
    ['faina', 'Făină x10', { 'Grâu': 10 }],
    ['somon_crud', 'Somon crud x2', { Somon: 1 }],
    ['ton_crud', 'Ton crud x2', { Ton: 1 }],
    ['rechin_crud', 'Rechin crud', { Rechin: 1 }],
    ['balena_cruda', 'Balenă crudă', { Balenă: 1 }],
    ['oua_ochiuri', 'Ouă ochiuri x3', { 'Carton de ouă': 1 }],
    ['pulpa_pui', 'Pulpă de pui x2', { Pui: 1 }],
    ['omleta', 'Omletă x2', { 'Carton de ouă': 1, Roșii: 3 }],
    ['paste_branza', 'Paste cu brânză', { 'Paste crude': 1, Brânză: 2 }],
    ['peste_gatit', 'Carne de pește gătită', { Somon: 1 }],
    ['carne_rosie_peste', 'Carne roșie de pește gătită', { Ton: 1 }],
    ['paste_crude', 'Paste crude', { Aluat: 1 }],
    ['branza', 'Brânză', { Lapte: 3 }],
    ['aluat', 'Aluat', { Făină: 1, Apă: 2 }],
    ['oua_cartofi', 'Ouă cu cartofi prăjiți', { 'Ouă ochiuri': 1, Cartofi: 3 }],
    ['paste_pui', 'Paste cu pui', { 'Pulpă de pui': 1, 'Paste crude': 2, Brânză: 2 }],
    ['peste_mare_gatit', 'Carne de pește mare gătită', { 'Balenă crudă': 1 }],
    ['paine', 'Pâine', { Aluat: 1 }],
    ['peste_fin_gatit', 'Carne fină de pește mare gătită', { Rechin: 1 }],
    ['sendvis_branza', 'Sendviș cu brânză x2', { Pâine: 1, Brânză: 1 }],
    ['salata_omleta', 'Salată cu omletă', { Omletă: 1, Salată: 1, Roșii: 2 }],
    ['salata_pui_cartofi', 'Salată cu pui și cartofi', { 'Pulpă de pui': 1, Salată: 1, Roșii: 2, Cartofi: 2 }],
    ['burger_ton', 'Burger cu ton', { Chiflă: 1, Salată: 1, Roșii: 2, Ceapă: 1, Cartofi: 1, 'Ton crud': 1 }],
    ['mancare_somon', 'Mâncare de somon', { Champignon: 3, Salată: 1, Roșii: 2, Ceapă: 1, Cartofi: 1, 'Somon crud': 1 }],
    ['chifle', 'Chifle proaspete x2', { Aluat: 1 }],
    ['mancare_rechin', 'Mâncare de rechin', { 'Rechin crud': 1, Salată: 1, Roșii: 2, 'Condimente de lux': 1, Cartofi: 1, Ton: 1 }],
    ['mancare_balena', 'Mâncare de balenă', { 'Balenă crudă': 1, Salată: 1, Champignon: 10, 'Condimente de lux': 1, Cartofi: 1, Ton: 1 }],
    ['fursex', 'Fursex x2', { Lapte: 2, Aluat: 1, Bomboane: 2 }]
  ].map(([id, name, base], index) => ({ id, name, base, image: `bucatarie-calc-${String(index + 1).padStart(2, '0')}.png` }));

  const byName = new Map(recipes.map(recipe => [recipe.name.toLocaleLowerCase('ro-RO'), recipe]));
  const aliases = new Map([
    ['ouă ochiuri', 'Ouă ochiuri x3'], ['pulpă de pui', 'Pulpă de pui x2'],
    ['omletă', 'Omletă x2'], ['paste cu brânză', 'Paste cu brânză'],
    ['paste crude', 'Paste crude'], ['brânză', 'Brânză'], ['aluat', 'Aluat'],
    ['pâine', 'Pâine'], ['chiflă', 'Chifle proaspete x2'], ['ton crud', 'Ton crud x2'],
    ['somon crud', 'Somon crud x2'], ['rechin crud', 'Rechin crud'], ['balenă crudă', 'Balenă crudă']
  ]);
  const resolve = (name) => byName.get(String(name).toLocaleLowerCase('ro-RO')) || byName.get(String(aliases.get(String(name).toLocaleLowerCase('ro-RO')) || '').toLocaleLowerCase('ro-RO'));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  const root = document.getElementById('kitchenForm');
  if (!root) return;
  const select = document.getElementById('kitchenItemSelect');
  const quantity = document.getElementById('kitchenQty');
  const gallery = document.getElementById('kitchenGalleryGrid');
  const galleryView = document.getElementById('kitchenGalleryView');
  const selectionView = document.getElementById('kitchenSelectionView');
  const direct = document.getElementById('kitchenDirectResults');
  const raw = document.getElementById('kitchenRawResults');
  const result = document.getElementById('kitchenResults');
  if (!select || !quantity || !gallery || !direct || !raw || !result) return;

  select.innerHTML = recipes.map(recipe => `<option value="${esc(recipe.id)}">${esc(recipe.name)}</option>`).join('');
  galleryView.hidden = false;
  selectionView.hidden = true;
  quantity.value = '0';
  result.hidden = true;
  const card = recipe => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'mecanic-gallery-card'; button.title = `Calculează ${recipe.name}`;
    button.innerHTML = `<img src="img/${recipe.image}" alt="${esc(recipe.name)}" loading="lazy"><span>${esc(recipe.name)}</span>`;
    button.onclick = () => open(recipe.id);
    return button;
  };
  recipes.forEach(recipe => gallery.appendChild(card(recipe)));

  const add = (target, name, amount) => { target[name] = (target[name] || 0) + amount; };
  const totals = (name, amount, target, visiting = new Set()) => {
    const recipe = resolve(name);
    if (!recipe || visiting.has(recipe.id)) { add(target, name, amount); return; }
    const next = new Set(visiting); next.add(recipe.id);
    Object.entries(recipe.base).forEach(([material, value]) => totals(material, amount * value, target, next));
  };
  const render = () => {
    const recipe = recipes.find(item => item.id === select.value);
    const amount = Math.max(0, Number.parseInt(quantity.value, 10) || 0);
    if (!recipe || !amount) { result.hidden = true; return; }
    const directValues = {}; Object.entries(recipe.base).forEach(([name, value]) => add(directValues, name, value * amount));
    const rawValues = {}; Object.entries(recipe.base).forEach(([name, value]) => totals(name, value * amount, rawValues));
    direct.innerHTML = Object.entries(directValues).map(([name, value]) => `<div class="result-card"><div class="item-title">${esc(name)}</div><div class="item-value is-non-zero">${value}</div></div>`).join('');
    raw.innerHTML = Object.entries(rawValues).map(([name, value]) => `<div class="result-card"><div class="item-title">${esc(name)}</div><div class="item-value is-non-zero">${value}</div></div>`).join('');
    document.getElementById('kitchenSelectedTitle').textContent = `${recipe.name} · ${amount} buc.`;
    document.getElementById('kitchenSelectedImage').src = `img/${recipe.image}`;
    result.hidden = false;
  };
  function open(id) { select.value = id; quantity.value = 0; galleryView.hidden = true; selectionView.hidden = false; render(); }
  window.showKitchenGallery = () => { galleryView.hidden = false; selectionView.hidden = true; quantity.value = 0; result.hidden = true; };
  select.onchange = render; quantity.oninput = render;
  document.getElementById('kitchenSelectionBack')?.addEventListener('click', window.showKitchenGallery);
})();
