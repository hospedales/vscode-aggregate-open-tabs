const vscode = acquireVsCodeApi();
let settings = {};
let presets = {
    minimal: {
        aiSummaryStyle: 'minimal',
        includeKeyPoints: false,
        includeImports: false,
        includeExports: false,
        includeDependencies: false,
        includeCrossReferences: false,
        chunkSize: 2000,
        chunkSeparatorStyle: 'minimal',
        extraSpacing: false,
        useCodeFences: true
    },
    standard: {
        aiSummaryStyle: 'standard',
        includeKeyPoints: true,
        includeImports: true,
        includeExports: true,
        includeDependencies: true,
        includeCrossReferences: true,
        chunkSize: 2000,
        chunkSeparatorStyle: 'double',
        extraSpacing: true,
        useCodeFences: true
    },
    detailed: {
        aiSummaryStyle: 'detailed',
        includeKeyPoints: true,
        includeImports: true,
        includeExports: true,
        includeDependencies: true,
        includeCrossReferences: true,
        chunkSize: 1000,
        chunkSeparatorStyle: 'double',
        extraSpacing: true,
        useCodeFences: true
    },
    development: {
        aiSummaryStyle: 'comprehensive',
        includeKeyPoints: true,
        includeImports: true,
        includeExports: true,
        includeDependencies: true,
        includeCrossReferences: true,
        chunkSize: 500,
        chunkSeparatorStyle: 'double',
        extraSpacing: true,
        useCodeFences: true,
        preview: {
            showSourceView: true,
            syntaxHighlighting: true,
            collapsibleSections: true,
            searchEnabled: true,
            autoRefresh: true
        }
    },
    documentation: {
        aiSummaryStyle: 'comprehensive',
        includeKeyPoints: true,
        includeImports: true,
        includeExports: true,
        includeDependencies: true,
        includeCrossReferences: true,
        chunkSize: 2000,
        chunkSeparatorStyle: 'double',
        extraSpacing: true,
        useCodeFences: true,
        outputFormat: 'markdown'
    }
};

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'updateSettings':
            settings = message.settings;
            updateUI();
            updatePreview();
            break;
    }
});

function updateUI() {
    // Update all input fields with current settings
    Object.entries(settings).forEach(([key, value]) => {
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value;
            } else if (element.type === 'number' || element.type === 'select-one') {
                element.value = value;
            }
        }
    });

    // Update preview settings
    Object.entries(settings.preview || {}).forEach(([key, value]) => {
        const element = document.getElementById(`preview.${key}`);
        if (element) {
            element.checked = value;
        }
    });

    // Update pattern lists
    updatePatternList('excludePatterns', settings.excludePatterns || []);
    updatePatternList('redactionPatterns', settings.customRedactionPatterns || []);
}

function updatePreview() {
    const preview = document.getElementById('settingsPreview');
    const content = JSON.stringify(settings, null, 2);
    preview.textContent = content;
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
        input.value = '';
    }
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

function updateSetting(key, value) {
    vscode.postMessage({
        command: 'updateSetting',
        value: { key, value }
    });
}

function applyPreset() {
    const selector = document.getElementById('presetSelector');
    const preset = presets[selector.value];
    if (preset) {
        Object.entries(preset).forEach(([key, value]) => {
            updateSetting(key, value);
        });
    }
}

function saveAsPreset() {
    const name = prompt('Enter a name for the preset:');
    if (name) {
        const customPresets = { ...presets };
        customPresets[name] = { ...settings };
        presets = customPresets;
        
        // Update preset selector
        const selector = document.getElementById('presetSelector');
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        selector.appendChild(option);
    }
}

function exportSettings() {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aggregate-open-tabs-settings.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const text = await file.text();
                const importedSettings = JSON.parse(text);
                Object.entries(importedSettings).forEach(([key, value]) => {
                    updateSetting(key, value);
                });
            } catch (error) {
                vscode.postMessage({
                    command: 'showError',
                    value: 'Failed to import settings: Invalid JSON file'
                });
            }
        }
    };
    input.click();
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Preset controls
    document.getElementById('applyPreset').addEventListener('click', applyPreset);
    document.getElementById('saveAsPreset').addEventListener('click', saveAsPreset);
    
    // Import/Export
    document.getElementById('exportSettings').addEventListener('click', exportSettings);
    document.getElementById('importSettings').addEventListener('click', importSettings);

    // Pattern management
    const addExcludeBtn = document.getElementById('addExcludePatternBtn');
    const newExcludeInput = document.getElementById('newExcludePattern');
    
    addExcludeBtn.addEventListener('click', () => addPattern('newExcludePattern', 'excludePatterns'));
    newExcludeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addPattern('newExcludePattern', 'excludePatterns');
        }
    });

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
            
            // Handle preview settings separately
            if (input.id.startsWith('preview.')) {
                const key = input.id.replace('preview.', '');
                const preview = { ...(settings.preview || {}) };
                preview[key] = value;
                updateSetting('preview', preview);
            } else {
                updateSetting(input.id, value);
            }
        });
    });
}); 