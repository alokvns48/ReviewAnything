// Popup Controller (Quick fix: copied from popup.js)
class ReviewAnythingPopup {
    constructor() {
        this.currentUrl = '';
        this.currentTab = 'reviews';
        this.selectedRating = 0;
        this.reviewsListener = null;
        this.chatListener = null;
        this.onlineUsersListener = null;
        this.userId = null;
        this.username = null;
        this.isInitialized = false; // Flag to prevent duplicate initialization
        this.lastMessageTimestamp = 0; // Track last message to prevent duplicates
        this.lastMessageText = ''; // Track last message content
        this.eventListenersAttached = false; // Flag to prevent duplicate event listener attachment
        this.initInProgress = false; // Flag to prevent rapid re-initialization
        this.bannedWords = [
            'spam', 'scam', 'offensive', 'abuse', 'hate', 'badword1', 'badword2' // Add more as needed
        ];
        this.init();
    }

    async init() {
        if (this.isInitialized) {
            console.log('⚠️ Already initialized, skipping...');
            return;
        }
        if (this.initInProgress) {
            console.log('⚠️ Initialization already in progress, skipping...');
            return;
        }
        this.initInProgress = true;
        try {
            this.showLoading();
            let attempts = 0;
            const maxAttempts = 10;
            while (!window.FirebaseService && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            if (!window.FirebaseService) {
                console.error('❌ Firebase service not available after initialization attempts');
                this.showError('Unable to connect to Firebase. Please check your internet connection and refresh the extension.');
                return;
            }
            const wasNormalized = await this.getCurrentTab();
            if (wasNormalized) {
                const urlIndicator = document.getElementById('urlIndicator');
                if (urlIndicator) {
                    urlIndicator.style.display = 'inline-block';
                }
            }
            await this.initializeUser();
            this.setupEventListeners();
            this.setupTabNavigation();
            this.loadReviews();
            this.loadChat();
            this.hideLoading();
            this.showMainContent();
            this.isInitialized = true;
            this.initInProgress = false;
            console.log('✅ Extension initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.initInProgress = false;
            this.showError('Failed to initialize extension. Please refresh and try again.');
        }
    }

    async initializeUser() {
        try {
            // Use localStorage for widget context
            const userId = localStorage.getItem('reviewAnything_userId');
            const username = localStorage.getItem('reviewAnything_username');
            if (userId && username) {
                this.userId = userId;
                this.username = username;
                console.log('✅ Loaded existing user:', { userId: this.userId, username: this.username });
            } else {
                this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                this.username = this.generateRandomUsername();
                localStorage.setItem('reviewAnything_userId', this.userId);
                localStorage.setItem('reviewAnything_username', this.username);
                console.log('🆕 Created new user:', { userId: this.userId, username: this.username });
            }
            this.updateUsernameDisplay();
        } catch (error) {
            console.error('❌ Error initializing user:', error);
            this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            this.username = this.generateRandomUsername();
            this.updateUsernameDisplay();
            console.log('🔄 Fallback user created:', { userId: this.userId, username: this.username });
        }
    }

    updateUsernameDisplay() {
        const usernameElement = document.getElementById('currentUsername');
        if (usernameElement && this.username) {
            usernameElement.textContent = this.username;
        }
    }

    generateRandomUsername() {
        const adjectives = [
            'Happy', 'Clever', 'Brave', 'Wise', 'Swift', 'Bright', 'Calm', 'Eager',
            'Friendly', 'Gentle', 'Honest', 'Kind', 'Lucky', 'Mighty', 'Noble', 'Proud',
            'Quick', 'Smart', 'Strong', 'True', 'Warm', 'Young', 'Bold', 'Cool',
            'Daring', 'Fresh', 'Golden', 'Heroic', 'Inspired', 'Joyful', 'Magical'
        ];
        const nouns = [
            'Explorer', 'Adventurer', 'Hero', 'Wizard', 'Knight', 'Pioneer', 'Champion',
            'Guardian', 'Warrior', 'Sage', 'Mage', 'Ranger', 'Scout', 'Voyager',
            'Discoverer', 'Navigator', 'Seeker', 'Wanderer', 'Traveler', 'Pilgrim',
            'Nomad', 'Rover', 'Rambler', 'Hiker', 'Climber', 'Swimmer', 'Runner',
            'Jumper', 'Dancer', 'Singer', 'Artist', 'Writer', 'Thinker', 'Dreamer'
        ];
        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNumber = Math.floor(Math.random() * 999) + 1;
        return `${randomAdjective}${randomNoun}${randomNumber}`;
    }

    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            let wasNormalized = false;
            if (urlObj.hostname.includes('amazon.')) {
                const pathParts = urlObj.pathname.split('/');
                const dpIndex = pathParts.findIndex(part => part === 'dp');
                if (dpIndex !== -1 && dpIndex + 1 < pathParts.length) {
                    const productId = pathParts[dpIndex + 1];
                    const coreUrl = `${urlObj.protocol}//${urlObj.hostname}/dp/${productId}/`;
                    console.log('🔄 Normalized Amazon URL:', { original: url, normalized: coreUrl });
                    wasNormalized = true;
                    return { url: coreUrl, normalized: true };
                }
            }
            if (urlObj.hostname.includes('flipkart.')) {
                const pathParts = urlObj.pathname.split('/');
                const pIndex = pathParts.findIndex(part => part === 'p');
                if (pIndex !== -1 && pIndex + 1 < pathParts.length) {
                    const productId = pathParts[pIndex + 1];
                    const coreUrl = `${urlObj.protocol}//${urlObj.hostname}/p/${productId}`;
                    console.log('🔄 Normalized Flipkart URL:', { original: url, normalized: coreUrl });
                    wasNormalized = true;
                    return { url: coreUrl, normalized: true };
                }
            }
            const trackingParams = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'gclid', 'fbclid', 'msclkid', 'ref', 'source', 'campaign',
                'pd_rd_w', 'pf_rd_r', 'pd_rd_r', 'pd_rd_wg', 'content-id', 'pf_rd_p',
                'pid', 'lid', 'marketplace', 'store', 'srno', 'otracker', 'fm', 'iid', 'ppt', 'ppn', 'ssid'
            ];
            let hasTrackingParams = false;
            trackingParams.forEach(param => {
                if (urlObj.searchParams.has(param)) {
                    urlObj.searchParams.delete(param);
                    hasTrackingParams = true;
                }
            });
            if (hasTrackingParams) {
                const normalizedUrl = urlObj.toString();
                console.log('🔄 Normalized URL:', { original: url, normalized: normalizedUrl });
                return { url: normalizedUrl, normalized: true };
            }
            return { url: url, normalized: false };
        } catch (error) {
            console.error('❌ Error normalizing URL:', error);
            return { url: url, normalized: false };
        }
    }

    async getCurrentTab() {
        try {
            // Use window.location.href in content script context
            const url = window.location.href;
            const normalizedResult = this.normalizeUrl(url);
            this.currentUrl = normalizedResult.url;
            console.log('Current URL:', this.currentUrl);
            return normalizedResult.normalized;
        } catch (error) {
            console.error('Error getting current tab:', error);
            throw error;
        }
    }

    setupEventListeners() {
        if (this.eventListenersAttached) {
            console.log('⚠️ Event listeners already attached, skipping...');
            return;
        }
        document.getElementById('submitReview').addEventListener('click', () => this.submitReview());
        document.getElementById('reviewComment').addEventListener('input', (e) => this.updateCharCount(e, 'charCount'));
        document.getElementById('sendMessage').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chatMessage').addEventListener('input', (e) => this.updateCharCount(e, 'chatCharCount'));
        document.getElementById('chatMessage').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        const starRating = document.querySelector('.star-rating');
        starRating.addEventListener('click', (e) => this.handleStarClick(e));
        starRating.addEventListener('mouseover', (e) => this.handleStarHover(e));
        starRating.addEventListener('mouseout', () => this.handleStarHoverOut());
        document.getElementById('refreshUsername').addEventListener('click', () => this.refreshUsername());
        document.getElementById('retryBtn').addEventListener('click', () => this.retry());
        document.getElementById('backBtn').addEventListener('click', () => this.goBack());
        this.eventListenersAttached = true;
        console.log('✅ Event listeners attached');
    }

    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
        this.currentTab = tabName;
        if (tabName === 'reviews') {
            this.loadReviews();
        } else if (tabName === 'chat') {
            this.loadChat();
        }
    }

    async loadReviews() {
        if (!this.currentUrl) return;
        try {
            if (!window.FirebaseService || !window.FirebaseService.db) {
                console.error('❌ Firebase Firestore not available');
                this.showError('Firebase service not available. Please refresh the extension.');
                return;
            }
            const encodedUrl = FirebaseService.encodeUrlForFirebase(this.currentUrl);
            const reviewsRef = FirebaseService.db.collection('reviews').doc(encodedUrl);
            this.reviewsListener = reviewsRef.onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    this.displayReviews(data);
                    this.updateRatingSummary(data);
                } else {
                    this.clearReviews();
                }
            }, (error) => {
                console.error('Error loading reviews:', error);
                this.showError('Failed to load reviews');
            });
        } catch (error) {
            console.error('Error setting up reviews listener:', error);
            this.showError('Failed to load reviews');
        }
    }

    displayReviews(reviewsData) {
        const reviewsList = document.getElementById('reviewsList');
        reviewsList.innerHTML = '';
        const reviews = Object.values(reviewsData).sort((a, b) => b.timestamp - a.timestamp);
        if (reviews.length === 0) {
            reviewsList.innerHTML = '<p class="no-reviews">No reviews yet. Be the first to review this page!</p>';
            return;
        }
        reviews.forEach(review => {
            const reviewElement = this.createReviewElement(review);
            reviewsList.appendChild(reviewElement);
        });
    }

    createReviewElement(review) {
        const reviewDiv = document.createElement('div');
        reviewDiv.className = 'review-item fade-in';
        const date = new Date(review.timestamp).toLocaleDateString();
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        reviewDiv.innerHTML = `
            <div class="review-header">
                <span class="reviewer-name">${this.escapeHtml(review.name)}</span>
                <span class="review-date">${date}</span>
            </div>
            <div class="review-rating">
                ${stars}
            </div>
            <div class="review-comment">${this.escapeHtml(review.comment)}</div>
        `;
        return reviewDiv;
    }

    updateRatingSummary(reviewsData) {
        const reviews = Object.values(reviewsData);
        const avgRating = reviews.length > 0 
            ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
            : '0.0';
        document.getElementById('avgRating').textContent = avgRating;
        document.getElementById('reviewCount').textContent = `(${reviews.length} reviews)`;
    }

    async submitReview() {
        if (this.selectedRating === 0) {
            this.showValidationMessage('Please select a rating');
            return;
        }
        const comment = document.getElementById('reviewComment').value.trim();
        if (!comment) {
            this.showValidationMessage('Please enter a comment');
            return;
        }
        if (this.containsBannedWords(comment)) {
            this.showValidationMessage('Your review contains inappropriate language.');
            return;
        }
        if (comment.length > 1000) {
            this.showValidationMessage('Review is too long. Maximum 1000 characters allowed.');
            return;
        }
        try {
            if (!window.FirebaseService || !window.FirebaseService.db) {
                console.error('❌ Firebase Firestore not available');
                this.showError('Firebase service not available. Please refresh the extension.');
                return;
            }
            const review = {
                userId: this.userId,
                name: this.username,
                comment: comment,
                rating: this.selectedRating,
                timestamp: Date.now()
            };
            const encodedUrl = FirebaseService.encodeUrlForFirebase(this.currentUrl);
            const reviewsRef = FirebaseService.db.collection('reviews').doc(encodedUrl);
            await reviewsRef.set({
                [this.userId]: review
            }, { merge: true });
            this.clearReviewForm();
            this.showSuccess('Review submitted successfully!');
        } catch (error) {
            console.error('Error submitting review:', error);
            this.showError('Failed to submit review. Please try again.');
        }
    }

    clearReviewForm() {
        document.getElementById('reviewComment').value = '';
        this.selectedRating = 0;
        this.updateStarDisplay();
        this.updateCharCount({ target: { value: '' } }, 'charCount');
    }

    handleStarClick(e) {
        if (e.target.classList.contains('star')) {
            const rating = parseInt(e.target.dataset.rating);
            this.selectedRating = rating;
            this.updateStarDisplay();
        }
    }

    handleStarHover(e) {
        if (e.target.classList.contains('star')) {
            const rating = parseInt(e.target.dataset.rating);
            this.updateStarDisplay(rating);
        }
    }

    handleStarHoverOut() {
        this.updateStarDisplay();
    }

    updateStarDisplay(hoverRating = null) {
        const stars = document.querySelectorAll('.star-rating .star');
        const rating = hoverRating || this.selectedRating;
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }

    async loadChat() {
        if (!this.currentUrl) return;
        try {
            if (!window.FirebaseService || !window.FirebaseService.realtimeDb) {
                console.error('❌ Firebase Realtime Database not available');
                console.log('FirebaseService state:', window.FirebaseService);
                this.showError('Firebase Realtime Database not available. Please refresh the extension.');
                return;
            }
            if (this.chatListener) {
                this.chatListener();
                this.chatListener = null;
            }
            if (this.onlineUsersListener) {
                this.onlineUsersListener();
                this.onlineUsersListener = null;
            }
            const encodedUrl = FirebaseService.encodeUrlForFirebase(this.currentUrl);
            const chatRef = FirebaseService.realtimeDb.ref(`chats/${encodedUrl}`);
            if (!chatRef || typeof chatRef.on !== 'function') {
                console.error('❌ Invalid chat reference created:', chatRef);
                this.showError('Failed to create chat reference. Please refresh the extension.');
                return;
            }
            console.log('✅ Chat reference created successfully:', chatRef);
            if (!chatRef.root || !chatRef.root.database) {
                console.error('❌ Chat reference not properly initialized');
                this.showError('Firebase reference not ready. Please refresh the extension.');
                return;
            }
            this.chatListener = chatRef.on('value', (snapshot) => {
                try {
                    if (!snapshot) {
                        console.log('📭 No snapshot received (normal for empty data)');
                        this.displayChatMessages(null);
                        return;
                    }
                    if (typeof snapshot.val !== 'function') {
                        console.error('❌ Invalid snapshot received:', snapshot);
                        return;
                    }
                    const data = snapshot.val();
                    this.displayChatMessages(data);
                } catch (error) {
                    console.error('❌ Error processing chat snapshot:', error);
                }
            }, (error) => {
                console.error('Error loading chat:', error);
                this.showError('Failed to load chat');
            });
            const onlineRef = FirebaseService.realtimeDb.ref(`online/${encodedUrl}`);
            if (!onlineRef || typeof onlineRef.on !== 'function') {
                console.error('❌ Invalid online users reference created:', onlineRef);
                return;
            }
            console.log('✅ Online users reference created successfully:', onlineRef);
            if (!onlineRef.root || !onlineRef.root.database) {
                console.error('❌ Online users reference not properly initialized');
                return;
            }
            this.onlineUsersListener = onlineRef.on('value', (snapshot) => {
                try {
                    if (!snapshot) {
                        console.log('📭 No online users snapshot received (normal for empty data)');
                        document.getElementById('onlineUsers').textContent = '0 online';
                        return;
                    }
                    if (typeof snapshot.val !== 'function') {
                        console.error('❌ Invalid online users snapshot received:', snapshot);
                        return;
                    }
                    const onlineUsers = snapshot.val() || {};
                    const count = Object.keys(onlineUsers).length;
                    document.getElementById('onlineUsers').textContent = `${count} online`;
                } catch (error) {
                    console.error('❌ Error processing online users snapshot:', error);
                }
            });
            this.updateOnlineStatus(encodedUrl, true);
            console.log('✅ Chat listeners set up successfully');
        } catch (error) {
            console.error('Error setting up chat listener:', error);
            this.showError('Failed to load chat. Please refresh the extension.');
        }
    }

    displayChatMessages(messagesData) {
        const chatMessages = document.getElementById('chatMessages');
        if (!messagesData) {
            chatMessages.innerHTML = '<p class="no-messages">No messages yet. Start the conversation!</p>';
            return;
        }
        const messages = Object.values(messagesData).sort((a, b) => a.timestamp - b.timestamp);
        const uniqueMessages = messages.filter((message, index, arr) => {
            if (index === 0) return true;
            const prevMessage = arr[index - 1];
            return !(
                message.userId === prevMessage.userId &&
                message.message === prevMessage.message &&
                Math.abs(message.timestamp - prevMessage.timestamp) < 2000
            );
        });
        const currentMessages = chatMessages.innerHTML;
        const newMessagesHTML = uniqueMessages.map(message => {
            const messageElement = this.createChatMessageElement(message);
            return messageElement.outerHTML;
        }).join('');
        if (currentMessages !== newMessagesHTML) {
            chatMessages.innerHTML = newMessagesHTML;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    createChatMessageElement(message) {
        const messageDiv = document.createElement('div');
        const isOwnMessage = message.userId === this.userId;
        messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'} fade-in`;
        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${this.escapeHtml(message.name)}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.message)}</div>
        `;
        return messageDiv;
    }

    async sendChatMessage() {
        const messageText = document.getElementById('chatMessage').value.trim();
        if (!messageText) {
            this.showValidationMessage('Please enter a message');
            return;
        }
        if (this.containsBannedWords(messageText)) {
            this.showValidationMessage('Your message contains inappropriate language.');
            return;
        }
        if (messageText.length > 500) {
            this.showValidationMessage('Message is too long. Maximum 500 characters allowed.');
            return;
        }
        const CHAT_MESSAGE_INTERVAL = 10000; // 30 seconds
        const storageKey = `reviewAnything_lastChatTimestamp_${this.userId}`;
        const now = Date.now();
        const lastTimestamp = parseInt(localStorage.getItem(storageKey) || '0', 10);
        if (now - lastTimestamp < CHAT_MESSAGE_INTERVAL) {
            const secondsLeft = Math.ceil((CHAT_MESSAGE_INTERVAL - (now - lastTimestamp)) / 1000);
            this.showValidationMessage(`Please wait ${secondsLeft} seconds before sending another message.`);
            return;
        }
        localStorage.setItem(storageKey, now.toString());
        try {
            if (!window.FirebaseService || !window.FirebaseService.realtimeDb) {
                console.error('❌ Firebase Realtime Database not available');
                this.showError('Firebase service not available. Please refresh the extension.');
                return;
            }
            const message = {
                userId: this.userId,
                name: this.username,
                message: messageText,
                timestamp: now
            };
            const encodedUrl = FirebaseService.encodeUrlForFirebase(this.currentUrl);
            const chatRef = FirebaseService.realtimeDb.ref(`chats/${encodedUrl}`);
            await chatRef.push(message);
            document.getElementById('chatMessage').value = '';
            this.updateCharCount({ target: { value: '' } }, 'chatCharCount');
            console.log('✅ Message sent successfully:', { message: messageText, timestamp: now, userId: this.userId });
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message. Please try again.');
        }
    }

    updateOnlineStatus(encodedUrl, isOnline) {
        try {
            if (!window.FirebaseService || !window.FirebaseService.realtimeDb) {
                console.error('❌ Firebase Realtime Database not available for online status');
                return;
            }
            const onlineRef = FirebaseService.realtimeDb.ref(`online/${encodedUrl}/${this.userId}`);
            if (isOnline) {
                onlineRef.set({
                    name: this.username,
                    timestamp: Date.now()
                });
                onlineRef.onDisconnect().remove();
            } else {
                onlineRef.remove();
            }
        } catch (error) {
            console.error('Error updating online status:', error);
        }
    }

    updateCharCount(event, counterId) {
        const count = event.target.value.length;
        document.getElementById(counterId).textContent = count;
    }

    clearReviews() {
        document.getElementById('reviewsList').innerHTML = '<p class="no-reviews">No reviews yet. Be the first to review this page!</p>';
        document.getElementById('avgRating').textContent = '0.0';
        document.getElementById('reviewCount').textContent = '(0 reviews)';
    }

    clearChat() {
        document.getElementById('chatMessages').innerHTML = '<p class="no-messages">No messages yet. Start the conversation!</p>';
        document.getElementById('onlineUsers').textContent = '0 online';
    }

    showLoading() {
        document.getElementById('loadingState').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('errorState').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loadingState').style.display = 'none';
    }

    showMainContent() {
        document.getElementById('mainContent').style.display = 'block';
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorState').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
    }

    showValidationMessage(message) {
        const notification = document.createElement('div');
        notification.className = 'validation-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ffc107;
            color: #212529;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
            font-weight: 500;
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showSuccess(message) {
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    retry() {
        document.getElementById('errorState').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        if (!this.isInitialized) {
            this.init();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    containsBannedWords(text) {
        const lower = text.toLowerCase();
        return this.bannedWords.some(word => lower.includes(word));
    }

    cleanup() {
        if (this.reviewsListener) {
            this.reviewsListener();
        }
        if (this.chatListener) {
            this.chatListener();
        }
        if (this.onlineUsersListener) {
            this.onlineUsersListener();
        }
        if (this.currentUrl) {
            const encodedUrl = FirebaseService.encodeUrlForFirebase(this.currentUrl);
            this.updateOnlineStatus(encodedUrl, false);
        }
    }

    async refreshUsername() {
        try {
            this.username = this.generateRandomUsername();
            localStorage.setItem('reviewAnything_username', this.username);
            this.updateUsernameDisplay();
            this.showSuccess('New username generated!');
        } catch (error) {
            console.error('Error refreshing username:', error);
            this.showError('Failed to generate new username');
        }
    }

    goBack() {
        document.getElementById('errorState').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        if (!this.isInitialized) {
            this.init();
        }
    }

}

// Floating Widget Logic
(function() {
    // Elements
    const floatingButton = document.getElementById('reviewAnythingButton');
    const widget = document.getElementById('reviewAnythingWidget');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const closeBtn = document.getElementById('closeBtn');
    const widgetHeader = document.getElementById('widgetHeader');

    // Show widget
    floatingButton.addEventListener('click', () => {
        floatingButton.style.display = 'none';
        widget.style.display = 'flex';
    });

    // Minimize widget
    minimizeBtn.addEventListener('click', () => {
        widget.style.display = 'none';
        floatingButton.style.display = 'flex';
    });

    // Close widget (removes it from DOM)
    closeBtn.addEventListener('click', () => {
        widget.style.display = 'none';
        floatingButton.style.display = 'flex';
    });

    // Drag logic
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    widgetHeader.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = widget.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        widget.style.left = (e.clientX - offsetX) + 'px';
        widget.style.top = (e.clientY - offsetY) + 'px';
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
        widget.style.position = 'fixed';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = '';
    });

    // Make widget initially appear at bottom right
    widget.style.left = '';
    widget.style.top = '';
    widget.style.right = '20px';
    widget.style.bottom = '20px';
    widget.style.position = 'fixed';

    // --- ReviewAnythingPopup logic injection ---
    // You can copy your ReviewAnythingPopup class from popup.js here,
    // or refactor your logic to be shared between popup.js and widget.js.
    // For now, just show the widget as a stub.

    // TODO: Integrate ReviewAnythingPopup logic here.

    // Quick fix: instantiate ReviewAnythingPopup if available
    if (typeof ReviewAnythingPopup === 'function') {
        window.reviewAnythingWidget = new ReviewAnythingPopup();
    }
})(); 