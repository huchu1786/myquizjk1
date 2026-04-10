import { escapeHTML } from './ui.js';
import { db, collection, doc, getDoc, query, orderBy, onSnapshot, updateDocument, addDocument, removeDocument } from './firebase-config.js';

let adminState = {
    activeTab: 'quizzes',
    users: [],
    categories: [],
    quizzes: [],
    content: [],
    payments: []
};

let unsubscribers = [];

export function renderAdminDisplay(container, appState) {
    const isUserAdmin = appState.profile?.role === 'admin' || appState.user?.email === 'huchu1786@gmail.com' || appState.user?.email === 'huchusim@gmail.com';
    if (!isUserAdmin) {
        container.innerHTML = `<div class="py-20 text-center text-red-500 font-bold text-xl">Access Denied</div>`;
        return;
    }

    container.innerHTML = `
        <div class="flex items-center gap-4 mb-10">
            <div class="w-16 h-16 bg-stone-900 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-stone-200">
                <i data-lucide="shield" class="w-8 h-8"></i>
            </div>
            <div>
                <h1 class="text-4xl font-black text-stone-900 tracking-tight">Admin Console</h1>
                <p class="text-stone-500 font-medium">Manage platform content and users</p>
            </div>
        </div>

        <div class="flex flex-col md:flex-row gap-8">
            <!-- Sidebar Navigation -->
            <div class="w-full md:w-64 space-y-2">
                ${['quizzes', 'categories', 'content', 'users', 'payments'].map(tab => {
                    const pendingCount = tab === 'payments' ? adminState.payments.filter(p => p.status === 'pending').length : 0;
                    return `
                    <button onclick="window.adminSetTab('${tab}')" class="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all text-left group ${adminState.activeTab === tab ? 'bg-stone-900 text-white shadow-lg' : 'bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-900'}">
                        <i data-lucide="${getTabIcon(tab)}" class="w-5 h-5 ${adminState.activeTab === tab ? 'text-white' : 'text-stone-400 group-hover:text-stone-900'}"></i>
                        <span class="capitalize flex-1">${tab}</span>
                        ${pendingCount > 0 ? `<span class="px-2 py-0.5 bg-red-500 text-white text-xs font-black rounded-full">${pendingCount}</span>` : ''}
                    </button>`;
                }).join('')}
            </div>

            <!-- Content Area -->
            <div class="flex-1 bg-white p-8 md:p-10 rounded-3xl border border-stone-200 shadow-xl min-h-[500px]" id="admin-content-area">
                <div class="flex justify-center items-center h-full">
                    <i data-lucide="loader-2" class="w-8 h-8 animate-spin text-stone-300"></i>
                </div>
            </div>
        </div>
    `;

    if(window.lucide) lucide.createIcons();

    // Start fetching data
    fetchAdminData();
}

function getTabIcon(tab) {
    if (tab === 'quizzes')    return 'book-open';
    if (tab === 'categories') return 'folder';
    if (tab === 'content')    return 'file-text';
    if (tab === 'users')      return 'users';
    if (tab === 'payments')   return 'credit-card';
    return 'circle';
}

function fetchAdminData() {
    unsubscribers.forEach(u => u());
    unsubscribers = [];

    // Fetch Users
    const uQ = query(collection(db, 'users'), orderBy('email'));
    unsubscribers.push(onSnapshot(uQ, snap => {
        adminState.users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (adminState.activeTab === 'users') renderActiveTab();
    }));

    // Fetch Categories
    const cQ = query(collection(db, 'categories'), orderBy('name'));
    unsubscribers.push(onSnapshot(cQ, snap => {
        adminState.categories = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (adminState.activeTab === 'categories') renderActiveTab();
    }));

    // Fetch Content
    const conQ = query(collection(db, 'content'), orderBy('createdAt', 'desc'));
    unsubscribers.push(onSnapshot(conQ, snap => {
        adminState.content = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (adminState.activeTab === 'content') renderActiveTab();
    }));

    // Fetch Quizzes
    const qQ = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
    unsubscribers.push(onSnapshot(qQ, snap => {
        adminState.quizzes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (adminState.activeTab === 'quizzes') renderActiveTab();
    }));

    // Fetch Payment Requests (real-time)
    const pQ = query(collection(db, 'payment_requests'), orderBy('createdAt', 'desc'));
    unsubscribers.push(onSnapshot(pQ, snap => {
        adminState.payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (adminState.activeTab === 'payments') renderActiveTab();
        // Only patch the sidebar badge — do NOT call renderAdminDisplay (causes infinite loop)
        updatePaymentBadge();
    }));
}

// Update only the payment badge in the sidebar without full re-render
function updatePaymentBadge() {
    const pending = adminState.payments.filter(p => p.status === 'pending').length;
    const paymentsBtn = document.querySelector('[onclick="window.adminSetTab(\'payments\')"]');
    if (!paymentsBtn) return;
    // Remove existing badge if any
    paymentsBtn.querySelector('.payment-badge-count')?.remove();
    if (pending > 0) {
        const badge = document.createElement('span');
        badge.className = 'payment-badge-count px-2 py-0.5 bg-red-500 text-white text-xs font-black rounded-full';
        badge.textContent = pending;
        paymentsBtn.appendChild(badge);
    }
}

// Global expose
window.adminSetTab = (tab) => {
    adminState.activeTab = tab;
    // Just update sidebar highlight classes + render the tab content (no full re-render)
    document.querySelectorAll('[onclick^="window.adminSetTab"]').forEach(btn => {
        const btnTab = btn.getAttribute('onclick').match(/'(\w+)'/)?.[1];
        const isActive = btnTab === tab;
        btn.className = btn.className
            .replace(/bg-stone-900 text-white shadow-lg|bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-900/g, '')
            .trim() + ' ' + (isActive
                ? 'bg-stone-900 text-white shadow-lg'
                : 'bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-900');
        const icon = btn.querySelector('i[data-lucide]');
        if (icon) {
            icon.className = `w-5 h-5 ${isActive ? 'text-white' : 'text-stone-400 group-hover:text-stone-900'}`;
        }
    });
    renderActiveTab();
};

function renderActiveTab() {
    const contentArea = document.getElementById('admin-content-area');
    if (!contentArea) return;

    if (adminState.activeTab === 'users')      renderUsersTab(contentArea);
    else if (adminState.activeTab === 'categories') renderCategoriesTab(contentArea);
    else if (adminState.activeTab === 'content')    renderContentTab(contentArea);
    else if (adminState.activeTab === 'quizzes')    renderQuizzesTab(contentArea);
    else if (adminState.activeTab === 'payments')   renderPaymentsTab(contentArea);
    
    if(window.lucide) lucide.createIcons();
}

// ============== TAB RENDERERS ==============

function renderUsersTab(container) {
    container.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <h2 class="text-2xl font-black text-stone-900 tracking-tight">Manage Users</h2>
            <span class="px-4 py-2 bg-stone-100 text-sm font-bold text-stone-600 rounded-full">${adminState.users.length} Users</span>
        </div>
        <div class="space-y-4">
            ${adminState.users.map(u => `
                <div class="flex flex-col md:flex-row md:items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-200 gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center overflow-hidden shrink-0">
                            ${u.photoURL ? `<img src="${escapeHTML(u.photoURL)}" class="w-full h-full object-cover">` : `<i data-lucide="user" class="text-stone-400"></i>`}
                        </div>
                        <div class="overflow-hidden">
                            <p class="font-bold text-stone-900 truncate">${escapeHTML(u.displayName || 'Unnamed User')}</p>
                            <p class="text-sm text-stone-500 truncate">${escapeHTML(u.email || '')}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-600'}">
                            ${u.role}
                        </span>
                        <select onchange="window.adminChangeRole('${u.id}', this.value)" class="p-2 border border-stone-200 rounded-lg text-sm bg-white font-medium">
                            <option value="user" ${u.role !== 'admin' ? 'selected' : ''}>Make User</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Make Admin</option>
                        </select>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderCategoriesTab(container) {
    container.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <div>
                <h2 class="text-2xl font-black text-stone-900 tracking-tight">Category Folders</h2>
                <p class="text-stone-500 text-sm font-medium mt-1">${adminState.categories.length} folder${adminState.categories.length !== 1 ? 's' : ''} &bull; Lock folders to charge users ₹50 for access</p>
            </div>
        </div>
        
        <!-- Add Folder Form -->
        <div class="flex flex-col gap-4 mb-8 p-5 bg-stone-50 border border-stone-200 rounded-2xl">
            <div class="flex gap-3">
                <input type="text" id="new-category-name" placeholder="New folder name..." 
                    class="flex-1 p-4 bg-white border border-stone-200 rounded-2xl focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none transition-all font-medium text-stone-800 placeholder:text-stone-400"
                    onkeydown="if(event.key==='Enter')window.adminAddCategory()">
                <button onclick="window.adminAddCategory()" 
                    class="px-7 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-700 active:scale-95 transition-all shrink-0 flex items-center gap-2">
                    <i data-lucide="folder-plus" class="w-4 h-4"></i> Add Folder
                </button>
            </div>
            <label class="flex items-center gap-3 px-2 cursor-pointer select-none group">
                <div class="relative">
                    <input type="checkbox" id="new-category-premium" class="sr-only peer">
                    <div class="w-10 h-6 bg-stone-200 peer-checked:bg-yellow-500 rounded-full transition-colors duration-200"></div>
                    <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 peer-checked:translate-x-4"></div>
                </div>
                <span class="font-bold text-stone-600 group-hover:text-stone-900 transition-colors flex items-center gap-2">
                    <i data-lucide="lock" class="w-4 h-4 text-yellow-500"></i>
                    Lock this folder (₹50 to unlock)
                </span>
            </label>
        </div>

        <!-- Category Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="categories-grid">
            ${adminState.categories.length === 0 ? `
                <div class="col-span-2 py-16 text-center border-2 border-dashed border-stone-200 rounded-2xl">
                    <i data-lucide="folder-open" class="w-12 h-12 text-stone-300 mx-auto mb-3"></i>
                    <p class="text-stone-400 font-bold">No folders yet</p>
                    <p class="text-stone-400 text-sm">Add your first category folder above</p>
                </div>
            ` : adminState.categories.map(c => `
                <div id="cat-card-${c.id}" 
                    class="cat-card group relative p-5 rounded-2xl border-2 flex items-center justify-between transition-all duration-300 
                        ${c.isPremium 
                            ? 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-yellow-100 shadow-md' 
                            : 'border-stone-200 bg-white shadow-sm hover:shadow-md hover:border-stone-300'}">
                    
                    <!-- Lock status indicator strip -->
                    <div class="absolute left-0 top-4 bottom-4 w-1 rounded-r-full transition-all duration-300 
                        ${c.isPremium ? 'bg-yellow-400' : 'bg-stone-200 group-hover:bg-stone-400'}"></div>

                    <div class="flex items-center gap-3 pl-3 overflow-hidden">
                        <!-- Folder icon -->
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300
                            ${c.isPremium ? 'bg-yellow-100' : 'bg-stone-100 group-hover:bg-stone-200'}">
                            <i data-lucide="${c.isPremium ? 'lock' : 'folder'}" 
                               class="w-5 h-5 transition-colors ${c.isPremium ? 'text-yellow-600' : 'text-stone-500'}"></i>
                        </div>
                        <div class="overflow-hidden">
                            <p class="font-bold text-stone-900 truncate">${escapeHTML(c.name)}</p>
                            <span class="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest 
                                ${c.isPremium ? 'bg-yellow-200 text-yellow-900' : 'bg-stone-100 text-stone-500'}">
                                ${c.isPremium ? `₹${c.price || 50} Premium` : 'Free Access'}
                            </span>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        <!-- Lock/Unlock Toggle -->
                        <button id="lock-btn-${c.id}"
                            onclick="window.adminToggleCategoryLock('${c.id}', ${!!c.isPremium})" 
                            aria-label="${c.isPremium ? 'Unlock folder' : 'Lock folder for ₹50'}"
                            aria-pressed="${!!c.isPremium}"
                            class="lock-toggle-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black 
                                   transition-all duration-200 active:scale-95
                                   ${c.isPremium 
                                       ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300 shadow-sm shadow-yellow-200' 
                                       : 'bg-stone-100 text-stone-600 hover:bg-stone-900 hover:text-white'}">
                            <i data-lucide="${c.isPremium ? 'lock-open' : 'lock'}" class="w-3.5 h-3.5"></i>
                            <span class="lock-btn-text">${c.isPremium ? 'Unlock' : 'Lock'}</span>
                        </button>
                        <!-- Delete -->
                        <button onclick="window.adminDeleteCategory('${c.id}')" 
                            aria-label="Delete folder"
                            class="p-2 rounded-xl text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200 active:scale-95">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderContentTab(container) {
    container.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <h2 class="text-2xl font-black text-stone-900 tracking-tight">Content Pages & Announcements</h2>
        </div>
        
        <div class="flex flex-col gap-4 mb-8 p-6 bg-stone-50 border border-stone-200 rounded-2xl">
            <h3 class="font-bold text-stone-900">Create New Content</h3>
            <div class="flex gap-4">
                <input type="text" id="new-content-title" placeholder="Title" class="flex-1 p-3 bg-white border border-stone-200 rounded-xl outline-none font-medium text-sm">
                <select id="new-content-type" class="p-3 bg-white border border-stone-200 rounded-xl outline-none font-medium text-sm w-40">
                    <option value="announcement">Announcement</option>
                    <option value="page">Custom Page</option>
                </select>
            </div>
            <textarea id="new-content-body" placeholder="Content Body... (Markdown not fully supported yet in vanilla)" rows="4" class="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none text-sm"></textarea>
            <div class="flex justify-end">
                <button onclick="window.adminCreateContent()" class="px-6 py-2 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors">Publish Content</button>
            </div>
        </div>

        <div class="space-y-4">
            ${adminState.content.map(c => `
                <div class="p-6 bg-white border border-stone-200 rounded-2xl flex flex-col gap-2">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center gap-3">
                            <span class="px-2 py-1 bg-stone-100 text-[10px] font-bold uppercase tracking-widest text-stone-500 rounded">${c.type}</span>
                            <span class="font-bold text-stone-900 text-lg">${escapeHTML(c.title)}</span>
                        </div>
                        <button onclick="window.adminDeleteContent('${c.id}')" class="text-stone-400 hover:text-red-500 transition-colors p-2 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                            <i data-lucide="trash-2" class="w-3 h-3"></i> Delete
                        </button>
                    </div>
                    <p class="text-stone-500 text-sm line-clamp-2">${escapeHTML(c.body)}</p>
                </div>
            `).join('')}
        </div>
    `;
}

function renderQuizzesTab(container) {
    container.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <h2 class="text-2xl font-black text-stone-900 tracking-tight">Quiz Library</h2>
            <div class="flex gap-2">
                <button onclick="window.app.navigate('import-quiz')" class="px-4 py-2 bg-white border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-colors shrink-0">Import</button>
                <button onclick="window.app.navigate('create-quiz')" class="px-4 py-2 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors shrink-0">+ New Quiz</button>
            </div>
        </div>
        
        <div class="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden bg-white">
            ${adminState.quizzes.length === 0 ? `<div class="p-8 text-center text-stone-500 font-medium">No quizzes created yet.</div>` : ''}
            ${adminState.quizzes.map(q => `
                <div class="flex items-center justify-between p-4 hover:bg-stone-50 transition-colors">
                    <div>
                        <h4 class="font-bold text-stone-900 line-clamp-1">${escapeHTML(q.title)}</h4>
                        <div class="flex items-center gap-3 mt-1">
                            <span class="text-xs text-stone-500 uppercase font-bold tracking-widest">${escapeHTML(q.category || 'General')}</span>
                            <span class="text-xs text-stone-400 font-medium">${q.questions?.length || 0} Questions</span>
                        </div>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="window.quizMasterEditQuiz('${q.id}')" class="p-2 text-stone-400 hover:text-stone-900 bg-white border border-stone-200 rounded-lg transition-colors"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                        <button onclick="window.quizMasterDeleteQuiz('${q.id}')" class="p-2 text-stone-400 hover:text-red-600 bg-white border border-stone-200 rounded-lg transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Expose admin actions
window.adminChangeRole = async (userId, newRole) => {
    try {
        await updateDocument('users', userId, { role: newRole });
    } catch(e) {
        console.error(e);
        alert('Error updating role');
    }
};

window.adminAddCategory = async () => {
    const input = document.getElementById('new-category-name');
    const isPremiumInput = document.getElementById('new-category-premium');
    const val = input.value.trim();
    if(!val) return;
    try {
        const data = { name: val, createdAt: new Date() };
        if (isPremiumInput && isPremiumInput.checked) {
            data.isPremium = true;
            data.price = 50;
        }
        await addDocument('categories', data);
        input.value = '';
        if(isPremiumInput) isPremiumInput.checked = false;
    } catch(e) {
        console.error(e);
        alert('Error adding category');
    }
}

window.adminDeleteCategory = async (id) => {
    if(confirm('Delete category?')) {
        await removeDocument('categories', id);
    }
}

window.adminToggleCategoryLock = async (id, currentlyLocked) => {
    const btn = document.getElementById(`lock-btn-${id}`);
    const card = document.getElementById(`cat-card-${id}`);
    if (!btn) return;

    // --- Optimistic UI: show spinner ---
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Saving...</span>`;
    if(window.lucide) lucide.createIcons();

    try {
        if (currentlyLocked) {
            await updateDocument('categories', id, { isPremium: false, price: 0 });
        } else {
            await updateDocument('categories', id, { isPremium: true, price: 50 });
        }
        // Success feedback — Firestore snapshot listener will re-render the card automatically
        btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>Saved!</span>`;
        btn.classList.add('bg-green-500', 'text-white');
        if(window.lucide) lucide.createIcons();
        // Let snapshot listener handle the full re-render (no need to re-render manually)
    } catch(e) {
        console.error('Lock toggle failed:', e);
        // --- Rollback UI ---
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        if(window.lucide) lucide.createIcons();

        // Show user-friendly error
        const isPermission = e?.code === 'permission-denied' || e?.message?.includes('permission');
        const msg = isPermission
            ? '⛔ Permission denied. Make sure you are logged in as an admin and your Firestore rules are deployed.'
            : `❌ Failed to update: ${e.message}`;

        // Flash error on the card
        if (card) {
            card.classList.add('border-red-300', 'bg-red-50');
            const errBadge = document.createElement('div');
            errBadge.className = 'absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-[10px] font-black rounded-lg z-10 animate-bounce';
            errBadge.textContent = 'Error!';
            card.appendChild(errBadge);
            setTimeout(() => {
                card.classList.remove('border-red-300', 'bg-red-50');
                errBadge.remove();
            }, 3000);
        }

        import('./ui.js').then(m => m.showToast(msg, 'error'));
    }
}

window.adminCreateContent = async () => {
    const title = document.getElementById('new-content-title').value.trim();
    const type = document.getElementById('new-content-type').value;
    const body = document.getElementById('new-content-body').value.trim();
    if(!title || !body) return alert("Title and Body are required.");
    try {
        await addDocument('content', {
            title, type, body,
            createdAt: new Date()
        });
        document.getElementById('new-content-title').value = '';
        document.getElementById('new-content-body').value = '';
    } catch(e) {
        console.error(e);
        alert('Error creating content');
    }
}

window.adminDeleteContent = async (id) => {
     if(confirm('Delete content?')) {
        await removeDocument('content', id);
    }
}

// ─── PAYMENTS TAB ─────────────────────────────────────────────────────────────

function renderPaymentsTab(container) {
    const pending   = adminState.payments.filter(p => p.status === 'pending');
    const approved  = adminState.payments.filter(p => p.status === 'approved');
    const rejected  = adminState.payments.filter(p => p.status === 'rejected');

    const paymentCard = (p) => {
        const date = p.createdAt?.toDate?.() ? p.createdAt.toDate().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'N/A';
        const statusColor = p.status === 'pending' ? 'bg-amber-100 text-amber-800' : p.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800';
        return `
            <div class="p-5 bg-white border-2 ${p.status === 'pending' ? 'border-amber-200' : p.status === 'approved' ? 'border-emerald-200' : 'border-red-100'} rounded-2xl flex flex-col gap-3 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <div class="overflow-hidden">
                        <p class="font-black text-stone-900 text-base truncate">${escapeHTML(p.categoryName || 'Unknown Folder')}</p>
                        <p class="text-stone-500 text-sm truncate">${escapeHTML(p.userEmail || p.userId || '')}</p>
                        <p class="text-stone-400 text-xs mt-0.5">${date}</p>
                    </div>
                    <span class="shrink-0 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${statusColor}">${p.status}</span>
                </div>
                <div class="flex items-center justify-between gap-3 bg-stone-50 rounded-xl p-3">
                    <div>
                        <p class="text-xs text-stone-500 font-bold uppercase tracking-widest mb-0.5">UTR Reference</p>
                        <p class="font-mono font-bold text-stone-800 text-sm">${escapeHTML(p.utr || '—')}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs text-stone-500 font-bold uppercase tracking-widest mb-0.5">Amount</p>
                        <p class="font-black text-indigo-600 text-lg">\u20b9${p.amount || 50}</p>
                    </div>
                </div>
                ${p.status === 'pending' ? `
                <div class="flex gap-2">
                    <button onclick="window.adminRejectPayment('${p.id}')"
                        class="flex-1 py-2.5 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all text-sm flex items-center justify-center gap-2">
                        <i data-lucide="x-circle" class="w-4 h-4"></i> Reject
                    </button>
                    <button onclick="window.adminApprovePayment('${p.id}', '${p.userId}', '${p.categoryId}')"
                        class="flex-2 flex-1 py-2.5 rounded-xl font-black text-white transition-all text-sm flex items-center justify-center gap-2"
                        style="background:linear-gradient(135deg,#10b981,#06b6d4); flex:2;">
                        <i data-lucide="check-circle" class="w-4 h-4"></i> Approve & Unlock
                    </button>
                </div>` : ''}
            </div>
        `;
    };

    container.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <div>
                <h2 class="text-2xl font-black text-stone-900 tracking-tight">Payment Requests</h2>
                <p class="text-stone-500 text-sm font-medium mt-1">
                    <span class="text-amber-600 font-bold">${pending.length} pending</span> &bull;
                    ${approved.length} approved &bull; ${rejected.length} rejected
                </p>
            </div>
            <div class="px-4 py-2 rounded-full text-sm font-bold" style="background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(16,185,129,0.1)); color:#92400e;">
                UPI: rmzshah-2@okicici
            </div>
        </div>

        ${adminState.payments.length === 0 ? `
            <div class="py-20 text-center border-2 border-dashed border-stone-200 rounded-2xl">
                <i data-lucide="credit-card" class="w-12 h-12 text-stone-300 mx-auto mb-3"></i>
                <p class="text-stone-400 font-bold">No payment requests yet</p>
                <p class="text-stone-400 text-sm">Requests will appear here when users pay to unlock folders</p>
            </div>
        ` : ''}

        ${pending.length > 0 ? `
        <div class="mb-8">
            <h3 class="text-sm font-black text-amber-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i data-lucide="clock" class="w-4 h-4"></i> Pending Approval (${pending.length})
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${pending.map(paymentCard).join('')}</div>
        </div>` : ''}

        ${approved.length > 0 ? `
        <div class="mb-8">
            <h3 class="text-sm font-black text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i data-lucide="check-circle" class="w-4 h-4"></i> Approved (${approved.length})
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${approved.map(paymentCard).join('')}</div>
        </div>` : ''}

        ${rejected.length > 0 ? `
        <div>
            <h3 class="text-sm font-black text-red-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i data-lucide="x-circle" class="w-4 h-4"></i> Rejected (${rejected.length})
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${rejected.map(paymentCard).join('')}</div>
        </div>` : ''}
    `;
}

window.adminApprovePayment = async (requestId, userId, categoryId) => {
    if (!confirm('Verify the UTR in your UPI app first, then click OK to unlock this folder for the user.')) return;
    try {
        // 1. Unlock the folder in the user's profile
        const userSnap = await getDoc(doc(db, 'users', userId));
        const currentUnlocked = userSnap.data()?.unlockedCategories || [];
        if (!currentUnlocked.includes(categoryId)) {
            await updateDocument('users', userId, {
                unlockedCategories: [...currentUnlocked, categoryId]
            });
        }
        // 2. Mark request as approved
        await updateDocument('payment_requests', requestId, {
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: window.app?.state?.user?.email || 'admin'
        });
        import('./ui.js').then(m => m.showToast('✅ Payment approved! Folder unlocked for the user.', 'success'));
    } catch(e) {
        console.error(e);
        import('./ui.js').then(m => m.showToast('❌ Error approving: ' + e.message, 'error'));
    }
};

window.adminRejectPayment = async (requestId) => {
    if (!confirm('Reject this payment request? The user will NOT get access.')) return;
    try {
        await updateDocument('payment_requests', requestId, { status: 'rejected' });
        import('./ui.js').then(m => m.showToast('Request rejected.', 'success'));
    } catch(e) {
        console.error(e);
        import('./ui.js').then(m => m.showToast('❌ Error: ' + e.message, 'error'));
    }
};
