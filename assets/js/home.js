import { db, collection, query, orderBy, onSnapshot } from './firebase-config.js';
import { escapeHTML } from './ui.js';

let quizzesUnsubscribe = null;
let categoriesUnsubscribe = null;
let announcementsUnsubscribe = null;

let localQuizzes = [];
let localCategories = [];
let localAnnouncements = [];

// Local state for the view
const viewState = {
    viewMode: 'topics', // 'topics' or 'grid'
    selectedCategory: 'All',
    selectedDifficulty: 'All',
    searchQuery: '',
    currentPage: 1,
    quizzesPerPage: 12
};

export function renderHome(container, appState) {
    // Initial skeleton
    container.innerHTML = `
        <!-- Hero Banner -->
        <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%); border-radius:24px; padding:36px 32px; margin-bottom:32px; position:relative; overflow:hidden;">
            <div style="position:absolute;top:-20px;right:-10px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.07);"></div>
            <div style="position:absolute;bottom:-30px;right:60px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.05);"></div>
            <p style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;">Welcome back</p>
            <h1 style="color:white;font-size:32px;font-weight:900;letter-spacing:-0.02em;margin-bottom:8px;">Hey, <span id="home-username" style="background:rgba(255,255,255,0.2);padding:2px 10px;border-radius:8px;">...</span>! &#127919;</h1>
            <p style="color:rgba(255,255,255,0.75);font-weight:600;">Ready to test your knowledge today?</p>
        </div>

        <!-- Mode Toggle -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
            <h2 style="font-size:20px;font-weight:900;color:#1e1b4b;letter-spacing:-0.01em;" id="home-section-title">&#128193; All Topics</h2>
            <div style="display:flex;background:rgba(99,102,241,0.07);padding:4px;border-radius:14px;gap:4px;">
                <button id="btn-mode-topics" style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;font-size:13px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:white;color:#6366f1;box-shadow:0 2px 8px rgba(99,102,241,0.15);">
                    &#128193; Topics
                </button>
                <button id="btn-mode-grid" style="display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:10px;font-size:13px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:transparent;color:#9ca3af;">
                    &#9783; All Quizzes
                </button>
            </div>
        </div>

        <div id="announcements-container" class="mb-8 hidden"></div>
        <div id="filters-container" class="hidden" style="margin-bottom:24px;"></div>
        
        <div id="home-content-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="col-span-full" style="display:flex;justify-content:center;padding:80px 0;">
                <div style="width:40px;height:40px;border:3px solid #6366f1;border-top-color:transparent;border-radius:50%;animation:spin-smooth 0.8s linear infinite;"></div>
            </div>
        </div>
        
        <div id="pagination-container" class="hidden" style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:40px;"></div>
    `;
    
    if(window.lucide) lucide.createIcons();

    // Populate user
    const firstName = escapeHTML(appState.profile?.displayName?.split(' ')[0] || appState.user.displayName?.split(' ')[0] || 'User');
    const uNameEl = document.getElementById('home-username');
    if (uNameEl) uNameEl.textContent = firstName;

    // Attach Mode toggles
    document.getElementById('btn-mode-topics')?.addEventListener('click', () => {
        viewState.viewMode = 'topics';
        viewState.selectedCategory = 'All';
        updateModeToggles();
        renderContent();
    });
    
    document.getElementById('btn-mode-grid')?.addEventListener('click', () => {
        viewState.viewMode = 'grid';
        updateModeToggles();
        renderContent();
    });

    // Start fetching data
    fetchData(appState);
}

function updateModeToggles() {
    const btnTopics = document.getElementById('btn-mode-topics');
    const btnGrid   = document.getElementById('btn-mode-grid');
    const title     = document.getElementById('home-section-title');
    if(!btnTopics || !btnGrid) return;

    const activeStyle   = 'background:white;color:#6366f1;box-shadow:0 2px 8px rgba(99,102,241,0.15);';
    const inactiveStyle = 'background:transparent;color:#9ca3af;box-shadow:none;';

    if (viewState.viewMode === 'topics' && viewState.selectedCategory === 'All') {
        btnTopics.setAttribute('style', btnTopics.getAttribute('style').replace(/background:[^;]+;color:[^;]+;box-shadow:[^;]+;/, '') + activeStyle);
        btnGrid.setAttribute('style',   btnGrid.getAttribute('style').replace(/background:[^;]+;color:[^;]+;box-shadow:[^;]+;/, '')   + inactiveStyle);
        if (title) title.textContent = '📁 All Topics';
    } else {
        btnGrid.setAttribute('style',   btnGrid.getAttribute('style').replace(/background:[^;]+;color:[^;]+;box-shadow:[^;]+;/, '')   + activeStyle);
        btnTopics.setAttribute('style', btnTopics.getAttribute('style').replace(/background:[^;]+;color:[^;]+;box-shadow:[^;]+;/, '') + inactiveStyle);
        if (title) title.textContent = viewState.selectedCategory !== 'All' ? `📂 ${viewState.selectedCategory}` : '📖 All Quizzes';
    }
}

function fetchData(appState) {
    if (quizzesUnsubscribe) quizzesUnsubscribe();
    if (categoriesUnsubscribe) categoriesUnsubscribe();
    if (announcementsUnsubscribe) announcementsUnsubscribe();

    // Fetch Announcements
    const qA = query(collection(db, 'content'), orderBy('createdAt', 'desc'));
    announcementsUnsubscribe = onSnapshot(qA, (snap) => {
        localAnnouncements = snap.docs.map(doc => ({id: doc.id, ...doc.data()})).filter(a => a.type === 'announcement');
        renderContent();
    });

    // Fetch Categories
    const qC = query(collection(db, 'categories'), orderBy('name', 'asc'));
    categoriesUnsubscribe = onSnapshot(qC, (snap) => {
        localCategories = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        renderContent(); // Might trigger re-render
    });

    // Fetch Quizzes
    const qQ = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
    quizzesUnsubscribe = onSnapshot(qQ, (snap) => {
        localQuizzes = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        renderContent();
    });
}

function renderContent() {
    const appState = window.app.state;
    const isAdmin = appState.profile?.role === 'admin';
    const unlockedCategories = appState.profile?.unlockedCategories || [];
    const contentGrid = document.getElementById('home-content-grid');
    const announcementsContainer = document.getElementById('announcements-container');
    const filtersContainer = document.getElementById('filters-container');
    const paginationContainer = document.getElementById('pagination-container');
    
    if (!contentGrid) return; // Unmounted

    // Gather Categories
    const quizCats = Array.from(new Set(localQuizzes.map(q => q.category).filter(Boolean)));
    const definedCats = localCategories.map(c => c.name);
    const allUniqueCats = Array.from(new Set([...definedCats, ...quizCats])).sort();
    const allCategoriesOptions = ['All', ...allUniqueCats];

    // Filter Logic
    let filteredQuizzes = localQuizzes.filter(q => {
        const catMatch = viewState.selectedCategory === 'All' || q.category === viewState.selectedCategory;
        const diffMatch = viewState.selectedDifficulty === 'All' || q.difficulty === viewState.selectedDifficulty;
        const searchMatch = q.title.toLowerCase().includes(viewState.searchQuery.toLowerCase()) || 
                          (q.description && q.description.toLowerCase().includes(viewState.searchQuery.toLowerCase()));
        return catMatch && diffMatch && searchMatch;
    });

    const totalPages = Math.ceil(filteredQuizzes.length / viewState.quizzesPerPage);
    if(viewState.currentPage > totalPages) viewState.currentPage = Math.max(1, totalPages);
    
    const startIndex = (viewState.currentPage - 1) * viewState.quizzesPerPage;
    const currentQuizzes = filteredQuizzes.slice(startIndex, startIndex + viewState.quizzesPerPage);

    // Layout
    if (viewState.viewMode === 'topics' && viewState.selectedCategory === 'All') {
        // TOPICS VIEW
        filtersContainer.classList.add('hidden');
        paginationContainer.classList.add('hidden');
        
        // Show announcements if any
        if (localAnnouncements.length > 0) {
            announcementsContainer.classList.remove('hidden');
            announcementsContainer.innerHTML = `
                <h2 style="font-size:16px;font-weight:900;color:#1e1b4b;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                    &#128227; Announcements
                </h2>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${localAnnouncements.map((a, i) => `
                        <div style="background:linear-gradient(135deg,rgba(99,102,241,0.05),rgba(139,92,246,0.08));border:1.5px solid rgba(99,102,241,0.15);border-radius:16px;padding:20px 24px;animation:fadeIn 0.4s ease ${i*0.08}s both;">
                            <h3 style="font-size:15px;font-weight:900;color:#1e1b4b;margin-bottom:6px;">${escapeHTML(a.title)}</h3>
                            <p style="color:#6b7280;font-size:13.5px;line-height:1.6;white-space:pre-wrap;">${escapeHTML(a.body)}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            announcementsContainer.classList.add('hidden');
        }

        // Color palette for topic cards (cycles)
        const CARD_PALETTES = [
            { bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)', emoji: '⚡', light: 'rgba(99,102,241,0.1)' },
            { bg: 'linear-gradient(135deg,#ec4899,#f43f5e)', emoji: '🔥', light: 'rgba(236,72,153,0.1)' },
            { bg: 'linear-gradient(135deg,#06b6d4,#6366f1)', emoji: '🌊', light: 'rgba(6,182,212,0.1)' },
            { bg: 'linear-gradient(135deg,#10b981,#06b6d4)', emoji: '🌿', light: 'rgba(16,185,129,0.1)' },
            { bg: 'linear-gradient(135deg,#f59e0b,#ef4444)', emoji: '🌟', light: 'rgba(245,158,11,0.1)' },
            { bg: 'linear-gradient(135deg,#8b5cf6,#ec4899)', emoji: '🎨', light: 'rgba(139,92,246,0.1)' },
        ];


        // Render Topics
        contentGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
        
        let topicsHTML = '';
        const topicsToShow = allCategoriesOptions.filter(c => c !== 'All');
        
        if (topicsToShow.length === 0) {
            topicsHTML = `
                <div class="col-span-full" style="padding:80px 0;text-align:center;border:2px dashed rgba(99,102,241,0.2);border-radius:24px;">
                    <div style="font-size:48px;margin-bottom:12px;">&#128193;</div>
                    <p style="color:#9ca3af;font-weight:700;font-size:15px;">No topics yet. Create your first quiz to get started!</p>
                </div>
            `;
        } else {
            topicsHTML = topicsToShow.map((cat, i) => {
                const count = localQuizzes.filter(q => q.category === cat).length;
                const catData = localCategories.find(c => c.name === cat);
                const isPremium = catData?.isPremium === true;
                const isUnlocked = !isPremium || isAdmin || unlockedCategories.includes(catData?.id);
                const price = catData?.price || 50;
                const palette = CARD_PALETTES[i % CARD_PALETTES.length];
                const delay = (i % 9) * 0.06;

                if (!isUnlocked) {
                    // LOCKED PREMIUM CARD
                    return `
                        <div onclick="window.quizMasterSelectCategory('${escapeHTML(cat)}')"
                             style="background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.06));border:2px solid rgba(245,158,11,0.3);border-radius:22px;padding:28px;cursor:pointer;position:relative;overflow:hidden;transition:transform 0.2s,box-shadow 0.2s;animation:fadeIn 0.4s ease ${delay}s both;"
                             onmouseover="this.style.transform='translateY(-6px)';this.style.boxShadow='0 16px 40px rgba(245,158,11,0.25)';"
                             onmouseout="this.style.transform='';this.style.boxShadow='';">
                            <!-- Lock watermark -->
                            <div style="position:absolute;bottom:-12px;right:-8px;font-size:80px;opacity:0.06;">&#128274;</div>
                            <!-- Premium badge -->
                            <div style="position:absolute;top:16px;right:16px;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;padding:3px 10px;border-radius:99px;">PREMIUM</div>
                            <!-- Icon -->
                            <div style="width:56px;height:56px;background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.12));border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:20px;">&#128274;</div>
                            <h3 style="font-size:20px;font-weight:900;color:#1e1b4b;margin-bottom:6px;letter-spacing:-0.01em;">${escapeHTML(cat)}</h3>
                            <p style="font-size:13px;color:#9ca3af;font-weight:600;margin-bottom:20px;">${count} ${count === 1 ? 'Quiz' : 'Quizzes'}</p>
                            <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:space-between;">
                                <span style="color:white;font-weight:900;font-size:14px;">Pay &#8377;${price} to Unlock</span>
                                <span style="color:white;font-size:18px;">&#128275;</span>
                            </div>
                        </div>
                    `;
                }

                // UNLOCKED CARD (colorful)
                const isJustUnlocked = isPremium && isUnlocked && !isAdmin;
                return `
                    <div onclick="window.quizMasterSelectCategory('${escapeHTML(cat)}')"
                         style="background:white;border:1.5px solid rgba(99,102,241,0.1);border-radius:22px;padding:28px;cursor:pointer;position:relative;overflow:hidden;transition:transform 0.2s,box-shadow 0.2s;animation:fadeIn 0.4s ease ${delay}s both;"
                         onmouseover="this.style.transform='translateY(-6px)';this.style.boxShadow='0 16px 40px rgba(99,102,241,0.15)',this.style.borderColor='rgba(99,102,241,0.3)';"
                         onmouseout="this.style.transform='';this.style.boxShadow='';this.style.borderColor='rgba(99,102,241,0.1)';">
                        <!-- Background watermark -->
                        <div style="position:absolute;bottom:-12px;right:-8px;font-size:80px;opacity:0.04;">${palette.emoji}</div>
                        <!-- Gradient icon -->
                        <div style="width:56px;height:56px;background:${palette.bg};border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:20px;box-shadow:0 4px 12px rgba(99,102,241,0.25);">${palette.emoji}</div>
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <h3 style="font-size:20px;font-weight:900;color:#1e1b4b;letter-spacing:-0.01em;">${escapeHTML(cat)}</h3>
                            ${isJustUnlocked ? '<span style="background:linear-gradient(135deg,#10b981,#06b6d4);color:white;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;padding:2px 8px;border-radius:99px;">Unlocked</span>' : ''}
                        </div>
                        <p style="font-size:13px;color:#9ca3af;font-weight:600;margin-bottom:20px;">${count} ${count === 1 ? 'Quiz' : 'Quizzes'}</p>
                        <div style="display:flex;align-items:center;justify-content:space-between;">
                            <span style="font-size:13px;font-weight:800;color:#6366f1;">Open Folder &#8594;</span>
                            <div style="width:32px;height:32px;background:${palette.light};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;">&#128193;</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        contentGrid.innerHTML = topicsHTML;
        
    } else {
        // GRID VIEW OR CATEGORY SELECTED
        announcementsContainer.classList.add('hidden');
        filtersContainer.classList.remove('hidden');
        contentGrid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
        
        // Render Filters
        let backBtnHTML = viewState.selectedCategory !== 'All' ? `
            <button onclick="window.quizMasterSelectCategory('All', true)"
                style="display:flex;align-items:center;gap:6px;background:transparent;border:none;font-weight:800;font-size:13px;color:#6366f1;cursor:pointer;padding:0;">
                &#8592; Back to Topics
            </button>
        ` : '';

        let selectOptionsHTML = allCategoriesOptions.map(cat =>
            `<option value="${escapeHTML(cat)}" ${viewState.selectedCategory === cat ? 'selected' : ''}>${cat === 'All' ? 'All Categories' : escapeHTML(cat)}</option>`
        ).join('');

        const DIFF_COLORS = { All: 'linear-gradient(135deg,#6366f1,#8b5cf6)', easy: 'linear-gradient(135deg,#10b981,#06b6d4)', medium: 'linear-gradient(135deg,#f59e0b,#ef4444)', hard: 'linear-gradient(135deg,#ef4444,#9f1239)' };

        let diffButtonsHTML = ['All', 'easy', 'medium', 'hard'].map(diff => `
            <button onclick="window.quizMasterSetDiff('${diff}')" 
                style="padding:7px 16px;border-radius:99px;font-size:12px;font-weight:800;text-transform:capitalize;cursor:pointer;border:none;transition:all 0.15s;
                ${viewState.selectedDifficulty === diff
                    ? `background:${DIFF_COLORS[diff]};color:white;box-shadow:0 2px 10px rgba(99,102,241,0.3);`
                    : 'background:white;color:#9ca3af;border:1.5px solid rgba(0,0,0,0.08);'}"
                onmouseover="if(this.style.color!=='white')this.style.borderColor='#6366f1';"
                onmouseout="if(this.style.color!=='white')this.style.borderColor='rgba(0,0,0,0.08)';">
                ${diff === 'easy' ? '&#128994;' : diff === 'medium' ? '&#128993;' : diff === 'hard' ? '&#128308;' : '&#9679;'} ${diff}
            </button>
        `).join('');

        filtersContainer.style.display = 'flex';
        filtersContainer.style.flexWrap = 'wrap';
        filtersContainer.style.gap = '10px';
        filtersContainer.style.alignItems = 'center';
        filtersContainer.innerHTML = `
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;flex:1;">
                ${backBtnHTML}
                <select onchange="window.quizMasterSelectCategory(this.value)"
                    style="padding:8px 16px;border-radius:99px;border:1.5px solid rgba(99,102,241,0.2);font-size:13px;font-weight:700;color:#1e1b4b;background:white;cursor:pointer;">
                    ${selectOptionsHTML}
                </select>
                <div style="display:flex;gap:6px;">${diffButtonsHTML}</div>
            </div>
            <div style="position:relative;">
                <input type="text" placeholder="&#128269; Search quizzes..." value="${escapeHTML(viewState.searchQuery)}" onkeyup="window.quizMasterSearch(this.value)"
                    style="padding:9px 18px;border-radius:99px;border:1.5px solid rgba(99,102,241,0.2);font-size:13px;font-weight:600;color:#1e1b4b;background:white;outline:none;width:220px;"
                    onfocus="this.style.borderColor='#6366f1';this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'"
                    onblur="this.style.borderColor='rgba(99,102,241,0.2)';this.style.boxShadow='none'">
            </div>
        `;

        // Render Quizzes
        const DIFF_STRIPE = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444', default: '#6366f1' };

        if (currentQuizzes.length === 0) {
            contentGrid.innerHTML = `
                <div class="col-span-full" style="padding:80px 0;text-align:center;border:2px dashed rgba(99,102,241,0.2);border-radius:24px;">
                    <div style="font-size:48px;margin-bottom:12px;">&#128269;</div>
                    <p style="color:#9ca3af;font-weight:700;font-size:15px;">No quizzes found. Try different filters!</p>
                </div>
            `;
            paginationContainer.classList.add('hidden');
        } else {
            let quizzesHTML = currentQuizzes.map((q, i) => {
                const diff = q.difficulty || 'medium';
                const stripe = DIFF_STRIPE[diff] || DIFF_STRIPE.default;
                const diffEmoji = diff === 'easy' ? '&#128994;' : diff === 'hard' ? '&#128308;' : '&#128993;';
                const delay = (i % 9) * 0.06;

                let adminControls = isAdmin ? `
                    <button onclick="event.stopPropagation();window.quizMasterEditQuiz('${q.id}')" title="Edit"
                        style="padding:6px;border:none;background:transparent;cursor:pointer;color:#9ca3af;border-radius:8px;transition:background 0.15s;"
                        onmouseover="this.style.background='rgba(99,102,241,0.1)';this.style.color='#6366f1';"
                        onmouseout="this.style.background='transparent';this.style.color='#9ca3af';">
                        &#9998;
                    </button>
                    <button onclick="event.stopPropagation();window.quizMasterDeleteQuiz('${q.id}')" title="Delete"
                        style="padding:6px;border:none;background:transparent;cursor:pointer;color:#9ca3af;border-radius:8px;transition:background 0.15s;"
                        onmouseover="this.style.background='rgba(239,68,68,0.1)';this.style.color='#ef4444';"
                        onmouseout="this.style.background='transparent';this.style.color='#9ca3af';">
                        &#128465;
                    </button>
                ` : '';

                return `
                    <div style="background:white;border-radius:20px;overflow:hidden;border:1.5px solid rgba(99,102,241,0.1);box-shadow:0 2px 8px rgba(0,0,0,0.04);transition:transform 0.2s,box-shadow 0.2s;animation:fadeIn 0.4s ease ${delay}s both;cursor:pointer;"
                         onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 32px rgba(99,102,241,0.15)';this.style.borderColor='rgba(99,102,241,0.25)';"
                         onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)';this.style.borderColor='rgba(99,102,241,0.1)';"
                         onclick="window.app.navigate('play-${q.id}')">
                        <!-- Difficulty Color Stripe -->
                        <div style="height:4px;background:${stripe};"></div>
                        <div style="padding:20px 22px;">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                                <div style="display:flex;gap:6px;">
                                    <span style="padding:4px 10px;background:rgba(99,102,241,0.08);color:#6366f1;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;border-radius:99px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHTML(q.category || 'General')}">${escapeHTML(q.category || 'General')}</span>
                                    <span style="padding:4px 10px;background:${stripe}18;color:${stripe};font-size:11px;font-weight:800;text-transform:capitalize;border-radius:99px;">${diffEmoji} ${diff}</span>
                                </div>
                                <div style="display:flex;gap:2px;align-items:center;">
                                    <button onclick="event.stopPropagation();window.quizMasterShare('${q.id}')" title="Share"
                                        style="padding:6px;border:none;background:transparent;cursor:pointer;color:#9ca3af;border-radius:8px;transition:background 0.15s;"
                                        onmouseover="this.style.background='rgba(99,102,241,0.1)';this.style.color='#6366f1';"
                                        onmouseout="this.style.background='transparent';this.style.color='#9ca3af';">
                                        &#10024;
                                    </button>
                                    ${adminControls}
                                </div>
                            </div>
                            <h3 style="font-size:16px;font-weight:900;color:#1e1b4b;margin-bottom:6px;letter-spacing:-0.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;" title="${escapeHTML(q.title)}">${escapeHTML(q.title)}</h3>
                            <p style="color:#9ca3af;font-size:13px;margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHTML(q.description || 'No description provided.')}</p>
                            <div style="display:flex;align-items:center;gap:12px;font-size:11px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;border-top:1.5px solid rgba(99,102,241,0.06);padding-top:14px;margin-bottom:14px;">
                                <span>&#128214; ${q.questionCount || 0} Questions</span>
                                ${q.duration ? `<span>&#9201; ${Math.floor(q.duration/60)}m</span>` : ''}
                            </div>
                            <button onclick="event.stopPropagation();window.app.navigate('play-${q.id}')"
                                style="width:100%;padding:12px;border-radius:12px;font-weight:900;font-size:13px;color:white;border:none;cursor:pointer;background:linear-gradient(135deg,#6366f1,#8b5cf6);transition:transform 0.15s,box-shadow 0.15s;"
                                onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 16px rgba(99,102,241,0.35)';"
                                onmouseout="this.style.transform='';this.style.boxShadow='';">
                                &#9654; Start Quiz
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            contentGrid.innerHTML = quizzesHTML;

            // Render Pagination
            if (totalPages > 1) {
                paginationContainer.classList.remove('hidden');
                paginationContainer.style.display = 'flex';
                paginationContainer.innerHTML = `
                    <button onclick="window.quizMasterSetPage(${viewState.currentPage - 1})"
                        style="padding:10px 16px;border-radius:12px;border:1.5px solid rgba(99,102,241,0.2);background:white;color:#6366f1;font-weight:800;cursor:pointer;transition:all 0.15s;${viewState.currentPage === 1 ? 'opacity:0.3;cursor:not-allowed;' : ''}"
                        ${viewState.currentPage === 1 ? 'disabled' : ''}>&#8592; Prev</button>
                    <span style="padding:10px 18px;font-weight:900;color:#1e1b4b;font-size:14px;">Page ${viewState.currentPage} of ${totalPages}</span>
                    <button onclick="window.quizMasterSetPage(${viewState.currentPage + 1})"
                        style="padding:10px 16px;border-radius:12px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;cursor:pointer;transition:all 0.15s;${viewState.currentPage === totalPages ? 'opacity:0.3;cursor:not-allowed;' : ''}"
                        ${viewState.currentPage === totalPages ? 'disabled' : ''}>Next &#8594;</button>
                `;
            } else {
                paginationContainer.classList.add('hidden');
            }
        }

    if(window.lucide) lucide.createIcons();


// Attach globals for inline event handlers
window.quizMasterSelectCategory = (cat, forceViewReset = false) => {
    // Check if this category is locked for the user
    const appState = window.app.state;
    const isAdmin = appState.profile?.role === 'admin';
    const unlockedCategories = appState.profile?.unlockedCategories || [];
    const catData = localCategories.find(c => c.name === cat);
    const isPremium = catData?.isPremium === true;
    const isUnlocked = !isPremium || isAdmin || unlockedCategories.includes(catData?.id);

    if (!isUnlocked && catData) {
        // Show payment modal
        import('./ui-modals.js').then(m => m.openPaymentModal(
            catData,
            appState.user.uid,
            appState.user.email || '',
            (result) => {
                if (result === 'pending') {
                    // Payment submitted, waiting for admin approval
                    import('./ui.js').then(ui => ui.showToast('Payment request submitted! Your folder will unlock once admin approves.', 'success'));
                }
            }
        ));
        return;
    }


    viewState.selectedCategory = cat;
    if (forceViewReset && cat === 'All') {
        viewState.viewMode = 'topics';
        updateModeToggles();
    }
    viewState.currentPage = 1;
    renderContent();
};

window.quizMasterSetDiff = (diff) => {
    viewState.selectedDifficulty = diff;
    viewState.currentPage = 1;
    renderContent();
};

window.quizMasterSearch = (query) => {
    viewState.searchQuery = query;
    viewState.currentPage = 1;
    renderContent();
};

window.quizMasterSetPage = (page) => {
    viewState.currentPage = page;
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.quizMasterShare = (id) => {
    const q = localQuizzes.find(x => x.id === id);
    if(q) {
        // Trigger share modal (will build shared modal UI util later, for now we will stub it)
        import('./ui-modals.js').then(m => m.openShareModal(q));
    }
};

window.quizMasterDeleteQuiz = (id) => {
    import('./ui-modals.js').then(m => m.openDeleteQuizModal(id));
};

window.quizMasterEditQuiz = (id) => {
    window.app.state.editingQuizId = id;
    window.app.navigate('admin-edit-quiz'); // Note: admin routing logic needs this
};
