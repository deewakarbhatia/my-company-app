// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDnklMoIyFk2djyY84bbh4v3sF5o1_YxZ0",
  authDomain: "my-company-app-60604.firebaseapp.com",
  projectId: "my-company-app-60604",
  storageBucket: "my-company-app-60604.appspot.com",
  messagingSenderId: "526581267771",
  appId: "1:526581267771:web:c7e140a0318aec9aa60b1e",
  measurementId: "G-EEM916L5VC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics
try {
  analytics = getAnalytics(app)
} catch (error) {
  console.warn('Firebase analytics initialization failed:', error.message)
}

// Initialize Auth with persistence
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('Firebase auth persistence failed:', error.code, error.message)
});

// Initialize Firestore
const db = getFirestore(app);

// Firestore helper functions
export const addDocument = async (collectionName, data) => {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error adding document to ${collectionName}:`, error);
    throw error;
  }
};

export const getDocuments = async (collectionName, whereConditions = null) => {
  try {
    let q;
    if (whereConditions && whereConditions.length > 0) {
      const conditions = whereConditions.map(cond => where(cond.field, cond.operator, cond.value));
      q = query(collection(db, collectionName), ...conditions);
    } else {
      q = collection(db, collectionName);
    }
    const querySnapshot = await getDocs(q);
    const docs = [];
    querySnapshot.forEach((doc) => {
      // Placing id AFTER doc.data() guarantees we get the real Firebase reference ID.
      docs.push({ ...doc.data(), id: doc.id });
    });
    return docs;
  } catch (error) {
    console.error(`Error getting documents from ${collectionName}:`, error);
    throw error;
  }
};

export const updateDocument = async (collectionName, docId, data) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error);
    throw error;
  }
};

export const deleteDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    throw error;
  }
};

export { app, auth, db };