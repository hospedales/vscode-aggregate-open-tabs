const vscode = acquireVsCodeApi();
let splitView = false;
let searchVisible = false;
let allSectionsExpanded = true;

// Initialize syntax highlighting
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block);
    });
});

function toggleSplitView() {
    splitView = !splitView;
    const sourceView = document.querySelector('.source-view');
    const gutter = document.querySelector('.gutter');
    
    if (splitView) {
        sourceView.style.display = 'block';
        gutter.style.display = 'block';
        vscode.postMessage({ command: 'requestSource' });
        initializeSplitView();
    } else {
        sourceView.style.display = 'none';
        gutter.style.display = 'none';
    }
}

function toggleSearch() {
    searchVisible = !searchVisible;
    const searchBar = document.querySelector('.search-bar');
    searchBar.style.display = searchVisible ? 'flex' : 'none';
    if (searchVisible) {
        document.querySelector('.search-input').focus();
    } else {
        clearSearch();
    }
}

function toggleCollapsible() {
    allSectionsExpanded = !allSectionsExpanded;
    document.querySelectorAll('details').forEach(detail => {
        detail.open = allSectionsExpanded;
    });
}

function searchContent(query) {
    // Remove existing highlights
    clearSearch();

    if (!query) {
        document.querySelector('.search-count').textContent = '';
        return;
    }

    const content = document.querySelector('.preview-view');
    const regex = new RegExp(query, 'gi');
    const walker = document.createTreeWalker(
        content,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let matches = 0;
    let node;

    while (node = walker.nextNode()) {
        if (node.nodeValue.match(regex)) {
            const span = document.createElement('span');
            span.innerHTML = node.nodeValue.replace(regex, match => {
                matches++;
                return `<span class="match-highlight">${match}</span>`;
            });
            node.replaceWith(span);
        }
    }

    document.querySelector('.search-count').textContent = 
        matches ? `${matches} match${matches === 1 ? '' : 'es'}` : 'No matches';
}

function clearSearch() {
    document.querySelectorAll('.match-highlight').forEach(el => {
        el.outerHTML = el.innerHTML;
    });
    document.querySelector('.search-count').textContent = '';
}

function refresh() {
    vscode.postMessage({ command: 'refresh' });
}

function initializeSplitView() {
    const splitInstance = Split(['.source-view', '.preview-view'], {
        sizes: [50, 50],
        minSize: 200,
        gutterSize: 4,
        cursor: 'col-resize'
    });

    // Store the Split.js instance for cleanup
    window.splitInstance = splitInstance;
}

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'updateSource':
            const sourceView = document.querySelector('.source-view');
            sourceView.textContent = message.content;
            if (typeof hljs !== 'undefined') {
                hljs.highlightBlock(sourceView);
            }
            break;
    }
}); 