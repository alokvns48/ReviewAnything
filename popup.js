// Popup Controller
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
        
        // Add a small delay to prevent rapid re-initialization
        if (this.initInProgress) {
            console.log('⚠️ Initialization already in progress, skipping...');
            return;
        }
        
        this.initInProgress = true;
        
        try {
            this.showLoading();
            
            // Wait for Firebase to be available
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
            
            // Show URL normalization indicator if needed
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

    // Initialize user with random username
    async initializeUser() {
        try {
            // Try to get existing user data from Chrome storage
            const result = await chrome.storage.local.get(['reviewAnything_userId', 'reviewAnything_username']);
            
            if (result.reviewAnything_userId && result.reviewAnything_username) {
                // Use existing user data
                this.userId = result.reviewAnything_userId;
                this.username = result.reviewAnything_username;
                console.log('✅ Loaded existing user:', { userId: this.userId, username: this.username });
            } else {
                // Generate new user ID and username
                this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                this.username = this.generateRandomUsername();
                
                // Store in Chrome storage (persists across all windows/tabs)
                await chrome.storage.local.set({
                    'reviewAnything_userId': this.userId,
                    'reviewAnything_username': this.username
                });
                console.log('🆕 Created new user:', { userId: this.userId, username: this.username });
            }
            
            // Display username in UI
            this.updateUsernameDisplay();
            
        } catch (error) {
            console.error('❌ Error initializing user:', error);
            // Fallback to session-based user if storage fails
            this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            this.username = this.generateRandomUsername();
            this.updateUsernameDisplay();
            console.log('🔄 Fallback user created:', { userId: this.userId, username: this.username });
        }
    }

    // Update username display in UI
    updateUsernameDisplay() {
        const usernameElement = document.getElementById('currentUsername');
        if (usernameElement && this.username) {
            usernameElement.textContent = this.username;
        }
    }

    // Generate random username
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

    // Normalize URL to handle tracking parameters and session-specific values
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            let wasNormalized = false;
            
            // Handle Amazon URLs specifically
            if (urlObj.hostname.includes('amazon.')) {
                // Extract the core product path (e.g., /PHILIPS-Fryer-NA120-00-Technology/dp/B0D14BB5XY/)
                const pathParts = urlObj.pathname.split('/');
                const dpIndex = pathParts.findIndex(part => part === 'dp');
                
                if (dpIndex !== -1 && dpIndex + 1 < pathParts.length) {
                    const productId = pathParts[dpIndex + 1];
                    // Reconstruct the core product URL
                    const coreUrl = `${urlObj.protocol}//${urlObj.hostname}/dp/${productId}/`;
                    console.log('🔄 Normalized Amazon URL:', { original: url, normalized: coreUrl });
                    wasNormalized = true;
                    return { url: coreUrl, normalized: true };
                }
            }
            
            // Handle Flipkart URLs specifically
            if (urlObj.hostname.includes('flipkart.')) {
                // Extract the core product path (e.g., /boult-z60-60hr-battery-quad-mic-enc-50ms-ultra-low-latency-made-india-5-3-bluetooth/p/itmf2872be099354)
                const pathParts = urlObj.pathname.split('/');
                const pIndex = pathParts.findIndex(part => part === 'p');
                
                if (pIndex !== -1 && pIndex + 1 < pathParts.length) {
                    const productId = pathParts[pIndex + 1];
                    // Reconstruct the core product URL
                    const coreUrl = `${urlObj.protocol}//${urlObj.hostname}/p/${productId}`;
                    console.log('🔄 Normalized Flipkart URL:', { original: url, normalized: coreUrl });
                    wasNormalized = true;
                    return { url: coreUrl, normalized: true };
                }
            }
            
            // For other URLs, remove common tracking parameters
            const trackingParams = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'gclid', 'fbclid', 'msclkid', 'ref', 'source', 'campaign',
                'pd_rd_w', 'pf_rd_r', 'pd_rd_r', 'pd_rd_wg', 'content-id', 'pf_rd_p',
                // Flipkart specific tracking parameters
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
            return { url: url, normalized: false }; // Return original URL if normalization fails
        }
    }

    // Get current tab URL
    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const normalizedResult = this.normalizeUrl(tab.url);
            this.currentUrl = normalizedResult.url;
            console.log('Current URL:', this.currentUrl);
            return normalizedResult.normalized;
        } catch (error) {
            console.error('Error getting current tab:', error);
            throw error;
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Check if listeners are already attached
        if (this.eventListenersAttached) {
            console.log('⚠️ Event listeners already attached, skipping...');
            return;
        }

        // Review form
        document.getElementById('submitReview').addEventListener('click', () => this.submitReview());
        document.getElementById('reviewComment').addEventListener('input', (e) => this.updateCharCount(e, 'charCount'));

        // Chat
        document.getElementById('sendMessage').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chatMessage').addEventListener('input', (e) => this.updateCharCount(e, 'chatCharCount'));
        document.getElementById('chatMessage').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });

        // Star rating
        const starRating = document.querySelector('.star-rating');
        starRating.addEventListener('click', (e) => this.handleStarClick(e));
        starRating.addEventListener('mouseover', (e) => this.handleStarHover(e));
        starRating.addEventListener('mouseout', () => this.handleStarHoverOut());

        // Refresh username
        document.getElementById('refreshUsername').addEventListener('click', () => this.refreshUsername());

        // Retry button
        document.getElementById('retryBtn').addEventListener('click', () => this.retry());

        // Back button
        document.getElementById('backBtn').addEventListener('click', () => this.goBack());

        this.eventListenersAttached = true;
        console.log('✅ Event listeners attached');
    }

    // Setup tab navigation
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

    // Switch between tabs
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        this.currentTab = tabName;

        // Load data for the selected tab
        if (tabName === 'reviews') {
            this.loadReviews();
        } else if (tabName === 'chat') {
            this.loadChat();
        }
    }

    // Load reviews
    async loadReviews() {
        if (!this.currentUrl) return;

        try {
            // Check if Firebase service is available
            if (!window.FirebaseService || !window.FirebaseService.db) {
                console.error('❌ Firebase Firestore not available');
                this.showError('Firebase service not available. Please refresh the extension.');
                return;
            }

            const encodedUrl = FirebaseService.encodeUrlForFirebase(this.currentUrl);
            const reviewsRef = FirebaseService.db.collection('reviews').doc(encodedUrl);
            
            // Listen for real-time updates
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

    // Display reviews
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

    // Create review element
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

    // Update rating summary
    updateRatingSummary(reviewsData) {
        const reviews = Object.values(reviewsData);
        const avgRating = reviews.length > 0 
            ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
            : '0.0';
        
        document.getElementById('avgRating').textContent = avgRating;
        document.getElementById('reviewCount').textContent = `(${reviews.length} reviews)`;
    }

    // Submit review
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
            // Check if Firebase service is available
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

            // Clear form
            this.clearReviewForm();
            this.showSuccess('Review submitted successfully!');
        } catch (error) {
            console.error('Error submitting review:', error);
            this.showError('Failed to submit review. Please try again.');
        }
    }

    // Clear review form
    clearReviewForm() {
        document.getElementById('reviewComment').value = '';
        this.selectedRating = 0;
        this.updateStarDisplay();
        this.updateCharCount({ target: { value: '' } }, 'charCount');
    }

    // Handle star rating
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

    // Load chat
    async loadChat() {
        if (!this.currentUrl) return;

        try {
            // Check if Firebase service is available
            if (!window.FirebaseService || !window.FirebaseService.realtimeDb) {
                console.error('❌ Firebase Realtime Database not available');
                console.log('FirebaseService state:', window.FirebaseService);
                this.showError('Firebase Realtime Database not available. Please refresh the extension.');
                return;
            }

            // Clean up existing listeners
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
            
            // Debug: Check if chatRef is valid
            if (!chatRef || typeof chatRef.on !== 'function') {
                console.error('❌ Invalid chat reference created:', chatRef);
                this.showError('Failed to create chat reference. Please refresh the extension.');
                return;
            }
            
            console.log('✅ Chat reference created successfully:', chatRef);
            
            // Ensure the reference is properly initialized
            if (!chatRef.root || !chatRef.root.database) {
                console.error('❌ Chat reference not properly initialized');
                this.showError('Firebase reference not ready. Please refresh the extension.');
                return;
            }
            
            // Listen for real-time chat messages
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

            // Listen for online users
            const onlineRef = FirebaseService.realtimeDb.ref(`online/${encodedUrl}`);
            
            // Debug: Check if onlineRef is valid
            if (!onlineRef || typeof onlineRef.on !== 'function') {
                console.error('❌ Invalid online users reference created:', onlineRef);
                return;
            }
            
            console.log('✅ Online users reference created successfully:', onlineRef);
            
            // Ensure the reference is properly initialized
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

            // Update online status
            this.updateOnlineStatus(encodedUrl, true);
            
            console.log('✅ Chat listeners set up successfully');
        } catch (error) {
            console.error('Error setting up chat listener:', error);
            this.showError('Failed to load chat. Please refresh the extension.');
        }
    }

    // Display chat messages
    displayChatMessages(messagesData) {
        const chatMessages = document.getElementById('chatMessages');
        
        if (!messagesData) {
            chatMessages.innerHTML = '<p class="no-messages">No messages yet. Start the conversation!</p>';
            return;
        }

        const messages = Object.values(messagesData).sort((a, b) => a.timestamp - b.timestamp);
        
        // Filter out duplicate messages (same userId, message, and timestamp within 2 seconds)
        // Made less aggressive to allow messages from different windows
        const uniqueMessages = messages.filter((message, index, arr) => {
            if (index === 0) return true;
            const prevMessage = arr[index - 1];
            return !(
                message.userId === prevMessage.userId &&
                message.message === prevMessage.message &&
                Math.abs(message.timestamp - prevMessage.timestamp) < 2000 // Reduced from 5000ms to 2000ms
            );
        });

        // Only update if messages have changed
        const currentMessages = chatMessages.innerHTML;
        const newMessagesHTML = uniqueMessages.map(message => {
            const messageElement = this.createChatMessageElement(message);
            return messageElement.outerHTML;
        }).join('');

        if (currentMessages !== newMessagesHTML) {
            chatMessages.innerHTML = newMessagesHTML;
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // Create chat message element
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

    // Send chat message
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

        // Enforce 30-second interval between messages per user (persistent across popups)
        const CHAT_MESSAGE_INTERVAL = 10000; // 30 seconds
        const storageKey = `reviewAnything_lastChatTimestamp_${this.userId}`;
        const now = Date.now();
        const result = await chrome.storage.local.get([storageKey]);
        const lastTimestamp = result[storageKey] || 0;

        if (now - lastTimestamp < CHAT_MESSAGE_INTERVAL) {
            const secondsLeft = Math.ceil((CHAT_MESSAGE_INTERVAL - (now - lastTimestamp)) / 1000);
            this.showValidationMessage(`Please wait ${secondsLeft} seconds before sending another message.`);
            return;
        }

        // Save the new timestamp
        await chrome.storage.local.set({ [storageKey]: now });

        try {
            // Check if Firebase service is available
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

            // Clear input
            document.getElementById('chatMessage').value = '';
            this.updateCharCount({ target: { value: '' } }, 'chatCharCount');
            
            console.log('✅ Message sent successfully:', { message: messageText, timestamp: now, userId: this.userId });
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message. Please try again.');
        }
    }

    // Update online status
    updateOnlineStatus(encodedUrl, isOnline) {
        try {
            // Check if Firebase service is available
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
                
                // Remove user when they disconnect
                onlineRef.onDisconnect().remove();
            } else {
                onlineRef.remove();
            }
        } catch (error) {
            console.error('Error updating online status:', error);
        }
    }

    // Update character count
    updateCharCount(event, counterId) {
        const count = event.target.value.length;
        document.getElementById(counterId).textContent = count;
    }

    // Clear reviews
    clearReviews() {
        document.getElementById('reviewsList').innerHTML = '<p class="no-reviews">No reviews yet. Be the first to review this page!</p>';
        document.getElementById('avgRating').textContent = '0.0';
        document.getElementById('reviewCount').textContent = '(0 reviews)';
    }

    // Clear chat
    clearChat() {
        document.getElementById('chatMessages').innerHTML = '<p class="no-messages">No messages yet. Start the conversation!</p>';
        document.getElementById('onlineUsers').textContent = '0 online';
    }

    // Show loading state
    showLoading() {
        document.getElementById('loadingState').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('errorState').style.display = 'none';
    }

    // Hide loading state
    hideLoading() {
        document.getElementById('loadingState').style.display = 'none';
    }

    // Show main content
    showMainContent() {
        document.getElementById('mainContent').style.display = 'block';
    }

    // Show error
    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorState').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
    }

    // Show validation message
    showValidationMessage(message) {
        // Create temporary validation notification
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

    // Show success message
    showSuccess(message) {
        // Create temporary success notification
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

    // Retry functionality
    retry() {
        // Hide error state and show main content
        document.getElementById('errorState').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        
        // Try to reinitialize if needed
        if (!this.isInitialized) {
            this.init();
        }
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Utility: Check for banned words
    containsBannedWords(text) {
        const lower = text.toLowerCase();
        return this.bannedWords.some(word => lower.includes(word));
    }

    // Cleanup listeners when popup closes
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
        
        // Update online status to offline
        if (this.currentUrl) {
            const encodedUrl = FirebaseService.encodeUrlForFirebase(this.currentUrl);
            this.updateOnlineStatus(encodedUrl, false);
        }
    }

    // Refresh username
    async refreshUsername() {
        try {
            this.username = this.generateRandomUsername();
            
            // Update in Chrome storage
            await chrome.storage.local.set({
                'reviewAnything_username': this.username
            });
            
            // Update UI
            this.updateUsernameDisplay();
            
            this.showSuccess('New username generated!');
        } catch (error) {
            console.error('Error refreshing username:', error);
            this.showError('Failed to generate new username');
        }
    }

    // Back button functionality
    goBack() {
        // Hide error state and show main content
        document.getElementById('errorState').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        
        // Try to reinitialize if needed
        if (!this.isInitialized) {
            this.init();
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const popup = new ReviewAnythingPopup();
    
    // Cleanup when popup is about to unload
    window.addEventListener('beforeunload', () => {
        popup.cleanup();
    });
}); 