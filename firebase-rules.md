# Firebase Security Rules

## Firestore Rules
Go to Firestore Database > Rules and replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reviews/{url} {
      allow read: if true;
      allow write: if request.auth != null;
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
        ".write": "auth != null"
      }
    },
    "online": {
      "$url": {
        ".read": true,
        ".write": "auth != null"
      }
    }
  }
}
```

## Notes:
- These rules allow anyone to read reviews/chat but only authenticated users to write
- For production, add more restrictive rules based on your needs
- Consider adding rate limiting and content moderation rules 