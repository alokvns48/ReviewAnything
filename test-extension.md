# Extension Test Guide

## CSP Warnings (Normal)
The CSP warnings you see are from Firebase SDK internal scripts and are **normal** for Chrome extensions. They don't affect functionality.

## Test Checklist

### ✅ User Initialization
- [ ] Extension loads without errors
- [ ] Username appears in header (e.g., "BraveExplorer123")
- [ ] Console shows: "✅ Loaded existing user" or "🆕 Created new user"

### ✅ Cross-Window Functionality
- [ ] Open multiple Chrome windows/tabs
- [ ] Same username appears in all windows
- [ ] Reviews submitted in one window appear in others
- [ ] Chat messages work across all windows

### ✅ Review Functionality
- [ ] Click stars to rate (1-5)
- [ ] Type review comment
- [ ] Submit review successfully
- [ ] Review appears in list with your username

### ✅ Chat Functionality
- [ ] Switch to Chat tab
- [ ] Type message and send
- [ ] Message appears with your username
- [ ] Online user count updates

### ✅ Username Management
- [ ] Click 🔄 button to generate new username
- [ ] New username appears immediately
- [ ] New username persists across windows

## Expected Console Output
```
✅ Firebase initialized successfully
✅ Loaded existing user: {userId: "...", username: "..."}
Current URL: https://...
```

## If Tests Pass
🎉 **Extension is working perfectly!** The CSP warnings can be ignored.

## If Tests Fail
Check:
1. Firebase rules are updated (see firebase-rules-updated.md)
2. Extension is reloaded in Chrome
3. No network connectivity issues 