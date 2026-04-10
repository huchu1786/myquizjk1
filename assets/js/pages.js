import { escapeHTML } from './ui.js';

export function renderPage(pageId) {
    const container = document.getElementById('view-page');
    if (!container) return;

    const page = window.app.state.pages.find(p => p.id === pageId);
    
    if (!page) {
         container.innerHTML = `
            <div class="py-20 text-center max-w-lg mx-auto">
                <h1 class="text-4xl font-black text-stone-900 mb-4">404</h1>
                <p class="text-stone-500 font-medium">This page could not be found or has been removed.</p>
                <button onclick="window.app.navigate('home')" class="mt-8 px-6 py-3 bg-stone-900 text-white rounded-full font-bold hover:bg-stone-800 transition-colors">Go Home</button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <h1 class="text-4xl font-black text-stone-900 mb-8 tracking-tight">${escapeHTML(page.title)}</h1>
        <div class="bg-white p-8 md:p-12 rounded-3xl border border-stone-200 shadow-sm leading-relaxed text-lg text-stone-700 whitespace-pre-wrap">
${escapeHTML(page.body)}
        </div>
    `;
}
