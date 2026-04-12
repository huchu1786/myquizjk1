import { db, doc, getDoc, collection, addDoc, updateDoc, query, where, getDocs, writeBatch, serverTimestamp } from './firebase-config.js';
import { escapeHTML, showToast, showLoading } from './ui.js';

let editorState = null;

export async function renderQuizEditor(container, quizId, appState) {
    const isUserAdmin = appState.profile?.role === 'admin' || appState.user?.email === 'huchu1786@gmail.com' || appState.user?.email === 'huchusim@gmail.com';
    if (!isUserAdmin) {
        container.innerHTML = `<div class="py-20 text-center text-red-500 font-bold">Access Denied</div>`;
        return;
    }

    editorState = {
        id: quizId || null,
        title: '',
        description: '',
        category: 'General',
        difficulty: 'medium',
        duration: '', // In seconds
        timerType: 'quiz', // 'quiz' or 'question'
        questions: [],
        categories: []
    };

    container.innerHTML = `<div class="py-20 flex justify-center"><i data-lucide="loader-2" class="w-10 h-10 animate-spin text-stone-400"></i></div>`;
    if(window.lucide) lucide.createIcons();

    try {
        // Fetch categories for the dropdown
        const cSnap = await getDocs(collection(db, 'categories'));
        editorState.categories = cSnap.docs.map(d => d.data().name);

        if (quizId) {
            // Edit existing
            const quizSnap = await getDoc(doc(db, 'quizzes', quizId));
            if (quizSnap.exists()) {
                const qd = quizSnap.data();
                editorState.title = qd.title || '';
                editorState.description = qd.description || '';
                editorState.category = qd.category || 'General';
                editorState.difficulty = qd.difficulty || 'medium';
                editorState.duration = qd.duration || '';
                editorState.timerType = qd.timerType || 'quiz';
                
                // Fetch questions
                const qq = query(collection(db, 'questions'), where('quizId', '==', quizId));
                const qs = await getDocs(qq);
                editorState.questions = qs.docs.map(d => ({id: d.id, ...d.data()}));
            } else {
                showToast("Quiz not found", "error");
                window.app.navigate('admin');
                return;
            }
        }
        
        renderEditorUI(container);
    } catch (e) {
        console.error(e);
        showToast("Error loading editor", "error");
    }
}

function renderEditorUI(container) {
    const isEdit = !!editorState.id;
    
    // Header
    const headerHTML = `
        <div class="flex items-center gap-4 mb-8">
            <button onclick="window.app.navigate('admin')" class="w-12 h-12 bg-white border border-stone-200 rounded-2xl flex items-center justify-center text-stone-400 hover:text-stone-900 transition-colors">
                <i data-lucide="chevron-left" class="w-6 h-6"></i>
            </button>
            <div>
                <h1 class="text-3xl font-black text-stone-900 tracking-tight">${isEdit ? 'Edit Quiz' : 'Create New Quiz'}</h1>
                <p class="text-stone-500 font-medium">Configure settings and add questions</p>
            </div>
            <div class="ml-auto flex gap-2">
                <button onclick="window.editorSave()" class="px-6 py-3 bg-stone-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-stone-800 transition-colors">
                    <i data-lucide="save" class="w-4 h-4"></i> Save Quiz
                </button>
            </div>
        </div>
    `;

    // Basic Settings
    const catOptions = ['General', ...editorState.categories].map(c => 
        `<option value="${escapeHTML(c)}" ${editorState.category === c ? 'selected' : ''}>${escapeHTML(c)}</option>`
    ).join('');

    const settingsHTML = `
        <div class="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm mb-8 space-y-6">
            <h2 class="text-xl font-bold text-stone-900 mb-4">Basic Information</h2>
            <div>
                <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Title</label>
                <input type="text" id="editor-title" value="${escapeHTML(editorState.title)}" placeholder="Quiz Title" class="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none font-medium">
            </div>
            <div>
                <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Description</label>
                <textarea id="editor-desc" rows="3" placeholder="Brief description..." class="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none font-medium">${escapeHTML(editorState.description)}</textarea>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Category</label>
                    <select id="editor-cat" class="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none font-medium">
                        ${catOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Difficulty</label>
                    <select id="editor-diff" class="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none font-medium">
                        <option value="easy" ${editorState.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
                        <option value="medium" ${editorState.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="hard" ${editorState.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Timer Value (seconds)</label>
                    <input type="number" id="editor-duration" value="${editorState.duration}" placeholder="e.g. 600 for 10min" class="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none font-medium">
                </div>
                <div>
                    <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Timer Context</label>
                    <select id="editor-timer-type" class="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none font-medium">
                        <option value="quiz" ${editorState.timerType === 'quiz' ? 'selected' : ''}>Total Quiz Time</option>
                        <option value="question" ${editorState.timerType === 'question' ? 'selected' : ''}>Per Question</option>
                    </select>
                </div>
            </div>
        </div>
    `;

    // Questions List
    const questionsHTML = `
        <div class="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold text-stone-900">Questions (${editorState.questions.length})</h2>
                <div class="flex gap-2">
                    <button onclick="window.editorAddQuestion('mcq')" class="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl font-bold hover:bg-stone-200 transition-colors flex items-center gap-2 text-sm">
                        <i data-lucide="plus" class="w-4 h-4"></i> MCQ
                    </button>
                    <button onclick="window.editorAddQuestion('match')" class="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl font-bold hover:bg-stone-200 transition-colors flex items-center gap-2 text-sm">
                        <i data-lucide="plus" class="w-4 h-4"></i> Match
                    </button>
                </div>
            </div>
            
            <div class="space-y-4" id="editor-questions-list">
                ${editorState.questions.length === 0 ? '<div class="text-center text-stone-400 py-10 font-medium">No questions added yet.</div>' : ''}
                ${editorState.questions.map((q, i) => `
                    <div class="border border-stone-200 rounded-2xl p-4 flex justify-between items-start bg-stone-50 group">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="bg-stone-200 text-stone-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${q.type}</span>
                                <span class="font-bold text-stone-900">${i + 1}. ${escapeHTML(q.text ? q.text.substring(0, 50) + (q.text.length>50?'...':'') : 'Untitled')}</span>
                            </div>
                            <div class="text-xs text-stone-500 font-medium">${q.points || 10} points</div>
                        </div>
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="window.editorEditQuestion(${i})" class="p-2 text-stone-400 hover:text-stone-900 transition-colors"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                            <button onclick="window.editorDeleteQuestion(${i})" class="p-2 text-stone-400 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="max-w-5xl mx-auto pb-20">
            ${headerHTML}
            ${settingsHTML}
            ${questionsHTML}
        </div>

        <!-- Question Modal Engine -->
        <div id="question-modal-container" class="hidden fixed inset-0 z-50 items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm opacity-0 transition-opacity duration-300">
            <div id="question-modal-content" class="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl transform scale-95 transition-all outline-none" tabindex="-1">
                <!-- Injected conditionally -->
            </div>
        </div>
    `;

    if(window.lucide) lucide.createIcons();

    // Attach syncers
    document.getElementById('editor-title').addEventListener('change', e => editorState.title = e.target.value);
    document.getElementById('editor-desc').addEventListener('change', e => editorState.description = e.target.value);
    document.getElementById('editor-cat').addEventListener('change', e => editorState.category = e.target.value);
    document.getElementById('editor-diff').addEventListener('change', e => editorState.difficulty = e.target.value);
    document.getElementById('editor-duration').addEventListener('change', e => editorState.duration = e.target.value ? parseInt(e.target.value) : null);
    document.getElementById('editor-timer-type').addEventListener('change', e => editorState.timerType = e.target.value);
}

// ==== Actions ====
window.editorSave = async () => {
    if (!editorState.title) return showToast("Title is required", "error");
    
    showLoading(true);
    try {
        const quizData = {
            title: editorState.title,
            questionCount: editorState.questions.length,
            authorId: window.app.state.user.uid
        };
        if (editorState.description) quizData.description = editorState.description;
        if (editorState.category) quizData.category = editorState.category;
        if (editorState.difficulty) quizData.difficulty = editorState.difficulty;
        if (editorState.duration) quizData.duration = Number(editorState.duration);
        if (editorState.timerType) quizData.timerType = editorState.timerType;

        if (!editorState.id) {
            quizData.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, 'quizzes'), quizData);
            editorState.id = docRef.id;
        } else {
            await updateDoc(doc(db, 'quizzes', editorState.id), quizData);
        }


        // Save Questions via Batch (simplistic version: delete all old questions for this quiz, re-insert them)
        // A robust app would match IDs, but replacing is easier for UI builder parity.
        const qQ = query(collection(db, 'questions'), where('quizId', '==', editorState.id));
        const prevQuestions = await getDocs(qQ);
        
        let batch = writeBatch(db);
        let count = 0;
        
        // Delete old
        for(let doc of prevQuestions.docs) {
            batch.delete(doc.ref);
            count++;
            if(count > 480) { await batch.commit(); batch = writeBatch(db); count = 0; }
        }

        // Insert new
        editorState.questions.forEach(q => {
            const newRef = doc(collection(db, 'questions'));
            const qDoc = {
                quizId: editorState.id,
                text: q.text || 'Untitled',
                type: q.type,
                points: Number(q.points) || 10
            };
            if (q.options) qDoc.options = q.options;
            if (q.correctAnswerIndex !== undefined) qDoc.correctAnswerIndex = Number(q.correctAnswerIndex);
            if (q.pairs) qDoc.pairs = q.pairs;
            if (q.explanation) qDoc.explanation = q.explanation;

            batch.set(newRef, qDoc);
            q.id = newRef.id; // update local pointer 
            count++;
            if(count > 480) { batch.commit().then(()=>{batch = writeBatch(db)}); count = 0; }
        });

        await batch.commit();

        showToast("Quiz Saved Successfully!", "success");
        window.app.navigate('admin');

    } catch (e) {
        console.error(e);
        showToast("Error saving quiz: " + e.message, "error");
    } finally {
        showLoading(false);
    }
};

window.editorDeleteQuestion = (index) => {
    if(confirm("Delete question?")) {
        editorState.questions.splice(index, 1);
        renderEditorUI(document.getElementById('view-admin'));
    }
};

// ==== Question Form Modal ====
let editingQuestionIndex = null;
let tempQuestionData = null;

window.editorAddQuestion = (type) => {
    editingQuestionIndex = -1;
    tempQuestionData = {
        type,
        text: '',
        points: 10,
        explanation: '',
        options: type === 'mcq' ? ['', '', '', ''] : null,
        correctAnswerIndex: type === 'mcq' ? 0 : null,
        pairs: type === 'match' ? [{left: '', right: ''}, {left: '', right: ''}] : null
    };
    openQuestionModal();
};

window.editorEditQuestion = (index) => {
    editingQuestionIndex = index;
    // Deep copy to prevent live edit issues
    tempQuestionData = JSON.parse(JSON.stringify(editorState.questions[index]));
    openQuestionModal();
};

function openQuestionModal() {
    const cont = document.getElementById('question-modal-container');
    const content = document.getElementById('question-modal-content');
    
    renderQuestionForm(content);
    
    cont.classList.remove('hidden', 'flex'); // Tailwind resets logic
    cont.classList.add('flex'); // Set flex explicitly to unhide properly
    requestAnimationFrame(() => {
        cont.classList.replace('opacity-0', 'opacity-100');
        content.classList.replace('scale-95', 'scale-100');
    });
}

window.closeQuestionModal = () => {
    const cont = document.getElementById('question-modal-container');
    const content = document.getElementById('question-modal-content');
    cont.classList.replace('opacity-100', 'opacity-0');
    content.classList.replace('scale-100', 'scale-95');
    setTimeout(() => {
        cont.classList.add('hidden');
        cont.classList.remove('flex');
    }, 300);
}

function renderQuestionForm(wrapper) {
    const q = tempQuestionData;
    const isMCQ = q.type === 'mcq';

    let specificsHTML = '';

    if (isMCQ) {
        specificsHTML = `
            <div class="space-y-3">
                <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest">Options</label>
                ${q.options.map((opt, i) => `
                    <div class="flex items-center gap-3">
                        <input type="radio" name="temp-correct-ans" value="${i}" ${q.correctAnswerIndex === i ? 'checked' : ''} onchange="tempQuestionData.correctAnswerIndex = ${i}">
                        <input type="text" value="${escapeHTML(opt)}" onchange="tempQuestionData.options[${i}] = this.value" placeholder="Option ${i+1}" class="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none text-sm">
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        specificsHTML = `
            <div class="space-y-3">
                <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest flex justify-between">
                    Pairs
                    <button onclick="tempQuestionData.pairs.push({left:'', right:''}); renderQuestionForm(document.getElementById('question-modal-content'))" class="text-stone-600 hover:text-stone-900">+ Add Pair</button>
                </label>
                ${q.pairs.map((p, i) => `
                    <div class="flex items-center gap-3">
                        <input type="text" value="${escapeHTML(p.left)}" onchange="tempQuestionData.pairs[${i}].left = this.value" placeholder="Left side" class="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none text-sm">
                        <i data-lucide="arrow-right" class="w-4 h-4 text-stone-400"></i>
                        <input type="text" value="${escapeHTML(p.right)}" onchange="tempQuestionData.pairs[${i}].right = this.value" placeholder="Right matching side" class="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none text-sm">
                        <button onclick="tempQuestionData.pairs.splice(${i}, 1); renderQuestionForm(document.getElementById('question-modal-content'))" class="p-2 text-stone-400 hover:text-red-500"><i data-lucide="trash" class="w-4 h-4"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    wrapper.innerHTML = `
        <div class="p-6 md:p-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-bold text-stone-900">${editingQuestionIndex < 0 ? 'Add' : 'Edit'} ${q.type.toUpperCase()} Question</h3>
                <button onclick="window.closeQuestionModal()" class="text-stone-400 hover:text-stone-900"><i data-lucide="x" class="w-6 h-6"></i></button>
            </div>

            <div class="space-y-6">
                <div>
                    <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Question Text</label>
                    <textarea onchange="tempQuestionData.text = this.value" rows="2" class="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none font-medium">${escapeHTML(q.text)}</textarea>
                </div>
                
                ${specificsHTML}

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Points</label>
                        <input type="number" value="${q.points}" onchange="tempQuestionData.points = parseInt(this.value) || 0" class="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none text-sm">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Explanation (Optional)</label>
                    <textarea onchange="tempQuestionData.explanation = this.value" rows="2" class="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none text-sm" placeholder="Why is this the correct answer?">${escapeHTML(q.explanation || '')}</textarea>
                </div>
            </div>

            <div class="mt-8 pt-6 border-t border-stone-100 flex justify-end gap-3">
                <button onclick="window.closeQuestionModal()" class="px-6 py-3 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200">Cancel</button>
                <button onclick="window.saveQuestionModal()" class="px-6 py-3 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800">Save Question</button>
            </div>
        </div>
    `;

    if(window.lucide) Object.assign(window, {lucide: window.lucide}); // Reattachment
    if(window.lucide) lucide.createIcons();
}

window.saveQuestionModal = () => {
    if (!tempQuestionData.text) return showToast("Question text is required", "error");

    if (editingQuestionIndex < 0) {
        editorState.questions.push(tempQuestionData);
    } else {
        editorState.questions[editingQuestionIndex] = tempQuestionData;
    }
    
    // Re-render main editor list
    renderEditorUI(document.getElementById('view-admin'));
    window.closeQuestionModal();
};
