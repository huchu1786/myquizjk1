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
        <div class="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
                <h1 class="text-4xl font-black text-stone-900 tracking-tight">Welcome back, <span id="home-username">...</span>!</h1>
                <p class="text-stone-500 mt-1 font-medium">Ready to test your skills today?</p>
            </div>
            <div class="flex bg-stone-100 p-1 rounded-2xl">
                <button id="btn-mode-topics" class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all bg-white text-stone-900 shadow-sm">
                    <i data-lucide="folder" class="w-4 h-4"></i> Topics
                </button>
                <button id="btn-mode-grid" class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all text-stone-500 hover:text-stone-700">
                    <i data-lucide="grid" class="w-4 h-4"></i> All Quizzes
                </button>
            </div>
        </div>
        
        <div id="announcements-container" class="mb-12 space-y-4 hidden"></div>
        <div id="filters-container" class="hidden flex-col md:flex-row gap-4 pb-8 items-start md:items-center justify-between"></div>
        
        <div id="home-content-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Loading state -->
            <div class="col-span-full flex justify-center py-20">
                <i data-lucide="loader-2" class="w-8 h-8 animate-spin text-stone-400"></i>
            </div>
        </div>
        
        <div id="pagination-container" class="flex justify-center items-center gap-4 mt-12 hidden"></div>
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
    const btnGrid = document.getElementById('btn-mode-grid');
    if(!btnTopics || !btnGrid) return;
    
    if (viewState.viewMode === 'topics') {
        btnTopics.className = "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all bg-white text-stone-900 shadow-sm";
        btnGrid.className = "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all text-stone-500 hover:text-stone-700";
    } else {
        btnGrid.className = "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all bg-white text-stone-900 shadow-sm";
        btnTopics.className = "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all text-stone-500 hover:text-stone-700";
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
                <h2 class="text-2xl font-black text-stone-900 tracking-tight">Announcements</h2>
                <div class="grid gap-4">
                    ${localAnnouncements.map(a => `
                        <div class="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
                            <h3 class="text-lg font-bold text-blue-900 mb-2">${escapeHTML(a.title)}</h3>
                            <p class="text-blue-800 whitespace-pre-wrap">${escapeHTML(a.body)}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            announcementsContainer.classList.add('hidden');
        }

        // Render Topics
        contentGrid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8";
        
        let topicsHTML = '';
        const topicsToShow = allCategoriesOptions.filter(c => c !== 'All');
        
        if (topicsToShow.length === 0) {
            topicsHTML = `
                <div class="col-span-full py-20 text-center border-2 border-dashed border-stone-200 rounded-3xl">
                    <p class="text-stone-400 font-medium">No topics found. Create your first quiz to see topics here!</p>
                </div>
            `;
        } else {
            topicsHTML = topicsToShow.map(cat => {
                const count = localQuizzes.filter(q => q.category === cat).length;
                const catData = localCategories.find(c => c.name === cat);
                const isPremium = catData?.isPremium === true;
                const isUnlocked = !isPremium || isAdmin || unlockedCategories.includes(catData?.id);
                const price = catData?.price || 50;

                if (!isUnlocked) {
                    // LOCKED CARD
                    return `
                        <div onclick="window.quizMasterSelectCategory('${escapeHTML(cat)}')" class="bg-white p-8 rounded-3xl border-2 border-yellow-200 shadow-sm hover:shadow-xl hover:border-yellow-400 transition-all cursor-pointer group relative overflow-hidden transform hover:-translate-y-1 hover:scale-[1.02]">
                            <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <i data-lucide="lock" class="w-20 h-20 text-yellow-500"></i>
                            </div>
                            <div class="w-14 h-14 bg-yellow-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-yellow-200 transition-colors">
                                <i data-lucide="lock" class="w-7 h-7 text-yellow-600"></i>
                            </div>
                            <div class="flex items-center gap-3 mb-2">
                                <h3 class="text-2xl font-black text-stone-900 tracking-tight capitalize">${escapeHTML(cat)}</h3>
                                <span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-[10px] font-black uppercase tracking-widest rounded-lg">₹${price}</span>
                            </div>
                            <p class="text-stone-500 font-medium">${count} ${count === 1 ? 'Quiz' : 'Quizzes'}</p>
                            <div class="mt-6 flex items-center gap-2 text-yellow-700 font-bold text-sm">
                                Pay ₹${price} to Unlock <i data-lucide="chevron-right" class="w-4 h-4"></i>
                            </div>
                        </div>
                    `;
                }

                // UNLOCKED CARD
                const isJustUnlocked = isPremium && isUnlocked && !isAdmin;
                return `
                    <div onclick="window.quizMasterSelectCategory('${escapeHTML(cat)}')" class="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm hover:shadow-xl hover:border-stone-300 transition-all cursor-pointer group relative overflow-hidden transform hover:-translate-y-1 hover:scale-[1.02]">
                        <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <i data-lucide="folder" class="w-20 h-20"></i>
                        </div>
                        <div class="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                            <i data-lucide="folder" class="w-7 h-7"></i>
                        </div>
                        <div class="flex items-center gap-3 mb-2">
                            <h3 class="text-2xl font-black text-stone-900 tracking-tight capitalize">${escapeHTML(cat)}</h3>
                            ${isJustUnlocked ? '<span class="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-lg">Unlocked</span>' : ''}
                        </div>
                        <p class="text-stone-500 font-medium">${count} ${count === 1 ? 'Quiz' : 'Quizzes'}</p>
                        <div class="mt-6 flex items-center gap-2 text-stone-900 font-bold text-sm">
                            Open Folder <i data-lucide="chevron-right" class="w-4 h-4"></i>
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
            <button onclick="window.quizMasterSelectCategory('All', true)" class="flex items-center gap-2 text-stone-500 hover:text-stone-900 font-bold text-sm transition-colors">
                <i data-lucide="chevron-left" class="w-4 h-4"></i> Back to Topics
            </button>
        ` : '';

        let selectOptionsHTML = allCategoriesOptions.map(cat => 
            `<option value="${escapeHTML(cat)}" ${viewState.selectedCategory === cat ? 'selected' : ''}>${cat === 'All' ? 'All Categories' : escapeHTML(cat)}</option>`
        ).join('');

        let diffButtonsHTML = ['All', 'easy', 'medium', 'hard'].map(diff => `
            <button onclick="window.quizMasterSetDiff('${diff}')" class="px-6 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap capitalize ${viewState.selectedDifficulty === diff ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' : 'bg-white text-stone-500 border border-stone-200 hover:border-stone-400'}">
                ${diff}
            </button>
        `).join('');

        filtersContainer.innerHTML = `
            <div class="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                ${backBtnHTML}
                <select onchange="window.quizMasterSelectCategory(this.value)" class="px-6 py-2 rounded-full text-sm font-bold transition-all bg-white text-stone-700 border border-stone-200 hover:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 shadow-sm appearance-none">
                    ${selectOptionsHTML}
                </select>
                <div class="flex gap-2 border-l border-stone-200 pl-4">
                    ${diffButtonsHTML}
                </div>
            </div>
            <div class="w-full md:w-64 relative">
                <input type="text" placeholder="Search quizzes..." value="${escapeHTML(viewState.searchQuery)}" onkeyup="window.quizMasterSearch(this.value)" class="w-full px-4 py-2 rounded-full border border-stone-200 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400 transition-all text-sm"/>
            </div>
        `;

        // Render Quizzes
        if (currentQuizzes.length === 0) {
            contentGrid.innerHTML = `
                <div class="col-span-full py-20 text-center border-2 border-dashed border-stone-200 rounded-3xl">
                    <p class="text-stone-400 font-medium">No quizzes found matching criteria.</p>
                </div>
            `;
            paginationContainer.classList.add('hidden');
        } else {
            let quizzesHTML = currentQuizzes.map(q => {
                let badgeClass = 'bg-blue-100 text-blue-600';
                if (q.difficulty === 'easy') badgeClass = 'bg-green-100 text-green-600';
                if (q.difficulty === 'hard') badgeClass = 'bg-red-100 text-red-600';
                
                let adminControls = isAdmin ? `
                    <button onclick="window.quizMasterEditQuiz('${q.id}')" class="p-2 text-stone-400 hover:text-stone-900 transition-colors"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="window.quizMasterDeleteQuiz('${q.id}')" class="p-2 text-stone-400 hover:text-red-600 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                ` : '';

                let durationHTML = q.duration ? `
                    <div class="flex items-center gap-1"><i data-lucide="clock" class="w-3.5 h-3.5"></i> ${Math.floor(q.duration / 60)}m</div>
                ` : '';

                return `
                    <div class="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all group animate-in">
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex gap-2">
                                <span class="px-3 py-1 bg-stone-100 text-stone-600 text-xs font-bold uppercase tracking-wider rounded-full truncate max-w-[100px]" title="${escapeHTML(q.category || 'General')}">${escapeHTML(q.category || 'General')}</span>
                                <span class="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${badgeClass}">${escapeHTML(q.difficulty || 'Medium')}</span>
                            </div>
                            <div class="flex gap-1">
                                <button onclick="window.quizMasterShare('${q.id}')" class="p-2 text-stone-400 hover:text-stone-900 transition-colors"><i data-lucide="share-2" class="w-4 h-4"></i></button>
                                ${adminControls}
                            </div>
                        </div>
                        <h3 class="text-xl font-bold text-stone-900 mb-2 line-clamp-2" title="${escapeHTML(q.title)}">${escapeHTML(q.title)}</h3>
                        <p class="text-stone-500 text-sm mb-4 line-clamp-2">${escapeHTML(q.description || 'No description provided.')}</p>
                        
                        <div class="flex items-center gap-4 text-stone-400 text-xs font-bold uppercase tracking-widest mb-6 border-t border-stone-100 pt-4">
                            <div class="flex items-center gap-1">
                                <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
                                ${q.questionCount || 0} Qs
                            </div>
                            ${durationHTML}
                        </div>

                        <button onclick="window.app.navigate('play-${q.id}')" class="w-full py-3 bg-stone-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors group-hover:translate-y-[-2px]">
                            Start Quiz
                            <i data-lucide="chevron-right" class="w-4 h-4"></i>
                        </button>
                    </div>
                `;
            }).join('');
            
            contentGrid.innerHTML = quizzesHTML;

            // Render Pagination
            if (totalPages > 1) {
                paginationContainer.classList.remove('hidden');
                paginationContainer.innerHTML = `
                    <button onclick="window.quizMasterSetPage(${viewState.currentPage - 1})" class="p-2 rounded-full border border-stone-200 text-stone-500 hover:bg-stone-100 disabled:opacity-30 transition-colors" ${viewState.currentPage === 1 ? 'disabled' : ''}>
                        <i data-lucide="chevron-left" class="w-5 h-5"></i>
                    </button>
                    <span class="text-sm font-bold text-stone-500">Page ${viewState.currentPage} of ${totalPages}</span>
                    <button onclick="window.quizMasterSetPage(${viewState.currentPage + 1})" class="p-2 rounded-full border border-stone-200 text-stone-500 hover:bg-stone-100 disabled:opacity-30 transition-colors" ${viewState.currentPage === totalPages ? 'disabled' : ''}>
                        <i data-lucide="chevron-right" class="w-5 h-5"></i>
                    </button>
                `;
            } else {
                paginationContainer.classList.add('hidden');
            }
        }
    }
    
    if(window.lucide) lucide.createIcons();
}

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
