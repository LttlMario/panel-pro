export type CalculatorRecipe = {
  id: string;
  name: string;
  base: Record<string, number>;
  produces?: number;
  ratio?: boolean;
};

export type CalculatorCategory = {
  id: string;
  label: string;
  recipes: CalculatorRecipe[];
};

const recipe = (id: string, name: string, base: Record<string, number>, produces = 1, ratio = false): CalculatorRecipe => ({ id, name, base, produces, ratio });

const legalCategories: CalculatorCategory[] = [
  {
    id: 'masa', label: '🛠️ Masă Crafting', recipes: [
      recipe('ziptip', 'Zip Tie', { Plastic: 10 }), recipe('momeala', 'Momeală de pește x10', { Plastic: 1 }),
      recipe('undita_plastic', 'Undiță de plastic', { 'Undiță normală': 1, Plastic: 5 }), recipe('undita_cupru', 'Undiță de cupru', { 'Undiță de plastic': 1, Cupru: 3 }),
      recipe('undita_aluminiu', 'Undiță de aluminiu', { 'Undiță de cupru': 1, Aluminiu: 3 }), recipe('undita_fier', 'Undiță de fier', { 'Undiță de aluminiu': 1, Fier: 3 }),
      recipe('placa_mesteacan', 'Placă mesteacăn', { 'Copac Mesteacăn': 1 }), recipe('placa_stejar', 'Placă stejar x2', { 'Copac Stejar': 1 }),
      recipe('placa_cedru', 'Placă cedru x3', { 'Copac Cedru': 1 }), recipe('teava', 'Țeavă de metal', { 'Scrap Metal': 10, Fier: 2 }),
      recipe('plicuri', 'Plicuri goale x10', { Plastic: 1 }), recipe('aprinzator', 'Aprinzător', { 'Scrap Metal': 15, 'Țeavă de metal': 1, Butelie: 1 }),
      recipe('cleste', 'Clește', { 'Scrap Metal': 20, Fier: 2, Aluminiu: 4, Plastic: 5 }), recipe('tableta_hacking', 'Tabletă de hacking', { 'Card albastru': 2, 'Cip vechi': 3, 'Cip clasic': 3, 'Cip nou': 3 }),
      recipe('flash_drive', 'Flash drive de hack', { USB: 1, 'Card roșu': 1, 'Cip nou': 5, Cabluri: 5 }), recipe('lockpick', 'Lockpick x5', { Fier: 1, 'Scrap Metal': 5 }),
      recipe('cauciuc_1', 'Cauciuc x1', { 'Copac Mesteacăn': 1 }), recipe('cauciuc_2', 'Cauciuc x2', { 'Copac Stejar': 1 }, 2), recipe('cauciuc_3', 'Cauciuc x3', { 'Copac Cedru': 1 }, 3),
      recipe('tarnacop_cupru', 'Târnacop de cupru', { 'Târnacop aluminiu': 1, Cupru: 5 }), recipe('tarnacop_fier', 'Târnacop de fier', { 'Târnacop cupru': 1, Fier: 5 }),
      recipe('tarnacop_otel', 'Târnacop de oțel', { 'Târnacop fier': 1, Oțel: 5 }), recipe('tarnacop_aur', 'Târnacop de aur', { 'Târnacop fier': 1, Aur: 2, Oțel: 3 }), recipe('tarnacop_diamant', 'Târnacop diamant', { 'Târnacop aur': 1, Diamant: 1, Aur: 2 }),
      recipe('topor_cupru', 'Topor de cupru', { 'Topor aluminiu': 1, Cupru: 5 }), recipe('topor_fier', 'Topor de fier', { 'Topor cupru': 1, Fier: 5 }),
      recipe('topor_otel', 'Topor de oțel', { 'Topor fier': 1, Oțel: 5 }), recipe('topor_aur', 'Topor de aur', { 'Topor fier': 1, Aur: 2, Oțel: 3 }), recipe('topor_diamant', 'Topor diamant', { 'Topor aur': 1, Diamant: 1, Aur: 2 }),
    ],
  },
  {
    id: 'croitorie', label: '🧵 Croitorie', recipes: [
      recipe('ata_x2', 'Ață x2', { Bumbac: 10 }, 2), recipe('sfoara', 'Sfoară', { Ață: 30, 'Scrap Metal': 5 }), recipe('fibra', 'Fibră', { Bumbac: 10 }),
      recipe('bandaj_improvizat', 'Bandaj improvizat x2', { Fibră: 2, 'Aloe Vera': 2 }, 2), recipe('fibra_kevlar', 'Fibră Kevlar', { Fibră: 2, Cauciuc: 2 }),
      recipe('armura_kevlar', 'Armură Kevlar', { 'Fibră Kevlar': 3, Ață: 5, Cupru: 1, Oțel: 1 }), recipe('sac_fibra', 'Sac de fibră', { Fibră: 4, Ață: 2 }), recipe('parasuta', 'Parașută', { Sfoară: 2, Fibră: 20, Cauciuc: 8 }),
    ],
  },
  { id: 'mecanic', label: '🔧 Craft Mecanic', recipes: [
    recipe('unelte_x10', 'Unelte x10', { Oțel: 1, Arc: 1 }), recipe('cabluri_x10', 'Cabluri x10', { Cupru: 1, Plastic: 1 }), recipe('cabluri', 'Cabluri', { 'Cabluri x10': 1 }, 10), recipe('bujii_x10', 'Bujii x10', { Plumb: 1, Arc: 1 }),
    recipe('kit_reparatii', 'Kit de reparații', { 'Unelte x10': 1, Cabluri: 1, 'Bujii x10': 1 }), recipe('limitator_viteza', 'Limitator de viteză', { 'Cip vechi': 5, Plastic: 15 }), recipe('set_cauciucuri', 'Set cauciucuri', { Cauciuc: 120 }),
    recipe('kit_reparat_avansat', 'Kit de reparat avansat', { 'Unelte x10': 2, Cabluri: 2, 'Bujii x10': 2, Oțel: 1, Cauciuc: 1, Plastic: 1 }),
    recipe('jante_addon_80', 'Jante addon 80', { Blueprint: 1, Oțel: 15, Aluminiu: 5 }), recipe('jante_addon_85', 'Jante addon 85', { Blueprint: 1, Oțel: 15, Aluminiu: 5 }), recipe('jante_addon_98', 'Jante addon 98', { Blueprint: 1, Oțel: 15, Aluminiu: 5 }),
    recipe('xenon_albastru', 'Xenon albastru', { Safir: 3, Plastic: 20, Cabluri: 4 }), recipe('xenon_albastru_deschis', 'Xenon albastru deschis', { Safir: 2, Diamant: 1, Plastic: 20, Cabluri: 3 }),
    recipe('xenon_verde', 'Xenon verde', { Emerald: 3, Plastic: 20, Cabluri: 3 }), recipe('xenon_verde_deschis', 'Xenon verde deschis', { Emerald: 2, Diamant: 1, Plastic: 20, Cabluri: 4 }),
    recipe('xenon_galben_deschis', 'Xenon galben deschis', { Rubin: 1, Emerald: 1, Diamant: 1, Plastic: 20, Cabluri: 4 }), recipe('xenon_galben', 'Xenon galben', { Rubin: 2, Diamant: 1, Plastic: 20, Cabluri: 4 }),
    recipe('xenon_portocaliu', 'Xenon portocaliu', { Rubin: 2, Diamant: 1, Plastic: 20, Cabluri: 4 }), recipe('xenon_rosu', 'Xenon roșu', { Rubin: 3, Plastic: 20, Cabluri: 4 }),
    recipe('xenon_roz_deschis', 'Xenon roz deschis', { Rubin: 1, Diamant: 2, Plastic: 20, Cabluri: 4 }), recipe('xenon_roz', 'Xenon roz', { Rubin: 2, Diamant: 1, Plastic: 20, Cabluri: 4 }),
    recipe('xenon_mov', 'Xenon mov', { Rubin: 2, Safir: 1, Plastic: 20, Cabluri: 4 }), recipe('xenon_mov_deschis', 'Xenon mov deschis', { Rubin: 2, Safir: 1, Diamant: 1, Plastic: 20, Cabluri: 4 }),
    recipe('turometru_tb_numeric', 'Turometru TB numeric', { Tabletă: 1, 'Cip nou': 30, Cabluri: 20, Diamant: 1 }), recipe('turometru_gmc', 'Turometru GMC', { Tabletă: 1, 'Cip nou': 30, Cabluri: 20, Diamant: 1 }),
    ...Array.from({ length: 4 }, (_, index) => recipe(`jante_addon_${55 + index}`, `Jante addon ${55 + index}`, { Blueprint: 1, Oțel: 15, Aluminiu: 5, ...(index % 2 ? { Plastic: 30 } : {}) })),
    ...Array.from({ length: 8 }, (_, index) => recipe(`jante_addon_${59 + index}`, `Jante addon ${59 + index}`, { Blueprint: 1, Oțel: index < 2 ? 15 : 20, Aluminiu: index < 2 ? 5 : 10, ...(index % 2 ? { Plastic: 30 } : {}) })),
    recipe('jante_addon_92', 'Jante addon 92', { Blueprint: 1, Oțel: 15, Aluminiu: 5, Plastic: 30 }), recipe('set_roti', 'Set roți', { 'Set cauciucuri': 1, 'Set jante aluminiu': 1 }), recipe('set_roti_runflat', 'Set roți runflat', { 'Set roți': 1, Oțel: 50 }),
    recipe('jante_addon_79', 'Jante addon 79', { Blueprint: 1, Oțel: 20, Aluminiu: 15, Plastic: 40 }), recipe('jante_addon_96', 'Jante addon 96', { Blueprint: 1, Oțel: 20, Aluminiu: 10 }),
    recipe('jante_addon_97', 'Jante addon 97', { Blueprint: 1, Oțel: 20, Aluminiu: 15, Plastic: 40 }), recipe('jante_addon_100', 'Jante addon 100', { Blueprint: 1, Oțel: 25, Aluminiu: 15 }),
    recipe('jante_addon_101', 'Jante addon 101', { Blueprint: 1, Oțel: 25, Aluminiu: 15 }), recipe('jante_addon_124', 'Jante addon 124', { Blueprint: 1, Oțel: 20, Aluminiu: 15, Plastic: 40 }),
    recipe('jante_addon_125', 'Jante addon 125', { Blueprint: 1, Oțel: 20, Aluminiu: 15, Plastic: 40 }), recipe('jante_addon_126', 'Jante addon 126', { Blueprint: 1, Oțel: 25, Aluminiu: 15 }), recipe('jante_addon_191', 'Jante addon 191', { Blueprint: 1, Oțel: 20, Aluminiu: 15, Plastic: 40 }),
    recipe('set_jante_aluminiu', 'Set jante aluminiu', { Aluminiu: 40 }),
  ] },
  {
    id: 'bucatarie', label: '🍳 Calculator Bucătărie', recipes: [
      recipe('gaina', 'Întreg = găină', { 'Găină': 1 }), recipe('faina', 'Făină x10', { Grâu: 10 }),
      recipe('somon_crud', 'Somon crud x2', { Somon: 1 }), recipe('ton_crud', 'Ton crud x2', { Ton: 1 }),
      recipe('rechin_crud', 'Rechin crud', { Rechin: 1 }), recipe('balena_cruda', 'Balenă crudă', { Balenă: 1 }),
      recipe('oua_ochiuri', 'Ouă ochiuri x3', { 'Carton de ouă': 1 }), recipe('pulpa_pui', 'Pulpă de pui x2', { Pui: 1 }),
      recipe('omleta', 'Omletă x2', { 'Carton de ouă': 1, Roșii: 3 }), recipe('paste_branza', 'Paste cu brânză', { 'Paste crude': 1, Brânză: 2 }),
      recipe('peste_gatit', 'Carne de pește gătită', { Somon: 1 }), recipe('carne_rosie_peste', 'Carne roșie de pește gătită', { Ton: 1 }),
      recipe('paste_crude', 'Paste crude', { Aluat: 1 }), recipe('branza', 'Brânză', { Lapte: 3 }),
      recipe('aluat', 'Aluat', { Făină: 1, Apă: 2 }), recipe('oua_cartofi', 'Ouă cu cartofi prăjiți', { 'Ouă ochiuri': 1, Cartofi: 3 }),
      recipe('paste_pui', 'Paste cu pui', { 'Pulpă de pui': 1, 'Paste crude': 2, Brânză: 2 }),
      recipe('peste_mare_gatit', 'Carne de pește mare gătită', { 'Balenă crudă': 1 }), recipe('paine', 'Pâine', { Aluat: 1 }),
      recipe('peste_fin_gatit', 'Carne fină de pește mare gătită', { Rechin: 1 }), recipe('sendvis_branza', 'Sendviș cu brânză x2', { Pâine: 1, Brânză: 1 }),
      recipe('salata_omleta', 'Salată cu omletă', { Omletă: 1, Salată: 1, Roșii: 2 }),
      recipe('salata_pui_cartofi', 'Salată cu pui și cartofi', { 'Pulpă de pui': 1, Salată: 1, Roșii: 2, Cartofi: 2 }),
      recipe('burger_ton', 'Burger cu ton', { Chiflă: 1, Salată: 1, Roșii: 2, Ceapă: 1, Cartofi: 1, 'Ton crud': 1 }),
      recipe('mancare_somon', 'Mâncare de somon', { Champignon: 3, Salată: 1, Roșii: 2, Ceapă: 1, Cartofi: 1, 'Somon crud': 1 }),
      recipe('chifle', 'Chifle proaspete x2', { Aluat: 1 }),
      recipe('mancare_rechin', 'Mâncare de rechin', { 'Rechin crud': 1, Salată: 1, Roșii: 2, 'Condimente de lux': 1, Cartofi: 1, Ton: 1 }),
      recipe('mancare_balena', 'Mâncare de balenă', { 'Balenă crudă': 1, Salată: 1, Champignon: 10, 'Condimente de lux': 1, Cartofi: 1, Somon: 1 }),
      recipe('fursex', 'Fursex x2', { Lapte: 2, Aluat: 1, Bomboane: 2 }),
    ],
  },
];

const illegalCategories: CalculatorCategory[] = [
  {
    id: 'arme', label: '🔫 Arme', recipes: [
      recipe('navy_pistol', 'Navy Pistol', { Blueprint: 1, 'Piese de armă': 6, 'Țeavă Rifle': 1, 'Corp Pistol': 1 }),
      recipe('combat_mg', 'Combat MG', { Blueprint: 1, 'Piese de armă': 4, 'Țeavă Rifle': 1, 'Corp Rifle': 1, Butstock: 1 }),
      recipe('assault_smg', 'Assault SMG', { Blueprint: 1, 'Piese de armă': 4, 'Țeavă SMG': 1, 'Corp Rifle': 1, Butstock: 1 }),
      recipe('gadget_pistol', 'Gadget Pistol', { Blueprint: 1, 'Piese de armă': 20, 'Țeavă Rifle': 1, 'Corp Pistol': 1, Aur: 10, Diamant: 2, Rubin: 2, Emerald: 2 }),
      recipe('shotgun', 'Shotgun', { 'Piese de armă': 4, 'Țeavă SMG': 1, 'Corp Pistol': 1 }), recipe('heavy_revolver', 'Heavy Revolver', { 'Piese de armă': 4, 'Țeavă Rifle': 1, 'Corp Pistol': 1 }),
      recipe('mg', 'MG', { 'Piese de armă': 3, 'Țeavă Rifle': 1, 'Corp Rifle': 1, Butstock: 1 }), recipe('assault_rifle_mk2', 'Assault Rifle MK2', { 'Piese de armă': 3, 'Țeavă Rifle': 1, 'Corp Rifle': 1, Butstock: 1 }),
      recipe('pistol', 'Pistol', { 'Corp Pistol': 1, 'Țeavă Pistol': 1 }), recipe('tec9', 'Tec-9', { 'Piese de armă': 1, 'Corp Pistol': 1, 'Țeavă SMG': 1 }),
      recipe('pistol_mk2', 'Pistol Mk2', { 'Piese de armă': 1, 'Corp Pistol': 1, 'Țeavă Pistol': 1 }), recipe('micro_smg', 'Micro SMG', { 'Piese de armă': 1, 'Corp SMG': 1, 'Țeavă SMG': 1 }),
      recipe('mini_ak', 'Mini Ak', { 'Piese de armă': 1, 'Corp Rifle': 1, 'Țeavă SMG': 1 }), recipe('vintage_pistol', 'Vintage Pistol', { 'Piese de armă': 2, 'Corp Pistol': 1, 'Țeavă Pistol': 1 }),
      recipe('smg_mk2', 'SMG Mk2', { 'Piese de armă': 1, 'Corp SMG': 1, 'Țeavă SMG': 1 }), recipe('tommy_gun', 'Tommy Gun', { 'Piese de armă': 1, 'Țeavă Rifle': 1, 'Corp Rifle': 1, Butstock: 1 }),
      recipe('db', 'DB', { 'Piese de armă': 3, 'Corp Pistol': 1, 'Țeavă Pistol': 1, Aur: 1 }),
      recipe('piese_arma', 'Piese de armă', { Arc: 1, Oțel: 1, Plastic: 1, Scrap: 2 }, 2),
      recipe('teava_pistol', 'Țeavă Pistol', { 'Piese de armă': 1 }), recipe('corp_pistol', 'Corp Pistol', { 'Piese de armă': 1 }),
      recipe('teava_smg', 'Țeavă SMG', { 'Piese de armă': 2 }), recipe('corp_smg', 'Corp SMG', { 'Piese de armă': 2 }),
      recipe('corp_rifle', 'Corp Rifle', { 'Piese de armă': 3 }), recipe('teava_rifle', 'Țeavă Rifle', { 'Piese de armă': 3 }), recipe('butstock', 'Butstock', { 'Piese de armă': 2 }),
    ],
  },
  {
    id: 'munitie', label: '📦 Muniție', recipes: [
      recipe('ammo_44', '.44 Marlin · set x30', { Cupru: 2, Plumb: 1, 'Praf de Pusca': 2, 'Casing-uri': 30 }, 30), recipe('ammo_762', '7.62mm · set x30', { Cupru: 2, Plumb: 2, 'Praf de Pusca': 2, 'Casing-uri': 30 }, 30),
      recipe('ammo_45', '.45 ACP · set x30', { Cupru: 1, Plumb: 1, 'Praf de Pusca': 1, 'Casing-uri': 30 }, 30), recipe('ammo_9pbm', '9mm PBM · set x30', { Cupru: 1, Plumb: 1, 'Praf de Pusca': 1, 'Casing-uri': 30 }, 30),
      recipe('ammo_9acp', '9mm ACP · set x30', { Cupru: 2, Plumb: 1, 'Praf de Pusca': 1, 'Casing-uri': 30 }, 30), recipe('ammo_38', '.38 Magnum · set x20', { Cupru: 2, Plumb: 2, 'Praf de Pusca': 3, 'Casing-uri': 20 }, 20),
      recipe('ammo_765', '7.65mm · set x20', { Cupru: 2, Plumb: 2, 'Praf de Pusca': 2, 'Casing-uri': 20 }, 20), recipe('ammo_50', '.50 DAP · set x20', { Cupru: 4, Aur: 1, Plumb: 3, 'Praf de Pusca': 4, Diamant: 1, 'Casing-uri': 20 }, 20),
      recipe('ammo_buckshot', 'Buckshot · set x20', { Aluminiu: 2, Plastic: 5, Cupru: 1, Plumb: 2, 'Praf de Pusca': 2, 'Casing-uri': 20 }, 20),
    ],
  },
  { id: 'topitorie', label: '🏭 Topitorie', recipes: [
    recipe('carbune_minereu', 'Cărbune', { 'Minereu cărbune': 4 }), recipe('carbune_mesteacan', 'Cărbune', { Mesteacăn: 1 }),
    recipe('carbune_stejar', 'Cărbune x2', { Stejar: 1 }, 2), recipe('carbune_cedru', 'Cărbune x3', { Cedru: 1 }, 3),
    recipe('sulf_minereu', 'Sulf', { 'Minereu de sulf': 4 }), recipe('cupru_minereu', 'Cupru', { 'Minereu de cupru': 4 }),
    recipe('fier_minereu', 'Fier', { 'Minereu de fier': 4 }), recipe('aur_minereu', 'Aur', { 'Minereu de aur': 4 }),
    recipe('aluminiu_minereu', 'Aluminiu', { 'Minereu de aluminiu': 4 }), recipe('plumb_minereu', 'Plumb', { 'Minereu de plumb': 4 }),
    recipe('otel', 'Oțel', { Fier: 1, Cărbune: 1 }), recipe('arc', 'Arc', { Aluminiu: 1 }),
    recipe('tava_x2', 'Tavă x2', { Oțel: 1 }, 2), recipe('janta_aluminiu', 'Jantă aluminiu', { Aluminiu: 10 }),
  ] },
  { id: 'plicuri', label: '💊 Plicuri Cocaină', recipes: [
    recipe('plicuri_facute', 'Plicuri Coca', { Frunze: 1000, Tăvi: 50, Ape: 50, Brichete: 50, 'Plicuri goale': 100 }, 100),
  ] },
  { id: 'marijuana', label: '🌿 Marijuana (Joint-uri)', recipes: [
    recipe('jointuri', 'Joint-uri', { Frunze: 20, 'Foițe': 1 }, 1),
  ] },
  { id: 'ciuperci', label: '🍄 Plicuri Ciuperci', recipes: [recipe('red_fire_x3', 'Red Fire x3', { Acetonă: 1, 'Pink Light': 3, 'Oyster roșu': 3, 'Amanita roșie': 3, 'Plicuri goale': 3 }), recipe('green_haze', 'Green Haze x3', { Acetonă: 1, 'Blue Light': 3, 'Oyster galben': 3, 'Amanita verde': 3, 'Plicuri goale': 3 }), recipe('blue_current_x3', 'Blue Current x3', { Acetonă: 1, 'Purple Light': 3, 'Oyster albastru': 3, Psilocybe: 3, 'Plicuri goale': 3 })] },
];

const allCategories = (kind: 'legal' | 'illegal') => kind === 'legal' ? legalCategories : illegalCategories;
const findCategory = (kind: 'legal' | 'illegal', id: string) => allCategories(kind).find((category) => category.id === id) || null;
const findRecipe = (kind: 'legal' | 'illegal', categoryId: string, recipeId: string) => findCategory(kind, categoryId)?.recipes.find((item) => item.id === recipeId) || null;

function calculateRecipe(recipeItem: CalculatorRecipe, quantity: number, categories: CalculatorCategory[]) {
  const direct: Record<string, number> = {};
  const raw: Record<string, number> = {};
  // Topitoria este publicată numai în calculatorul ilegal, dar materialele
  // produse acolo sunt dependențe brute și pentru rețetele legale (Oțel, Arc).
  // Nu o afișăm în lista legală; o folosim doar la descompunerea materiilor.
  const dependencyCategories = categories.some((category) => category.id === 'topitorie')
    ? categories
    : [...categories, illegalCategories.find((category) => category.id === 'topitorie')].filter(Boolean) as CalculatorCategory[];
  const allRecipes = dependencyCategories.flatMap((category) => category.recipes);
  const normalize = (value: string) => value.toLocaleLowerCase('ro-RO').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const aliases: Record<string, string> = {
    [normalize('ouă ochiuri')]: normalize('Ouă ochiuri x3'),
    [normalize('pulpă de pui')]: normalize('Pulpă de pui x2'),
    [normalize('omletă')]: normalize('Omletă x2'),
    [normalize('ton crud')]: normalize('Ton crud x2'),
    [normalize('somon crud')]: normalize('Somon crud x2'),
    [normalize('chiflă')]: normalize('Chifle proaspete x2'),
  };
  const byName = (value: string) => {
    const key = aliases[normalize(value)] || normalize(value);
    return allRecipes.find((item) => normalize(item.name) === key || normalize(item.id) === key) || null;
  };
  const add = (target: Record<string, number>, key: string, amount: number) => { target[key] = (target[key] || 0) + amount; };
  const resolve = (name: string, amount: number, seen = new Set<string>()) => {
    const nested = byName(name);
    if (!nested || seen.has(nested.id)) { add(raw, name, amount); return; }
    const crafts = nested.ratio ? amount : Math.ceil(amount / Math.max(1, nested.produces || 1));
    const next = new Set(seen); next.add(nested.id);
    Object.entries(nested.base).forEach(([material, needed]) => resolve(material, needed * crafts, next));
  };
  const crafts = recipeItem.ratio ? quantity : Math.ceil(quantity / Math.max(1, recipeItem.produces || 1));
  Object.entries(recipeItem.base).forEach(([material, needed]) => { add(direct, material, needed * crafts); resolve(material, needed * crafts); });
  return { crafts, direct, raw };
}

export { allCategories, findCategory, findRecipe, calculateRecipe };
