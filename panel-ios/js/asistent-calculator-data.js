// Datele exacte folosite de calculatoare, disponibile și pentru Asistent.
// Nu duplicăm formulele în răspunsuri: motorul citește aceste obiecte și
// calculează materialele brute cu aceleași randamente ca paginile de calcul.
(() => {
    'use strict';
    if (window.PANEL_ASSISTANT_CALCULATOR_DATA) return;
    const craft = {
        masa: [
            ['ziptip', 'Zip Tie', { Plastic: 10 }],
            ['momeala', 'Momeală de pește x10', { Plastic: 1 }],
            ['undita_plastic', 'Undiță de plastic', { 'Undiță normală': 1, Plastic: 5 }],
            ['undita_cupru', 'Undiță de cupru', { 'Undiță de plastic': 1, Cupru: 3 }],
            ['undita_aluminiu', 'Undiță de aluminiu', { 'Undiță de cupru': 1, Aluminiu: 3 }],
            ['undita_fier', 'Undiță de fier', { 'Undiță de aluminiu': 1, Fier: 3 }],
            ['placa_mesteacan', 'Placă mesteacăn', { 'Copac Mesteacăn': 1 }],
            ['placa_stejar', 'Placă stejar x2', { 'Copac Stejar': 1 }],
            ['placa_cedru', 'Placă cedru x3', { 'Copac Cedru': 1 }],
            ['teava', 'Țeavă de metal', { 'Scrap Metal': 10, Fier: 2 }],
            ['plicuri', 'Plicuri goale x10', { Plastic: 1 }],
            ['aprinzator', 'Aprinzător', { 'Scrap Metal': 15, 'Țeavă de metal': 1, Butelie: 1 }],
            ['cleste', 'Clește', { 'Scrap Metal': 20, Fier: 2, Aluminiu: 4, Plastic: 5 }],
            ['tableta_hacking', 'Tabletă de hacking', { 'Card albastru': 2, 'Cip vechi': 3, 'Cip clasic': 3, 'Cip nou': 3 }],
            ['flash_drive', 'Flash drive de hack', { USB: 1, 'Card roșu': 1, 'Cip nou': 5, Cabluri: 5 }],
            ['lockpick', 'Lockpick x5', { Fier: 1, 'Scrap Metal': 5 }],
            ['cauciuc_1', 'Cauciuc x1', { 'Copac Mesteacăn': 1 }, 1],
            ['cauciuc_2', 'Cauciuc x2', { 'Copac Stejar': 1 }, 2],
            ['cauciuc_3', 'Cauciuc x3', { 'Copac Cedru': 1 }, 3],
            ['tarnacop_cupru', 'Târnacop de cupru', { 'Târnacop aluminiu': 1, Cupru: 5 }],
            ['tarnacop_fier', 'Târnacop de fier', { 'Târnacop cupru': 1, Fier: 5 }],
            ['tarnacop_otel', 'Târnacop de oțel', { 'Târnacop fier': 1, Oțel: 5 }],
            ['tarnacop_aur', 'Târnacop de aur', { 'Târnacop fier': 1, Aur: 2, Oțel: 3 }],
            ['tarnacop_diamant', 'Târnacop diamant', { 'Târnacop aur': 1, Diamant: 1, Aur: 2 }],
            ['topor_cupru', 'Topor de cupru', { 'Topor aluminiu': 1, Cupru: 5 }],
            ['topor_fier', 'Topor de fier', { 'Topor cupru': 1, Fier: 5 }],
            ['topor_otel', 'Topor de oțel', { 'Topor fier': 1, Oțel: 5 }],
            ['topor_aur', 'Topor de aur', { 'Topor fier': 1, Aur: 2, Oțel: 3 }],
            ['topor_diamant', 'Topor diamant', { 'Topor aur': 1, Diamant: 1, Aur: 2 }]
        ].map(([id, name, base, produces]) => ({ id, name, base, ...(produces ? { produces } : {}) })),
        croitorie: [
            ['ata_x2', 'Ață x2', { Bumbac: 10 }, 2],
            ['sfoara', 'Sfoară', { Ață: 30, 'Scrap Metal': 5 }],
            ['fibra', 'Fibră', { Bumbac: 10 }],
            ['bandaj_improvizat', 'Bandaj improvizat x2', { Fibră: 2, 'Aloe Vera': 2 }, 2],
            ['fibra_kevlar', 'Fibră Kevlar', { Fibră: 2, Cauciuc: 2 }],
            ['armura_kevlar', 'Armură Kevlar', { 'Fibră Kevlar': 3, Ață: 5, Cupru: 1, Oțel: 1 }],
            ['sac_fibra', 'Sac de fibră', { Fibră: 4, Ață: 2 }],
            ['parasuta', 'Parașută', { Sfoară: 2, Fibră: 20, Cauciuc: 8 }]
        ].map(([id, name, base, produces]) => ({ id, name, base, ...(produces ? { produces } : {}) })),
        topitorie: [
            ['otel', 'Oțel', { Fier: 1, Cărbune: 1 }],
            ['arc', 'Arc', { Aluminiu: 1 }]
        ],
        chains: {
            undita: [
                ['undita_plastic', 'Undiță de plastic', { 'Undiță normală': 1, Plastic: 5 }],
                ['undita_cupru', 'Undiță de cupru', { 'Undiță de plastic': 1, Cupru: 3 }],
                ['undita_aluminiu', 'Undiță de aluminiu', { 'Undiță de cupru': 1, Aluminiu: 3 }],
                ['undita_fier', 'Undiță de fier', { 'Undiță de aluminiu': 1, Fier: 3 }]
            ],
            tarnacop: [
                ['tarnacop_cupru', 'Târnacop de cupru', { 'Târnacop Aluminiu': 1, Cupru: 5 }],
                ['tarnacop_fier', 'Târnacop de fier', { Fier: 5 }],
                ['tarnacop_otel', 'Târnacop de oțel', { Oțel: 5 }],
                ['tarnacop_aur', 'Târnacop de aur', { Aur: 2, Oțel: 3 }],
                ['tarnacop_diamant', 'Târnacop diamant', { Diamant: 1, Aur: 2 }]
            ],
            topor: [
                ['topor_cupru', 'Topor de cupru', { 'Topor Aluminiu': 1, Cupru: 5 }],
                ['topor_fier', 'Topor de fier', { Fier: 5 }],
                ['topor_otel', 'Topor de oțel', { Oțel: 5 }],
                ['topor_aur', 'Topor de aur', { Aur: 2, Oțel: 3 }],
                ['topor_diamant', 'Topor diamant', { Diamant: 1, Aur: 2 }]
            ]
        }
    };
    const illegal = {
        componentCost: { 'Teava Pistol': 1, 'Corp Pistol': 1, 'Teava SMG': 2, 'Corp SMG': 2, 'Corp Rifle': 3, 'Teava Rifle': 3, Butstock: 2 },
        weapons: {
            'Navy Pistol': { blueprint: 1, parts: 6, components: ['Teava Rifle', 'Corp Pistol'] },
            'Combat MG': { blueprint: 1, parts: 4, components: ['Teava Rifle', 'Corp Rifle', 'Butstock'] },
            'Assault SMG': { blueprint: 1, parts: 4, components: ['Teava SMG', 'Corp Rifle', 'Butstock'] },
            'Gadget Pistol': { blueprint: 1, parts: 20, components: ['Teava Rifle', 'Corp Pistol'], gold: 10, diamonds: 2, rubies: 2, emeralds: 2 },
            Shotgun: { blueprint: 1, parts: 4, components: ['Teava SMG', 'Corp Pistol'] },
            'Heavy Revolver': { blueprint: 1, parts: 4, components: ['Teava Rifle', 'Corp Pistol'] },
            MG: { parts: 3, components: ['Teava Rifle', 'Corp Rifle', 'Butstock'] },
            'Assault Rifle MK2': { parts: 3, components: ['Teava Rifle', 'Corp Rifle', 'Butstock'] },
            Pistol: { components: ['Corp Pistol', 'Teava Pistol'] },
            'Tec-9': { parts: 1, components: ['Corp Pistol', 'Teava SMG'] },
            'Pistol Mk2': { parts: 1, components: ['Corp Pistol', 'Teava Pistol'] },
            'Micro SMG': { parts: 1, components: ['Corp SMG', 'Teava SMG'] },
            'Mini Ak': { parts: 1, components: ['Corp Rifle', 'Teava SMG'] },
            'Vintage Pistol': { parts: 2, components: ['Corp Pistol', 'Teava Pistol'] },
            'SMG Mk2': { parts: 1, components: ['Corp SMG', 'Teava SMG'] },
            'Tommy Gun': { parts: 1, components: ['Teava Rifle', 'Corp Rifle', 'Butstock'] },
            DB: { parts: 3, components: ['Corp Pistol', 'Teava Pistol'], gold: 1 }
        },
        ammo: {
            '.44 Marlin': [30, { Cupru: 2 }, { Plumb: 1, 'Praf de Pusca': 2 }],
            '7.62mm': [30, { Cupru: 2 }, { Plumb: 2, 'Praf de Pusca': 2 }],
            '.45 ACP': [30, { Cupru: 1 }, { Plumb: 1, 'Praf de Pusca': 1 }],
            '9mm PBM': [30, { Cupru: 1 }, { Plumb: 1, 'Praf de Pusca': 1 }],
            '9mm ACP': [30, { Cupru: 2 }, { Plumb: 1, 'Praf de Pusca': 1 }],
            '.38 Magnum': [20, { Cupru: 2 }, { Plumb: 2, 'Praf de Pusca': 3 }],
            '7.65mm': [20, { Cupru: 2 }, { Plumb: 2, 'Praf de Pusca': 2 }],
            '.50 DAP': [20, { Cupru: 4, Aur: 1 }, { Plumb: 3, 'Praf de Pusca': 4, Diamant: 1 }],
            Buckshot: [20, { Aluminiu: 2, Plastic: 5, Cupru: 1 }, { Plumb: 2, 'Praf de Pusca': 2 }]
        },
        smeltery: {
            carbune_minereu: ['Cărbune', 1, { 'Minereu cărbune': 4 }], carbune_mesteacan: ['Cărbune', 1, { Mesteacăn: 1 }],
            sulf_minereu: ['Sulf', 1, { 'Minereu de sulf': 4 }], cupru_minereu: ['Cupru', 1, { 'Minereu de cupru': 4 }],
            fier_minereu: ['Fier', 1, { 'Minereu de fier': 4 }], aur_minereu: ['Aur', 1, { 'Minereu de aur': 4 }],
            aluminiu_minereu: ['Aluminiu', 1, { 'Minereu de aluminiu': 4 }], plumb_minereu: ['Plumb', 1, { 'Minereu de plumb': 4 }],
            otel: ['Oțel', 1, { Fier: 1, Cărbune: 1 }], arc: ['Arc', 1, { Aluminiu: 1 }],
            tava_x2: ['Tavă', 2, { Oțel: 1 }], carbune_stejar: ['Cărbune', 2, { Stejar: 1 }],
            carbune_cedru: ['Cărbune', 3, { Cedru: 1 }], janta_aluminiu: ['Jantă aluminiu', 1, { Aluminiu: 10 }]
        }
    };
    window.PANEL_ASSISTANT_CALCULATOR_DATA = Object.freeze({ craft, illegal });
})();
