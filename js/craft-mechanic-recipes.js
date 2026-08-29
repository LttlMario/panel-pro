(() => {
    const wheel = (steel, aluminum, plastic = 0) => {
        const base = {
            Blueprint: 1,
            Oțel: steel,
            Aluminiu: aluminum
        };
        if (plastic) base.Plastic = plastic;
        return base;
    };

    const recipes = [
        { id: 'unelte_x10', name: 'Unelte x10', base: { Oțel: 1, Arc: 1 } },
        { id: 'cabluri_x10', name: 'Cabluri x10', base: { Cupru: 1, Plastic: 1 } },
        { id: 'bujii_x10', name: 'Bujii x10', base: { Plumb: 1, Arc: 1 } },
        { id: 'kit_reparatii', name: 'Kit de reparații', base: { 'Unelte x10': 1, 'Cabluri x10': 1, 'Bujii x10': 1 } },
        { id: 'limitator_viteza', name: 'Limitator de viteză', base: { 'Cip vechi': 5, Plastic: 15 } },
        { id: 'set_cauciucuri', name: 'Set cauciucuri', base: { Cauciuc: 120 } },
        { id: 'kit_reparat_avansat', name: 'Kit de reparat avansat', base: { 'Unelte x10': 2, 'Cabluri x10': 2, 'Bujii x10': 2, Oțel: 1, Cauciuc: 1, Plastic: 1 } },
        { id: 'jante_addon_80', name: 'Jante addon 80', base: wheel(15, 5) },
        { id: 'jante_addon_85', name: 'Jante addon 85', base: wheel(15, 5) },
        { id: 'jante_addon_98', name: 'Jante addon 98', base: wheel(15, 5) },
        { id: 'xenon_albastru', name: 'Xenon albastru', base: { Safir: 3, Plastic: 20, 'Cabluri x10': 4 } },
        { id: 'xenon_albastru_deschis', name: 'Xenon albastru deschis', base: { Safir: 2, Diamant: 1, Plastic: 20, 'Cabluri x10': 3 } },
        { id: 'xenon_verde', name: 'Xenon verde', base: { Emerald: 3, Plastic: 20, 'Cabluri x10': 3 } },
        { id: 'xenon_verde_deschis', name: 'Xenon verde deschis', base: { Emerald: 2, Diamant: 1, Plastic: 20, 'Cabluri x10': 4 } },
        { id: 'xenon_galben_deschis', name: 'Xenon galben deschis', base: { Rubin: 1, Emerald: 1, Diamant: 1, Plastic: 20, 'Cabluri x10': 4 } },
        { id: 'xenon_galben', name: 'Xenon galben', base: { Rubin: 2, Diamant: 1, Plastic: 20, 'Cabluri x10': 4 } },
        { id: 'xenon_portocaliu', name: 'Xenon portocaliu', base: { Rubin: 2, Diamant: 1, Plastic: 20, 'Cabluri x10': 4 } },
        { id: 'xenon_rosu', name: 'Xenon roșu', base: { Rubin: 3, Plastic: 20, 'Cabluri x10': 4 } },
        { id: 'xenon_roz_deschis', name: 'Xenon roz deschis', base: { Rubin: 1, Diamant: 2, Plastic: 20, 'Cabluri x10': 4 } },
        { id: 'xenon_roz', name: 'Xenon roz', base: { Rubin: 2, Diamant: 1, Plastic: 20, 'Cabluri x10': 4 } },
        { id: 'xenon_mov', name: 'Xenon mov', base: { Rubin: 2, Safir: 1, Plastic: 20, 'Cabluri x10': 4 } },
        { id: 'xenon_mov_deschis', name: 'Xenon mov deschis', base: { Rubin: 2, Safir: 1, Diamant: 1, Plastic: 20, 'Cabluri x10': 4 } },
        { id: 'turometru_tb_numeric', name: 'Turometru TB numeric', base: { 'Tabletă': 1, 'Cip nou': 30, 'Cabluri x10': 20, Diamant: 1 } },
        { id: 'turometru_gmc', name: 'Turometru GMC', base: { 'Tabletă': 1, 'Cip nou': 30, 'Cabluri x10': 20, Diamant: 1 } },
        { id: 'jante_addon_55', name: 'Jante addon 55', base: wheel(15, 5) },
        { id: 'jante_addon_56', name: 'Jante addon 56', base: wheel(15, 5, 30) },
        { id: 'jante_addon_57', name: 'Jante addon 57', base: wheel(15, 5, 30) },
        { id: 'jante_addon_58', name: 'Jante addon 58', base: wheel(15, 5) },
        { id: 'jante_addon_59', name: 'Jante addon 59', base: wheel(15, 5, 30) },
        { id: 'jante_addon_60', name: 'Jante addon 60', base: wheel(15, 5) },
        { id: 'jante_addon_61', name: 'Jante addon 61', base: wheel(15, 5, 30) },
        { id: 'jante_addon_62', name: 'Jante addon 62', base: wheel(15, 5) },
        { id: 'jante_addon_63', name: 'Jante addon 63', base: wheel(15, 5, 30) },
        { id: 'jante_addon_64', name: 'Jante addon 64', base: wheel(15, 5) },
        { id: 'jante_addon_65', name: 'Jante addon 65', base: wheel(20, 10, 30) },
        { id: 'jante_addon_66', name: 'Jante addon 66', base: wheel(20, 10) },
        { id: 'jante_addon_67', name: 'Jante addon 67', base: wheel(20, 10, 30) },
        { id: 'jante_addon_68', name: 'Jante addon 68', base: wheel(20, 10) },
        { id: 'jante_addon_69', name: 'Jante addon 69', base: wheel(20, 10, 30) },
        { id: 'jante_addon_70', name: 'Jante addon 70', base: wheel(20, 10) },
        { id: 'jante_addon_71', name: 'Jante addon 71', base: wheel(20, 10, 30) },
        { id: 'jante_addon_72', name: 'Jante addon 72', base: wheel(20, 10) },
        { id: 'jante_addon_92', name: 'Jante addon 92', base: wheel(15, 5, 30) },
        { id: 'set_roti', name: 'Set roți', base: { 'Set cauciucuri': 1, 'Set jante aluminiu': 1 } },
        { id: 'set_roti_runflat', name: 'Set roți runflat', base: { 'Set roți': 1, Oțel: 50 } },
        { id: 'jante_addon_79', name: 'Jante addon 79', base: wheel(20, 15, 40) },
        { id: 'jante_addon_96', name: 'Jante addon 96', base: wheel(20, 10) },
        { id: 'jante_addon_97', name: 'Jante addon 97', base: wheel(20, 15, 40) },
        { id: 'jante_addon_100', name: 'Jante addon 100', base: wheel(25, 15) },
        { id: 'jante_addon_101', name: 'Jante addon 101', base: wheel(25, 15) },
        { id: 'jante_addon_124', name: 'Jante addon 124', base: wheel(20, 15, 40) },
        { id: 'jante_addon_125', name: 'Jante addon 125', base: wheel(20, 15, 40) },
        { id: 'jante_addon_126', name: 'Jante addon 126', base: wheel(25, 15) },
        { id: 'jante_addon_191', name: 'Jante addon 191', base: wheel(20, 15, 40) }
    ];

    const imageById = Object.freeze({
        unelte_x10: '1.png',
        masa_crafting_mecanic: '2.png',
        limitator_viteza: '3.png',
        set_cauciucuri: '4.png',
        kit_reparat_avansat: '5.png',
        jante_addon_80: '6.png',
        jante_addon_85: '7.png',
        jante_addon_98: '8.png',
        xenon_albastru: '9.png',
        xenon_albastru_deschis: '10.png',
        xenon_verde: '11.png',
        xenon_verde_deschis: '12.png',
        xenon_galben_deschis: '13.png',
        xenon_galben: '14.png',
        xenon_portocaliu: '15.png',
        xenon_rosu: '16.png',
        xenon_roz_deschis: '17.png',
        xenon_roz: '18.png',
        xenon_mov: '19.png',
        xenon_mov_deschis: '20.png',
        turometru_tb_numeric: '21.png',
        turometru_gmc: '22.png',
        jante_addon_55: '23.png',
        jante_addon_56: '24.png',
        jante_addon_57: '25.png',
        jante_addon_58: '26.png',
        jante_addon_59: '27.png',
        jante_addon_60: '28.png',
        jante_addon_61: '29.png',
        jante_addon_62: '30.png',
        jante_addon_63: '31.png',
        jante_addon_64: '32.png',
        jante_addon_65: '33.png',
        jante_addon_66: '34.png',
        jante_addon_67: '35.png',
        jante_addon_68: '36.png',
        jante_addon_69: '37.png',
        jante_addon_70: '38.png',
        jante_addon_71: '39.png',
        jante_addon_72: '40.png',
        jante_addon_92: '41.png',
        set_roti: '42.png',
        set_roti_runflat: '43.png',
        jante_addon_79: '44.png',
        jante_addon_96: '45.png',
        jante_addon_97: '46.png',
        jante_addon_100: '47.png',
        jante_addon_101: '48.png',
        jante_addon_124: '49.png',
        jante_addon_125: '50.png',
        jante_addon_126: '51.png',
        jante_addon_191: '52.png'
    });

    const recipesWithImages = recipes.map(recipe => ({
        ...recipe,
        image: imageById[recipe.id] || null
    }));

    // Ingredientul apare în rețeta pentru „Set roți”, dar nu este o intrare
    // separată în lista cerută. Formula este preluată din calculatorul de
    // topitorie: 1 jantă de aluminiu = 10 aluminiu; setul conține 4 jante.
    const componentRecipes = [
        { id: 'set_jante_aluminiu', name: 'Set jante aluminiu', base: { Aluminiu: 40 }, componentOnly: true }
    ];

    window.PANEL_CRAFT_MECHANIC_RECIPES = Object.freeze([...recipesWithImages, ...componentRecipes]);
})();
