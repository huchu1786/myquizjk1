import { escapeHTML, showToast } from './ui.js';
import { updateDocument } from './firebase-config.js';

export function renderProfile(container, appState) {
    if (!appState.profile) return;
    
    // We maintain some local state here
    window.profileState = {
        displayName: appState.profile.displayName || '',
        photoURL: appState.profile.photoURL || ''
    };

    const hasPhoto = !!window.profileState.photoURL;
    const photoContent = hasPhoto 
        ? `<img src="${escapeHTML(window.profileState.photoURL)}" alt="Avatar" class="w-full h-full object-cover" id="profile-preview-img" referrerpolicy="no-referrer">`
        : `<i data-lucide="user" class="w-16 h-16" id="profile-preview-icon"></i>`;

    container.innerHTML = `
        <h1 class="text-4xl font-black text-stone-900 mb-10 tracking-tight">My Profile</h1>
        
        <div class="bg-white p-10 rounded-3xl border border-stone-200 shadow-xl">
            <div class="flex flex-col items-center mb-10">
                <div class="relative group">
                    <div class="w-32 h-32 rounded-full bg-stone-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center text-stone-300" id="profile-image-container">
                        ${photoContent}
                    </div>
                    <label class="absolute bottom-0 right-0 w-10 h-10 bg-stone-900 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-stone-800 transition-colors shadow-lg">
                        <i data-lucide="camera" class="w-5 h-5"></i>
                        <input type="file" class="hidden" accept="image/*" id="profile-file-input">
                    </label>
                </div>
                <p class="mt-4 text-stone-400 text-sm font-medium">Click the camera icon to upload a new avatar</p>
            </div>

            <div class="space-y-6">
                <div>
                    <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Email Address</label>
                    <input type="text" value="${escapeHTML(appState.profile.email)}" disabled class="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-stone-500 cursor-not-allowed">
                    <p class="mt-1 text-[10px] text-stone-400 italic">Email cannot be changed.</p>
                </div>

                <div>
                    <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Display Name</label>
                    <input type="text" id="profile-display-name" value="${escapeHTML(window.profileState.displayName)}" placeholder="Enter your name" class="w-full p-4 bg-white border border-stone-200 rounded-2xl text-stone-900 focus:border-stone-900 transition-all outline-none">
                </div>

                <div id="profile-error" class="hidden p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 text-sm font-medium">
                    <i data-lucide="alert-circle" class="w-5 h-5"></i>
                    <span id="profile-error-text"></span>
                </div>

                <button id="profile-save-btn" class="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-2">
                    <span id="profile-save-spinner" class="hidden"><i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i></span>
                    <span id="profile-save-text">Save Changes</span>
                </button>
            </div>
        </div>
    `;

    if(window.lucide) lucide.createIcons();

    // Attach Handlers
    document.getElementById('profile-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit for base64 in Firestore
                const errDiv = document.getElementById('profile-error');
                document.getElementById('profile-error-text').textContent = "Image size must be less than 1MB";
                errDiv.classList.remove('hidden');
                return;
            }
            document.getElementById('profile-error').classList.add('hidden');
            
            const reader = new FileReader();
            reader.onloadend = () => {
                window.profileState.photoURL = reader.result;
                const container = document.getElementById('profile-image-container');
                container.innerHTML = `<img src="${reader.result}" alt="Avatar" class="w-full h-full object-cover">`;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('profile-save-btn')?.addEventListener('click', async (e) => {
        const dName = document.getElementById('profile-display-name').value.trim();
        window.profileState.displayName = dName;

        const btn = e.currentTarget;
        const spinner = document.getElementById('profile-save-spinner');
        const text = document.getElementById('profile-save-text');
        const errDiv = document.getElementById('profile-error');
        
        btn.disabled = true;
        btn.classList.add('opacity-50');
        spinner.classList.remove('hidden');
        text.textContent = 'Saving...';
        errDiv.classList.add('hidden');

        try {
            const updatedProfile = { 
                ...appState.profile, 
                displayName: dName, 
                photoURL: window.profileState.photoURL 
            };
            
            await updateDocument('users', appState.profile.uid, updatedProfile);
            
            // Sync local global state
            appState.profile = updatedProfile;
            
            // Re-render navbar to update avatar globally
            import('./ui.js').then(m => m.renderNavbar(appState, appState.pages));
            
            showToast('Profile updated successfully!', 'success');
        } catch (err) {
            errDiv.classList.remove('hidden');
            document.getElementById('profile-error-text').textContent = err.message || "Failed to update profile";
        } finally {
            btn.disabled = false;
            btn.classList.remove('opacity-50');
            spinner.classList.add('hidden');
            text.textContent = 'Save Changes';
        }
    });
}
