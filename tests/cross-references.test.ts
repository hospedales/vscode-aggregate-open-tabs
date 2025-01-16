import * as vscode from 'vscode';
import * as assert from 'assert';
import { CrossReferenceTracker } from '../src/cross-references';
import { before, beforeEach, describe, it } from 'mocha';

class MockTextDocument implements vscode.TextDocument {
    private _content: string;
    private _uri: vscode.Uri;

    constructor(content: string, fileName: string) {
        this._content = content;
        this._uri = { fsPath: fileName } as vscode.Uri;
    }

    get uri(): vscode.Uri { return this._uri; }
    getText(): string { return this._content; }
    positionAt(offset: number): vscode.Position {
        const lines = this._content.slice(0, offset).split('\n');
        return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
    }

    // Implement other required methods with dummy values
    get fileName(): string { return this._uri.fsPath; }
    get isUntitled(): boolean { return false; }
    get languageId(): string { return 'typescript'; }
    get lineCount(): number { return this._content.split('\n').length; }
    get version(): number { return 1; }
    get isDirty(): boolean { return false; }
    get isClosed(): boolean { return false; }
    eol: vscode.EndOfLine = vscode.EndOfLine.LF;
    getWordRangeAtPosition(): vscode.Range | undefined { return undefined; }
    lineAt(): vscode.TextLine { throw new Error('Not implemented'); }
    offsetAt(): number { throw new Error('Not implemented'); }
    save(): Thenable<boolean> { throw new Error('Not implemented'); }
    validatePosition(): vscode.Position { throw new Error('Not implemented'); }
    validateRange(): vscode.Range { throw new Error('Not implemented'); }
}

describe('CrossReferenceTracker', () => {
    let tracker: CrossReferenceTracker;

    before(() => {
        // Mock workspace root
        (vscode.workspace as any).workspaceFolders = [{
            uri: { fsPath: '/workspace' } as vscode.Uri,
            name: 'workspace',
            index: 0
        }];
    });

    beforeEach(() => {
        tracker = new CrossReferenceTracker();
    });

    describe('analyzeFile', () => {
        it('should detect relative imports', async () => {
            const doc = new MockTextDocument(
                `import { something } from './utils';
                import type { Other } from '../types';`,
                '/workspace/src/test.ts'
            );

            const refs = await tracker.analyzeFile(doc);
            
            assert.ok(refs);
            assert.strictEqual(refs.references.length, 2);
            assert.strictEqual(refs.references[0].targetFile, 'src/utils.ts');
            assert.strictEqual(refs.references[1].targetFile, 'types.ts');
        });

        it('should ignore non-relative imports', async () => {
            const doc = new MockTextDocument(
                `import express from 'express';
                import { useState } from 'react';`,
                '/workspace/src/test.ts'
            );

            const refs = await tracker.analyzeFile(doc);
            
            assert.ok(refs);
            assert.strictEqual(refs.references.length, 0);
        });

        it('should track bidirectional references', async () => {
            const fileA = new MockTextDocument(
                `import { b } from './b';`,
                '/workspace/src/a.ts'
            );
            
            const fileB = new MockTextDocument(
                `import { a } from './a';`,
                '/workspace/src/b.ts'
            );

            await tracker.analyzeFile(fileA);
            await tracker.analyzeFile(fileB);

            const refsA = tracker.getCrossReferences('/workspace/src/a.ts');
            const refsB = tracker.getCrossReferences('/workspace/src/b.ts');

            assert.ok(refsA && refsB);
            assert.strictEqual(refsA.references[0].targetFile, 'src/b.ts');
            assert.strictEqual(refsB.references[0].targetFile, 'src/a.ts');
            assert.strictEqual(refsA.referencedBy[0].sourceFile, 'src/b.ts');
            assert.strictEqual(refsB.referencedBy[0].sourceFile, 'src/a.ts');
        });

        it('should extract imported symbols', async () => {
            const doc = new MockTextDocument(
                `import { one, two as alias } from './utils';`,
                '/workspace/src/test.ts'
            );

            const refs = await tracker.analyzeFile(doc);
            
            assert.ok(refs);
            assert.strictEqual(refs.references.length, 1);
            assert.strictEqual(refs.references[0].symbol, 'one, two as alias');
        });

        it('should handle require statements', async () => {
            const doc = new MockTextDocument(
                `const utils = require('./utils');`,
                '/workspace/src/test.ts'
            );

            const refs = await tracker.analyzeFile(doc);
            
            assert.ok(refs);
            assert.strictEqual(refs.references.length, 1);
            assert.strictEqual(refs.references[0].targetFile, 'src/utils.ts');
        });
    });

    describe('clear', () => {
        it('should remove all tracked references', async () => {
            const doc = new MockTextDocument(
                `import { something } from './utils';`,
                '/workspace/src/test.ts'
            );

            await tracker.analyzeFile(doc);
            tracker.clear();

            const refs = tracker.getCrossReferences('/workspace/src/test.ts');
            assert.strictEqual(refs, undefined);
        });
    });
}); 