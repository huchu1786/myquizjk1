import { initAuth, logout } from './auth.js';
import { showLoading, renderNavbar } from './ui.js';
import { db, collection, query, where, orderBy, onSnapshot } from './firebase-config.js';

// Global App State
const state = {
    user: null,
    profile: null,
    currentView: 'loading',
    pages: [] // CMS stored pages
};

// Map views to DOM section IDs
const viewMap = {
    'landing': 'view-landing',
    'home': 'view-home',
    'quizzes': 'view-home', // Reuse same view logic
    'play': 'view-play', // prefix play-id
    'leaderboard': 'view-leaderboard',
    'results': 'view-results',
    'review': 'view-review',
    'profile': 'view-profile',
    'admin': 'view-admin',
    'create-quiz': 'view-admin',
    'admin-edit-quiz': 'view-admin',
    'import-quiz': 'view-admin',
    'page': 'view-page' // prefix page-id
};

// Make app logic accessible from HTML elements
window.app = {
    state,
    navigate: (viewName) => setView(viewName),
    auth: { logout }
};

// Initialize App
function bootstrap() {
    // Create initial lucide icons
    if(window.lucide) lucide.createIcons();

    // Check for deep links
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('quizId');
    if (quizId) {
        // Deep link active, we should try to render play view after auth
        state.initialDeepLink = `play-${quizId}`;
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    initAuth((user, profile) => {
        state.user = user;
        state.profile = profile;
        
        if (user) {
            setupGlobalListeners();
            if (state.initialDeepLink) {
                setView(state.initialDeepLink);
                state.initialDeepLink = null;
            } else if (state.currentView === 'landing' || state.currentView === 'loading') {
                setView('home');
            } else {
                // Re-render current view with auth
                setView(state.currentView);
            }
        } else {
            // Unauthenticated state
            setView('landing');
        }
        
        renderNavbar(state, state.pages);
        
        // Hide initial global loader after first auth response
        setTimeout(() => showLoading(false), 500);
    });
}

// Global data listeners (Pages)
let pagesUnsubscribe = null;
function setupGlobalListeners() {
    if (pagesUnsubscribe) pagesUnsubscribe();
    
    if (state.user) {
        const q = query(collection(db, 'content'), where('type', '==', 'page'), orderBy('createdAt', 'desc'));
        pagesUnsubscribe = onSnapshot(q, (snapshot) => {
            state.pages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderNavbar(state, state.pages);
            
            // If we are currently viewing a page, tell that view to update
            if (state.currentView.startsWith('page-')) {
                // trigger page re-render
                import('./pages.js').then(m => m.renderPage(state.currentView.replace('page-', '')));
            }
        });
    }
}

// View Router
function setView(viewTarget) {
    const prevView = state.currentView;
    state.currentView = viewTarget;
    
    // Hide all view sections gracefully
    document.querySelectorAll('.view-section').forEach(el => {
        if (!el.classList.contains('hidden')) {
            el.classList.add('opacity-0', 'translate-y-4');
            setTimeout(() => {
                el.classList.add('hidden');
            }, 300); // matches duration-300
        }
    });

    let targetElId = viewMap[viewTarget];
    
    // Check prefixes for parameterized views
    if (viewTarget.startsWith('play-')) {
        targetElId = viewMap['play'];
    } else if (viewTarget.startsWith('page-')) {
        targetElId = viewMap['page'];
    }
    
    const targetEl = document.getElementById(targetElId);
    
    setTimeout(() => {
        if (targetEl) {
            targetEl.classList.remove('hidden');
            if (viewTarget !== 'landing') {
                targetEl.innerHTML = ''; // Clear out before rendering (optional, depends on logic, good to have it controlled by modules)
            }
            
            // Render logic based on view
            renderViewLogic(viewTarget, targetEl);
            
            // In the next frame, trigger css transitions
            requestAnimationFrame(() => {
                targetEl.classList.remove('opacity-0', 'translate-y-4');
            });
        }
    }, 300);
}

// Delegate rendering logic to respective modules
function renderViewLogic(viewTarget, container) {
    // Dynamically loading modules so everything isn't loaded upfront
    
    if (viewTarget === 'home' || viewTarget === 'quizzes') {
        // Render Home
        import('./home.js').then(m => m.renderHome(container, state));
    } 
    else if (viewTarget.startsWith('play-')) {
        const quizId = viewTarget.replace('play-', '');
        import('./quiz-player.js').then(m => m.renderQuizPlayer(container, quizId, state));
    }
    else if (viewTarget === 'leaderboard') {
        import('./leaderboard.js').then(m => m.renderLeaderboard(container, state));
    }
    else if (viewTarget === 'results') {
        import('./results.js').then(m => m.renderResultHistory(container, state));
    }
    else if (viewTarget === 'profile') {
        import('./profile.js').then(m => m.renderProfile(container, state));
    }
    else if (viewTarget === 'admin') {
        import('./admin.js').then(m => m.renderAdminDisplay(container, state));
    }
    else if (viewTarget === 'create-quiz') {
        import('./quiz-editor.js').then(m => m.renderQuizEditor(container, null, state));
    }
    else if (viewTarget === 'admin-edit-quiz') {
        // Relies on state.editingQuizId being set before navigation
        import('./quiz-editor.js').then(m => m.renderQuizEditor(container, state.editingQuizId, state));
    }
    else if (viewTarget === 'import-quiz') {
        import('./quiz-importer.js').then(m => m.renderQuizImporter(container, state));
    }
    else if (viewTarget === 'landing') {
        // handled in HTML directly, no JS needed
    }
    else {
        // Fallback for not-yet-implemented views
        container.innerHTML = `<div class="py-20 text-center"><h2 class="text-2xl font-bold">View: ${viewTarget}</h2><p class="text-stone-500">Working on this right now!</p></div>`;
    }
    
    if(window.lucide) {
        setTimeout(() => lucide.createIcons(), 50); // Small delay to let DOM paint first
    }
}

// Run app
document.addEventListener('DOMContentLoaded', bootstrap);
