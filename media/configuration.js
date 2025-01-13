const vscode = acquireVsCodeApi();
let settings = {};

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'updateSettings':
            settings = message.settings;
            updateUI();
            break;
    }
});

function updateUI() {
    // Update all input fields with current settings
    Object.entries(settings).forEach(([key, value]) => {
        const element = document.getElementById(key);
        if (element && element.type !== 'text') {  // Skip text inputs as they're handled separately
            if (element.type === 'checkbox') {
                element.checked = value;
            } else if (element.type !== 'text') {  // Don't update text inputs here
                element.value = value;
            }
        }
    });

    // Update pattern lists
    updatePatternList('excludePatterns', settings.excludePatterns || []);
    updatePatternList('redactionPatterns', settings.customRedactionPatterns || []);
}

function updatePatternList(id, patterns) {
    const container = document.getElementById(id);
    container.innerHTML = '';
    
    if (patterns.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No patterns added';
        container.appendChild(emptyMessage);
        return;
    }

    patterns.forEach((pattern, index) => {
        const div = document.createElement('div');
        div.className = 'pattern-item';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = pattern;
        input.addEventListener('change', (e) => updatePattern(id, index, e.target.value));
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => removePattern(id, index));
        
        div.appendChild(input);
        div.appendChild(removeBtn);
        container.appendChild(div);
    });
}

function addPattern(inputId, listId) {
    const input = document.getElementById(inputId);
    const pattern = input.value.trim();
    
    if (pattern) {
        const key = listId === 'redactionPatterns' ? 'customRedactionPatterns' : listId;
        const patterns = [...(settings[key] || [])];
        patterns.push(pattern);
        updateSetting(key, patterns);
        input.value = ''; // Clear the input
    }
}

// Add event listeners for pattern management
document.addEventListener('DOMContentLoaded', () => {
    // Exclude patterns
    const addExcludeBtn = document.getElementById('addExcludePatternBtn');
    const newExcludeInput = document.getElementById('newExcludePattern');
    
    addExcludeBtn.addEventListener('click', () => addPattern('newExcludePattern', 'excludePatterns'));
    newExcludeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addPattern('newExcludePattern', 'excludePatterns');
        }
    });

    // Redaction patterns
    const addRedactionBtn = document.getElementById('addRedactionPatternBtn');
    const newRedactionInput = document.getElementById('newRedactionPattern');
    
    addRedactionBtn.addEventListener('click', () => addPattern('newRedactionPattern', 'redactionPatterns'));
    newRedactionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addPattern('newRedactionPattern', 'redactionPatterns');
        }
    });

    // Add change listeners to all inputs
    document.querySelectorAll('input[type="checkbox"], select, input[type="number"]').forEach(input => {
        input.addEventListener('change', () => {
            const value = input.type === 'checkbox' ? input.checked : 
                        input.type === 'number' ? parseInt(input.value, 10) : 
                        input.value;
            updateSetting(input.id, value);
        });
    });
});

function updatePattern(listId, index, value) {
    const key = listId === 'redactionPatterns' ? 'customRedactionPatterns' : listId;
    const patterns = [...(settings[key] || [])];
    patterns[index] = value;
    updateSetting(key, patterns);
}

function removePattern(listId, index) {
    const key = listId === 'redactionPatterns' ? 'customRedactionPatterns' : listId;
    const patterns = [...(settings[key] || [])];
    patterns.splice(index, 1);
    updateSetting(key, patterns);
}

function updateSetting(key, value) {
    settings[key] = value;
    vscode.postMessage({
        command: 'updateSetting',
        value: { key, value }
    });
} 