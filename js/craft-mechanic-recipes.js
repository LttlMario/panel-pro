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
        { id: 'kit_reparatii', name: 'Kit de reparații', base: { 'Unelte x10': 1, Cabluri: 1, 'Bujii x10': 1 } },
        { id: 'limitator_viteza', name: 'Limitator de viteză', base: { 'Cip vechi': 5, Plastic: 15 } },
        { id: 'set_cauciucuri', name: 'Set cauciucuri', base: { Cauciuc: 120 } },
        { id: 'kit_reparat_avansat', name: 'Kit de reparat avansat', base: { 'Unelte x10': 2, Cabluri: 2, 'Bujii x10': 2, Oțel: 1, Cauciuc: 1, Plastic: 1 } },
        { id: 'jante_addon_80', name: 'Jante addon 80', base: wheel(15, 5) },
        { id: 'jante_addon_85', name: 'Jante addon 85', base: wheel(15, 5) },
        { id: 'jante_addon_98', name: 'Jante addon 98', base: wheel(15, 5) },
        { id: 'xenon_albastru', name: 'Xenon albastru', base: { Safir: 3, Plastic: 20, Cabluri: 4 } },
        { id: 'xenon_albastru_deschis', name: 'Xenon albastru deschis', base: { Safir: 2, Diamant: 1, Plastic: 20, Cabluri: 3 } },
        { id: 'xenon_verde', name: 'Xenon verde', base: { Emerald: 3, Plastic: 20, Cabluri: 3 } },
        { id: 'xenon_verde_deschis', name: 'Xenon verde deschis', base: { Emerald: 2, Diamant: 1, Plastic: 20, Cabluri: 4 } },
        { id: 'xenon_galben_deschis', name: 'Xenon galben deschis', base: { Rubin: 1, Emerald: 1, Diamant: 1, Plastic: 20, Cabluri: 4 } },
        { id: 'xenon_galben', name: 'Xenon galben', base: { Rubin: 2, Diamant: 1, Plastic: 20, Cabluri: 4 } },
        { id: 'xenon_portocaliu', name: 'Xenon portocaliu', base: { Rubin: 2, Diamant: 1, Plastic: 20, Cabluri: 4 } },
        { id: 'xenon_rosu', name: 'Xenon roșu', base: { Rubin: 3, Plastic: 20, Cabluri: 4 } },
        { id: 'xenon_roz_deschis', name: 'Xenon roz deschis', base: { Rubin: 1, Diamant: 2, Plastic: 20, Cabluri: 4 } },
        { id: 'xenon_roz', name: 'Xenon roz', base: { Rubin: 2, Diamant: 1, Plastic: 20, Cabluri: 4 } },
        { id: 'xenon_mov', name: 'Xenon mov', base: { Rubin: 2, Safir: 1, Plastic: 20, Cabluri: 4 } },
        { id: 'xenon_mov_deschis', name: 'Xenon mov deschis', base: { Rubin: 2, Safir: 1, Diamant: 1, Plastic: 20, Cabluri: 4 } },
        { id: 'turometru_tb_numeric', name: 'Turometru TB numeric', base: { 'Tabletă': 1, 'Cip nou': 30, Cabluri: 20, Diamant: 1 } },
        { id: 'turometru_gmc', name: 'Turometru GMC', base: { 'Tabletă': 1, 'Cip nou': 30, Cabluri: 20, Diamant: 1 } },
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

    // Ingredientul apare în rețeta pentru „Set roți”, dar nu este o intrare
    // separată în lista cerută. Formula este preluată din calculatorul de
    // topitorie: 1 jantă de aluminiu = 10 aluminiu; setul conține 4 jante.
    const componentRecipes = [
        { id: 'set_jante_aluminiu', name: 'Set jante aluminiu', base: { Aluminiu: 40 }, componentOnly: true }
    ];

    window.PANEL_CRAFT_MECHANIC_RECIPES = Object.freeze([...recipes, ...componentRecipes]);
})();
