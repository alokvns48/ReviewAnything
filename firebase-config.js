// Firebase Configuration
// To get these values:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project or select existing one
// 3. Click the gear icon -> Project settings
// 4. Scroll to "Your apps" section
// 5. Click the web icon (</>) to add a web app
// 6. Copy the config object and replace the values below

// Note: Firebase SDK may show CSP warnings for internal scripts, but these don't affect functionality

const firebaseConfig = {
    apiKey: "AIzaSyCuFT6ofH97TuLTNXB61T-nOKSXsHVEmLY",
    authDomain: "review-anything-bfd28.firebaseapp.com",
    databaseURL: "https://review-anything-bfd28-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "review-anything-bfd28",
    storageBucket: "review-anything-bfd28.firebasestorage.app",
    messagingSenderId: "77138232204",
    appId: "1:77138232204:web:c5eed212ce6d5b63480ca9",
    measurementId: "G-T7TT8NDZGE"
};

// Initialize Firebase with error handling
try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
}

// Initialize Firebase services (no Auth needed)
let db, realtimeDb;

try {
    db = firebase.firestore();
    console.log('✅ Firestore initialized successfully');
} catch (error) {
    console.error('❌ Firestore initialization error:', error);
    db = null;
}

try {
    realtimeDb = firebase.database();
    console.log('✅ Realtime Database initialized successfully');
} catch (error) {
    console.error('❌ Realtime Database initialization error:', error);
    realtimeDb = null;
}

// Note: Disabled persistence for Chrome extension to avoid multi-tab conflicts
// The popup-based nature of the extension doesn't require offline persistence

// Utility function to encode URL for Firebase key
function encodeUrlForFirebase(url) {
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '_');
}

// Utility function to decode URL from Firebase key
function decodeUrlFromFirebase(encodedUrl) {
    return atob(encodedUrl.replace(/_/g, '='));
}

// Export functions for use in other files
window.FirebaseService = {
    db,
    realtimeDb,
    encodeUrlForFirebase,
    decodeUrlFromFirebase
};

// Log the final state
console.log('📊 Firebase Service Status:', {
    firestore: db ? '✅ Available' : '❌ Failed',
    realtimeDb: realtimeDb ? '✅ Available' : '❌ Failed'
}); 