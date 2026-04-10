import { db, collection, query, orderBy, onSnapshot } from './firebase-config.js';
import { escapeHTML } from './ui.js';

let quizzesUnsubscribe = null;
let categoriesUnsubscribe = null;
let announcementsUnsubscribe = null;

let localQuizzes = [];
let localCategories = [];
let localAnnouncements = [];

const viewState = {
    viewMode: 'topics',
    selectedCategory: 'All',
    selectedDifficulty: 'All',
    searchQuery: '',
    currentPage: 1,
    quizzesPerPage: 12
};

// Card gradient palettes
const PALETTES = [
    { bg: '#6366f1,#8b5cf6', emoji: '⚡' },
    { bg: '#ec4899,#f43f5e', emoji: '🔥' },
    { bg: '#06b6d4,#6366f1', emoji: '🌊' },
    { bg: '#10b981,#06b6d4', emoji: '🌿' },
    { bg: '#f59e0b,#ef4444', emoji: '🌟' },
    { bg: '#8b5cf6,#ec4899', emoji: '🎨' },
];

export function renderHome(container, appState) {
    const firstName = escapeHTML(
        appState.profile?.displayName?.split(' ')[0] ||
        appState.user?.displayName?.split(' ')[0] ||
        'User'
    );

    container.innerHTML = `
        <style>
            .qm-hero { background: linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899); border-radius: 20px; padding: 32px; margin-bottom: 28px; position: relative; overflow: hidden; }
            .qm-hero::before { content:''; position:absolute; top:-30px; right:-20px; width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,0.07); }
            .qm-hero::after  { content:''; position:absolute; bottom:-40px; right:80px; width:120px; height:120px; border-radius:50%; background:rgba(255,255,255,0.05); }
            .qm-card { background:white; border:1.5px solid rgba(99,102,241,0.12); border-radius:18px; padding:24px; cursor:pointer; transition:transform 0.18s ease, box-shadow 0.18s ease; }
            .qm-card:hover { transform:translateY(-5px); box-shadow:0 12px 32px rgba(99,102,241,0.18); border-color:rgba(99,102,241,0.28); }
            .qm-locked { background:linear-gradient(135deg,rgba(245,158,11,0.07),rgba(239,68,68,0.05)); border:2px solid rgba(245,158,11,0.3); }
            .qm-locked:hover { box-shadow:0 12px 32px rgba(245,158,11,0.22); border-color: rgba(245,158,11,0.5); }
            .qm-icon { width:52px; height:52px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:22px; margin-bottom:16px; }
            .qm-btn { width:100%; padding:11px; border-radius:12px; font-weight:800; font-size:13px; color:white; border:none; cursor:pointer; background:linear-gradient(135deg,#6366f1,#8b5cf6); transition:transform 0.15s, box-shadow 0.15s; }
            .qm-btn:hover { transform:translateY(-1px); box-shadow:0 4px 14px rgba(99,102,241,0.35); }
            .qm-mode-toggle { display:flex; background:rgba(99,102,241,0.07); padding:4px; border-radius:12px; gap:4px; }
            .qm-mode-btn { padding:8px 18px; border-radius:9px; font-size:13px; font-weight:800; border:none; cursor:pointer; transition:all 0.15s; }
            .qm-mode-active { background:white; color:#6366f1; box-shadow:0 2px 8px rgba(99,102,241,0.15); }
            .qm-mode-inactive { background:transparent; color:#9ca3af; }
            .qm-pill { padding:4px 10px; border-radius:99px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; }
            .qm-quiz-card { background:white; border-radius:18px; overflow:hidden; border:1.5px solid rgba(99,102,241,0.1); transition:transform 0.18s ease, box-shadow 0.18s ease; cursor:pointer; }
            .qm-quiz-card:hover { transform:translateY(-4px); box-shadow:0 12px 32px rgba(99,102,241,0.15); border-color:rgba(99,102,241,0.25); }
        </style>

        <!-- Hero -->
        <div class="qm-hero">
            <p style="color:rgba(255,255,255,0.7);font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;">Welcome back</p>
            <h1 style="color:white;font-size:28px;font-weight:900;margin-bottom:6px;">Hey, ${firstName}! 🎯</h1>
            <p style="color:rgba(255,255,255,0.75);font-weight:600;font-size:14px;">Ready to test your knowledge today?</p>
        </div>

        <!-- Header row -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
            <h2 id="qm-section-title" style="font-size:18px;font-weight:900;color:#1e1b4b;">📁 All Topics</h2>
            <div class="qm-mode-toggle">
                <button id="btn-topics" class="qm-mode-btn qm-mode-active">📁 Topics</button>
                <button id="btn-grid"   class="qm-mode-btn qm-mode-inactive">📖 All Quizzes</button>
            </div>
        </div>

        <div id="qm-announcements" style="margin-bottom:20px;display:none;"></div>
        <div id="qm-filters"       style="margin-bottom:20px;display:none;flex-wrap:wrap;gap:10px;align-items:center;"></div>

        <div id="qm-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;">
            <div style="grid-column:1/-1;display:flex;justify-content:center;padding:60px 0;">
                <div style="width:36px;height:36px;border:3px solid #6366f1;border-top-color:transparent;border-radius:50%;animation:spin-smooth 0.8s linear infinite;"></div>
            </div>
        </div>

        <div id="qm-pagination" style="display:none;justify-content:center;align-items:center;gap:12px;margin-top:36px;"></div>
    `;

    // Bind toggles
    document.getElementById('btn-topics').addEventListener('click', () => {
        viewState.viewMode = 'topics';
        viewState.selectedCategory = 'All';
        updateToggle();
        renderContent();
    });
    document.getElementById('btn-grid').addEventListener('click', () => {
        viewState.viewMode = 'grid';
        updateToggle();
        renderContent();
    });

    fetchData(appState);
}

function updateToggle() {
    const btnT = document.getElementById('btn-topics');
    const btnG = document.getElementById('btn-grid');
    const title = document.getElementById('qm-section-title');
    if (!btnT || !btnG) return;
    const isTopics = viewState.viewMode === 'topics' && viewState.selectedCategory === 'All';
    btnT.className = 'qm-mode-btn ' + (isTopics ? 'qm-mode-active' : 'qm-mode-inactive');
    btnG.className = 'qm-mode-btn ' + (!isTopics ? 'qm-mode-active' : 'qm-mode-inactive');
    if (title) {
        if (isTopics) title.textContent = '📁 All Topics';
        else if (viewState.selectedCategory !== 'All') title.textContent = '📂 ' + viewState.selectedCategory;
        else title.textContent = '📖 All Quizzes';
    }
}

function fetchData(appState) {
    if (quizzesUnsubscribe)     quizzesUnsubscribe();
    if (categoriesUnsubscribe)  categoriesUnsubscribe();
    if (announcementsUnsubscribe) announcementsUnsubscribe();

    const qA = query(collection(db, 'content'), orderBy('createdAt', 'desc'));
    announcementsUnsubscribe = onSnapshot(qA, snap => {
        localAnnouncements = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.type === 'announcement');
        renderContent();
    });

    const qC = query(collection(db, 'categories'), orderBy('name', 'asc'));
    categoriesUnsubscribe = onSnapshot(qC, snap => {
        localCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderContent();
    });

    const qQ = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
    quizzesUnsubscribe = onSnapshot(qQ, snap => {
        localQuizzes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderContent();
    });
}

function renderContent() {
    const appState = window.app.state;
    const isAdmin = appState.profile?.role === 'admin';
    const unlocked = appState.profile?.unlockedCategories || [];

    const grid   = document.getElementById('qm-grid');
    const ann    = document.getElementById('qm-announcements');
    const fil    = document.getElementById('qm-filters');
    const pag    = document.getElementById('qm-pagination');
    if (!grid) return;

    // Build category list
    const catNames = localCategories.map(c => c.name);
    const quizCats  = localQuizzes.map(q => q.category).filter(Boolean);
    const allCats   = Array.from(new Set([...catNames, ...quizCats])).sort();

    // ── TOPICS VIEW ──────────────────────────────────────────────
    if (viewState.viewMode === 'topics' && viewState.selectedCategory === 'All') {
        fil.style.display = 'none';
        pag.style.display = 'none';
        updateToggle();

        // Announcements
        if (localAnnouncements.length > 0) {
            ann.style.display = 'block';
            ann.innerHTML = localAnnouncements.map(a => `
                <div style="background:linear-gradient(135deg,rgba(99,102,241,0.05),rgba(139,92,246,0.08));border:1.5px solid rgba(99,102,241,0.15);border-radius:14px;padding:18px 20px;margin-bottom:10px;">
                    <p style="font-weight:900;color:#1e1b4b;margin-bottom:4px;font-size:14px;">📢 ${escapeHTML(a.title)}</p>
                    <p style="color:#6b7280;font-size:13px;white-space:pre-wrap;">${escapeHTML(a.body)}</p>
                </div>
            `).join('');
        } else {
            ann.style.display = 'none';
        }

        if (allCats.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:80px 0;border:2px dashed rgba(99,102,241,0.2);border-radius:20px;">
                    <div style="font-size:40px;margin-bottom:12px;">📁</div>
                    <p style="color:#9ca3af;font-weight:700;">No topics yet. Quizzes will appear here once added.</p>
                </div>`;
            return;
        }

        grid.innerHTML = allCats.map((cat, i) => {
            const catData  = localCategories.find(c => c.name === cat);
            const count    = localQuizzes.filter(q => q.category === cat).length;
            const isPremium = catData?.isPremium === true;
            const isUnlocked = !isPremium || isAdmin || unlocked.includes(catData?.id);
            const price    = catData?.price || 50;
            const pal      = PALETTES[i % PALETTES.length];

            if (!isUnlocked) {
                return `
                    <div class="qm-card qm-locked" onclick="window.quizMasterSelectCategory('${escapeHTML(cat)}')">
                        <div style="position:absolute;right:12px;top:12px;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;padding:2px 8px;border-radius:99px;">PREMIUM</div>
                        <div class="qm-icon" style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.1));">🔒</div>
                        <h3 style="font-size:18px;font-weight:900;color:#1e1b4b;margin-bottom:4px;">${escapeHTML(cat)}</h3>
                        <p style="color:#9ca3af;font-size:13px;font-weight:600;margin-bottom:16px;">${count} Quiz${count !== 1 ? 'zes' : ''}</p>
                        <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:11px;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:white;font-weight:900;font-size:13px;">Pay ₹${price} to Unlock</span>
                            <span style="color:white;font-size:16px;">🔑</span>
                        </div>
                    </div>`;
            }

            const badge = isPremium && !isAdmin ? '<span style="background:linear-gradient(135deg,#10b981,#06b6d4);color:white;font-size:9px;font-weight:900;text-transform:uppercase;padding:2px 7px;border-radius:99px;margin-left:6px;">✓ Unlocked</span>' : '';
            return `
                <div class="qm-card" onclick="window.quizMasterSelectCategory('${escapeHTML(cat)}')">
                    <div class="qm-icon" style="background:linear-gradient(135deg,${pal.bg});">${pal.emoji}</div>
                    <div style="display:flex;align-items:center;margin-bottom:4px;">
                        <h3 style="font-size:18px;font-weight:900;color:#1e1b4b;">${escapeHTML(cat)}</h3>${badge}
                    </div>
                    <p style="color:#9ca3af;font-size:13px;font-weight:600;margin-bottom:16px;">${count} Quiz${count !== 1 ? 'zes' : ''}</p>
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                        <span style="font-size:13px;font-weight:800;color:#6366f1;">Open Folder →</span>
                        <div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.08);border-radius:50%;font-size:14px;">📁</div>
                    </div>
                </div>`;
        }).join('');

        if (window.lucide) lucide.createIcons();
        return;
    }

    // ── GRID / CATEGORY VIEW ─────────────────────────────────────
    ann.style.display = 'none';
    fil.style.display = 'flex';
    updateToggle();

    // Filter quizzes
    let filtered = localQuizzes.filter(q => {
        const catOK  = viewState.selectedCategory === 'All' || q.category === viewState.selectedCategory;
        const diffOK = viewState.selectedDifficulty === 'All' || q.difficulty === viewState.selectedDifficulty;
        const srchOK = !viewState.searchQuery ||
            q.title.toLowerCase().includes(viewState.searchQuery.toLowerCase()) ||
            (q.description || '').toLowerCase().includes(viewState.searchQuery.toLowerCase());
        return catOK && diffOK && srchOK;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / viewState.quizzesPerPage));
    if (viewState.currentPage > totalPages) viewState.currentPage = 1;
    const pageQuizzes = filtered.slice(
        (viewState.currentPage - 1) * viewState.quizzesPerPage,
        viewState.currentPage * viewState.quizzesPerPage
    );

    const allOptsHTML = ['All', ...allCats].map(c =>
        `<option value="${escapeHTML(c)}" ${viewState.selectedCategory === c ? 'selected' : ''}>${c === 'All' ? 'All Categories' : escapeHTML(c)}</option>`
    ).join('');

    const DIFF_GRAD = { All: '#6366f1,#8b5cf6', easy: '#10b981,#06b6d4', medium: '#f59e0b,#ef4444', hard: '#ef4444,#9f1239' };
    const diffHTML = ['All', 'easy', 'medium', 'hard'].map(d => {
        const active = viewState.selectedDifficulty === d;
        return `<button onclick="window.quizMasterSetDiff('${d}')" style="padding:6px 14px;border-radius:99px;font-size:11px;font-weight:800;text-transform:capitalize;border:none;cursor:pointer;${active ? `background:linear-gradient(135deg,${DIFF_GRAD[d]});color:white;box-shadow:0 2px 8px rgba(99,102,241,0.25);` : 'background:white;color:#9ca3af;border:1.5px solid rgba(0,0,0,0.08);'}">${d}</button>`;
    }).join('');

    const backHTML = viewState.selectedCategory !== 'All'
        ? `<button onclick="window.quizMasterSelectCategory('All',true)" style="border:none;background:transparent;font-weight:800;font-size:13px;color:#6366f1;cursor:pointer;">← Back to Topics</button>`
        : '';

    fil.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:1;">
            ${backHTML}
            <select onchange="window.quizMasterSelectCategory(this.value)" style="padding:7px 14px;border-radius:99px;border:1.5px solid rgba(99,102,241,0.2);font-size:13px;font-weight:700;color:#1e1b4b;background:white;cursor:pointer;">${allOptsHTML}</select>
            <div style="display:flex;gap:6px;">${diffHTML}</div>
        </div>
        <input type="text" placeholder="🔍 Search..." value="${escapeHTML(viewState.searchQuery)}" onkeyup="window.quizMasterSearch(this.value)"
            style="padding:8px 16px;border-radius:99px;border:1.5px solid rgba(99,102,241,0.2);font-size:13px;font-weight:600;color:#1e1b4b;background:white;outline:none;width:200px;"
            onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='rgba(99,102,241,0.2)'">
    `;

    if (pageQuizzes.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:80px 0;border:2px dashed rgba(99,102,241,0.2);border-radius:20px;">
                <div style="font-size:40px;margin-bottom:12px;">🔍</div>
                <p style="color:#9ca3af;font-weight:700;">No quizzes found. Try different filters!</p>
            </div>`;
        pag.style.display = 'none';
    } else {
        const STRIPE = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' };
        grid.innerHTML = pageQuizzes.map(q => {
            const diff = q.difficulty || 'medium';
            const stripe = STRIPE[diff] || '#6366f1';
            const diffEmoji = diff === 'easy' ? '🟢' : diff === 'hard' ? '🔴' : '🟡';
            const adminCtrl = isAdmin ? `
                <button onclick="event.stopPropagation();window.quizMasterEditQuiz('${q.id}')" title="Edit" style="border:none;background:none;cursor:pointer;color:#9ca3af;font-size:15px;padding:4px;">✏️</button>
                <button onclick="event.stopPropagation();window.quizMasterDeleteQuiz('${q.id}')" title="Delete" style="border:none;background:none;cursor:pointer;color:#9ca3af;font-size:15px;padding:4px;">🗑️</button>` : '';

            return `
                <div class="qm-quiz-card" onclick="window.app.navigate('play-${q.id}')">
                    <div style="height:4px;background:${stripe};"></div>
                    <div style="padding:18px 20px;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                <span class="qm-pill" style="background:rgba(99,102,241,0.08);color:#6366f1;">${escapeHTML(q.category || 'General')}</span>
                                <span class="qm-pill" style="background:${stripe}18;color:${stripe};">${diffEmoji} ${diff}</span>
                            </div>
                            <div style="display:flex;gap:2px;">
                                <button onclick="event.stopPropagation();window.quizMasterShare('${q.id}')" title="Share" style="border:none;background:none;cursor:pointer;color:#9ca3af;font-size:15px;padding:4px;">✨</button>
                                ${adminCtrl}
                            </div>
                        </div>
                        <h3 style="font-size:15px;font-weight:900;color:#1e1b4b;margin-bottom:6px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHTML(q.title)}</h3>
                        <p style="color:#9ca3af;font-size:12px;margin-bottom:14px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHTML(q.description || 'No description.')}</p>
                        <div style="font-size:11px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid rgba(99,102,241,0.07);padding-top:12px;margin-bottom:12px;display:flex;gap:12px;">
                            <span>📚 ${q.questionCount || 0} Qs</span>
                            ${q.duration ? `<span>⏱ ${Math.floor(q.duration / 60)}m</span>` : ''}
                        </div>
                        <button onclick="event.stopPropagation();window.app.navigate('play-${q.id}')" class="qm-btn">▶ Start Quiz</button>
                    </div>
                </div>`;
        }).join('');

        if (totalPages > 1) {
            pag.style.display = 'flex';
            pag.innerHTML = `
                <button onclick="window.quizMasterSetPage(${viewState.currentPage - 1})" ${viewState.currentPage === 1 ? 'disabled' : ''} style="padding:9px 18px;border-radius:11px;border:1.5px solid rgba(99,102,241,0.2);background:white;color:#6366f1;font-weight:800;cursor:pointer;opacity:${viewState.currentPage === 1 ? 0.4 : 1};">← Prev</button>
                <span style="padding:9px 16px;font-weight:900;color:#1e1b4b;font-size:14px;">Page ${viewState.currentPage} / ${totalPages}</span>
                <button onclick="window.quizMasterSetPage(${viewState.currentPage + 1})" ${viewState.currentPage === totalPages ? 'disabled' : ''} style="padding:9px 18px;border-radius:11px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;cursor:pointer;opacity:${viewState.currentPage === totalPages ? 0.4 : 1};">Next →</button>`;
        } else {
            pag.style.display = 'none';
        }
    }

    if (window.lucide) lucide.createIcons();
}

// ── Global handlers ───────────────────────────────────────────────────────────

window.quizMasterSelectCategory = (cat, forceReset = false) => {
    const appState = window.app.state;
    const isAdmin  = appState.profile?.role === 'admin';
    const unlocked = appState.profile?.unlockedCategories || [];
    const catData  = localCategories.find(c => c.name === cat);
    const isPremium = catData?.isPremium === true;
    const isUnlocked = !isPremium || isAdmin || unlocked.includes(catData?.id);

    if (!isUnlocked && catData) {
        import('./ui-modals.js').then(m => m.openPaymentModal(
            catData,
            appState.user.uid,
            appState.user.email || '',
            result => {
                if (result === 'pending') {
                    import('./ui.js').then(ui => ui.showToast('Payment submitted! Admin will verify and unlock your folder.', 'success'));
                }
            }
        ));
        return;
    }

    if (forceReset && cat === 'All') {
        viewState.viewMode = 'topics';
    } else if (cat !== 'All') {
        viewState.viewMode = 'grid';
    }
    viewState.selectedCategory = cat;
    viewState.currentPage = 1;
    renderContent();
};

window.quizMasterSetDiff = diff => {
    viewState.selectedDifficulty = diff;
    viewState.currentPage = 1;
    renderContent();
};

window.quizMasterSearch = q => {
    viewState.searchQuery = q;
    viewState.currentPage = 1;
    renderContent();
};

window.quizMasterSetPage = page => {
    viewState.currentPage = page;
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.quizMasterShare = id => {
    const q = localQuizzes.find(x => x.id === id);
    if (q) import('./ui-modals.js').then(m => m.openShareModal(q));
};

window.quizMasterDeleteQuiz = id => {
    import('./ui-modals.js').then(m => m.openDeleteQuizModal(id));
};

window.quizMasterEditQuiz = id => {
    window.app.state.editingQuizId = id;
    window.app.navigate('admin-edit-quiz');
};
