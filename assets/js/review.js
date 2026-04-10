import { escapeHTML } from './ui.js';

export function renderResultReview(container, result) {
    if (!result) {
        container.innerHTML = '<p class="text-center py-20 text-stone-500 font-bold">Result not found.</p>';
        return;
    }

    const percentage = Math.round((result.score / result.maxScore) * 100);
    
    let emoji = '😐'; 
    let message = 'Good effort!';
    let headerColor = 'bg-yellow-500';
    if (percentage >= 80) { emoji = '🥳'; message = 'Exceptional work!'; headerColor = 'bg-stone-900'; }
    else if (percentage < 50) { emoji = '😢'; message = 'Keep practicing!'; headerColor = 'bg-red-500'; }

    let answersHTML = '';

    if (!result.answers || Object.keys(result.answers).length === 0) {
        answersHTML = `<div class="bg-white p-8 rounded-3xl border border-stone-200 text-center col-span-full">
            <p class="text-stone-500 font-medium">Detailed answers were not stored for this attempt.</p>
        </div>`;
    } else {
        // Detailed answers exist, render them
        // Reconstruct the order from answers keys (assuming keys represent indices or IDs, sorting for safety)
        const sortedQuestionIds = Object.keys(result.answers).sort();
        
        answersHTML = sortedQuestionIds.map((qId, index) => {
            const ans = result.answers[qId];
            const isCorrect = ans.isCorrect;
            
            let statusIcon = isCorrect 
                ? '<div class="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0"><i data-lucide="check" class="w-4 h-4"></i></div>'
                : '<div class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0"><i data-lucide="x" class="w-4 h-4"></i></div>';
            
            let innerContent = '';
            if (ans.type === 'match') {
                innerContent = `
                    <div class="mt-4 space-y-2">
                        ${ans.matches.map(m => `
                            <div class="flex items-center gap-4 text-sm">
                                <span class="bg-stone-100 px-3 py-1 rounded w-1/2">${escapeHTML(m.left)}</span>
                                <i data-lucide="arrow-right" class="w-3 h-3 text-stone-400 shrink-0"></i>
                                <span class="px-3 py-1 rounded w-1/2 ${m.isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
                                    ${escapeHTML(m.matchedRight)}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                innerContent = `
                    <div class="mt-4 space-y-2 text-sm">
                        <div class="flex gap-2">
                            <span class="font-bold text-stone-400 capitalize w-16">Your Ans:</span>
                            <span class="${isCorrect ? 'text-green-600 font-bold' : 'text-red-500 line-through'}">${escapeHTML(ans.userAnswer || 'Skipped')}</span>
                        </div>
                        ${!isCorrect ? `
                            <div class="flex gap-2">
                                <span class="font-bold text-stone-400 uppercase w-16">Correct:</span>
                                <span class="text-green-600 font-bold">${escapeHTML(ans.correctAnswer)}</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }

            let explanationHTML = ans.explanation ? `
                <div class="mt-4 p-4 bg-blue-50 rounded-xl flex items-start gap-3">
                    <i data-lucide="info" class="w-4 h-4 text-blue-500 shrink-0 mt-0.5"></i>
                    <p class="text-sm text-blue-800">${escapeHTML(ans.explanation)}</p>
                </div>
            ` : '';

            return `
                <div class="bg-white p-6 rounded-2xl border ${isCorrect ? 'border-green-200 shadow-sm' : 'border-stone-200'}">
                    <div class="flex items-start gap-3">
                        <span class="font-bold text-stone-400 w-6">${index + 1}.</span>
                        <div class="flex-1">
                            <h4 class="font-bold text-stone-900 leading-tight mb-2">${escapeHTML(ans.questionText || 'Question text unavailable')}</h4>
                            ${innerContent}
                            ${explanationHTML}
                        </div>
                        ${statusIcon}
                    </div>
                    <div class="mt-4 flexjustify-end text-xs font-bold ${isCorrect ? 'text-green-600' : 'text-red-500'}">
                        +${isCorrect ? ans.points || 0 : 0} points
                    </div>
                </div>
            `;
        }).join('');
    }

    container.innerHTML = `
        <button onclick="window.app.navigate('results')" class="flex items-center gap-2 text-stone-500 hover:text-stone-900 mb-8 transition-colors font-bold">
            <i data-lucide="chevron-left" class="w-5 h-5"></i> Back to History
        </button>

        <div class="${headerColor} text-white p-10 rounded-3xl mb-8 shadow-xl relative overflow-hidden">
            <div class="absolute top-0 right-0 p-8 opacity-10">
                <i data-lucide="award" class="w-32 h-32"></i>
            </div>
            
            <div class="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
                <div>
                    <h2 class="text-3xl font-black mb-2">${escapeHTML(result.quizTitle)}</h2>
                    <p class="text-white/80 font-medium text-lg flex items-center gap-2">
                        <span class="text-2xl">${emoji}</span> ${message}
                    </p>
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="text-6xl font-black tracking-tighter">${result.score}</span>
                    <span class="text-2xl font-bold text-white/50">/ ${result.maxScore}</span>
                </div>
            </div>
            
            <div class="relative z-10 mt-8 flex flex-wrap gap-4 text-sm font-bold bg-black/10 p-4 rounded-2xl inline-flex backdrop-blur-sm">
                <div class="flex items-center gap-2"><i data-lucide="percent" class="w-4 h-4"></i> ${percentage}% Accuracy</div>
                <div class="w-px bg-white/20"></div>
                <div class="flex items-center gap-2"><i data-lucide="clock" class="w-4 h-4"></i> ${Math.floor(result.timeTaken/60)}m ${result.timeTaken%60}s</div>
            </div>
        </div>

        <div class="flex justify-between items-end mb-6">
            <h3 class="text-xl font-black text-stone-900">Detailed Feedback</h3>
            <button onclick="window.app.navigate('play-${result.quizId}')" class="px-6 py-2 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors hidden md:block">
                Retake Quiz
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
            ${answersHTML}
        </div>
        
        <div class="md:hidden fixed bottom-6 left-6 right-6">
            <button onclick="window.app.navigate('play-${result.quizId}')" class="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-colors shadow-2xl">
                Retake Quiz
            </button>
        </div>
    `;

    if(window.lucide) lucide.createIcons();
}
