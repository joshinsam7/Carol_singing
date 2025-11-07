// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database"; 

const firebaseConfig = {
  apiKey: "AIzaSyDzK9b5gjFCT158JgYt4xdHxDqP8ryegdQ",
  authDomain: "bus-tracking-e5cf4.firebaseapp.com",
  databaseURL: "https://bus-tracking-e5cf4-default-rtdb.firebaseio.com",
  projectId: "bus-tracking-e5cf4",
  storageBucket: "bus-tracking-e5cf4.firebasestorage.app",
  messagingSenderId: "204995379548",
  appId: "1:204995379548:web:f36b0ba2efda6edf1c4199",
  measurementId: "G-ET043K67C4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

export { database };