# Updated Firebase Security Rules for Anonymous Users

## Firestore Rules
Go to Firestore Database > Rules and replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reviews/{url} {
      allow read, write: if true;  // Allow anonymous access
    }
  }
}
```

## Realtime Database Rules
Go to Realtime Database > Rules and replace with:

```json
{
  "rules": {
    "chats": {
      "$url": {
        ".read": true,
        ".write": true
      }
    },
    "online": {
      "$url": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## Important Notes:
- These rules allow ANYONE to read and write data
- This is suitable for development/testing
- For production, consider adding rate limiting and content moderation
- The extension will now work with anonymous users

## How to Apply:
1. Go to Firebase Console
2. Navigate to Firestore Database > Rules
3. Replace the rules with the Firestore rules above
4. Navigate to Realtime Database > Rules  
5. Replace the rules with the Realtime Database rules above
6. Click "Publish" 