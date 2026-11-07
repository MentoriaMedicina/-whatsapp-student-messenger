// Replace the values below with your NEW Firebase project's web app config.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, signInAnonymously, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  query, where, orderBy, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwyGdsp6mh67Z1cw2yyXSRxtS-Txi8npk",
  authDomain: "mentoria-medicina-1st-year.firebaseapp.com",
  projectId: "mentoria-medicina-1st-year",
  storageBucket: "mentoria-medicina-1st-year.firebasestorage.app",
  messagingSenderId: "182876014235",
  appId: "1:182876014235:web:36d85c3f687b66fd2aa83e",
  measurementId: "G-3NVQG2201M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth, db, signInAnonymously, signInWithEmailAndPassword, signOut,
  collection, doc, getDoc, getDocs, setDoc, addDoc, query, where,
  orderBy, serverTimestamp, limit
};
