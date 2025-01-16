import * as assert from 'assert';
import * as vscode from 'vscode';

suite('ConfigurationPanel Integration Tests', () => {
    let disposables: vscode.Disposable[] = [];

    setup(async () => {
        // Reset configuration to defaults before each test
        await vscode.workspace.getConfiguration('aggregateOpenTabs').update('aiSummaryStyle', 'standard');
        await vscode.workspace.getConfiguration('aggregateOpenTabs').update('includeImports', true);
        await vscode.workspace.getConfiguration('aggregateOpenTabs').update('includeCrossReferences', true);
        await vscode.workspace.getConfiguration('aggregateOpenTabs').update('preview.showSourceView', false);

        // Show configuration panel
        await vscode.commands.executeCommand('aggregateOpenTabs.showConfiguration');
    });

    teardown(() => {
        disposables.forEach(d => d.dispose());
        disposables = [];
    });

    test('panel creation and initial state', async () => {
        // Wait for panel to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify initial configuration values
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        assert.strictEqual(config.get('aiSummaryStyle'), 'standard');
        assert.strictEqual(config.get('includeImports'), true);
        assert.strictEqual(config.get('includeCrossReferences'), true);
        assert.strictEqual(config.get('preview.showSourceView'), false);
    });

    test('configuration updates are reflected in UI', async () => {
        // Update a configuration value
        await vscode.workspace.getConfiguration('aggregateOpenTabs').update('aiSummaryStyle', 'detailed');
        
        // Wait for UI to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify the change is reflected in the configuration
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        assert.strictEqual(config.get('aiSummaryStyle'), 'detailed');
    });

    test('preset configuration application', async () => {
        // Simulate clicking the development preset button
        await vscode.commands.executeCommand('aggregateOpenTabs.applyPreset', 'development');
        
        // Wait for changes to take effect
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify development preset settings
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        assert.strictEqual(config.get('aiSummaryStyle'), 'detailed');
        assert.strictEqual(config.get('includeImports'), true);
        assert.strictEqual(config.get('includeCrossReferences'), true);
        assert.strictEqual(config.get('preview.showSourceView'), true);
    });

    test('configuration import/export', async () => {
        // Export current configuration via command
        const exportedConfig = await vscode.commands.executeCommand('aggregateOpenTabs.exportSettings');
        
        // Modify some settings
        await vscode.workspace.getConfiguration('aggregateOpenTabs').update('aiSummaryStyle', 'minimal');
        await vscode.workspace.getConfiguration('aggregateOpenTabs').update('includeImports', false);
        
        // Import the exported configuration via command
        await vscode.commands.executeCommand('aggregateOpenTabs.importSettings', exportedConfig);
        
        // Wait for changes to take effect
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify settings are restored
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        assert.strictEqual(config.get('aiSummaryStyle'), 'standard');
        assert.strictEqual(config.get('includeImports'), true);
    });

    test('error handling for invalid settings', async () => {
        // Attempt to import invalid settings via command
        const invalidSettings = '{ "invalid": "json" }';
        
        try {
            await vscode.commands.executeCommand('aggregateOpenTabs.importSettings', invalidSettings);
            assert.fail('Should throw error for invalid settings');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('Invalid configuration'));
        }
    });

    test('live preview updates', async () => {
        // Make multiple rapid changes
        const changes = [
            vscode.workspace.getConfiguration('aggregateOpenTabs').update('aiSummaryStyle', 'minimal'),
            vscode.workspace.getConfiguration('aggregateOpenTabs').update('includeImports', false),
            vscode.workspace.getConfiguration('aggregateOpenTabs').update('includeCrossReferences', false)
        ];
        
        await Promise.all(changes);
        
        // Wait for debounced preview update
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Verify configuration changes
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        assert.strictEqual(config.get('aiSummaryStyle'), 'minimal');
        assert.strictEqual(config.get('includeImports'), false);
        assert.strictEqual(config.get('includeCrossReferences'), false);
    });
}); 