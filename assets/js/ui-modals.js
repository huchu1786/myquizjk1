import { escapeHTML } from './ui.js';
import { db, removeDocument, query, collection, where, getDocs, writeBatch, doc, updateDoc, addDoc } from './firebase-config.js';
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

export function openPaymentModal(category, userId, userEmail, onSuccess) {
    const container = document.getElementById('confirm-modal-container');
    if (!container) return;

    const price = category.price || 50;
    const upiId = 'rmzshah-2@okicici';
    // UPI deep link for QR code generation
    const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=QuizMaster&am=${price}&cu=INR&tn=${encodeURIComponent('Unlock ' + category.name)}`;
    // Use a public QR generator API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiDeepLink)}`;

    container.innerHTML = `
        <div class="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl transform transition-all scale-95 opacity-0" 
             id="payment-modal-content"
             style="background:white; border:1.5px solid rgba(99,102,241,0.15); position:relative;">
            
            <!-- Gradient Header -->
            <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 60%,#ec4899 100%); padding:28px 28px 24px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <p style="color:rgba(255,255,255,0.65); font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:4px;">
                            Unlock Premium Folder
                        </p>
                        <h2 style="color:white; font-size:22px; font-weight:900; letter-spacing:-0.02em; margin:0;">
                            ${escapeHTML(category.name)}
                        </h2>
                    </div>
                    <div style="text-align:right;">
                        <p style="color:rgba(255,255,255,0.65); font-size:11px; font-weight:800; margin-bottom:4px;">Amount</p>
                        <p style="color:white; font-size:32px; font-weight:900; margin:0;">₹${price}</p>
                    </div>
                </div>
            </div>

            <!-- Body -->
            <div id="pay-body" style="padding:24px 28px;">
                <!-- Step 1: Pay -->
                <div id="pay-step-1">
                    <p style="font-weight:700; color:#1e1b4b; margin-bottom:16px; font-size:14px;">
                        <span style="background:linear-gradient(135deg,#6366f1,#8b5cf6); color:white; border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; margin-right:8px;">1</span>
                        Scan QR or use UPI ID to pay ₹${price}
                    </p>

                    <!-- QR + UPI ID side by side -->
                    <div style="display:flex; gap:16px; align-items:center; background:linear-gradient(135deg,rgba(99,102,241,0.04),rgba(139,92,246,0.06)); border:1.5px dashed rgba(99,102,241,0.3); border-radius:16px; padding:16px; margin-bottom:20px;">
                        <div style="background:white; border-radius:12px; padding:8px; box-shadow:0 2px 8px rgba(0,0,0,0.08); flex-shrink:0;">
                            <img src="${qrUrl}" 
                                 alt="UPI QR Code" 
                                 width="120" height="120"
                                 style="display:block; border-radius:6px;"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                            <div style="display:none; width:120px; height:120px; align-items:center; justify-content:center; color:#6366f1; font-size:11px; text-align:center; font-weight:700;">Open any UPI app and pay manually</div>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <p style="font-size:11px; color:#6b7280; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:8px;">UPI ID</p>
                            <div id="upi-id-display" 
                                 style="background:rgba(99,102,241,0.05); border:1.5px dashed rgba(99,102,241,0.4); border-radius:10px; padding:10px 14px; font-family:monospace; font-size:14px; font-weight:700; color:#4338ca; cursor:pointer; word-break:break-all;"
                                 onclick="navigator.clipboard.writeText('${upiId}').then(()=>{ this.style.background='rgba(16,185,129,0.1)'; this.style.borderColor='rgba(16,185,129,0.5)'; setTimeout(()=>{ this.style.background=''; this.style.borderColor=''; },1500); });"
                                 title="Click to copy">
                                ${upiId}
                            </div>
                            <p style="font-size:11px; color:#10b981; font-weight:700; margin-top:6px; display:flex; align-items:center; gap:4px;">
                                <i data-lucide="copy" style="width:11px; height:11px;"></i> Click to copy
                            </p>
                            <p style="font-size:11px; color:#6b7280; margin-top:8px;">Works with GPay, PhonePe, Paytm, BHIM & all UPI apps</p>
                        </div>
                    </div>

                    <p style="font-weight:700; color:#1e1b4b; margin-bottom:12px; font-size:14px;">
                        <span style="background:linear-gradient(135deg,#6366f1,#8b5cf6); color:white; border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; margin-right:8px;">2</span>
                        Enter your UTR / Reference ID after paying
                    </p>

                    <input type="text" 
                           id="utr-input"
                           placeholder="e.g. 123456789012 (12-digit UTR)" 
                           maxlength="30"
                           style="width:100%; padding:14px 16px; border:1.5px solid rgba(99,102,241,0.2); border-radius:14px; font-size:14px; font-weight:600; color:#1e1b4b; background:rgba(99,102,241,0.02); outline:none; margin-bottom:8px; box-sizing:border-box; transition:border-color 0.2s;"
                           onfocus="this.style.borderColor='#6366f1'; this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'"
                           onblur="this.style.borderColor='rgba(99,102,241,0.2)'; this.style.boxShadow='none'"
                           oninput="document.getElementById('submit-utr-btn').disabled=this.value.trim().length<6">
                    <p style="font-size:11px; color:#9ca3af; margin-bottom:20px;">Find the UTR in your UPI app under Payment History</p>

                    <div style="display:flex; gap:10px;">
                        <button id="cancel-payment" 
                            style="flex:1; padding:14px; border-radius:14px; font-weight:700; color:#6b7280; background:#f3f4f6; border:none; cursor:pointer; transition:background 0.2s; font-size:14px;"
                            onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                            Cancel
                        </button>
                        <button id="submit-utr-btn" disabled
                            style="flex:2; padding:14px; border-radius:14px; font-weight:900; color:white; background:linear-gradient(135deg,#6366f1,#8b5cf6); border:none; cursor:pointer; font-size:14px; opacity:0.5; transition:opacity 0.2s, transform 0.15s; display:flex; align-items:center; justify-content:center; gap:8px;"
                            onmouseover="if(!this.disabled){this.style.transform='translateY(-1px)'}"
                            onmouseout="this.style.transform='translateY(0)'">
                            <i data-lucide="send" style="width:16px; height:16px;"></i>
                            <span id="submit-btn-text">Submit Payment</span>
                        </button>
                    </div>
                </div>

                <!-- Step 2: Pending screen (hidden initially) -->
                <div id="pay-step-2" style="display:none; text-align:center; padding:16px 0;">
                    <div style="width:72px; height:72px; background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.15)); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px;"
                         class="pending-pulse">
                        <i data-lucide="clock" style="width:32px; height:32px; color:#6366f1;"></i>
                    </div>
                    <h3 style="font-size:20px; font-weight:900; color:#1e1b4b; margin-bottom:8px;">Request Submitted!</h3>
                    <p style="color:#6b7280; font-size:14px; margin-bottom:20px; line-height:1.6;">
                        Your payment request has been sent to the admin for verification.<br>
                        <strong style="color:#6366f1;">Folder will unlock within a few hours</strong> once the admin approves your UTR.
                    </p>
                    <div style="background:rgba(99,102,241,0.06); border-radius:14px; padding:16px; text-align:left; margin-bottom:20px;">
                        <p style="font-size:12px; color:#6b7280; font-weight:700; margin-bottom:4px;">Your UTR / Reference ID</p>
                        <p id="confirmed-utr" style="font-family:monospace; font-size:15px; font-weight:900; color:#4338ca;"></p>
                    </div>
                    <button id="close-pending-modal"
                        style="width:100%; padding:14px; border-radius:14px; font-weight:900; color:white; background:linear-gradient(135deg,#6366f1,#8b5cf6); border:none; cursor:pointer; font-size:14px;">
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    `;

    if(window.lucide) lucide.createIcons();

    // Enable submit when UTR >= 6 chars (already handled by oninput, but ensure initial state)
    const submitBtn = document.getElementById('submit-utr-btn');
    if(submitBtn) submitBtn.disabled = true;

    container.classList.remove('hidden');
    requestAnimationFrame(() => {
        container.classList.replace('opacity-0', 'opacity-100');
        const mc = document.getElementById('payment-modal-content');
        if(mc) { mc.classList.replace('scale-95', 'scale-100'); mc.classList.replace('opacity-0', 'opacity-100'); }
    });

    const closeModal = () => {
        container.classList.replace('opacity-100', 'opacity-0');
        const mc = document.getElementById('payment-modal-content');
        if(mc) { mc.classList.replace('scale-100', 'scale-95'); }
        setTimeout(() => { container.classList.add('hidden'); container.innerHTML = ''; }, 300);
    };

    document.getElementById('cancel-payment')?.addEventListener('click', closeModal);
    container.addEventListener('click', (e) => { if(e.target === container) closeModal(); });

    // Enable/disable submit based on UTR length
    document.getElementById('utr-input')?.addEventListener('input', (e) => {
        const btn = document.getElementById('submit-utr-btn');
        if(btn) {
            btn.disabled = e.target.value.trim().length < 6;
            btn.style.opacity = btn.disabled ? '0.5' : '1';
            btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
        }
    });

    // Submit payment request
    submitBtn?.addEventListener('click', async () => {
        const utr = document.getElementById('utr-input')?.value.trim();
        if(!utr || utr.length < 6) return;

        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
        document.getElementById('submit-btn-text').textContent = 'Submitting...';
        submitBtn.querySelector('i[data-lucide="send"]')?.setAttribute('data-lucide', 'loader-2');
        if(window.lucide) lucide.createIcons();

        try {
            // Write payment request to Firestore
            await addDoc(collection(db, 'payment_requests'), {
                userId,
                userEmail: userEmail || '',
                categoryId: category.id,
                categoryName: category.name,
                amount: category.price || 50,
                utr,
                status: 'pending',
                createdAt: new Date()
            });

            // Show pending screen
            document.getElementById('pay-step-1').style.display = 'none';
            document.getElementById('pay-step-2').style.display = 'block';
            document.getElementById('confirmed-utr').textContent = utr;
            if(window.lucide) lucide.createIcons();

            document.getElementById('close-pending-modal')?.addEventListener('click', () => {
                closeModal();
                if(onSuccess) onSuccess('pending');
            });

        } catch(err) {
            console.error('Payment request failed:', err);
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            document.getElementById('submit-btn-text').textContent = 'Submit Payment';
            const isPerms = err?.code === 'permission-denied';
            showToast(isPerms ? '⛔ Sign in required to submit payment.' : `❌ Error: ${err.message}`, 'error');
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
