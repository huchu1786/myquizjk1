import { escapeHTML } from './ui.js';
import { db, collection, query, orderBy, limit, onSnapshot } from './firebase-config.js';

let leaderboardUnsubscribe = null;
let usersUnsubscribe = null;

let localResults = [];
let localUsers = {};

export function renderLeaderboard(container, appState) {
    container.innerHTML = `
        <div class="flex items-center gap-4 mb-10">
            <div class="w-16 h-16 bg-yellow-400 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-yellow-100">
                <i data-lucide="trophy" class="w-8 h-8"></i>
            </div>
            <div>
                <h1 class="text-4xl font-black text-stone-900 tracking-tight">Global Leaderboard</h1>
                <p class="text-stone-500 font-medium">Top performers across all quizzes</p>
            </div>
        </div>

        <div class="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden">
            <div class="grid grid-cols-12 gap-4 p-6 bg-stone-50 border-b border-stone-200 text-xs font-bold text-stone-400 uppercase tracking-widest hidden md:grid">
                <div class="col-span-1 text-center">Rank</div>
                <div class="col-span-5">User</div>
                <div class="col-span-3">Quiz</div>
                <div class="col-span-1 text-center">Score</div>
                <div class="col-span-2 text-right">Time</div>
            </div>

            <div id="leaderboard-list" class="divide-y divide-stone-100">
                <div class="p-20 flex justify-center"><i data-lucide="loader-2" class="w-8 h-8 animate-spin text-stone-400"></i></div>
            </div>
        </div>
    `;

    if(window.lucide) lucide.createIcons();

    fetchLeaderboardData();
}

function fetchLeaderboardData() {
    if (leaderboardUnsubscribe) leaderboardUnsubscribe();
    if (usersUnsubscribe) usersUnsubscribe();

    const q = query(
        collection(db, 'results'),
        orderBy('score', 'desc'),
        orderBy('timeTaken', 'asc'),
        limit(50)
    );

    leaderboardUnsubscribe = onSnapshot(q, (snapshot) => {
        localResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const userIds = Array.from(new Set(localResults.map(r => r.userId).filter(Boolean)));
        
        if (userIds.length > 0) {
            // Since we can't easily do `where('uid', 'in', userIds)` if userIds > 10,
            // we will fetch all users simply for global resolution in this architecture, 
            // similar to what was done in App.tsx. Real-world might build a map dynamically.
            const usersQ = query(collection(db, 'users'));
            if (!usersUnsubscribe) {
                usersUnsubscribe = onSnapshot(usersQ, (uSnap) => {
                    localUsers = {};
                    uSnap.docs.forEach(doc => {
                        localUsers[doc.id] = doc.data();
                    });
                    updateLeaderboardUI();
                });
            } else {
                // If users already fetched, just update UI
                updateLeaderboardUI();
            }
        } else {
            updateLeaderboardUI();
        }
    });
}

function formatTime(seconds) {
    if (seconds === undefined || seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateLeaderboardUI() {
    const listEl = document.getElementById('leaderboard-list');
    if (!listEl) return; // View changed

    if (localResults.length === 0) {
        listEl.innerHTML = `
            <div class="p-20 text-center text-stone-400 font-medium">
                No results recorded yet. Be the first to top the charts!
            </div>
        `;
        return;
    }

    listEl.innerHTML = localResults.map((res, idx) => {
        const user = localUsers[res.userId];
        const rank = idx + 1;
        
        let rankBadgeClass = 'text-stone-400';
        if(rank === 1) rankBadgeClass = 'bg-yellow-400 text-white';
        else if (rank === 2) rankBadgeClass = 'bg-stone-300 text-white';
        else if (rank === 3) rankBadgeClass = 'bg-orange-400 text-white';

        const displayName = escapeHTML(user?.displayName || 'Anonymous User');
        const userInitials = user?.displayName ? user.displayName[0].toUpperCase() : `<i data-lucide="user" class="w-5 h-5"></i>`;

        return `
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 p-6 items-center hover:bg-stone-50 transition-colors animate-in" style="animation-delay: ${idx * 0.03}s">
                <!-- Mobile Rank -->
                <div class="md:hidden flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-stone-400 uppercase tracking-widest">Rank</span>
                    <span class="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${rankBadgeClass}">${rank}</span>
                </div>
                
                <!-- Desktop Rank -->
                <div class="hidden md:flex col-span-1 justify-center">
                    <span class="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${rankBadgeClass}">${rank}</span>
                </div>
                
                <div class="md:col-span-5 flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 font-bold overflow-hidden">
                        ${user?.photoURL ? `<img src="${escapeHTML(user.photoURL)}" class="w-full h-full object-cover">` : userInitials}
                    </div>
                    <div>
                        <p class="font-bold text-stone-900">${displayName}</p>
                        <p class="text-xs text-stone-400 truncate w-32 md:w-auto">${escapeHTML(user?.email || '')}</p>
                    </div>
                </div>
                
                <div class="md:col-span-3">
                    <p class="text-sm font-medium text-stone-600 truncate" title="${escapeHTML(res.quizTitle)}">${escapeHTML(res.quizTitle)}</p>
                </div>
                
                <div class="flex md:hidden justify-between items-center mt-2 pt-2 border-t border-stone-100">
                    <div class="text-center">
                        <span class="font-black text-stone-900">${res.score}</span><span class="text-stone-400 text-xs ml-1">/${res.maxScore}</span>
                    </div>
                    <div class="font-mono font-bold text-stone-600">${formatTime(res.timeTaken)}</div>
                </div>

                <div class="hidden md:block md:col-span-1 text-center">
                    <span class="font-black text-stone-900">${res.score}</span><span class="text-stone-400 text-xs ml-1">/${res.maxScore}</span>
                </div>
                
                <div class="hidden md:block md:col-span-2 text-right font-mono font-bold text-stone-600">
                    ${formatTime(res.timeTaken)}
                </div>
            </div>
        `;
    }).join('');

    if(window.lucide) lucide.createIcons();
}
