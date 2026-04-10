import { escapeHTML } from './ui.js';
import { db, removeDocument, query, collection, where, getDocs, writeBatch, doc, updateDoc } from './firebase-config.js';
import { showToast } from './ui.js';

export function openShareModal(quiz) {
    const container = document.getElementById('share-modal-container');
    if (!container) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?quizId=${quiz.id}`;
    const encodedUrl = encodeURIComponent(shareUrl);
    const title = encodeURIComponent(quiz.title);

    container.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl transform transition-all scale-95 opacity-0" id="share-modal-content">
            <div class="flex justify-between items-start mb-6">
                <h2 class="text-2xl font-black text-stone-900 tracking-tight">Share Quiz</h2>
                <button id="close-share-modal" class="text-stone-400 hover:text-stone-900 transition-colors">
                    <i data-lucide="x-circle" class="w-6 h-6"></i>
                </button>
            </div>
            
            <p class="text-stone-500 mb-6 font-medium">Share "${escapeHTML(quiz.title)}" with your friends and colleagues.</p>
            
            <div class="flex items-center gap-2 p-3 bg-stone-50 rounded-2xl border border-stone-200 mb-8">
                <input 
                    readonly 
                    value="${shareUrl}" 
                    class="bg-transparent flex-1 text-sm font-mono text-stone-600 outline-none truncate"
                />
                <button id="copy-share-url" class="p-2 rounded-xl transition-all bg-stone-900 text-white hover:bg-stone-800">
                    <i data-lucide="copy" class="w-4 h-4"></i>
                </button>
            </div>

            <div class="grid grid-cols-3 gap-4">
                <a href="https://twitter.com/intent/tweet?text=Check out this quiz: ${title}&url=${encodedUrl}" target="_blank" class="flex flex-col items-center gap-2 p-4 rounded-2xl text-white font-bold text-xs transition-transform hover:scale-105 bg-[#1DA1F2]">
                    Twitter
                </a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" class="flex flex-col items-center gap-2 p-4 rounded-2xl text-white font-bold text-xs transition-transform hover:scale-105 bg-[#4267B2]">
                    Facebook
                </a>
                <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" class="flex flex-col items-center gap-2 p-4 rounded-2xl text-white font-bold text-xs transition-transform hover:scale-105 bg-[#0077B5]">
                    LinkedIn
                </a>
            </div>
        </div>
    `;

    if(window.lucide) lucide.createIcons();

    container.classList.remove('hidden');
    
    // Animate in
    requestAnimationFrame(() => {
        container.classList.replace('opacity-0', 'opacity-100');
        const modalContent = document.getElementById('share-modal-content');
        if (modalContent) {
            modalContent.classList.replace('scale-95', 'scale-100');
            modalContent.classList.replace('opacity-0', 'opacity-100');
        }
    });

    const closeModal = () => {
        container.classList.replace('opacity-100', 'opacity-0');
        const modalContent = document.getElementById('share-modal-content');
        if (modalContent) {
            modalContent.classList.replace('scale-100', 'scale-95');
            modalContent.classList.replace('opacity-100', 'opacity-0');
        }
        setTimeout(() => {
            container.classList.add('hidden');
            container.innerHTML = '';
        }, 300);
    };

    document.getElementById('close-share-modal')?.addEventListener('click', closeModal);
    // Click outside to close
    container.addEventListener('click', (e) => {
        if (e.target === container) closeModal();
    });

    document.getElementById('copy-share-url')?.addEventListener('click', (e) => {
        navigator.clipboard.writeText(shareUrl);
        const btn = e.currentTarget;
        btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i>`;
        btn.classList.replace('bg-stone-900', 'bg-green-500');
        if(window.lucide) lucide.createIcons();
        
        setTimeout(() => {
            btn.innerHTML = `<i data-lucide="copy" class="w-4 h-4"></i>`;
            btn.classList.replace('bg-green-500', 'bg-stone-900');
            if(window.lucide) lucide.createIcons();
        }, 2000);
    });
}

export function openPaymentModal(category, userId, onSuccess) {
    const container = document.getElementById('confirm-modal-container');
    if (!container) return;

    const price = category.price || 50;

    container.innerHTML = `
        <div class="bg-white rounded-3xl w-full max-w-md shadow-2xl transform transition-all scale-95 opacity-0 overflow-hidden" id="payment-modal-content">
            <!-- Header -->
            <div class="bg-stone-900 px-8 py-6 flex items-center justify-between">
                <div>
                    <p class="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Unlock Folder</p>
                    <h2 class="text-white text-2xl font-black tracking-tight">${escapeHTML(category.name)}</h2>
                </div>
                <div class="text-right">
                    <p class="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Amount</p>
                    <p class="text-white text-3xl font-black">₹${price}</p>
                </div>
            </div>

            <!-- Payment Method Tabs -->
            <div class="flex border-b border-stone-100 px-6 pt-4 gap-1" id="payment-tabs">
                <button data-tab="upi" class="payment-tab px-4 py-2 text-sm font-bold rounded-t-xl border-b-2 border-stone-900 text-stone-900 transition-all">UPI</button>
                <button data-tab="card" class="payment-tab px-4 py-2 text-sm font-bold rounded-t-xl border-b-2 border-transparent text-stone-400 hover:text-stone-700 transition-all">Card</button>
                <button data-tab="bank" class="payment-tab px-4 py-2 text-sm font-bold rounded-t-xl border-b-2 border-transparent text-stone-400 hover:text-stone-700 transition-all">Net Banking</button>
            </div>

            <!-- Tab Content -->
            <div class="px-8 py-6 min-h-[200px]" id="payment-tab-content">
                <!-- UPI Tab (default) -->
                <div id="tab-upi">
                    <label class="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">UPI ID</label>
                    <input id="upi-input" type="text" placeholder="yourname@upi" class="w-full p-4 bg-stone-50 border-2 border-stone-200 rounded-2xl font-medium text-stone-700 focus:border-stone-900 outline-none transition-all text-sm">
                    <p class="text-xs text-stone-400 mt-2 font-medium">e.g. 9876543210@paytm, name@okaxis</p>
                </div>
                <div id="tab-card" class="hidden space-y-3">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Card Number</label>
                        <input type="text" placeholder="1234 5678 9012 3456" maxlength="19" class="w-full p-4 bg-stone-50 border-2 border-stone-200 rounded-2xl font-medium text-stone-700 focus:border-stone-900 outline-none transition-all text-sm">
                    </div>
                    <div class="flex gap-3">
                        <div class="flex-1">
                            <label class="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Expiry</label>
                            <input type="text" placeholder="MM/YY" maxlength="5" class="w-full p-4 bg-stone-50 border-2 border-stone-200 rounded-2xl font-medium text-stone-700 focus:border-stone-900 outline-none transition-all text-sm">
                        </div>
                        <div class="flex-1">
                            <label class="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">CVV</label>
                            <input type="password" placeholder="•••" maxlength="3" class="w-full p-4 bg-stone-50 border-2 border-stone-200 rounded-2xl font-medium text-stone-700 focus:border-stone-900 outline-none transition-all text-sm">
                        </div>
                    </div>
                </div>
                <div id="tab-bank" class="hidden">
                    <label class="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Select Bank</label>
                    <select class="w-full p-4 bg-stone-50 border-2 border-stone-200 rounded-2xl font-medium text-stone-700 focus:border-stone-900 outline-none transition-all text-sm">
                        <option>State Bank of India</option>
                        <option>HDFC Bank</option>
                        <option>ICICI Bank</option>
                        <option>Axis Bank</option>
                        <option>Kotak Mahindra Bank</option>
                        <option>Punjab National Bank</option>
                    </select>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-8 pb-8 flex gap-3">
                <button id="cancel-payment" class="flex-1 py-3 rounded-2xl font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors">Cancel</button>
                <button id="confirm-payment" class="flex-1 py-4 rounded-2xl font-black text-white bg-stone-900 hover:bg-stone-800 transition-colors flex items-center justify-center gap-2">
                    <span id="pay-text">Pay ₹${price}</span>
                    <span id="pay-spinner" class="hidden"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i></span>
                </button>
            </div>

            <!-- Success state (hidden) -->
            <div id="payment-success" class="hidden absolute inset-0 bg-white rounded-3xl flex flex-col items-center justify-center gap-4 p-8">
                <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <i data-lucide="check-circle-2" class="w-10 h-10 text-green-600"></i>
                </div>
                <h3 class="text-2xl font-black text-stone-900">Payment Successful!</h3>
                <p class="text-stone-500 text-center font-medium">"${escapeHTML(category.name)}" folder is now unlocked. Enjoy your quizzes!</p>
            </div>
        </div>
    `;

    if(window.lucide) lucide.createIcons();

    // Make the container relative so success overlay works
    const modalContent = document.getElementById('payment-modal-content');
    if(modalContent) modalContent.style.position = 'relative';

    container.classList.remove('hidden');
    requestAnimationFrame(() => {
        container.classList.replace('opacity-0', 'opacity-100');
        if(modalContent) {
            modalContent.classList.replace('scale-95', 'scale-100');
            modalContent.classList.replace('opacity-0', 'opacity-100');
        }
    });

    const closeModal = () => {
        container.classList.replace('opacity-100', 'opacity-0');
        if(modalContent) {
            modalContent.classList.replace('scale-100', 'scale-95');
            modalContent.classList.replace('opacity-100', 'opacity-0');
        }
        setTimeout(() => {
            container.classList.add('hidden');
            container.innerHTML = '';
        }, 300);
    };

    // Tab switching logic
    document.getElementById('payment-tabs')?.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-tab]')?.dataset.tab;
        if (!tab) return;
        document.querySelectorAll('.payment-tab').forEach(btn => {
            btn.classList.remove('border-stone-900', 'text-stone-900');
            btn.classList.add('border-transparent', 'text-stone-400');
        });
        e.target.classList.add('border-stone-900', 'text-stone-900');
        e.target.classList.remove('border-transparent', 'text-stone-400');

        ['upi', 'card', 'bank'].forEach(t => {
            const el = document.getElementById(`tab-${t}`);
            if(el) el.classList.toggle('hidden', t !== tab);
        });
    });

    document.getElementById('cancel-payment')?.addEventListener('click', closeModal);
    container.addEventListener('click', (e) => { if (e.target === container) closeModal(); });

    document.getElementById('confirm-payment')?.addEventListener('click', async () => {
        const payBtn = document.getElementById('confirm-payment');
        const payText = document.getElementById('pay-text');
        const paySpinner = document.getElementById('pay-spinner');
        
        payBtn.disabled = true;
        payText.textContent = 'Processing...';
        paySpinner.classList.remove('hidden');

        try {
            // Simulate 2s payment processing
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Write to Firestore
            const userDocRef = doc(db, 'users', userId);
            const currentProfile = window.app?.state?.profile;
            const currentUnlocked = currentProfile?.unlockedCategories || [];
            
            if (!currentUnlocked.includes(category.id)) {
                await updateDoc(userDocRef, {
                    unlockedCategories: [...currentUnlocked, category.id]
                });
                // Update local state immediately
                if (window.app?.state?.profile) {
                    window.app.state.profile.unlockedCategories = [...currentUnlocked, category.id];
                }
            }

            // Show success
            const successOverlay = document.getElementById('payment-success');
            if(successOverlay) {
                successOverlay.classList.remove('hidden');
                if(window.lucide) lucide.createIcons();
            }

            setTimeout(() => {
                closeModal();
                if (onSuccess) onSuccess();
            }, 2500);

        } catch(err) {
            console.error('Payment error:', err);
            showToast('Payment failed. Please try again.', 'error');
            payBtn.disabled = false;
            payText.textContent = `Pay ₹${price}`;
            paySpinner.classList.add('hidden');
        }
    });
}
export function openDeleteQuizModal(quizId) {
    const container = document.getElementById('confirm-modal-container');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform transition-all scale-95 opacity-0" id="confirm-modal-content">
            <h3 class="text-2xl font-bold text-stone-900 mb-2">Delete Quiz</h3>
            <p class="text-stone-500 mb-8">Are you sure you want to delete this quiz and all its questions? This action cannot be undone.</p>
            <div class="flex gap-4">
                <button id="cancel-delete" class="flex-1 py-3 px-4 rounded-xl font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors">
                    Cancel
                </button>
                <button id="confirm-delete" class="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                    <span id="delete-spinner" class="hidden"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i></span>
                    <span id="delete-text">Confirm</span>
                </button>
            </div>
        </div>
    `;

    if(window.lucide) lucide.createIcons();

    container.classList.remove('hidden');
    requestAnimationFrame(() => {
        container.classList.replace('opacity-0', 'opacity-100');
        const modalContent = document.getElementById('confirm-modal-content');
        if(modalContent) {
            modalContent.classList.replace('scale-95', 'scale-100');
            modalContent.classList.replace('opacity-0', 'opacity-100');
        }
    });

    const closeModal = () => {
        container.classList.replace('opacity-100', 'opacity-0');
        const modalContent = document.getElementById('confirm-modal-content');
        if(modalContent) {
            modalContent.classList.replace('scale-100', 'scale-95');
            modalContent.classList.replace('opacity-100', 'opacity-0');
        }
        setTimeout(() => {
            container.classList.add('hidden');
            container.innerHTML = '';
        }, 300);
    };

    document.getElementById('cancel-delete')?.addEventListener('click', closeModal);
    
    document.getElementById('confirm-delete')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        document.getElementById('delete-spinner').classList.remove('hidden');
        document.getElementById('delete-text').textContent = 'Deleting...';
        document.getElementById('cancel-delete').disabled = true;

        try {
            // Delete questions
            const questionsQ = query(collection(db, 'questions'), where('quizId', '==', quizId));
            const questionsSnapshot = await getDocs(questionsQ);
            
            // Delete results
            const resultsQ = query(collection(db, 'results'), where('quizId', '==', quizId));
            const resultsSnapshot = await getDocs(resultsQ);

            let batch = writeBatch(db);
            let operationCount = 0;

            for (const docSnap of questionsSnapshot.docs) {
                batch.delete(docSnap.ref);
                operationCount++;
                if (operationCount === 490) {
                    await batch.commit();
                    batch = writeBatch(db);
                    operationCount = 0;
                }
            }

            for (const docSnap of resultsSnapshot.docs) {
                batch.delete(docSnap.ref);
                operationCount++;
                if (operationCount === 490) {
                    await batch.commit();
                    batch = writeBatch(db);
                    operationCount = 0;
                }
            }

            // Delete quiz
            batch.delete(doc(db, 'quizzes', quizId));
            await batch.commit();
            
            showToast('Quiz deleted successfully', 'success');
            closeModal();
            // Assuming home will re-render due to snapshot listener
        } catch (error) {
            console.error("Error deleting quiz:", error);
            showToast('Failed to delete quiz', 'error');
            closeModal();
        }
    });
}
