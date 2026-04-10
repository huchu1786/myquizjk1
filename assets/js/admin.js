import { escapeHTML } from './ui.js';
import { db, collection, query, orderBy, onSnapshot, updateDocument, addDocument, removeDocument } from './firebase-config.js';

let adminState = {
    activeTab: 'quizzes',
    users: [],
    categories: [],
    quizzes: [],
    content: []
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
                ${['quizzes', 'categories', 'content', 'users'].map(tab => `
                    <button onclick="window.adminSetTab('${tab}')" class="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all text-left group ${adminState.activeTab === tab ? 'bg-stone-900 text-white shadow-lg' : 'bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-900'}">
                        <i data-lucide="${getTabIcon(tab)}" class="w-5 h-5 ${adminState.activeTab === tab ? 'text-white' : 'text-stone-400 group-hover:text-stone-900'}"></i>
                        <span class="capitalize">${tab}</span>
                    </button>
                `).join('')}
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
    if (tab === 'quizzes') return 'book-open';
    if (tab === 'categories') return 'folder';
    if (tab === 'content') return 'file-text';
    if (tab === 'users') return 'users';
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
}

// Global expose
window.adminSetTab = (tab) => {
    adminState.activeTab = tab;
    // Re-render full view to update sidebar highlight
    renderAdminDisplay(document.getElementById('view-admin'), window.app.state);
};

function renderActiveTab() {
    const contentArea = document.getElementById('admin-content-area');
    if (!contentArea) return;

    if (adminState.activeTab === 'users') renderUsersTab(contentArea);
    else if (adminState.activeTab === 'categories') renderCategoriesTab(contentArea);
    else if (adminState.activeTab === 'content') renderContentTab(contentArea);
    else if (adminState.activeTab === 'quizzes') renderQuizzesTab(contentArea);
    
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
            <h2 class="text-2xl font-black text-stone-900 tracking-tight">Category Folders</h2>
        </div>
        
        <div class="flex flex-col gap-4 mb-8 p-4 bg-stone-50 border border-stone-200 rounded-2xl">
            <div class="flex gap-4">
                <input type="text" id="new-category-name" placeholder="New category name..." class="flex-1 p-4 bg-white border border-stone-200 rounded-2xl focus:border-stone-400 outline-none transition-all font-medium">
                <button onclick="window.adminAddCategory()" class="px-8 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-colors shrink-0">Add Custom Folder</button>
            </div>
            <div class="flex items-center gap-3 px-2">
                <input type="checkbox" id="new-category-premium" class="w-5 h-5 accent-stone-900 cursor-pointer">
                <label for="new-category-premium" class="font-bold text-stone-700 cursor-pointer">Lock this folder for ₹50</label>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${adminState.categories.map(c => `
                <div class="p-4 bg-white border border-stone-200 rounded-2xl flex items-center justify-between group shadow-sm">
                    <div class="flex items-center gap-3">
                        <i data-lucide="${c.isPremium ? 'lock' : 'folder'}" class="w-5 h-5 ${c.isPremium ? 'text-yellow-500' : 'text-stone-400'}"></i>
                        <span class="font-bold text-stone-700">${escapeHTML(c.name)}</span>
                        ${c.isPremium ? `<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-[10px] font-black uppercase tracking-widest rounded-lg">₹${c.price || 50}</span>` : ''}
                    </div>
                    <button onclick="window.adminDeleteCategory('${c.id}')" class="text-stone-300 hover:text-red-500 transition-colors p-2">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
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
