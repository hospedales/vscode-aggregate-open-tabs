import * as assert from 'assert';
import * as vscode from 'vscode';
import { PreviewPanel } from '../../previewPanel';
import * as sinon from 'sinon';

suite('PreviewPanel Test Suite', () => {
    let extensionUri: vscode.Uri;
    let panel: PreviewPanel;
    let webviewPanel: vscode.WebviewPanel;

    setup(() => {
        extensionUri = vscode.Uri.file(__dirname);
        webviewPanel = vscode.window.createWebviewPanel(
            'test',
            'Test Panel',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );
        panel = PreviewPanel.createOrShow(extensionUri, webviewPanel);
    });

    teardown(() => {
        panel.dispose();
    });

    test('createOrShow creates new panel', () => {
        assert.strictEqual(PreviewPanel.currentPanel, panel);
    });

    test('createOrShow reuses existing panel', () => {
        const newPanel = PreviewPanel.createOrShow(extensionUri);
        assert.strictEqual(newPanel, panel);
    });

    test('updateContent sends message to webview', () => {
        const postMessageSpy = sinon.spy(webviewPanel.webview, 'postMessage');
        const content = 'test content';
        const metadata = [{
            fileName: 'test.ts',
            relativePath: 'test.ts',
            content: 'test',
            size: 4,
            lastModified: new Date().toISOString(),
            languageId: 'typescript'
        }];

        panel.updateContent(content, metadata);

        assert.strictEqual(postMessageSpy.calledOnce, true);
        assert.deepStrictEqual(postMessageSpy.firstCall.args[0], {
            type: 'update',
            content,
            metadata
        });
    });

    test('dispose cleans up resources', () => {
        const disposeSpy = sinon.spy(webviewPanel, 'dispose');
        
        panel.dispose();

        assert.strictEqual(disposeSpy.calledOnce, true);
        assert.strictEqual(PreviewPanel.currentPanel, undefined);
    });
}); 