// Firebase config - Stok Manadjment (Original Project - mostafabelfakiir@gmail.com)
const firebaseConfig = {
    apiKey: "AIzaSyAEdWQa_zHNTSbYf5-e7T3un9XgbVMuyWM",
    authDomain: "stok-manadjment-v1.firebaseapp.com",
    projectId: "stok-manadjment-v1",
    storageBucket: "stok-manadjment-v1.firebasestorage.app",
    messagingSenderId: "922477116435",
    appId: "1:922477116435:web:3cfa208bf26bedc78493e6"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
