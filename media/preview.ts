// @ts-check

declare function acquireVsCodeApi(): {
    postMessage(message: any): void;
};

interface SearchResult {
    line: number;
    text: string;
}

(function () {
    const vscode = acquireVsCodeApi();
    const contentDiv = document.getElementById('content');
    const splitContentDiv = document.getElementById('splitContent');
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    const searchCount = document.getElementById('searchCount');
    const prevMatchBtn = document.getElementById('prevMatch');
    const nextMatchBtn = document.getElementById('nextMatch');
    const copyBtn = document.getElementById('copyBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const splitViewBtn = document.getElementById('splitViewBtn');

    let currentSearchResults: SearchResult[] = [];
    let currentMatchIndex = 0;
    let isSplitView = false;

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'copy' });
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'refresh' });
        });
    }

    if (splitViewBtn) {
        splitViewBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'toggleSplitView' });
        });
    }

    if (searchInput && searchCount && prevMatchBtn && nextMatchBtn) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value;
            if (query) {
                vscode.postMessage({ type: 'search', query });
            } else {
                clearSearchResults();
            }
        });

        prevMatchBtn.addEventListener('click', () => {
            if (currentSearchResults.length > 0) {
                currentMatchIndex = (currentMatchIndex - 1 + currentSearchResults.length) % currentSearchResults.length;
                scrollToMatch();
            }
        });

        nextMatchBtn.addEventListener('click', () => {
            if (currentSearchResults.length > 0) {
                currentMatchIndex = (currentMatchIndex + 1) % currentSearchResults.length;
                scrollToMatch();
            }
        });
    }

    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.type) {
            case 'update':
                updateContent(message.content);
                if (message.metadata) {
                    updateMetadata(message.metadata);
                }
                break;

            case 'searchResults':
                displaySearchResults(message.results);
                break;

            case 'splitView':
                toggleSplitView();
                break;
        }
    });

    function updateContent(html: string) {
        if (contentDiv) {
            contentDiv.innerHTML = html;
            // Add line numbers and IDs to each line for search highlighting
            const lines = contentDiv.querySelectorAll('pre > code');
            lines.forEach((line, index) => {
                line.setAttribute('id', `line-${index + 1}`);
            });
        }
    }

    function updateMetadata(metadata: unknown[]) {
        if (splitContentDiv) {
            splitContentDiv.innerHTML = '';
            metadata.forEach((file) => {
                const fileDiv = document.createElement('div');
                fileDiv.textContent = `File: ${file}`;
                fileDiv.addEventListener('click', () => {
                    // Handle file click, e.g., open in editor
                    // vscode.postMessage({ type: 'openFile', filePath: file.filename });
                });
                splitContentDiv.appendChild(fileDiv);
            });
        }
    }

    function displaySearchResults(results: SearchResult[]) {
        currentSearchResults = results;
        currentMatchIndex = 0;

        if (searchCount) {
            searchCount.textContent = `${results.length} results`;
        }

        clearHighlighting();

        if (results.length > 0) {
            highlightMatch(currentSearchResults[currentMatchIndex]);
            scrollToMatch();
        }
    }

    function clearSearchResults() {
        currentSearchResults = [];
        currentMatchIndex = 0;

        if (searchCount) {
            searchCount.textContent = '';
        }

        clearHighlighting();
    }

    function clearHighlighting() {
        if (contentDiv) {
            const lines = Array.from(contentDiv.children);
            lines.forEach(line => {
                line.classList.remove('highlight');
            });
        }
    }

    function highlightMatch(result: SearchResult | undefined) {
        if (!result || !contentDiv) {
            return;
        }
        const lineDiv = document.getElementById(`line-${result.line}`);
        if (lineDiv) {
            lineDiv.classList.add('highlight');
        }
    }

    function scrollToMatch() {
        if (contentDiv && currentSearchResults.length > 0 && currentMatchIndex < currentSearchResults.length) {
            const result = currentSearchResults[currentMatchIndex];
            if (!result) {
                return;
            }
            const lineDiv = document.getElementById(`line-${result.line}`);
            if (lineDiv) {
                lineDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    function toggleSplitView() {
        isSplitView = !isSplitView;
        if (contentDiv && splitContentDiv) {
            if (isSplitView) {
                contentDiv.classList.add('split');
                splitContentDiv.classList.remove('hidden');
            } else {
                contentDiv.classList.remove('split');
                splitContentDiv.classList.add('hidden');
            }
        }
    }
})(); 