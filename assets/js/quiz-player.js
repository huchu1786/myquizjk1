import { db, doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from './firebase-config.js';
import { escapeHTML } from './ui.js';

let currentQuiz = null;
let currentQuestionIndex = 0;
let answers = {};
let revealed = {};
let timerInterval = null;
let timeRemaining = null; // Either for whole quiz or per question
let isSubmitted = false;
let globalTimeElapsed = 0; // The total time user spent taking quiz
let globalTimeInterval = null;

let state = null; // Pointer to global app state
let uiContainer = null;

export async function renderQuizPlayer(container, quizId, appState) {
    uiContainer = container;
    state = appState;

    container.innerHTML = `<div class="py-20 flex flex-col items-center justify-center gap-4">
        <i data-lucide="loader-2" class="w-10 h-10 animate-spin text-stone-400"></i>
        <p class="text-stone-500 font-medium">Loading quiz...</p>
    </div>`;
    if(window.lucide) lucide.createIcons();

    try {
        const quizSnap = await getDoc(doc(db, 'quizzes', quizId));
        if (quizSnap.exists()) {
            currentQuiz = { id: quizSnap.id, ...quizSnap.data() };

            const qq = query(collection(db, 'questions'), where('quizId', '==', quizId));
            const qs = await getDocs(qq);
            currentQuiz.questions = qs.docs.map(d => ({id: d.id, ...d.data()}));

            // Initialization
            currentQuestionIndex = 0;
            answers = {};
            revealed = {};
            isSubmitted = false;
            globalTimeElapsed = 0;

            if (currentQuiz.questions && currentQuiz.questions.length > 0) {
                renderStartScreen();
            } else {
                container.innerHTML = `<div class="py-20 text-center"><h2 class="text-2xl font-bold">Quiz has no questions</h2></div>`;
            }
        } else {
            container.innerHTML = `<div class="py-20 text-center"><h2 class="text-2xl font-bold">Quiz not found</h2></div>`;
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="py-20 text-center"><h2 class="text-2xl font-bold text-red-500">Error loading quiz</h2></div>`;
    }
}

function renderStartScreen() {
    clearTimers();
    uiContainer.innerHTML = `
        <div class="bg-white p-10 rounded-3xl border border-stone-200 shadow-xl text-center max-w-2xl mx-auto">
            <h1 class="text-4xl font-black text-stone-900 mb-4 tracking-tight">${escapeHTML(currentQuiz.title)}</h1>
            <p class="text-stone-500 mb-8 max-w-lg mx-auto text-lg">${escapeHTML(currentQuiz.description || '')}</p>
            
            <div class="flex justify-center gap-4 mb-10">
                <div class="px-6 py-3 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col items-center">
                    <span class="text-xl font-black text-stone-900">${currentQuiz.questions.length}</span>
                    <span class="text-xs font-bold text-stone-400 uppercase tracking-widest">Questions</span>
                </div>
                ${currentQuiz.duration ? `
                    <div class="px-6 py-3 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col items-center">
                         <span class="text-xl font-black text-stone-900">${Math.floor(currentQuiz.duration / 60)}m</span>
                         <span class="text-xs font-bold text-stone-400 uppercase tracking-widest">${currentQuiz.timerType === 'question' ? 'Per Question' : 'Total Time'}</span>
                    </div>
                ` : ''}
            </div>

            <div class="flex gap-4 max-w-md mx-auto">
                <button onclick="window.app.navigate('quizzes')" class="flex-1 py-4 bg-white border border-stone-200 text-stone-600 rounded-2xl font-bold hover:bg-stone-50 transition-colors">Go Back</button>
                <button id="btn-start-quiz" class="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-colors shadow-lg shadow-stone-200">Start Quiz</button>
            </div>
        </div>
    `;

    document.getElementById('btn-start-quiz').addEventListener('click', () => {
        startQuiz();
    });
}

function startQuiz() {
    globalTimeElapsed = 0;
    globalTimeInterval = setInterval(() => {
        globalTimeElapsed++;
    }, 1000);

    if (currentQuiz.duration && currentQuiz.timerType === 'quiz') {
        timeRemaining = currentQuiz.duration;
        startTimer();
    }

    renderQuestion();
}

function clearTimers() {
    if (timerInterval) clearInterval(timerInterval);
    if (globalTimeInterval) clearInterval(globalTimeInterval);
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (timeRemaining > 0) {
            timeRemaining--;
            updateTimerUI();
            if (timeRemaining <= 10) {
                document.getElementById('timer-display')?.classList.add('text-red-600', 'animate-pulse');
            }
        } else {
            clearInterval(timerInterval);
            handleTimeUp();
        }
    }, 1000);
}

function handleTimeUp() {
    if (currentQuiz.timerType === 'question') {
        // time up for this question, mark as un-answered and go to next
        saveAnswer(null);
        if (currentQuestionIndex < currentQuiz.questions.length - 1) {
            currentQuestionIndex++;
            renderQuestion();
        } else {
            submitQuiz();
        }
    } else {
        // time up for whole quiz
        submitQuiz();
    }
}

function updateTimerUI() {
    const el = document.getElementById('timer-display');
    if (el) {
        const mins = Math.floor(timeRemaining / 60);
        const secs = timeRemaining % 60;
        el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    const progressEl = document.getElementById('timer-progress');
    if (progressEl && currentQuiz.duration) {
         progressEl.style.width = `${(timeRemaining / currentQuiz.duration) * 100}%`;
    }
}

function getBaseUIHeader() {
    let timerHTML = '';
    if (currentQuiz.duration) {
        timerHTML = `
            <div class="flex items-center gap-2 font-mono font-bold text-stone-900 text-lg bg-stone-100 px-4 py-2 rounded-xl">
                <i data-lucide="clock" class="w-5 h-5 text-stone-400"></i>
                <span id="timer-display">--:--</span>
            </div>
        `;
    }
    
    // Overall Progress bar
    const progressPerc = ((currentQuestionIndex) / currentQuiz.questions.length) * 100;

    return `
        <div class="flex justify-between items-end mb-6">
            <div>
                <span class="text-stone-400 font-bold uppercase tracking-widest text-xs">Question ${currentQuestionIndex + 1} of ${currentQuiz.questions.length}</span>
                <div class="w-full h-1 bg-stone-100 rounded-full mt-2 w-48">
                    <div class="h-full bg-stone-900 rounded-full transition-all" style="width: ${progressPerc}%"></div>
                </div>
            </div>
            ${timerHTML}
        </div>
        
        ${currentQuiz.duration ? `<div class="w-full h-1 bg-stone-100 mb-6 rounded-full"><div id="timer-progress" class="h-full bg-stone-400 rounded-full transition-all"></div></div>` : ''}
    `;
}

function renderQuestion() {
    if (isSubmitted) return;
    
    const q = currentQuiz.questions[currentQuestionIndex];
    
    if (currentQuiz.duration && currentQuiz.timerType === 'question') {
        timeRemaining = currentQuiz.duration;
        startTimer();
    }
    
    // Check if we have a saved answer
    const savedAns = answers[currentQuestionIndex];

    let contentHTML = '';
    
    if (q.type === 'match') {
        // Need to render two columns and let them match
        // For simplicity in vanilla HTML, we render left items, and right items as a selected group or simplified drag&drop/dropdowns.
        // We will use dropdowns for vanilla JS simplicity while ensuring full capability.
        
        // Prepare local matches tracking if missing
        if (!window.currentMatches) window.currentMatches = {};
        if (savedAns) window.currentMatches = {...savedAns};

        const rightOptionsStr = q.pairs.map(p => escapeHTML(p.right)).sort(() => Math.random() - 0.5); // shuffle
        const optionsListHTML = `<option value="">Select match...</option>` + rightOptionsStr.map(o => `<option value="${o}">${o}</option>`).join('');

        const isRevealed = !!revealed[currentQuestionIndex];

        contentHTML = `
            <h3 class="text-2xl font-bold text-stone-900 mb-8 border-l-4 border-stone-900 pl-4 leading-tight">${escapeHTML(q.text)}</h3>
            <div class="space-y-4 mb-8" id="match-container">
                ${q.pairs.map((p, i) => {
                    let selectClasses = 'w-full p-3 rounded-lg border bg-white font-medium text-stone-800 outline-none focus:border-stone-400 border-stone-200';
                    let hintHTML = '';
                    if (isRevealed) {
                        const userAns = window.currentMatches[p.left];
                        if (userAns === p.right) {
                            selectClasses = 'w-full p-3 rounded-lg border-2 border-green-500 bg-green-50 text-green-700 font-bold outline-none cursor-not-allowed';
                        } else {
                            selectClasses = 'w-full p-3 rounded-lg border-2 border-red-500 bg-red-50 text-red-700 font-bold outline-none cursor-not-allowed';
                            hintHTML = `<div class="mt-1 text-xs font-bold text-green-600 bg-green-50 p-2 rounded flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Correct: ${escapeHTML(p.right)}</div>`;
                        }
                    }
                    return `
                    <div class="flex flex-col md:flex-row md:items-center gap-4 bg-stone-50 p-4 rounded-xl border border-stone-100">
                        <div class="flex-1 font-medium text-stone-700">${escapeHTML(p.left)}</div>
                        <div class="w-8 flex justify-center text-stone-300 md:block hidden"><i data-lucide="arrow-right" class="w-5 h-5"></i></div>
                        <div class="flex-1">
                            <select data-left="${escapeHTML(p.left)}" class="match-select ${selectClasses}" ${isRevealed ? 'disabled' : ''}>
                                ${optionsListHTML}
                            </select>
                            ${hintHTML}
                        </div>
                    </div>
                `}).join('')}
            </div>
            
            ${!isRevealed ? `<button onclick="window.quizPlayerRevealMatch()" class="mb-4 px-6 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors shadow-md">Check Answer</button>` : ''}
            
            ${isRevealed ? `
                <div class="mb-6 p-6 bg-stone-100 rounded-2xl border border-stone-200">
                    <h4 class="text-sm font-bold text-stone-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <i data-lucide="info" class="w-4 h-4 text-blue-500"></i> Explanation
                    </h4>
                    <p class="text-stone-700 leading-relaxed font-medium">${escapeHTML(q.explanation) || 'No specific explanation provided for this question.'}</p>
                </div>
            ` : ''}

            ${renderNavButtons()}
        `;
    } else {
        // Normal MCQ
        const isRevealed = !!revealed[currentQuestionIndex];
        contentHTML = `
            <h3 class="text-2xl font-bold text-stone-900 mb-8 border-l-4 border-stone-900 pl-4 leading-tight">${escapeHTML(q.text)}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                ${q.options.map((opt, i) => {
                    const isSelected = savedAns === i;
                    const isCorrect = i === q.correctAnswerIndex;
                    
                    let styleClass = 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400 hover:bg-stone-50';
                    let iconHTML = isSelected ? '<div class="w-2.5 h-2.5 bg-stone-900 rounded-full mx-auto"></div>' : '';
                    let indicatorClass = isSelected ? 'border-stone-900 text-stone-900' : 'border-stone-300';

                    if (isRevealed) {
                        if (isCorrect) {
                            styleClass = 'bg-green-50 border-2 border-green-500 text-green-800 font-bold shadow-sm';
                            iconHTML = '<i data-lucide="check" class="w-4 h-4 mx-auto text-green-600"></i>';
                            indicatorClass = 'border-green-500 bg-green-100';
                        } else if (isSelected) {
                            styleClass = 'bg-red-50 border-2 border-red-500 text-red-800 font-bold shadow-sm opacity-80';
                            iconHTML = '<i data-lucide="x" class="w-4 h-4 mx-auto text-red-600"></i>';
                            indicatorClass = 'border-red-500 bg-red-100';
                        } else {
                            styleClass = 'bg-white text-stone-400 border border-stone-100 opacity-50 cursor-not-allowed';
                        }
                    } else if (isSelected) {
                        styleClass = 'bg-stone-100 text-stone-900 border-stone-400 font-bold shadow-inner';
                    }

                    const clickAttr = isRevealed ? '' : `onclick="window.quizPlayerSelectOption(${i})"`;

                    return `
                        <button ${clickAttr} class="text-left p-4 md:p-6 rounded-2xl transition-all flex items-start gap-4 ${styleClass}">
                            <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${indicatorClass}">
                                ${iconHTML}
                            </div>
                            <span class="leading-relaxed">${escapeHTML(opt)}</span>
                        </button>
                    `;
                }).join('')}
            </div>

            ${isRevealed ? `
                <div class="mb-6 p-6 bg-stone-100 rounded-2xl border border-stone-200 transition-all">
                    <h4 class="text-sm font-bold text-stone-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <i data-lucide="info" class="w-4 h-4 text-blue-500"></i> Explanation
                    </h4>
                    <p class="text-stone-700 leading-relaxed font-medium">${escapeHTML(q.explanation) || 'No specific explanation provided for this question.'}</p>
                </div>
            ` : ''}

            ${renderNavButtons()}
        `;
    }

    uiContainer.innerHTML = `
        <div class="bg-white p-8 md:p-12 rounded-3xl border border-stone-200 shadow-xl max-w-4xl mx-auto transform transition-all">
            ${getBaseUIHeader()}
            ${contentHTML}
        </div>
    `;

    if (q.type === 'match') {
        // Pre-fill selections if available
        document.querySelectorAll('.match-select').forEach(select => {
            const left = select.getAttribute('data-left');
            if (window.currentMatches[left]) {
                select.value = window.currentMatches[left];
            }
            select.addEventListener('change', (e) => {
                window.currentMatches[left] = e.target.value;
                validateNavButtons();
            });
        });
    }

    if(window.lucide) lucide.createIcons();
    updateTimerUI();
    validateNavButtons();
}

// Ensure "Next" or "Submit" is somewhat visible but disable if validation fails entirely? 
// Current react app didn't forcibly disable except on empty match. We will keep it flexible.
function validateNavButtons() {}

function renderNavButtons() {
    const isLast = currentQuestionIndex === currentQuiz.questions.length - 1;
    const isFirst = currentQuestionIndex === 0;

    let prevBtn = !isFirst ? `
        <button onclick="window.quizPlayerPrev()" class="px-8 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-colors flex items-center gap-2">
            <i data-lucide="chevron-left" class="w-5 h-5"></i> Previous
        </button>
    ` : '<div></div>'; // spacer

    let nextBtn = !isLast ? `
        <button onclick="window.quizPlayerNext()" class="px-8 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-colors flex items-center gap-2 shadow-lg shadow-stone-200">
            Next <i data-lucide="chevron-right" class="w-5 h-5"></i>
        </button>
    ` : `
        <button onclick="window.quizPlayerSubmit()" class="px-8 py-4 bg-green-500 text-white rounded-2xl font-bold hover:bg-green-600 transition-colors flex items-center gap-2 shadow-lg shadow-green-200">
            Submit Quiz <i data-lucide="check" class="w-5 h-5"></i>
        </button>
    `;

    return `<div class="flex justify-between items-center mt-12 pt-6 border-t border-stone-100">${prevBtn}${nextBtn}</div>`;
}

function saveCurrentAnswer() {
    const q = currentQuiz.questions[currentQuestionIndex];
    if (q.type === 'match') {
        answers[currentQuestionIndex] = { ...window.currentMatches };
    }
}

window.quizPlayerRevealMatch = () => {
    answers[currentQuestionIndex] = { ...window.currentMatches };
    revealed[currentQuestionIndex] = true;
    renderQuestion();
};

window.quizPlayerSelectOption = (idx) => {
    answers[currentQuestionIndex] = idx;
    revealed[currentQuestionIndex] = true;
    renderQuestion(); // Re-render to show selection and feedback
};

window.quizPlayerPrev = () => {
    saveCurrentAnswer();
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
};

window.quizPlayerNext = () => {
    saveCurrentAnswer();
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
        currentQuestionIndex++;
        
        // Reset match local state 
        const nextQ = currentQuiz.questions[currentQuestionIndex];
        if (nextQ.type === 'match') {
            window.currentMatches = answers[currentQuestionIndex] || {};
        }

        renderQuestion();
    }
};

window.quizPlayerSubmit = async () => {
    saveCurrentAnswer();
    await submitQuiz();
};

async function submitQuiz() {
    isSubmitted = true;
    clearTimers();
    
    uiContainer.innerHTML = `<div class="py-20 flex flex-col items-center justify-center gap-4">
        <i data-lucide="loader-2" class="w-10 h-10 animate-spin text-stone-400"></i>
        <p class="text-stone-500 font-medium text-lg">Calculating your results...</p>
    </div>`;

    // Calculate score
    let score = 0;
    let maxScore = 0;
    const finalAnswersObj = {};

    currentQuiz.questions.forEach((q, index) => {
        const points = q.points || 10;
        maxScore += points;
        
        const userAns = answers[index];
        let isCorrect = false;

        if (q.type === 'mcq') {
            isCorrect = userAns === q.correctAnswerIndex;
            if (isCorrect) score += points;
            
            finalAnswersObj[index] = {
                questionText: q.text,
                type: 'mcq',
                userAnswer: userAns !== undefined && userAns !== null ? q.options[userAns] : null,
                correctAnswer: q.options[q.correctAnswerIndex],
                isCorrect,
                points: isCorrect ? points : 0,
                explanation: q.explanation || null
            };
        } else if (q.type === 'match') {
            let correctCount = 0;
            const matchesArr = [];
            const userMatchDict = userAns || {};

            q.pairs.forEach(p => {
                const isMatchCorrect = userMatchDict[p.left] === p.right;
                if (isMatchCorrect) correctCount++;
                matchesArr.push({
                    left: p.left,
                    matchedRight: userMatchDict[p.left] || null,
                    correctRight: p.right,
                    isCorrect: isMatchCorrect
                });
            });

            isCorrect = correctCount === q.pairs.length;
            const matchPoints = isCorrect ? points : 0; // all-or-nothing typical in this app
            score += matchPoints;

            finalAnswersObj[index] = {
                questionText: q.text,
                type: 'match',
                matches: matchesArr,
                isCorrect,
                points: matchPoints,
                explanation: q.explanation || null
            };
        }
    });

    const resultDoc = {
        userId: state.user.uid,
        quizId: currentQuiz.id,
        quizTitle: currentQuiz.title,
        score,
        maxScore,
        timeTaken: Math.max(1, globalTimeElapsed), // Ensure greater than 0
        answers: finalAnswersObj,
        completedAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, 'results'), resultDoc);
        window.app.navigate('results');
    } catch (e) {
        console.error("Error saving result", e);
        uiContainer.innerHTML = `<div class="py-20 text-center">
            <h2 class="text-2xl font-bold text-red-500 mb-4">Error Saving Result</h2>
            <p class="mb-6">We could not save your submission. This instance may only be accessible as a demo.</p>
            <button onclick="window.app.navigate('results')" class="px-6 py-2 bg-stone-900 text-white rounded-xl">Go to Results</button>
        </div>`;
    }
}
