// popup.js - Simple popup functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inboxie popup loaded');
    
    // Optional: Add click tracking or other popup functionality here
    const gmailLink = document.querySelector('a[href*="gmail.com"]');
    if (gmailLink) {
      gmailLink.addEventListener('click', function() {
        console.log('Gmail link clicked from popup');
      });
    }
  });