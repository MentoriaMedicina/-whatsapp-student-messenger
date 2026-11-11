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
  apiKey: "AIzaSyBPag4SLUqmdfAws0WFLV7FWp3X8_eLPXQ",
  authDomain: "mentoria-medicina-attend-7d5ca.firebaseapp.com",
  databaseURL: "https://mentoria-medicina-attend-7d5ca-default-rtdb.firebaseio.com",
  projectId: "mentoria-medicina-attend-7d5ca",
  storageBucket: "mentoria-medicina-attend-7d5ca.firebasestorage.app",
  messagingSenderId: "238479536134",
  appId: "1:238479536134:web:3ff9a57dc1cb70dc8c9387",
  measurementId: "G-WEVCZ0JG2K"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth, db, signInAnonymously, signInWithEmailAndPassword, signOut,
  collection, doc, getDoc, getDocs, setDoc, addDoc, query, where,
  orderBy, serverTimestamp, limit
};
