// content.js - Content Script for Review Anything

// Placeholder for future widget injection
console.log('Review Anything content script loaded.');

// Example: Send a message to the background script
document.addEventListener('DOMContentLoaded', () => {
    chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
        if (response && response.status === 'OK') {
            console.log('Background script responded:', response.message);
        }
    });
});

// Future: Inject review/chat widget into the page, listen for DOM changes, etc.

// Inject the floating Review Anything widget into every page
(function() {
    if (window.__reviewAnythingWidgetInjected) return;
    window.__reviewAnythingWidgetInjected = true;

    // Create a container for the widget
    const container = document.createElement('div');
    container.id = 'review-anything-widget-root';
    document.body.appendChild(container);

    // Fetch the widget HTML and inject it
    fetch(chrome.runtime.getURL('widget.html'))
        .then(response => response.text())
        .then(html => {
            container.innerHTML = html;

            // Remove any <link rel="stylesheet" href="widget.css"> from the injected HTML
            const oldLinks = container.querySelectorAll('link[rel="stylesheet"][href="widget.css"]');
            oldLinks.forEach(link => link.parentNode.removeChild(link));

            // Inject widget.css from extension
            const style = document.createElement('link');
            style.rel = 'stylesheet';
            style.type = 'text/css';
            style.href = chrome.runtime.getURL('widget.css');
            document.head.appendChild(style);

            // Inject Firebase scripts
            const scripts = [
                'firebase-app.js',
                'firebase-firestore.js',
                'firebase-database.js',
                'firebase-config.js',
                'widget.js'
            ];
            function injectScript(i) {
                if (i >= scripts.length) return;
                const s = document.createElement('script');
                s.src = chrome.runtime.getURL(scripts[i]);
                s.onload = () => injectScript(i + 1);
                document.body.appendChild(s);
            }
            injectScript(0);
        });
})(); 