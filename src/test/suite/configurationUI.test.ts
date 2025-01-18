import * as assert from 'assert';
import * as vscode from 'vscode';
import { before, describe, it } from 'mocha';

describe('Configuration Tests', () => {
    before(async () => {
        // Wait for extension to activate
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Ensure workspace is set up
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(workspaceFolder, 'Workspace should be set up');
    });

    it('should have default configuration values', async () => {
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        assert.ok(config.has('maxTerminalLines'), 'maxTerminalLines setting should exist');
        assert.strictEqual(config.get('maxTerminalLines'), 100, 'Default value should be 100');
    });

    it('should update configuration values', async function() {
        this.timeout(10000); // Increase timeout for config updates

        // Get initial configuration
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const initialValue = config.get('maxTerminalLines');

        try {
            // Update configuration
            await config.update('maxTerminalLines', 150, vscode.ConfigurationTarget.Workspace);

            // Wait for configuration to update
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get updated configuration
            const updatedConfig = vscode.workspace.getConfiguration('aggregateOpenTabs');
            const updatedValue = updatedConfig.get('maxTerminalLines');
            assert.strictEqual(updatedValue, 150, 'Configuration should be updated to test value');

            // Update configuration again
            await config.update('maxTerminalLines', 200, vscode.ConfigurationTarget.Workspace);

            // Wait for configuration to update
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get updated configuration again
            const finalConfig = vscode.workspace.getConfiguration('aggregateOpenTabs');
            const finalValue = finalConfig.get('maxTerminalLines');
            assert.strictEqual(finalValue, 200, 'Configuration should be updated to final value');
        } finally {
            // Restore initial value
            await config.update('maxTerminalLines', initialValue, vscode.ConfigurationTarget.Workspace);
        }
    });
}); 