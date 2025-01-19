// Required globals provided by VS Code webview
declare const acquireVsCodeApi: () => {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
};

declare const hljs: {
    getLanguage(lang: string): unknown;
    highlight(code: string, options: { language: string }): { value: string };
    highlightBlock(block: Element): void;
};

declare const marked: {
    parse(content: string, options: {
        highlight?: (code: string, lang: string) => string;
    }): string;
};

interface SearchMatch {
    node: Text;
    index: number;
    length: number;
}

interface FileMetadata {
    fileName: string;
    content: string;
    languageId: string;
}

interface Message {
    type: string;
    content?: string;
    metadata?: FileMetadata[];
    message?: string;
}

const vscode = acquireVsCodeApi();
const contentContainer = document.getElementById('content');
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const searchCount = document.getElementById('searchCount');
const prevMatchBtn = document.getElementById('prevMatch');
const nextMatchBtn = document.getElementById('nextMatch');
const copyBtn = document.getElementById('copyBtn');
const refreshBtn = document.getElementById('refreshBtn');

let currentContent = '';
let currentMetadata: FileMetadata[] = [];
let searchMatches: SearchMatch[] = [];
let currentMatchIndex = -1;

// Initialize highlight.js
document.addEventListener('DOMContentLoaded', () => {
    // Initialize syntax highlighting
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block);
    });

    // Set up event listeners
    searchInput?.addEventListener('input', () => {
        updateSearch();
    });

    copyBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(currentContent).then(() => {
            vscode.postMessage({ type: 'info', message: 'Content copied to clipboard' });
        }).catch(() => {
            vscode.postMessage({ type: 'error', message: 'Failed to copy content' });
        });
    });

    refreshBtn?.addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
    });

    prevMatchBtn?.addEventListener('click', () => {
        if (searchMatches.length === 0) return;
        currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
        highlightMatches();
        updateMatchCount();
        scrollToCurrentMatch();
    });

    nextMatchBtn?.addEventListener('click', () => {
        if (searchMatches.length === 0) return;
        currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
        highlightMatches();
        updateMatchCount();
        scrollToCurrentMatch();
    });
});

function updateContent(): void {
    // Convert markdown to HTML with syntax highlighting
    const html = marked.parse(currentContent, {
        highlight: (code: string, lang: string) => {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (err) {
                    console.error('Highlight error:', err);
                }
            }
            return code; // Use verbatim if language not found
        }
    });

    if (contentContainer) {
        contentContainer.innerHTML = html;
    }
    updateSearch(); // Refresh search if there's an active search term
}

function updateSearch(): void {
    if (searchMatches.length === 0) {
        return;
    }

    if (!searchInput || !searchCount) {
        return;
    }

    if (!contentContainer) {
        return;
    }

    const searchTerm = searchInput.value.toLowerCase();
    searchMatches = [];
    currentMatchIndex = -1;

    if (!searchTerm) {
        searchCount.textContent = '';
        clearHighlights();
        return;
    }

    // Find all text nodes in the content
    const walker = document.createTreeWalker(
        contentContainer,
        NodeFilter.SHOW_TEXT
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
        const text = node?.textContent?.toLowerCase() || '';
        let index = text.indexOf(searchTerm);
        
        while (index !== -1) {
            searchMatches.push({
                node,
                index,
                length: searchTerm.length
            });
            index = text.indexOf(searchTerm, index + 1);
        }
    }

    highlightMatches();
    updateMatchCount();
}

function clearHighlights(): void {
    if (!contentContainer) return;

    const highlights = contentContainer.querySelectorAll('.search-highlight');
    highlights.forEach(h => {
        const parent = h.parentNode;
        if (parent && h.textContent) {
            parent.replaceChild(document.createTextNode(h.textContent), h);
            parent.normalize();
        }
    });
}

function highlightMatches(): void {
    clearHighlights();
    
    if (searchMatches.length === 0) return;

    // Create highlights in reverse order to maintain text indices
    for (let i = searchMatches.length - 1; i >= 0; i--) {
        const match = searchMatches[i];
        if (!match?.node?.textContent) {
            continue;
        }

        const text = match.node.textContent;
        const before = text.substring(0, match.index);
        const highlight = text.substring(match.index, match.index + match.length);
        const after = text.substring(match.index + match.length);

        const span = document.createElement('span');
        span.className = 'search-highlight';
        if (i === currentMatchIndex) {
            span.className += ' current-match';
        }
        span.textContent = highlight;

        const fragment = document.createDocumentFragment();
        fragment.appendChild(document.createTextNode(before));
        fragment.appendChild(span);
        fragment.appendChild(document.createTextNode(after));

        const parent = match.node.parentNode;
        if (parent) {
            parent.replaceChild(fragment, match.node);
        }
    }
}

function updateMatchCount(): void {
    if (!searchCount) {
        return;
    }

    if (searchMatches.length > 0) {
        searchCount.textContent = `${currentMatchIndex + 1}/${searchMatches.length}`;
    } else {
        searchCount.textContent = 'No matches';
    }
}

function scrollToCurrentMatch(): void {
    if (!contentContainer) return;

    if (currentMatchIndex >= 0 && currentMatchIndex < searchMatches.length) {
        const currentHighlight = contentContainer.querySelector('.current-match');
        if (currentHighlight) {
            currentHighlight.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }
}

// Handle messages from the extension
window.addEventListener('message', (event: MessageEvent<Message>) => {
    const message = event.data;
    switch (message.type) {
        case 'update':
            if (message.content) {
                currentContent = message.content;
                currentMetadata = message.metadata || [];
                updateContent();
            }
            break;
    }
}); 