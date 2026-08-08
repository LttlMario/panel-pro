// Configurația Supabase
const SUPABASE_URL = window.PANEL_SUPABASE_CONFIG.url;
const SUPABASE_KEY = window.PANEL_SUPABASE_CONFIG.publishableKey;

const supabaseClient = window.createPanelSupabaseClient();

document.addEventListener('DOMContentLoaded', async () => {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    let currentUser = JSON.parse(localStorage.getItem('workforce_user'));

    if (currentUser) {
        showApp(currentUser);
    } else {
        loginScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }

    loginBtn.addEventListener('click', async () => {
        try {
            let { data: users, error } = await supabaseClient
                .from('users')
                .select('*')
                .limit(1);

            if (error) throw error;

            if (users && users.length > 0) {
                currentUser = users[0];
            } else {
                throw new Error('Nu și-a găsit niciun utilizator în baza de date.');
            }

            localStorage.setItem('workforce_user', JSON.stringify(currentUser));
            showApp(currentUser);
        } catch (err) {
            console.error('Erore la conectare:', err);
            alert('Nu s-a putut prelua utilizatorul din baza de date. Verifică tabelul users.');
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('workforce_user');
        location.reload();
    });

    function showApp(user) {
        loginScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');

        document.getElementById('user-display-name').textContent = user.display_name || user.username || 'Utilizator';
        document.getElementById('user-role').textContent = user.role || 'Mecanic';
        document.getElementById('welcome-name').textContent = user.display_name || user.username || 'Mecanic';
        document.getElementById('card-role').textContent = user.role || 'Mecanic';
        document.getElementById('card-service').textContent = user.service || 'Nespecificat';

        if (user.avatar) {
            document.getElementById('user-avatar').src = user.avatar;
        }
    }
});
