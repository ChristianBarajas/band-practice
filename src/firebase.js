// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ✅ Put your Firebase config here (from Firebase Console → Project settings → Your apps)
const firebaseConfig = {
    apiKey: "AIzaSyB38xv5KAvF3gJ4rL2tJke4iRB6oIZhQIw",
    authDomain: "band-practice-85891.firebaseapp.com",
    projectId: "band-practice-85891",
    storageBucket: "band-practice-85891.firebasestorage.app",
    messagingSenderId: "1046609505150",
    appId: "1:1046609505150:web:43f47979bc92f3528fa12f",
    measurementId: "G-Z351RS28Y7"
  };

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
