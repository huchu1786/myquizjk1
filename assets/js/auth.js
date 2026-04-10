import { 
    auth, 
    googleProvider, 
    signInWithPopup, 
    signInWithRedirect, 
    getRedirectResult, 
    signOut, 
    onAuthStateChanged,
    getDocument,
    createDocument
} from './firebase-config.js';
import { showLoading, showToast } from './ui.js';

// Popup fallback codes that require redirect
const GOOGLE_POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
]);

export function initAuth(onStateChange) {
    // Check for redirect result first
    getRedirectResult(auth).catch((err) => {
        console.error('Google redirect sign-in failed:', err);
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Check for user profile in firestore
                const profileSnap = await getDocument('users', user.uid);
                let profileData = null;
                
                if (profileSnap && profileSnap.exists()) {
                    profileData = profileSnap.data();
                } else {
                    // Create new profile on first sign in
                    const isAdmin = user.email === 'huchusim@gmail.com';
                    const newProfile = {
                        uid: user.uid,
                        email: user.email || '',
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        role: isAdmin ? 'admin' : 'user',
                    };
                    await createDocument('users', user.uid, newProfile);
                    profileData = newProfile;
                }
                
                onStateChange(user, profileData);
            } catch (err) {
                console.error("Error setting up user profile", err);
                onStateChange(user, null); // Proceed anyway with basic user
            }
        } else {
            onStateChange(null, null);
        }
    });

    // Attach listener to login button
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const errorDiv = document.getElementById('landing-error');
            const errorText = document.getElementById('landing-error-text');
            const spinner = document.getElementById('login-spinner');
            const icon = document.getElementById('login-icon');
            const loginText = document.getElementById('login-text');
            
            errorDiv.classList.add('hidden');
            
            // UI Loading state
            btnLogin.disabled = true;
            btnLogin.classList.add('opacity-60');
            spinner.classList.remove('hidden');
            icon.classList.add('hidden');
            loginText.textContent = "Signing in...";

            try {
                try {
                    await signInWithPopup(auth, googleProvider);
                } catch (e) {
                    const code = e.code;
                    const message = e.message || 'Sign-in failed';
                    if (code && GOOGLE_POPUP_FALLBACK_CODES.has(code)) {
                        await signInWithRedirect(auth, googleProvider);
                        return; // Execution stops here due to redirect
                    }
                    const hint = code === 'auth/unauthorized-domain'
                        ? ' Add this origin under Firebase Console -> Authentication -> Settings -> Authorized domains.'
                        : '';
                    errorText.textContent = `${message} ${hint}`;
                    errorDiv.classList.remove('hidden');
                }
            } finally {
                // Reset UI Loading State (if popup was cancelled)
                btnLogin.disabled = false;
                btnLogin.classList.remove('opacity-60');
                spinner.classList.add('hidden');
                icon.classList.remove('hidden');
                loginText.textContent = "Get Started with Google";
            }
        });
    }
}

export async function logout() {
    try {
        await signOut(auth);
    } catch(err) {
        console.error("Logout error", err);
        showToast("Error signing out", "error");
    }
}
