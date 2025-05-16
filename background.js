// Constants
const BOOKMARK_FOLDER_NAME = "Shortcuts for Google.com";

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getBookmarks") {
    getBookmarks().then(sendResponse);
    return true; // Keep the message channel open for async response
  } else if (message.action === "createBookmarkFolder") {
    createFolder().then(sendResponse);
    return true;
  } else if (message.action === "addBookmark") {
    addBookmark(message.title, message.url, message.folderId).then(sendResponse);
    return true;
  } else if (message.action === "moveBookmark") {
    moveBookmark(message.draggedId, message.targetIndex, message.draggedIndex).then(sendResponse);
    return true;
  } else if (message.action === "updateBookmark") {
    updateBookmark(message.id, message.title, message.url).then(sendResponse);
    return true;
  } else if (message.action === "deleteBookmark") {
    deleteBookmark(message.id).then(sendResponse);
    return true;
  }
});

// Get all bookmarks
async function getBookmarks() {
  try {
    const bookmarkTreeNodes = await chrome.bookmarks.getTree();
    const shortcutsFolder = findShortcutsFolder(bookmarkTreeNodes[0]);
    
    if (shortcutsFolder) {
      return {
        success: true,
        folder: shortcutsFolder
      };
    } else {
      return {
        success: false,
        reason: "folder_not_found"
      };
    }
  } catch (error) {
    return {
      success: false,
      reason: "error",
      error: error.message
    };
  }
}

// Find the shortcuts folder in bookmarks
function findShortcutsFolder(bookmarkNode) {
  if (bookmarkNode.title === BOOKMARK_FOLDER_NAME) {
    return bookmarkNode;
  }
  
  if (bookmarkNode.children) {
    for (const child of bookmarkNode.children) {
      const folder = findShortcutsFolder(child);
      if (folder) return folder;
    }
  }
  
  return null;
}

// Create shortcuts folder
async function createFolder() {
  try {
    const folder = await chrome.bookmarks.create({
      title: BOOKMARK_FOLDER_NAME
    });
    
    return {
      success: true,
      folder: folder
    };
  } catch (error) {
    return {
      success: false,
      reason: "error",
      error: error.message
    };
  }
}

// Add a bookmark to the shortcuts folder
async function addBookmark(title, url, folderId) {
  try {
    const bookmark = await chrome.bookmarks.create({
      parentId: folderId,
      title: title,
      url: url
    });
    
    const bookmarkTreeNodes = await chrome.bookmarks.getTree();
    const shortcutsFolder = findShortcutsFolder(bookmarkTreeNodes[0]);
    
    return {
      success: true,
      bookmark: bookmark,
      folder: shortcutsFolder
    };
  } catch (error) {
    return {
      success: false,
      reason: "error",
      error: error.message
    };
  }
}

// Move a bookmark to a new position
async function moveBookmark(draggedId, targetIndex, draggedIndex) {
  try {
    // console.log(`Starting move - draggedId: ${draggedId}, targetIndex: ${targetIndex}, draggedIndex: ${draggedIndex}`);
    
    // Get folder information
    const folderResponse = await getBookmarks();
    if (!folderResponse.success) {
      throw new Error("Bookmark folder not found");
    }
    
    const folder = folderResponse.folder;
    // console.log(`Folder ID: ${folder.id}, Bookmark count: ${folder.children?.length || 0}`);
    
    // Log dragged bookmark and target position information
    if (folder.children && folder.children.length > 0) {
      const draggedBookmark = folder.children.find(b => b.id === draggedId);
      if (draggedBookmark) {
        // console.log(`Dragged bookmark: ID=${draggedBookmark.id}, Title=${draggedBookmark.title}, Index=${draggedIndex}`);
      }
      
      if (targetIndex >= 0 && targetIndex < folder.children.length) {
        const targetBookmark = folder.children[targetIndex];
        // console.log(`Target position bookmark: ID=${targetBookmark.id}, Title=${targetBookmark.title}, Index=${targetIndex}`);
      }
    }
    
    // Move bookmark using Chrome API
    // console.log(`Executing bookmark move - ID: ${draggedId}, Target index: ${targetIndex}`);
    await chrome.bookmarks.move(draggedId, {
      parentId: folder.id,
      index: targetIndex
    });
    
    // Get updated folder information
    const updatedResponse = await getBookmarks();
    
    // Log results after move
    if (updatedResponse.folder && updatedResponse.folder.children) {
      const newIndex = updatedResponse.folder.children.findIndex(b => b.id === draggedId);
      // console.log(`Move complete - Bookmark moved from index ${draggedIndex} to ${newIndex}`);
    }
    
    return {
      success: true,
      folder: updatedResponse.folder
    };
  } catch (error) {
    // console.error("Error moving bookmark:", error);
    return {
      success: false,
      reason: "error",
      error: error.message
    };
  }
}

// Update a bookmark's title and URL
async function updateBookmark(id, title, url) {
  try {
    const bookmark = await chrome.bookmarks.update(id, {
      title: title,
      url: url
    });
    
    const bookmarkTreeNodes = await chrome.bookmarks.getTree();
    const shortcutsFolder = findShortcutsFolder(bookmarkTreeNodes[0]);
    
    return {
      success: true,
      bookmark: bookmark,
      folder: shortcutsFolder
    };
  } catch (error) {
    return {
      success: false,
      reason: "error",
      error: error.message
    };
  }
}

// Delete a bookmark
async function deleteBookmark(id) {
  try {
    await chrome.bookmarks.remove(id);
    
    const bookmarkTreeNodes = await chrome.bookmarks.getTree();
    const shortcutsFolder = findShortcutsFolder(bookmarkTreeNodes[0]);
    
    return {
      success: true,
      folder: shortcutsFolder
    };
  } catch (error) {
    return {
      success: false,
      reason: "error",
      error: error.message
    };
  }
} 