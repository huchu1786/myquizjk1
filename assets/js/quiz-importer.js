import { db, addDoc, collection, writeBatch, doc, serverTimestamp } from './firebase-config.js';
import { escapeHTML, showToast, showLoading } from './ui.js';

let importedQuizContent = null;
let isProcessing = false;

export function renderQuizImporter(container, appState) {
    const isUserAdmin = appState.profile?.role === 'admin' || appState.user?.email === 'huchu1786@gmail.com' || appState.user?.email === 'huchusim@gmail.com';
    if (!isUserAdmin) {
        container.innerHTML = `<div class="py-20 text-center text-red-500 font-bold">Access Denied</div>`;
        return;
    }

    importedQuizContent = null;
    isProcessing = false;
    renderImporterUI(container);
}

function renderImporterUI(container) {
    if (importedQuizContent) {
        // Review Mode
        container.innerHTML = `
            <div class="max-w-4xl mx-auto p-8 pt-4">
                <button onclick="window.app.navigate('admin')" class="flex items-center gap-2 text-stone-500 hover:text-stone-900 mb-8 transition-colors font-bold">
                    <i data-lucide="chevron-left" class="w-5 h-5"></i> Back to Dashboard
                </button>
                
                <div class="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                    <h2 class="text-2xl font-bold mb-6">Review Imported Quiz</h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Title</label>
                            <p class="text-xl font-bold text-stone-900">${escapeHTML(importedQuizContent.title)}</p>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Category</label>
                            <p class="text-stone-600">${escapeHTML(importedQuizContent.category || 'General')}</p>
                        </div>
                        <div class="flex justify-between items-center pt-8 border-t border-stone-100">
                            <span class="text-stone-500 font-medium">${importedQuizContent.questions?.length || 0} questions found</span>
                            <div class="flex gap-3">
                                <button onclick="window.cancelImport()" class="px-6 py-3 text-stone-500 font-bold hover:text-stone-900 rounded-xl hover:bg-stone-50 transition-colors">Cancel</button>
                                <button id="btn-save-import" class="px-8 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors shadow-lg shadow-stone-200">
                                    Save to Database
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-save-import')?.addEventListener('click', saveImportedQuiz);

    } else {
        // Upload Mode
        container.innerHTML = `
            <div class="max-w-4xl mx-auto p-8 pt-4">
                <button onclick="window.app.navigate('admin')" class="flex items-center gap-2 text-stone-500 hover:text-stone-900 mb-8 transition-colors font-bold">
                    <i data-lucide="chevron-left" class="w-5 h-5"></i> Back to Dashboard
                </button>
                
                <div class="bg-white p-10 rounded-3xl border border-stone-200 shadow-sm text-center">
                    <i data-lucide="upload-cloud" class="w-16 h-16 text-stone-300 mx-auto mb-6"></i>
                    <h2 class="text-3xl font-black text-stone-900 mb-2">Import Quiz</h2>
                    <p class="text-stone-500 mb-8">
                        Upload a <span class="font-bold text-stone-700">.json</span> file matching the QuizMaster structure.
                    </p>
                    
                    <div class="max-w-md mx-auto">
                        <label class="block w-full p-8 border-2 border-dashed border-stone-300 rounded-2xl cursor-pointer hover:border-stone-500 hover:bg-stone-50 transition-all mb-6">
                            <input type="file" accept=".json,application/json" id="import-file" class="hidden" />
                            <div class="flex flex-col items-center">
                                <span class="text-stone-700 font-bold text-lg mb-1">Click to browse</span>
                                <span class="text-sm text-stone-400" id="file-name-display">No file selected</span>
                            </div>
                        </label>

                        <div class="flex gap-4">
                            <button id="btn-process-file" disabled class="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                Process File
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const fileInput = document.getElementById('import-file');
        const processBtn = document.getElementById('btn-process-file');
        
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('file-name-display').textContent = file.name;
                processBtn.disabled = false;
            } else {
                document.getElementById('file-name-display').textContent = "No file selected";
                processBtn.disabled = true;
            }
        });

        processBtn?.addEventListener('click', () => {
            const file = fileInput.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (!parsed.title || !parsed.questions || !Array.isArray(parsed.questions)) {
                        throw new Error("Invalid format. Must contain 'title' and 'questions' array.");
                    }
                    importedQuizContent = parsed;
                    renderImporterUI(document.getElementById('view-admin')); // Need to re-trigger internal render route
                } catch (err) {
                    showToast('Invalid JSON file format', 'error');
                }
            };
            reader.readAsText(file);
        });
    }

    if(window.lucide) lucide.createIcons();
}

window.cancelImport = () => {
    importedQuizContent = null;
    renderImporterUI(document.getElementById('view-admin'));
}

async function saveImportedQuiz() {
    if(!importedQuizContent || isProcessing) return;
    isProcessing = true;
    showLoading(true);

    try {
        const quizData = {
            title: String(importedQuizContent.title || 'Imported Quiz').substring(0, 100),
            questionCount: Math.max(1, parseInt(importedQuizContent.questions.length) || 1),
            authorId: window.app.state.user.uid,
            createdAt: serverTimestamp()
        };
        if (importedQuizContent.description) quizData.description = String(importedQuizContent.description).substring(0, 500);
        if (importedQuizContent.category) quizData.category = String(importedQuizContent.category).substring(0, 100);
        if (importedQuizContent.difficulty) {
            const diff = String(importedQuizContent.difficulty).toLowerCase();
            if (['easy', 'medium', 'hard'].includes(diff)) quizData.difficulty = diff;
        }
        if (importedQuizContent.duration) {
            const dur = parseInt(importedQuizContent.duration);
            if (!isNaN(dur) && dur > 0) quizData.duration = dur;
        }
        if (importedQuizContent.timerType) {
            const tt = String(importedQuizContent.timerType).toLowerCase();
            if (['quiz', 'question'].includes(tt)) quizData.timerType = tt;
        }

        const newDocRef = await addDoc(collection(db, 'quizzes'), quizData);
        
        let batch = writeBatch(db);
        let count = 0;

        importedQuizContent.questions.forEach((q) => {
            const qRef = doc(collection(db, 'questions'));
            const qData = {
                quizId: newDocRef.id,
                text: String(q.text || 'Untitled Question').substring(0, 2000),
                type: String(q.type || 'mcq').toLowerCase(),
                points: Math.max(0, parseInt(q.points) || 10)
            };
            if (!['mcq', 'match'].includes(qData.type)) qData.type = 'mcq';
            
            if (qData.type === 'mcq' && Array.isArray(q.options) && q.options.length >= 2) {
                qData.options = q.options.slice(0, 20);
                if (q.correctAnswerIndex !== undefined) {
                    qData.correctAnswerIndex = Math.max(0, parseInt(q.correctAnswerIndex) || 0);
                }
            } else if (qData.type === 'match' && Array.isArray(q.pairs)) {
                qData.pairs = q.pairs;
            } else {
                qData.type = 'mcq';
                qData.options = ['Option 1', 'Option 2'];
                qData.correctAnswerIndex = 0;
            }

            if (q.explanation) qData.explanation = String(q.explanation).substring(0, 5000);

            batch.set(qRef, qData);

            count++;
            if(count > 480) { batch.commit().then(()=>batch = writeBatch(db)); count = 0; }
        });

        await batch.commit();
        showToast("Quiz Imported Successfully!", "success");
        window.app.navigate('admin'); // Go back to admin dashboard
    } catch (err) {
        console.error(err);
        showToast("Error saving import: " + err.message, "error");
    } finally {
        isProcessing = false;
        showLoading(false);
    }
}
