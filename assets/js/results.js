import { db, collection, query, where, orderBy, getDocs } from './firebase-config.js';
import { escapeHTML } from './ui.js';

let localResults = [];

export function renderResultHistory(container, appState) {
    container.innerHTML = `
        <h1 class="text-4xl font-black text-stone-900 mb-10 tracking-tight">My Results</h1>
        <div id="results-list" class="space-y-6">
            <div class="p-20 flex justify-center"><i data-lucide="loader-2" class="w-8 h-8 animate-spin text-stone-400"></i></div>
        </div>
    `;
    if(window.lucide) lucide.createIcons();
    fetchResults(appState.user.uid);
}

async function fetchResults(uid) {
    try {
        const q = query(
            collection(db, 'results'),
            where('userId', '==', uid),
            orderBy('completedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        localResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateResultsUI();
    } catch (e) {
        console.error("Error fetching results", e);
        const list = document.getElementById('results-list');
        if (list) list.innerHTML = `<div class="p-8 text-red-500 bg-red-50 rounded-2xl">Error loading results. Check permissions or try again.</div>`;
    }
}

function updateResultsUI() {
    const list = document.getElementById('results-list');
    if (!list) return;

    if (localResults.length === 0) {
        list.innerHTML = `
            <div class="bg-white p-12 rounded-3xl border border-stone-200 shadow-sm text-center">
                <div class="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6 text-stone-300">
                    <i data-lucide="history" class="w-10 h-10"></i>
                </div>
                <h3 class="text-xl font-bold text-stone-900 mb-2">No results yet</h3>
                <p class="text-stone-500 mb-8">You haven't taken any quizzes yet. Start exploring and test your knowledge!</p>
                <button onclick="window.app.navigate('quizzes')" class="px-8 py-3 bg-stone-900 text-white rounded-full font-bold hover:bg-stone-800 transition-colors">
                    Explore Quizzes
                </button>
            </div>
        `;
        if(window.lucide) lucide.createIcons();
        return;
    }

    list.innerHTML = localResults.map((result, idx) => {
        const dateStr = result.completedAt ? new Date(result.completedAt.seconds * 1000).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }) : 'Recent';
        
        const percentage = Math.round((result.score / result.maxScore) * 100);
        
        let emoji = '😐'; let textColor = 'text-yellow-600'; let bgColor = 'bg-yellow-50'; let borderColor = 'border-yellow-200';
        if (percentage >= 80) { emoji = '🥳'; textColor = 'text-green-600'; bgColor = 'bg-green-50'; borderColor = 'border-green-200'; }
        else if (percentage < 50) { emoji = '😢'; textColor = 'text-red-600'; bgColor = 'bg-red-50'; borderColor = 'border-red-200'; }

        return `
            <div class="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all animate-in" style="animation-delay: ${idx * 0.05}s">
                <div class="flex flex-col md:flex-row justify-between md:items-center gap-6">
                    <div>
                        <div class="flex items-center gap-3 mb-2">
                            <span class="text-2xl">${emoji}</span>
                            <h3 class="text-xl font-bold text-stone-900 truncate" title="${escapeHTML(result.quizTitle)}">${escapeHTML(result.quizTitle)}</h3>
                        </div>
                        <div class="flex items-center gap-4 text-sm font-bold text-stone-400 uppercase tracking-widest">
                            <div class="flex items-center gap-1"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${dateStr}</div>
                            <div class="flex items-center gap-1"><i data-lucide="clock" class="w-3.5 h-3.5"></i> ${Math.floor(result.timeTaken/60)}m ${result.timeTaken%60}s</div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-6">
                        <div class="text-right">
                            <div class="text-3xl font-black text-stone-900 leading-none mb-1">${result.score}<span class="text-lg text-stone-400">/${result.maxScore}</span></div>
                            <div class="text-sm font-bold uppercase tracking-wider ${textColor}">${percentage}%</div>
                        </div>
                        
                        <div class="flex flex-col gap-2">
                            <button onclick="window.quizMasterReviewResult('${result.id}')" class="px-6 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors w-full md:w-auto">
                                Review Answers
                            </button>
                            <button onclick="window.app.navigate('play-${result.quizId}')" class="px-6 py-2 rounded-xl text-sm font-bold bg-stone-900 text-white hover:bg-stone-800 transition-colors w-full md:w-auto">
                                Retake Quiz
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if(window.lucide) lucide.createIcons();
}

window.quizMasterReviewResult = (id) => {
    const res = localResults.find(r => r.id === id);
    if(res) {
        import('./review.js').then(m => m.renderResultReview(document.getElementById('view-review'), res));
        window.app.navigate('review'); // Need custom logic to display it
    }
};
