// Constants
const BOOKMARK_FOLDER_NAME = "Shortcuts for Google.com";
const SHORTCUTS_PER_ROW = 10;
let hasInitialized = false; // Variable to track initialization status
let draggedItem = null; // Item being dragged
let draggedItemIndex = -1; // Index of item being dragged
let isDragging = false; // Current dragging status
let lastDropIndex = -1; // Last drop index
let dropMarker = null; // Drop position marker

// Dark mode detection function
function isDarkMode() {
  // Detect preferred color scheme using media query
  const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  // Analyze page background color (Google dark mode typically uses dark background)
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  const bgRgb = bodyBg.match(/\d+/g);
  
  // If RGB values exist and average is below 50, consider it a dark background
  const isDarkBg = bgRgb && bgRgb.length >= 3 && 
                  (parseInt(bgRgb[0]) + parseInt(bgRgb[1]) + parseInt(bgRgb[2])) / 3 < 50;
  
  // Additional check: Check if specific elements with dark mode classes or IDs exist in Google
  const hasDarkElements = document.querySelector('.dark-mode, .darkmode, [data-theme="dark"]') !== null;
  
  // Check if HTML or body has data-theme="dark" attribute
  const hasDataThemeDark = document.documentElement.getAttribute('data-theme') === 'dark' || 
                         document.body.getAttribute('data-theme') === 'dark';
  
  // Check for dark mode classes
  const hasDarkClass = document.documentElement.classList.contains('dark') || 
                     document.body.classList.contains('dark') ||
                     document.documentElement.classList.contains('darkmode') || 
                     document.body.classList.contains('darkmode');
  
  return prefersDarkScheme || isDarkBg || hasDarkElements || hasDataThemeDark || hasDarkClass;
}

// Function to adjust brightness of colors (lighter/darker)
function adjustBrightness(color, percent) {
  // Convert HEX color to RGB if needed
  if (color.startsWith('#')) {
    const r = parseInt(color.substring(1, 3), 16);
    const g = parseInt(color.substring(3, 5), 16);
    const b = parseInt(color.substring(5, 7), 16);
    
    // Adjust each RGB value (make lighter or darker)
    let adjustedR, adjustedG, adjustedB;
    
    if (percent > 0) {
      // Lighten (move towards 255)
      adjustedR = Math.min(255, r + (255 - r) * percent / 100);
      adjustedG = Math.min(255, g + (255 - g) * percent / 100);
      adjustedB = Math.min(255, b + (255 - b) * percent / 100);
    } else {
      // Darken (move towards 0)
      adjustedR = Math.max(0, r * (100 + percent) / 100);
      adjustedG = Math.max(0, g * (100 + percent) / 100);
      adjustedB = Math.max(0, b * (100 + percent) / 100);
    }
    
    // Convert back to HEX color
    return `#${Math.round(adjustedR).toString(16).padStart(2, '0')}${Math.round(adjustedG).toString(16).padStart(2, '0')}${Math.round(adjustedB).toString(16).padStart(2, '0')}`;
  }
  
  return color; // Return original color if conversion not possible
}

// Initialize dark mode detection and monitoring
function initDarkModeMonitoring() {
  // Detect dark mode
  const updateDarkModeStyles = () => {
    const darkMode = isDarkMode();
    const textColor = darkMode ? '#e8eaed' : '#202124';
    const plusColor = darkMode ? '#e8eaed' : '#202124';
    
    // Update CSS variables
    document.documentElement.style.setProperty('--shortcut-text-color', textColor);
    document.documentElement.style.setProperty('--plus-icon-color', plusColor);
    
    // Update text color of existing shortcuts
    document.querySelectorAll('.google-shortcut span, .google-add-shortcut span').forEach(span => {
      span.style.color = textColor;
    });
    
    // Update + icon color
    document.querySelectorAll('.add-shortcut-circle').forEach(circle => {
      circle.style.color = plusColor;
    });
  };
  
  // Initial execution
  updateDarkModeStyles();
  
  // Detect media query changes
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeMediaQuery.addEventListener('change', updateDarkModeStyles);
  
  // Detect DOM changes (when dark mode is toggled in Google page)
  const observer = new MutationObserver(mutations => {
    // Detect body class or background color changes
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class' || mutation.attributeName === 'style') {
        updateDarkModeStyles();
        break;
      }
    }
  });
  
  // Start observing body element
  observer.observe(document.body, { attributes: true });
  observer.observe(document.documentElement, { attributes: true });
}

// Main function to run when the page is loaded
function init() {
  // Prevent duplicate initialization
  if (document.getElementById('google-shortcuts-container')) {
    return;
  }
  
  // Check if we're on a Google homepage
  const isGooglePage = isGoogleHomepage();
  if (!isGooglePage) return;
  
  // Detect dark mode and set CSS variables
  const darkMode = isDarkMode();
  const textColor = darkMode ? '#e8eaed' : '#202124';
  const plusColor = darkMode ? '#e8eaed' : '#202124';
  
  // Set CSS variables
  document.documentElement.style.setProperty('--shortcut-text-color', textColor);
  document.documentElement.style.setProperty('--plus-icon-color', plusColor);
  
  // Start dark mode monitoring
  initDarkModeMonitoring();
  
  // Add background customization button
  addBackgroundButton();
  
  // Add shortcuts container after the search buttons
  addShortcutsContainer();
  
  // Get bookmarks and display them
  chrome.runtime.sendMessage({ action: "getBookmarks" }, response => {
    if (response && response.success) {
      displayShortcuts(response.folder.children || []);
    } else {
      // Create the shortcuts folder if it doesn't exist
      chrome.runtime.sendMessage({ action: "createBookmarkFolder" }, folderResponse => {
        if (folderResponse && folderResponse.success) {
          displayShortcuts([]);
        }
      });
    }
  });
  
  // Load and apply background settings
  loadBackgroundSettings();
  
  // Mark initialization as complete
  hasInitialized = true;
}

// Check if current page is Google homepage
function isGoogleHomepage() {
  // Match the main Google search page
  // This will match most Google domains like google.com, google.co.kr, etc.
  // It will match both the root (/) and search pages
  const pathname = window.location.pathname;
  const fullUrl = window.location.href;
  
  // Check if it's the root path (/) or the search page
  if (pathname === "/" || pathname === "/search") {
    return true;
  }
  
  // Check for the webhp path which is also a Google homepage variant
  if (pathname === "/webhp") {
    return true;
  }
  
  // Check if the URL contains webhp which is a common Google search page format
  if (fullUrl.includes("/webhp?") || fullUrl.includes("/webhp")) {
    return true;
  }
  
  // Check for country-specific versions that might have different paths
  if (pathname.match(/^\/search\/?\?/) || pathname.match(/^\/?$/)) {
    return true;
  }
  
  // Check if the URL contains the Google search elements
  const hasSearchBox = document.querySelector('input[name="q"]') !== null;
  const hasGoogleLogo = document.querySelector('.lnXdpd') !== null || 
                       document.querySelector('.o3j99') !== null;
  
  // If it has both a search box and logo, it's likely a Google search page
  if (hasSearchBox && hasGoogleLogo) {
    return true;
  }
  
  return false;
}

// Add shortcuts container to the page
function addShortcutsContainer() {
  // Check if container already exists
  if (document.getElementById('google-shortcuts-container')) {
    return;
  }
  
  // 1. Find search button area - try various possible selectors
  let searchButtonArea = 
      document.querySelector('.FPdoLc.lJ9FBc') || 
      document.querySelector('.FPdoLc') ||
      document.querySelector('.lJ9FBc') ||
      document.querySelector('div.aajZCb') || // Recent Google version
      document.querySelector('div.A8SBwf'); // Google search form
  
  // 2. Find language selection area (Google offered in: English)
  const languageDiv = document.querySelector('div#SIvCob') || 
                     document.querySelector('div:contains("Google offered in")');
  
  // If search button area is not found, place it right below the language selection area
  if (!searchButtonArea && languageDiv) {
    searchButtonArea = languageDiv;
  }
  
  // 3. If both areas are not found, find the search form itself
  if (!searchButtonArea) {
    searchButtonArea = document.querySelector('form') || 
                      document.querySelector('div.RNNXgb') || 
                      document.querySelector('div.A8SBwf');
  }
  
  // 4. If still not found, find the center part
  if (!searchButtonArea) {
    searchButtonArea = document.querySelector('center') || 
                      document.querySelector('div[role="main"]') || 
                      document.querySelector('div#main');
  }
  
  // 5. Last resort: add directly to body
  if (!searchButtonArea) {
    searchButtonArea = document.body;
  }
  
  // Stepwise approach: find appropriate container by moving up to parent elements
  let container = searchButtonArea;
  
  // If there's a search button element, find a wider container (up to 3 levels)
  for (let i = 0; i < 3 && container.parentElement; i++) {
    // Look for a wider container with specific classes or attributes
    if (container.parentElement.classList.contains('appbar') || 
        container.parentElement.getAttribute('role') === 'main' ||
        container.parentElement.id === 'main' ||
        container.parentElement.classList.contains('main') ||
        container.parentElement.tagName === 'CENTER') {
      container = container.parentElement;
      break;
    }
    container = container.parentElement;
  }
  
  // Create new shortcuts container
  const shortcutsContainer = document.createElement('div');
  shortcutsContainer.id = 'google-shortcuts-container';
  shortcutsContainer.className = 'google-shortcuts-container';
  
  // Insert container (after the container)
  if (container.nextElementSibling) {
    container.parentNode.insertBefore(shortcutsContainer, container.nextElementSibling);
  } else {
    container.parentNode.appendChild(shortcutsContainer);
  }
}

// Display shortcuts from bookmarks
function displayShortcuts(bookmarks) {
  const container = document.getElementById('google-shortcuts-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Detect dark mode
  const darkMode = isDarkMode();
  
  // Set container width
  container.style.margin = '20px auto'; // Center alignment
  
  let currentRow;
  let shortcuts = [...bookmarks]; // Copy bookmarks
  
  // Split bookmarks into rows according to SHORTCUTS_PER_ROW
  for (let i = 0; i < shortcuts.length; i++) {
    // Start new row
    if (i % SHORTCUTS_PER_ROW === 0) {
      currentRow = document.createElement('div');
      currentRow.className = 'shortcuts-row';
      container.appendChild(currentRow);
    }
    
    const bookmark = shortcuts[i];
    const shortcut = document.createElement('div'); // Use div instead of a tag
    shortcut.className = 'google-shortcut';
    shortcut.title = bookmark.url;
    shortcut.setAttribute('data-index', i);
    shortcut.setAttribute('data-id', bookmark.id);
    shortcut.setAttribute('data-url', bookmark.url);
    
    // Add drag and drop attributes
    shortcut.draggable = true;
    shortcut.addEventListener('dragstart', handleDragStart);
    shortcut.addEventListener('dragover', handleDragOver);
    shortcut.addEventListener('dragenter', handleDragEnter);
    shortcut.addEventListener('dragleave', handleDragLeave);
    shortcut.addEventListener('drop', handleDrop);
    shortcut.addEventListener('dragend', handleDragEnd);
    
    // Click event - navigate to link
    shortcut.addEventListener('click', (e) => {
      // Only navigate if not dragging
      if (!isDragging) {
        window.location.href = bookmark.url;
      }
    });
    
    // Add right-click context menu event listener
    shortcut.addEventListener('contextmenu', handleContextMenu);
    
    // Add favicon if possible
    try {
      // Create favicon container
      const faviconContainer = document.createElement('div');
      faviconContainer.className = 'shortcut-favicon';
      
      // Set up favicon inner elements to not interfere with parent events
      faviconContainer.addEventListener('dragover', e => {
        e.stopPropagation();
        // Manually trigger parent element's dragover event
        const event = new Event('dragover', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      faviconContainer.addEventListener('dragenter', e => {
        e.stopPropagation();
        // Manually trigger parent element's dragenter event
        const event = new Event('dragenter', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      faviconContainer.addEventListener('dragleave', e => {
        e.stopPropagation();
        // Manually trigger parent element's dragleave event
        const event = new Event('dragleave', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      faviconContainer.addEventListener('drop', e => {
        e.stopPropagation();
        e.preventDefault();
        // Manually trigger parent element's drop event
        const event = new Event('drop', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      // Adjust background color (based on dark mode)
      chrome.storage.local.get(['backgroundColor'], (result) => {
        let bgColor;
        // If background color setting exists, use that color, otherwise use default gray
        if (result.backgroundColor) {
          // If dark mode, lighten background color; if light mode, darken it
          const adjustPercent = darkMode ? 20 : -20;
          bgColor = adjustBrightness(result.backgroundColor, adjustPercent);
        } else {
          // Default background color
          bgColor = darkMode ? '#444444' : '#f1f3f4';
        }
        
        // Apply background color
        faviconContainer.style.backgroundColor = bgColor;
      });
      
      // Create favicon image
      const favicon = document.createElement('img');
      const url = new URL(bookmark.url);
      favicon.src = `https://www.google.com/s2/favicons?domain=${url.hostname}`;
      favicon.onerror = () => {
        // If image fails to load, display first letter
        faviconContainer.textContent = bookmark.title.charAt(0).toUpperCase();
      };
      
      // Add image to favicon container
      faviconContainer.appendChild(favicon);
      
      // Add favicon container to shortcut
      shortcut.appendChild(faviconContainer);
      
      // Add text
      const textSpan = document.createElement('span');
      textSpan.textContent = bookmark.title;
      textSpan.style.color = darkMode ? '#e8eaed' : '#202124'; // Set text color based on dark mode
      
      // Handle event bubbling for text element too
      textSpan.addEventListener('dragover', e => {
        e.stopPropagation();
        // Manually trigger parent element's dragover event
        const event = new Event('dragover', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      textSpan.addEventListener('dragenter', e => {
        e.stopPropagation();
        // Manually trigger parent element's dragenter event
        const event = new Event('dragenter', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      textSpan.addEventListener('dragleave', e => {
        e.stopPropagation();
        // Manually trigger parent element's dragleave event
        const event = new Event('dragleave', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      textSpan.addEventListener('drop', e => {
        e.stopPropagation();
        e.preventDefault();
        // Manually trigger parent element's drop event
        const event = new Event('drop', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      shortcut.appendChild(textSpan);
    } catch (e) {
      // If favicon fails, just use text
      const faviconContainer = document.createElement('div');
      faviconContainer.className = 'shortcut-favicon';
      faviconContainer.textContent = bookmark.title.charAt(0).toUpperCase();
      
      // Handle event bubbling for text element too
      faviconContainer.addEventListener('dragover', e => {
        e.stopPropagation();
        const event = new Event('dragover', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      faviconContainer.addEventListener('dragenter', e => {
        e.stopPropagation();
        const event = new Event('dragenter', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      faviconContainer.addEventListener('dragleave', e => {
        e.stopPropagation();
        const event = new Event('dragleave', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      faviconContainer.addEventListener('drop', e => {
        e.stopPropagation();
        e.preventDefault();
        const event = new Event('drop', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      // Adjust background color (based on dark mode)
      chrome.storage.local.get(['backgroundColor'], (result) => {
        let bgColor;
        // If background color setting exists, use that color, otherwise use default gray
        if (result.backgroundColor) {
          // If dark mode, lighten background color; if light mode, darken it
          const adjustPercent = darkMode ? 20 : -20;
          bgColor = adjustBrightness(result.backgroundColor, adjustPercent);
        } else {
          // Default background color
          bgColor = darkMode ? '#444444' : '#f1f3f4';
        }
        
        // Apply background color
        faviconContainer.style.backgroundColor = bgColor;
      });
      
      shortcut.appendChild(faviconContainer);
      
      const textSpan = document.createElement('span');
      textSpan.textContent = bookmark.title;
      textSpan.style.color = darkMode ? '#e8eaed' : '#202124'; // Set text color based on dark mode
      
      // Handle event bubbling for text element too
      textSpan.addEventListener('dragover', e => {
        e.stopPropagation();
        const event = new Event('dragover', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      textSpan.addEventListener('dragenter', e => {
        e.stopPropagation();
        const event = new Event('dragenter', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      textSpan.addEventListener('dragleave', e => {
        e.stopPropagation();
        const event = new Event('dragleave', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      textSpan.addEventListener('drop', e => {
        e.stopPropagation();
        e.preventDefault();
        const event = new Event('drop', {bubbles: true});
        shortcut.dispatchEvent(event);
      });
      
      shortcut.appendChild(textSpan);
    }
    
    currentRow.appendChild(shortcut);
  }
  
  // Add new shortcut button to the last row
  // If the last row is full or doesn't exist, create a new row
  const lastRow = container.querySelector('.shortcuts-row:last-child');
  const shortcutsInLastRow = lastRow ? lastRow.childElementCount : 0;
  
  let targetRow = lastRow;
  
  // If the last row is full or doesn't exist, create a new row
  if (!targetRow || shortcutsInLastRow >= SHORTCUTS_PER_ROW) {
    targetRow = document.createElement('div');
    targetRow.className = 'shortcuts-row';
    container.appendChild(targetRow);
  }
  
  // Create new shortcut button
  addNewShortcutButtonToRow(targetRow);
}

// Add shortcut button to a specific row
function addNewShortcutButtonToRow(row) {
  // Get folder ID to send message
  chrome.runtime.sendMessage({ action: "getBookmarks" }, response => {
    if (response && response.success) {
      const folderId = response.folder.id;
      
      // Detect dark mode
      const darkMode = isDarkMode();
      
      // Create new shortcut button - same format as Gmail link
      const addButton = document.createElement('div');
      addButton.className = 'google-add-shortcut';
      
      // Circle container with + icon
      const iconCircle = document.createElement('div');
      iconCircle.className = 'add-shortcut-circle';
      iconCircle.textContent = '+';
      
      // Get background color used in settings
      chrome.storage.local.get(['backgroundColor'], (result) => {
        let bgColor;
        // If background color setting exists, use that color, otherwise use default gray
        if (result.backgroundColor) {
          // If dark mode, lighten background color; if light mode, darken it
          const adjustPercent = darkMode ? 20 : -20; // If dark mode, +20%, if light mode, -20%
          bgColor = adjustBrightness(result.backgroundColor, adjustPercent);
        } else {
          // Default background color (dark mode: dark gray, light mode: light gray)
          bgColor = darkMode ? '#444444' : '#cccccc';
        }
        
        // Apply background color
        iconCircle.style.backgroundColor = bgColor;
      });
      
      addButton.appendChild(iconCircle);
      
      // 'Add shortcut' text
      const textSpan = document.createElement('span');
      textSpan.textContent = 'Add shortcut';
      textSpan.style.marginTop = '4px';
      textSpan.style.color = darkMode ? '#e8eaed' : '#202124'; // Set text color based on dark mode
      addButton.appendChild(textSpan);
      
      // Click event handler
      addButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Show custom bookmark add dialog
        showAddBookmarkDialog(folderId);
        
        return false;
      });
      
      row.appendChild(addButton);
    } else {
      // If folder doesn't exist, create
      chrome.runtime.sendMessage({ action: "createBookmarkFolder" }, folderResponse => {
        if (folderResponse && folderResponse.success) {
          // Try again with new folder ID
          addNewShortcutButtonToRow(row, folderResponse.folder.id);
        }
      });
    }
  });
}

// Show custom dialog to add a bookmark
function showAddBookmarkDialog(folderId) {
  // Check if there's already an open dialog
  if (document.querySelector('.bookmark-dialog-overlay')) {
    return;
  }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'bookmark-dialog-overlay';
  
  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = 'bookmark-dialog';
  dialog.style.borderRadius = '8px';
  dialog.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
  
  // Dialog header
  const header = document.createElement('div');
  header.className = 'bookmark-dialog-header';
  header.textContent = 'Add Shortcut';
  header.style.padding = '16px';
  header.style.borderBottom = '1px solid #e5e5e5';
  header.style.fontWeight = 'bold';
  header.style.fontSize = '16px';
  dialog.appendChild(header);
  
  // Dialog content
  const content = document.createElement('div');
  content.className = 'bookmark-dialog-content';
  content.style.padding = '16px';
  
  // Name field
  const nameContainer = document.createElement('div');
  nameContainer.className = 'bookmark-input-container';
  nameContainer.style.marginBottom = '16px';
  
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name:';
  nameLabel.htmlFor = 'bookmark-name-input';
  nameLabel.style.display = 'block';
  nameLabel.style.marginBottom = '8px';
  nameLabel.style.fontWeight = '500';
  nameContainer.appendChild(nameLabel);
  
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'bookmark-name-input';
  nameInput.className = 'bookmark-input';
  nameInput.placeholder = 'Shortcut Name';
  nameInput.autocomplete = 'off';
  nameInput.style.width = '100%';
  nameInput.style.padding = '8px 12px';
  nameInput.style.borderRadius = '4px';
  nameInput.style.border = '1px solid #d1d1d1';
  nameInput.style.fontSize = '14px';
  nameInput.style.boxSizing = 'border-box';
  nameContainer.appendChild(nameInput);
  
  content.appendChild(nameContainer);
  
  // URL field
  const urlContainer = document.createElement('div');
  urlContainer.className = 'bookmark-input-container';
  urlContainer.style.marginBottom = '16px';
  
  const urlLabel = document.createElement('label');
  urlLabel.textContent = 'URL:';
  urlLabel.htmlFor = 'bookmark-url-input';
  urlLabel.style.display = 'block';
  urlLabel.style.marginBottom = '8px';
  urlLabel.style.fontWeight = '500';
  urlContainer.appendChild(urlLabel);
  
  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.id = 'bookmark-url-input';
  urlInput.className = 'bookmark-input';
  urlInput.placeholder = 'https://';
  urlInput.value = 'https://';
  urlInput.autocomplete = 'off';
  urlInput.style.width = '100%';
  urlInput.style.padding = '8px 12px';
  urlInput.style.borderRadius = '4px';
  urlInput.style.border = '1px solid #d1d1d1';
  urlInput.style.fontSize = '14px';
  urlInput.style.boxSizing = 'border-box';
  urlContainer.appendChild(urlInput);
  
  content.appendChild(urlContainer);
  
  dialog.appendChild(content);
  
  // Dialog buttons
  const buttons = document.createElement('div');
  buttons.className = 'bookmark-dialog-buttons';
  buttons.style.display = 'flex';
  buttons.style.justifyContent = 'flex-end';
  buttons.style.padding = '12px 16px';
  buttons.style.borderTop = '1px solid #e5e5e5';
  buttons.style.gap = '8px';
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'bookmark-dialog-button cancel-button';
  cancelButton.type = 'button';
  cancelButton.style.padding = '8px 16px';
  cancelButton.style.borderRadius = '4px';
  cancelButton.style.border = '1px solid #d1d1d1';
  cancelButton.style.background = '#f5f5f5';
  cancelButton.style.cursor = 'pointer';
  cancelButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.removeChild(overlay);
    return false;
  });
  buttons.appendChild(cancelButton);
  
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save';
  saveButton.className = 'bookmark-dialog-button save-button';
  saveButton.type = 'button';
  saveButton.style.padding = '8px 16px';
  saveButton.style.borderRadius = '4px';
  saveButton.style.border = '1px solid #1a73e8';
  saveButton.style.background = '#1a73e8';
  saveButton.style.color = 'white';
  saveButton.style.cursor = 'pointer';
  saveButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const title = nameInput.value.trim();
    const url = urlInput.value.trim();
    
    if (!title) {
      nameInput.classList.add('error');
      nameInput.style.borderColor = '#e53935';
      nameInput.focus();
      return false;
    }
    
    if (!url || url === 'https://') {
      urlInput.classList.add('error');
      urlInput.style.borderColor = '#e53935';
      urlInput.focus();
      return false;
    }
    
    // Add bookmark through background script
    chrome.runtime.sendMessage({ 
      action: "addBookmark", 
      title: title, 
      url: url, 
      folderId: folderId 
    }, response => {
      if (response && response.success) {
        displayShortcuts(response.folder.children || []);
        addNewShortcutButtonToRow(response.folder.id);
        document.body.removeChild(overlay);
      }
    });
    
    return false;
  });
  buttons.appendChild(saveButton);
  
  dialog.appendChild(buttons);
  overlay.appendChild(dialog);
  
  // Style the overlay for better appearance
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';
  
  // Style the dialog
  dialog.style.width = '400px';
  dialog.style.maxWidth = '90%';
  dialog.style.backgroundColor = 'white';
  
  // Add to page and focus on name input
  document.body.appendChild(overlay);
  nameInput.focus();
  
  // Input validation
  nameInput.addEventListener('input', () => {
    nameInput.classList.remove('error');
    nameInput.style.borderColor = '#d1d1d1';
  });
  
  urlInput.addEventListener('input', () => {
    urlInput.classList.remove('error');
    urlInput.style.borderColor = '#d1d1d1';
  });
  
  // Handle Enter key
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      urlInput.focus();
      return false;
    }
  });
  
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveButton.click();
      return false;
    }
  });
}

// Add background customization button
function addBackgroundButton() {
  // Check if background setting button already exists
  if (document.querySelector('.google-bg-button')) {
    return; // If already exists, don't add
  }

  try {
    // Find Gmail link
    const gmailLink = document.querySelector('a[href*="mail.google.com"]') || 
                     document.querySelector('a[aria-label="Gmail"]');
    
    if (!gmailLink) {
      // console.log('Gmail link not found.');
      return;
    }
    
    // Find parent element of Gmail link (container)
    const parentContainer = gmailLink.parentNode;
    if (!parentContainer || !parentContainer.parentNode) {
      // console.log('Parent element of Gmail link not found.');
      return;
    }
    
    // Create new button container (same format as Gmail link)
    const buttonContainer = document.createElement('div');
    // Copy parent container's classes
    buttonContainer.className = parentContainer.className;
    
    // Create new button
    const bgButton = document.createElement('a');
    // Use same classes as Gmail link
    bgButton.className = gmailLink.className;
    bgButton.textContent = 'Background Settings';
    bgButton.href = 'javascript:void(0);';
    bgButton.title = 'Background Image or Color Settings';
    bgButton.setAttribute('aria-label', 'Background Settings');
    
    // Add click event
    bgButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showBackgroundSettings();
      return false;
    });
    
    // Add button to container
    buttonContainer.appendChild(bgButton);
    
    // Insert before Gmail link
    parentContainer.parentNode.insertBefore(buttonContainer, parentContainer);
    
  } catch (error) {
    // console.error('Background setting button addition error:', error);
  }
}

// Show background settings dialog
function showBackgroundSettings() {
  // Check if there's already an open dialog
  if (document.querySelector('.google-bg-overlay')) {
    return;
  }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'google-bg-overlay';
  
  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = 'google-bg-dialog';
  dialog.style.width = '400px';
  dialog.style.maxWidth = '90%';
  dialog.style.backgroundColor = 'white';
  dialog.style.borderRadius = '8px';
  dialog.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
  dialog.style.overflow = 'hidden';
  
  // Dialog header
  const header = document.createElement('h3');
  header.textContent = 'Background Settings';
  header.style.margin = '0';
  header.style.padding = '16px';
  header.style.borderBottom = '1px solid #e5e5e5';
  header.style.fontWeight = 'bold';
  header.style.fontSize = '16px';
  dialog.appendChild(header);
  
  // Content container
  const contentContainer = document.createElement('div');
  contentContainer.style.padding = '16px';
  
  // Color option
  const colorSection = document.createElement('div');
  colorSection.className = 'settings-section';
  colorSection.style.marginBottom = '16px';
  
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Background Color:';
  colorLabel.htmlFor = 'bg-color-input';
  colorLabel.style.display = 'block';
  colorLabel.style.marginBottom = '8px';
  colorLabel.style.fontWeight = '500';
  
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.id = 'bg-color-input';
  colorInput.style.width = '100%';
  colorInput.style.height = '40px';
  colorInput.style.padding = '4px';
  colorInput.style.border = '1px solid #d1d1d1';
  colorInput.style.borderRadius = '4px';
  colorInput.style.cursor = 'pointer';
  
  // Get current color from storage
  chrome.storage.local.get(['backgroundColor'], (result) => {
    if (result.backgroundColor) {
      colorInput.value = result.backgroundColor;
    } else {
      colorInput.value = '#ffffff'; // Default white
    }
  });
  
  colorSection.appendChild(colorLabel);
  colorSection.appendChild(colorInput);
  contentContainer.appendChild(colorSection);
  
  // Background image URL option
  const imageSection = document.createElement('div');
  imageSection.className = 'settings-section';
  imageSection.style.marginBottom = '16px';
  
  const imageLabel = document.createElement('label');
  imageLabel.textContent = 'Background Image URL:';
  imageLabel.htmlFor = 'bg-image-input';
  imageLabel.style.display = 'block';
  imageLabel.style.marginBottom = '8px';
  imageLabel.style.fontWeight = '500';
  
  const imageInput = document.createElement('input');
  imageInput.type = 'text';
  imageInput.id = 'bg-image-input';
  imageInput.placeholder = 'https://example.com/image.jpg';
  imageInput.style.width = '100%';
  imageInput.style.padding = '8px 12px';
  imageInput.style.borderRadius = '4px';
  imageInput.style.border = '1px solid #d1d1d1';
  imageInput.style.fontSize = '14px';
  imageInput.style.boxSizing = 'border-box';
  
  // Get current image from storage
  chrome.storage.local.get(['backgroundImage'], (result) => {
    if (result.backgroundImage) {
      imageInput.value = result.backgroundImage;
    }
  });
  
  imageSection.appendChild(imageLabel);
  imageSection.appendChild(imageInput);
  contentContainer.appendChild(imageSection);
  
  dialog.appendChild(contentContainer);
  
  // Buttons
  const buttonSection = document.createElement('div');
  buttonSection.className = 'settings-buttons';
  buttonSection.style.display = 'flex';
  buttonSection.style.justifyContent = 'flex-end';
  buttonSection.style.padding = '12px 16px';
  buttonSection.style.borderTop = '1px solid #e5e5e5';
  buttonSection.style.gap = '8px';
  
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save';
  saveButton.type = 'button';
  saveButton.style.padding = '8px 16px';
  saveButton.style.borderRadius = '4px';
  saveButton.style.border = '1px solid #1a73e8';
  saveButton.style.background = '#1a73e8';
  saveButton.style.color = 'white';
  saveButton.style.cursor = 'pointer';
  saveButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const color = colorInput.value;
    const imageUrl = imageInput.value.trim();
    
    // Save to storage
    chrome.storage.local.set({
      backgroundColor: color,
      backgroundImage: imageUrl
    }, () => {
      // Apply settings
      applyBackgroundSettings(color, imageUrl);
      
      // Close dialog
      document.body.removeChild(overlay);
    });
    
    return false;
  });
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.type = 'button';
  cancelButton.style.padding = '8px 16px';
  cancelButton.style.borderRadius = '4px';
  cancelButton.style.border = '1px solid #d1d1d1';
  cancelButton.style.background = '#f5f5f5';
  cancelButton.style.cursor = 'pointer';
  cancelButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.removeChild(overlay);
    return false;
  });
  
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset';
  resetButton.type = 'button';
  resetButton.style.padding = '8px 16px';
  resetButton.style.borderRadius = '4px';
  resetButton.style.border = '1px solid #d1d1d1';
  resetButton.style.background = '#f5f5f5';
  resetButton.style.cursor = 'pointer';
  resetButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear settings
    chrome.storage.local.remove(['backgroundColor', 'backgroundImage'], () => {
      // Reset to default
      document.body.style.backgroundColor = '';
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundRepeat = '';
      
      // Close dialog
      document.body.removeChild(overlay);
    });
    
    return false;
  });
  
  buttonSection.appendChild(saveButton);
  buttonSection.appendChild(cancelButton);
  buttonSection.appendChild(resetButton);
  dialog.appendChild(buttonSection);
  
  overlay.appendChild(dialog);
  
  // Style the overlay for better appearance
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';
  
  document.body.appendChild(overlay);
  
  // Focus on image input and add keyboard controls
  imageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveButton.click();
      return false;
    }
  });
}

// Load background settings from storage
function loadBackgroundSettings() {
  chrome.storage.local.get(['backgroundColor', 'backgroundImage'], (result) => {
    applyBackgroundSettings(result.backgroundColor, result.backgroundImage);
  });
}

// Apply background settings
function applyBackgroundSettings(color, imageUrl) {
  if (color) {
    document.body.style.backgroundColor = color;
  }
  
  if (imageUrl && imageUrl.trim() !== '') {
    document.body.style.backgroundImage = `url('${imageUrl}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
  } else if (imageUrl === '') {
    document.body.style.backgroundImage = '';
  }
}

// Run the extension - process in order of load event
document.addEventListener('DOMContentLoaded', () => {
  // Try initialization after page DOM loaded
  setTimeout(init, 100);
});

// Run after page is fully loaded
window.addEventListener('load', () => {
  // If container doesn't exist, try again
  if (!document.getElementById('google-shortcuts-container')) {
    init();
    
    // Since page elements might load asynchronously, try again after short delay
    setTimeout(() => {
      if (!document.getElementById('google-shortcuts-container')) {
        init();
      }
    }, 500);
  }
});

// URL change detection variable and observer
let lastUrl = location.href; 
const urlChangeObserver = new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    
    // If URL changes, remove existing container and reset hasInitialized
    const container = document.getElementById('google-shortcuts-container');
    if (container) {
      container.remove();
    }
    
    // Remove background setting button
    const bgButton = document.querySelector('.google-bg-button');
    if (bgButton) {
      bgButton.remove();
    }
    
    // Reset initialization status
    hasInitialized = false;
    
    // Wait a bit before trying again
    setTimeout(init, 300);
  }
});

// Start DOM change detection
urlChangeObserver.observe(document, {subtree: true, childList: true});

// Simple drag & drop event handlers
function handleDragStart(e) {
  // Set dragging status
  isDragging = true;
  draggedItem = this;
  draggedItemIndex = parseInt(this.getAttribute('data-index'));
  
  // Add dragging class to dragged item
  this.classList.add('dragging');
  
  // Set drag data
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
  
  // Set preview image
  if (e.dataTransfer.setDragImage) {
    const preview = this.cloneNode(true);
    preview.style.position = 'absolute';
    preview.style.top = '-1000px';
    preview.style.opacity = '0.8';
    document.body.appendChild(preview);
    
    e.dataTransfer.setDragImage(preview, 40, 40);
    
    setTimeout(() => {
      document.body.removeChild(preview);
    }, 0);
  }
  
  // Add dragging class to container
  const container = document.getElementById('google-shortcuts-container');
  if (container) {
    container.classList.add('dragging-active');
  }
  
  // Create drop marker
  createDropMarker();
  
  // Add dragover event listener to container
  container.addEventListener('dragover', handleContainerDragOver);
  
  lastDropIndex = -1;
}

// Create drop marker
function createDropMarker() {
  // Remove existing marker
  removeDropMarker();
  
  const container = document.getElementById('google-shortcuts-container');
  if (!container) return;
  
  // Create new marker
  dropMarker = document.createElement('div');
  dropMarker.className = 'drop-marker';
  
  // Initially hidden
  dropMarker.style.display = 'none';
  
  // Add to container
  container.appendChild(dropMarker);
}

// Remove drop marker
function removeDropMarker() {
  if (dropMarker) {
    dropMarker.remove();
    dropMarker = null;
  }
}

// Container dragover event handler
function handleContainerDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!isDragging || !draggedItem || !dropMarker) return;
  
  const container = document.getElementById('google-shortcuts-container');
  if (!container) return;
  
  // Calculate mouse position
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  
  // Get all shortcut elements except dragged item
  const shortcuts = Array.from(container.querySelectorAll('.google-shortcut:not(.dragging)'));
  
  // Show marker
  dropMarker.style.display = 'block';
  
  // Calculate closest element and distance
  let closestDistance = Number.MAX_SAFE_INTEGER;
  let closestItem = null;
  let insertBefore = false;
  
  shortcuts.forEach(shortcut => {
    const rect = shortcut.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate distance from mouse
    const distance = Math.sqrt(
      Math.pow(mouseX - centerX, 2) + 
      Math.pow(mouseY - centerY, 2)
    );
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestItem = shortcut;
      
      // Calculate if moving left or right
      const currentIndex = parseInt(draggedItem.getAttribute('data-index'));
      const targetIndex = parseInt(shortcut.getAttribute('data-index'));
      
      // Check if mouse is on left half or right half
      const isMouseOnLeftHalf = mouseX < centerX;
      
      // Calculate if moving within the same row
      const draggedRect = draggedItem.getBoundingClientRect();
      const isSameRow = Math.abs(draggedRect.top - rect.top) < 30;
      
      if (currentIndex < targetIndex) {
        // Moving from front to back
        insertBefore = !isMouseOnLeftHalf;
      } else if (currentIndex > targetIndex) {
        // Moving from back to front
        insertBefore = isMouseOnLeftHalf;
      } else {
        // Moving back to the same position (just dragging, no movement)
        insertBefore = isMouseOnLeftHalf;
      }
      
      // Debug log
      // console.log(`Current: ${currentIndex}, Target: ${targetIndex}, InsertBefore: ${insertBefore}, LeftHalf: ${isMouseOnLeftHalf}`);
    }
  });
  
  if (closestItem) {
    const rect = closestItem.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Set marker height to element height
    dropMarker.style.height = `${rect.height}px`;
    
    // Get data index
    const dataIndex = parseInt(closestItem.getAttribute('data-index'));
    
    // Set marker position
    if (insertBefore) {
      // Show before element
      dropMarker.style.left = `${rect.left - containerRect.left - 2}px`;
      lastDropIndex = dataIndex;
    } else {
      // Show after element
      dropMarker.style.left = `${rect.right - containerRect.left - 2}px`;
      lastDropIndex = dataIndex + 1;
    }
    dropMarker.style.top = `${rect.top - containerRect.top}px`;
    
    // If dragged item index is same or 1 difference from last drop index
    // Actually no movement, so hide marker
    const draggedIndex = parseInt(draggedItem.getAttribute('data-index'));
    if (draggedIndex === lastDropIndex || draggedIndex + 1 === lastDropIndex) {
      dropMarker.style.display = 'none';
    }
  } else if (shortcuts.length === 0) {
    // If no shortcuts, show at first position
    const firstRow = container.querySelector('.shortcuts-row');
    if (firstRow) {
      dropMarker.style.height = '80px';
      dropMarker.style.left = `20px`;
      dropMarker.style.top = `${firstRow.offsetTop + 10}px`;
      lastDropIndex = 0;
    }
  }
  
  // Error handling: check if dataTransfer is defined before using
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
}

// Shortcut element itself drop handling
function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  
  // Drop to marker position
  performDrop();
  
  return false;
}

// Drop to marker position handling
function performDrop() {
  if (lastDropIndex === -1 || !draggedItem) return;
  
  const draggedBookmarkId = draggedItem.getAttribute('data-id');
  const dataIndex = parseInt(draggedItem.getAttribute('data-index'));
  
  // Ignore if moving to same position
  if (dataIndex === lastDropIndex || (dataIndex + 1 === lastDropIndex && lastDropIndex !== 0)) {
    // console.log('Not moving to same position', dataIndex, lastDropIndex);
    return;
  }
  
  // console.log(`Moving bookmark from ${dataIndex} to ${lastDropIndex}`);
  
  // Calculate actual target index to move
  let targetIndex = lastDropIndex;
  
  // Chrome Bookmarks API doesn't need index adjustment for moving from front to back
  // It's already adjusted internally
  // Previous logic (targetIndex -= 1) always placed target one position ahead
  
  // Move bookmark request
  chrome.runtime.sendMessage({ 
    action: "moveBookmark", 
    draggedId: draggedBookmarkId,
    targetIndex: targetIndex,
    draggedIndex: dataIndex
  }, response => {
    if (response && response.success) {
      // Bookmark move success, refresh screen
      displayShortcuts(response.folder.children || []);
      
      // Remove marker and reset state
      removeDropMarker();
      lastDropIndex = -1;
      draggedItem = null;
      draggedItemIndex = -1;
      isDragging = false;
    } else {
      // console.error('Failed to move bookmark:', response ? response.error : 'Unknown error');
    }
  });
}

function handleDragEnd(e) {
  // Reset status and styles on drag end
  this.style.opacity = '1';
  
  if (this.classList.contains('dragging')) {
    this.classList.remove('dragging');
  }
  
  // Reset dragging status
  isDragging = false;
  
  // If marker was shown, drop to marker position
  if (dropMarker && dropMarker.style.display !== 'none' && lastDropIndex !== -1) {
    performDrop();
  }
  
  // Remove marker
  removeDropMarker();
  
  // Remove dragging class from container
  const container = document.getElementById('google-shortcuts-container');
  if (container) {
    container.classList.remove('dragging-active');
    
    // Remove event listeners
    container.removeEventListener('dragover', handleContainerDragOver);
  }
  
  // Reset dragging related variables
  draggedItem = null;
  draggedItemIndex = -1;
  lastDropIndex = -1;
}

// Shortcut element dragover handler
function handleDragOver(e) {
  // Prevent default behavior
  e.preventDefault();
  e.stopPropagation();
  
  // If not dragging or dragged item doesn't exist, stop processing
  if (!isDragging || !draggedItem) return;
  
  // Set drop effect (only if dataTransfer exists)
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
}

// Shortcut element drag enter handler
function handleDragEnter(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // If not dragging or dragged item doesn't exist, stop processing
  if (!isDragging || !draggedItem) return;
  
  // MouseEvent object doesn't have dataTransfer, so use CustomEvent
  const containerDragOverEvent = new CustomEvent('dragover', {
    bubbles: true,
    cancelable: true
  });
  
  // Copy mouse position info
  containerDragOverEvent.clientX = e.clientX;
  containerDragOverEvent.clientY = e.clientY;
  
  const container = document.getElementById('google-shortcuts-container');
  if (container) {
    container.dispatchEvent(containerDragOverEvent);
  }
}

// Shortcut element drag leave handler
function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Actually no processing needed
  // Marker is continuously updated in container's dragover event
}

// Legacy removeDropSpaces call for compatibility
function removeDropSpaces() {
  // This function is kept for previous version compatibility but actually does nothing
  // New implementation uses marker instead of drop space
  return;
}

// Right-click context menu handler
function handleContextMenu(e) {
  e.preventDefault();
  
  // Remove existing context menu
  removeContextMenu();
  
  const bookmarkId = this.getAttribute('data-id');
  const bookmarkTitle = this.querySelector('span').textContent;
  const bookmarkUrl = this.href;
  
  // Create context menu
  const contextMenu = document.createElement('div');
  contextMenu.className = 'shortcut-context-menu';
  contextMenu.style.position = 'absolute';
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;
  
  // Edit menu item
  const editItem = document.createElement('div');
  editItem.className = 'context-menu-item';
  editItem.textContent = 'Edit';
  editItem.addEventListener('click', () => {
    removeContextMenu();
    showEditBookmarkDialog(bookmarkId, bookmarkTitle, bookmarkUrl);
  });
  
  // Delete menu item
  const deleteItem = document.createElement('div');
  deleteItem.className = 'context-menu-item';
  deleteItem.textContent = 'Delete';
  deleteItem.addEventListener('click', () => {
    removeContextMenu();
    
    if (confirm(`"${bookmarkTitle}" shortcut to be deleted?`)) {
      chrome.runtime.sendMessage({ 
        action: "deleteBookmark", 
        id: bookmarkId 
      }, response => {
        if (response && response.success) {
          displayShortcuts(response.folder.children || []);
        }
      });
    }
  });
  
  // Add items to context menu
  contextMenu.appendChild(editItem);
  contextMenu.appendChild(deleteItem);
  
  // Add context menu to page
  document.body.appendChild(contextMenu);
  
  // Remove context menu on other click
  document.addEventListener('click', removeContextMenu, { once: true });
  
  return false;
}

// Context menu removal function
function removeContextMenu() {
  const menu = document.querySelector('.shortcut-context-menu');
  if (menu) {
    menu.remove();
  }
}

// Show edit bookmark dialog
function showEditBookmarkDialog(bookmarkId, title, url) {
  // Check if there's already an open dialog
  if (document.querySelector('.bookmark-dialog-overlay')) {
    return;
  }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'bookmark-dialog-overlay';
  
  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = 'bookmark-dialog';
  dialog.style.borderRadius = '8px';
  dialog.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
  
  // Dialog header
  const header = document.createElement('div');
  header.className = 'bookmark-dialog-header';
  header.textContent = 'Edit Shortcut';
  header.style.padding = '16px';
  header.style.borderBottom = '1px solid #e5e5e5';
  header.style.fontWeight = 'bold';
  header.style.fontSize = '16px';
  dialog.appendChild(header);
  
  // Dialog content
  const content = document.createElement('div');
  content.className = 'bookmark-dialog-content';
  content.style.padding = '16px';
  
  // Name field
  const nameContainer = document.createElement('div');
  nameContainer.className = 'bookmark-input-container';
  nameContainer.style.marginBottom = '16px';
  
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name:';
  nameLabel.htmlFor = 'bookmark-name-input';
  nameLabel.style.display = 'block';
  nameLabel.style.marginBottom = '8px';
  nameLabel.style.fontWeight = '500';
  nameContainer.appendChild(nameLabel);
  
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'bookmark-name-input';
  nameInput.className = 'bookmark-input';
  nameInput.placeholder = 'Shortcut Name';
  nameInput.value = title || '';
  nameInput.autocomplete = 'off';
  nameInput.style.width = '100%';
  nameInput.style.padding = '8px 12px';
  nameInput.style.borderRadius = '4px';
  nameInput.style.border = '1px solid #d1d1d1';
  nameInput.style.fontSize = '14px';
  nameInput.style.boxSizing = 'border-box';
  nameContainer.appendChild(nameInput);
  
  content.appendChild(nameContainer);
  
  // URL field
  const urlContainer = document.createElement('div');
  urlContainer.className = 'bookmark-input-container';
  urlContainer.style.marginBottom = '16px';
  
  const urlLabel = document.createElement('label');
  urlLabel.textContent = 'URL:';
  urlLabel.htmlFor = 'bookmark-url-input';
  urlLabel.style.display = 'block';
  urlLabel.style.marginBottom = '8px';
  urlLabel.style.fontWeight = '500';
  urlContainer.appendChild(urlLabel);
  
  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.id = 'bookmark-url-input';
  urlInput.className = 'bookmark-input';
  urlInput.placeholder = 'https://';
  // Fix for undefined URL value by ensuring a valid URL string
  urlInput.value = url && url !== 'undefined' ? url : '';
  urlInput.autocomplete = 'off';
  urlInput.style.width = '100%';
  urlInput.style.padding = '8px 12px';
  urlInput.style.borderRadius = '4px';
  urlInput.style.border = '1px solid #d1d1d1';
  urlInput.style.fontSize = '14px';
  urlInput.style.boxSizing = 'border-box';
  urlContainer.appendChild(urlInput);
  
  content.appendChild(urlContainer);
  
  dialog.appendChild(content);
  
  // Dialog buttons
  const buttons = document.createElement('div');
  buttons.className = 'bookmark-dialog-buttons';
  buttons.style.display = 'flex';
  buttons.style.justifyContent = 'flex-end';
  buttons.style.padding = '12px 16px';
  buttons.style.borderTop = '1px solid #e5e5e5';
  buttons.style.gap = '8px';
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'bookmark-dialog-button cancel-button';
  cancelButton.type = 'button';
  cancelButton.style.padding = '8px 16px';
  cancelButton.style.borderRadius = '4px';
  cancelButton.style.border = '1px solid #d1d1d1';
  cancelButton.style.background = '#f5f5f5';
  cancelButton.style.cursor = 'pointer';
  cancelButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.removeChild(overlay);
    return false;
  });
  buttons.appendChild(cancelButton);
  
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save';
  saveButton.className = 'bookmark-dialog-button save-button';
  saveButton.type = 'button';
  saveButton.style.padding = '8px 16px';
  saveButton.style.borderRadius = '4px';
  saveButton.style.border = '1px solid #1a73e8';
  saveButton.style.background = '#1a73e8';
  saveButton.style.color = 'white';
  saveButton.style.cursor = 'pointer';
  saveButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newTitle = nameInput.value.trim();
    const newUrl = urlInput.value.trim();
    
    if (!newTitle) {
      nameInput.classList.add('error');
      nameInput.style.borderColor = '#e53935';
      nameInput.focus();
      return false;
    }
    
    if (!newUrl || newUrl === 'https://') {
      urlInput.classList.add('error');
      urlInput.style.borderColor = '#e53935';
      urlInput.focus();
      return false;
    }
    
    // Update bookmark through background script
    chrome.runtime.sendMessage({ 
      action: "updateBookmark", 
      id: bookmarkId,
      title: newTitle, 
      url: newUrl
    }, response => {
      if (response && response.success) {
        displayShortcuts(response.folder.children || []);
        document.body.removeChild(overlay);
      }
    });
    
    return false;
  });
  buttons.appendChild(saveButton);
  
  dialog.appendChild(buttons);
  overlay.appendChild(dialog);
  
  // Style the overlay for better appearance
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';
  
  // Style the dialog
  dialog.style.width = '400px';
  dialog.style.maxWidth = '90%';
  dialog.style.backgroundColor = 'white';
  
  // Add to page and focus on name input
  document.body.appendChild(overlay);
  nameInput.focus();
  nameInput.select();
  
  // Input validation
  nameInput.addEventListener('input', () => {
    nameInput.classList.remove('error');
    nameInput.style.borderColor = '#d1d1d1';
  });
  
  urlInput.addEventListener('input', () => {
    urlInput.classList.remove('error');
    urlInput.style.borderColor = '#d1d1d1';
  });
  
  // Handle Enter key
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      urlInput.focus();
      urlInput.select();
      return false;
    }
  });
  
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveButton.click();
      return false;
    }
  });
} 