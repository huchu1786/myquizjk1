// ui.js - Centralizing general DOM helpers and UI widgets

export function showLoading(show = true) {
    const loader = document.getElementById('global-loader');
    if (loader) {
        if (show) {
            loader.classList.remove('hidden');
        } else {
            loader.classList.add('opacity-0');
            setTimeout(() => {
                loader.classList.add('hidden');
                loader.classList.remove('opacity-0');
            }, 300);
        }
    }
}

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    
    // Base styles
    toast.className = 'px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 transform transition-all duration-300 translate-y-4 opacity-0';
    
    // Type specific styles
    if (type === 'error') {
        toast.className += ' bg-red-50 border-red-200 text-red-700';
        toast.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4"></i> <span>${message}</span>`;
    } else if (type === 'success') {
        toast.className += ' bg-green-50 border-green-200 text-green-700';
        toast.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4"></i> <span>${message}</span>`;
    } else {
        toast.className += ' bg-stone-900 border-stone-800 text-white shadow-xl';
        toast.innerHTML = `<i data-lucide="info" class="w-4 h-4"></i> <span>${message}</span>`;
    }

    container.appendChild(toast);
    if(window.lucide) lucide.createIcons();

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
    });

    // Animate out and remove
    setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

export function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

export function renderNavbar(appState, pages = []) {
    const actionsContainer = document.getElementById('nav-actions');
    if (!actionsContainer) return;

    const { user, profile } = appState;

    if (!user) {
        actionsContainer.innerHTML = '';
        return;
    }

    let pagesHTML = pages.map(page => 
        `<button class="text-stone-600 hover:text-stone-900 font-medium transition-colors" onclick="window.app.navigate('page-${page.id}')">${escapeHTML(page.title)}</button>`
    ).join('');

    const isUserAdmin = profile?.role === 'admin' || user?.email === 'huchu1786@gmail.com' || user?.email === 'huchusim@gmail.com';
    let adminHTML = isUserAdmin ? `
        <button onclick="window.app.navigate('admin')" class="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-900 rounded-full font-medium hover:bg-stone-200 transition-colors">
            <i data-lucide="layout-dashboard" class="w-4 h-4"></i> Admin
        </button>
    ` : '';

    let photoHTML = (profile?.photoURL || user.photoURL) 
        ? `<img src="${escapeHTML(profile?.photoURL || user.photoURL)}" alt="Profile" class="w-8 h-8 rounded-full border border-stone-200 group-hover:border-stone-400 transition-all" referrerpolicy="no-referrer" />`
        : `<div class="w-8 h-8 rounded-full border border-stone-200 bg-stone-100 flex items-center justify-center group-hover:border-stone-400 transition-all">
                <i data-lucide="user" class="text-stone-400 w-4 h-4"></i>
           </div>`;

    let displayName = escapeHTML(profile?.displayName || user.displayName || 'User');

    actionsContainer.innerHTML = `
        <button onclick="window.app.navigate('quizzes')" class="hidden md:block text-stone-600 hover:text-stone-900 font-medium transition-colors">Quizzes</button>
        <button onclick="window.app.navigate('leaderboard')" class="hidden md:block text-stone-600 hover:text-stone-900 font-medium transition-colors">Leaderboard</button>
        <button onclick="window.app.navigate('results')" class="hidden md:block text-stone-600 hover:text-stone-900 font-medium transition-colors">My Results</button>
        
        <div class="hidden lg:flex items-center gap-4">
            ${pagesHTML}
        </div>
        
        ${adminHTML}
        
        <div class="flex items-center gap-3 pl-4 border-l border-stone-200">
            <button onclick="window.app.navigate('profile')" class="flex items-center gap-2 group">
                ${photoHTML}
                <span class="text-stone-600 group-hover:text-stone-900 font-medium text-sm hidden md:block">${displayName}</span>
            </button>
            <button onclick="window.app.auth.logout()" class="text-stone-500 hover:text-red-600 transition-colors ml-2" title="Sign Out">
                <i data-lucide="log-out" class="w-5 h-5"></i>
            </button>
        </div>
    `;

    if(window.lucide) lucide.createIcons();
}
