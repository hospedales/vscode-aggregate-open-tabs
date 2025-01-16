import * as vscode from 'vscode';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { before, beforeEach, afterEach, describe, it } from 'mocha';
import { TagManager, Tag } from '../src/tags';

describe('TagManager', () => {
    let tagManager: TagManager;
    const mockWorkspacePath = '/workspace';
    const mockConfigPath = path.join(mockWorkspacePath, '.vscode', 'file-tags.json');

    before(() => {
        // Mock workspace root
        (vscode.workspace as any).workspaceFolders = [{
            uri: { fsPath: mockWorkspacePath } as vscode.Uri,
            name: 'workspace',
            index: 0
        }];

        // Mock fs operations
        const mockFiles = new Map<string, string>();
        (fs as any).existsSync = (path: string) => mockFiles.has(path);
        (fs as any).readFileSync = (path: string) => mockFiles.get(path);
        (fs as any).writeFileSync = (path: string, content: string) => mockFiles.set(path, content);
        (fs as any).mkdirSync = () => {};
        (fs as any).statSync = (path: string) => ({
            isDirectory: () => path.endsWith('dir')
        });
    });

    beforeEach(() => {
        tagManager = new TagManager();
    });

    describe('Tag Creation', () => {
        it('should create a new tag with generated ID', () => {
            const tag = tagManager.createTag({
                name: 'Test Tag',
                scope: 'both',
                color: '#ff0000',
                description: 'A test tag'
            });

            assert.strictEqual(tag.name, 'Test Tag');
            assert.strictEqual(tag.id, 'test-tag');
            assert.strictEqual(tag.color, '#ff0000');
            assert.strictEqual(tag.description, 'A test tag');
            assert.strictEqual(tag.scope, 'both');
        });

        it('should handle duplicate tag names', () => {
            const tag1 = tagManager.createTag({ name: 'Test', scope: 'both' });
            const tag2 = tagManager.createTag({ name: 'Test', scope: 'both' });

            assert.strictEqual(tag1.id, 'test');
            assert.strictEqual(tag2.id, 'test-1');
        });
    });

    describe('Tag Application', () => {
        let fileTag: Tag;
        let dirTag: Tag;
        let bothTag: Tag;

        beforeEach(() => {
            fileTag = tagManager.createTag({ name: 'File Only', scope: 'file' });
            dirTag = tagManager.createTag({ name: 'Dir Only', scope: 'directory' });
            bothTag = tagManager.createTag({ name: 'Both', scope: 'both' });
        });

        it('should apply file tag to file', () => {
            const applied = tagManager.applyTag(fileTag.id, '/workspace/test.ts');
            assert.ok(applied);
            assert.strictEqual(applied.appliedTo, 'test.ts');
        });

        it('should not apply file tag to directory', () => {
            const applied = tagManager.applyTag(fileTag.id, '/workspace/test-dir');
            assert.strictEqual(applied, undefined);
        });

        it('should apply directory tag to directory', () => {
            const applied = tagManager.applyTag(dirTag.id, '/workspace/test-dir');
            assert.ok(applied);
            assert.strictEqual(applied.appliedTo, 'test-dir');
        });

        it('should apply both tag to file and directory', () => {
            const fileApplied = tagManager.applyTag(bothTag.id, '/workspace/test.ts');
            const dirApplied = tagManager.applyTag(bothTag.id, '/workspace/test-dir');

            assert.ok(fileApplied && dirApplied);
            assert.strictEqual(fileApplied.appliedTo, 'test.ts');
            assert.strictEqual(dirApplied.appliedTo, 'test-dir');
        });
    });

    describe('Tag Inheritance', () => {
        let parentTag: Tag;
        let childTag: Tag;

        beforeEach(() => {
            parentTag = tagManager.createTag({ name: 'Parent', scope: 'directory' });
            childTag = tagManager.createTag({ name: 'Child', scope: 'file' });

            // Apply tags
            tagManager.applyTag(parentTag.id, '/workspace/parent-dir');
            tagManager.applyTag(childTag.id, '/workspace/parent-dir/child.ts');
        });

        it('should inherit parent directory tags', () => {
            const tags = tagManager.getAppliedTags('/workspace/parent-dir/child.ts');
            assert.strictEqual(tags.length, 2);
            assert.ok(tags.some(t => t.id === parentTag.id));
            assert.ok(tags.some(t => t.id === childTag.id));
        });

        it('should respect inheritance override setting', () => {
            // Create a tag with same name in parent and child
            const commonTag = tagManager.createTag({ name: 'Common', scope: 'both' });
            tagManager.applyTag(commonTag.id, '/workspace/parent-dir');
            tagManager.applyTag(commonTag.id, '/workspace/parent-dir/child.ts');

            // With override enabled
            tagManager.updateInheritanceConfig({ override: true });
            const tagsWithOverride = tagManager.getAppliedTags('/workspace/parent-dir/child.ts');
            assert.strictEqual(tagsWithOverride.filter(t => t.id === commonTag.id).length, 1);

            // With override disabled
            tagManager.updateInheritanceConfig({ override: false });
            const tagsWithoutOverride = tagManager.getAppliedTags('/workspace/parent-dir/child.ts');
            assert.strictEqual(tagsWithoutOverride.filter(t => t.id === commonTag.id).length, 2);
        });

        it('should not inherit when inheritance is disabled', () => {
            tagManager.updateInheritanceConfig({ enabled: false });
            const tags = tagManager.getAppliedTags('/workspace/parent-dir/child.ts');
            assert.strictEqual(tags.length, 1);
            assert.strictEqual(tags[0].id, childTag.id);
        });
    });

    describe('Tag Removal', () => {
        let tag: Tag;

        beforeEach(() => {
            tag = tagManager.createTag({ name: 'Test', scope: 'both' });
            tagManager.applyTag(tag.id, '/workspace/test.ts');
        });

        it('should remove an applied tag', () => {
            const removed = tagManager.removeTag(tag.id, '/workspace/test.ts');
            assert.strictEqual(removed, true);

            const tags = tagManager.getAppliedTags('/workspace/test.ts');
            assert.strictEqual(tags.length, 0);
        });

        it('should return false when removing non-existent tag', () => {
            const removed = tagManager.removeTag('non-existent', '/workspace/test.ts');
            assert.strictEqual(removed, false);
        });
    });
}); 