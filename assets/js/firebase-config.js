import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithRedirect, 
    getRedirectResult, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    onSnapshot, 
    serverTimestamp, 
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js';

// Configuration injected based on the existing React app settings
const firebaseConfig = {
  projectId: "rameez-70103",
  appId: "1:676018803178:web:80f0f54074e084c6e7a293",
  apiKey: "AIzaSyCPaXas_oa62uT1zxLW_t-8umLWhn6EKTo",
  authDomain: "rameez-70103.firebaseapp.com",
  storageBucket: "rameez-70103.firebasestorage.app",
  messagingSenderId: "676018803178",
  measurementId: ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth Export
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Firestore Export
export const db = getFirestore(app, 'ai-studio-441c98c4-9bbd-4a25-b593-4f4b6e928e97');

// Data Wrapper Helper Functions (mirrors the original React firebase.ts)
export const handleFirestoreError = (error, operationType, path) => {
    console.error(`Firestore Error [${operationType}] at [${path}]:`, error);
    if(error instanceof Error) {
        throw error;
    }
    throw new Error(String(error));
};

export const getDocument = async (path, id) => {
    try {
        const docRef = doc(db, path, id);
        return await getDoc(docRef);
    } catch (e) {
        handleFirestoreError(e, 'get', `${path}/${id}`);
    }
};

export const createDocument = async (path, id, data) => {
    try {
        const docRef = doc(db, path, id);
        await setDoc(docRef, data);
    } catch (e) {
        handleFirestoreError(e, 'create', `${path}/${id}`);
    }
};

export const addDocument = async (path, data) => {
    try {
        const colRef = collection(db, path);
        return await addDoc(colRef, data);
    } catch (e) {
        handleFirestoreError(e, 'create', path);
    }
};

export const updateDocument = async (path, id, data) => {
    try {
        const docRef = doc(db, path, id);
        await updateDoc(docRef, data);
    } catch (e) {
        handleFirestoreError(e, 'update', `${path}/${id}`);
    }
};

export const removeDocument = async (path, id) => {
    try {
        const docRef = doc(db, path, id);
        await deleteDoc(docRef);
    } catch (e) {
        handleFirestoreError(e, 'delete', `${path}/${id}`);
    }
};

// Expose these core modules to building blocks
export {
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    writeBatch,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc
};
