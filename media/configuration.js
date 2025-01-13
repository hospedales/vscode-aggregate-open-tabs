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
        input.style.flex = '1';
        input.style.marginRight = '8px';
        input.addEventListener('change', (e) => updatePattern(id, index, e.target.value));
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => removePattern(id, index);
        
        div.appendChild(input);
        div.appendChild(removeBtn);
        container.appendChild(div);
    });
}

function addExcludePattern() {
    const input = document.getElementById('newExcludePattern');
    const pattern = input.value.trim();
    
    if (pattern) {
        const patterns = [...(settings.excludePatterns || [])];
        patterns.push(pattern);
        updateSetting('excludePatterns', patterns);
        input.value = ''; // Clear the input
    }
}

function addRedactionPattern() {
    const patterns = [...(settings.customRedactionPatterns || [])];
    patterns.push('');  // Add empty pattern for editing
    updateSetting('customRedactionPatterns', patterns);
}

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

// Add change listeners to all inputs
document.querySelectorAll('input[type="checkbox"], select, input[type="number"]').forEach(input => {
    input.addEventListener('change', () => {
        const value = input.type === 'checkbox' ? input.checked : 
                    input.type === 'number' ? parseInt(input.value, 10) : 
                    input.value;
        updateSetting(input.id, value);
    });
});

// Add enter key handler for the new pattern input
document.getElementById('newExcludePattern').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addExcludePattern();
    }
});

function updateSetting(key, value) {
    settings[key] = value;
    vscode.postMessage({
        command: 'updateSetting',
        value: { key, value }
    });
} 