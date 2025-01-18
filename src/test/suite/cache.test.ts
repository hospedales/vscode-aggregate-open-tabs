import * as assert from 'assert';
import * as vscode from 'vscode';
import { CacheManager } from '../../cache';

describe('CacheManager Test Suite', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
        cacheManager = CacheManager.getInstance();
        cacheManager.clear();
    });

    it('should return singleton instance', () => {
        const instance1 = CacheManager.getInstance();
        const instance2 = CacheManager.getInstance();
        assert.strictEqual(instance1, instance2);
    });

    it('should cache file metadata when analyzing', async () => {
        const mockDocument = {
            fileName: '/test/path/test.ts',
            getText: () => 'test content',
            languageId: 'typescript',
            version: 1,
            uri: { fsPath: '/test/path/test.ts' }
        } as vscode.TextDocument;

        // First call should analyze and cache
        const result1 = await cacheManager.getOrAnalyzeFile(mockDocument);
        assert.strictEqual(result1.fileName, mockDocument.fileName);
        assert.strictEqual(result1.content, mockDocument.getText());
        assert.strictEqual(result1.languageId, mockDocument.languageId);

        // Second call should return cached result
        const result2 = await cacheManager.getOrAnalyzeFile(mockDocument);
        // Compare everything except lastModified
        const { lastModified: lastModified1, ...rest1 } = result1;
        const { lastModified: lastModified2, ...rest2 } = result2;
        assert.deepStrictEqual(rest2, rest1);
        assert.ok(lastModified1 && lastModified2, 'Both results should have lastModified timestamps');
    });

    it('should force reanalysis when marked dirty', async function() {
        this.timeout(5000); // Increase timeout for this test

        const mockDocument = {
            fileName: '/test/path/test.ts',
            getText: () => 'test content',
            languageId: 'typescript',
            version: 1,
            uri: { fsPath: '/test/path/test.ts' }
        } as vscode.TextDocument;

        // First analysis
        const result1 = await cacheManager.getOrAnalyzeFile(mockDocument);

        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 100));

        // Mark dirty and verify reanalysis
        cacheManager.markDirty(mockDocument.fileName);
        const result2 = await cacheManager.getOrAnalyzeFile(mockDocument);

        // Parse timestamps and compare
        const time1 = new Date(result1.lastModified).getTime();
        const time2 = new Date(result2.lastModified).getTime();
        assert.ok(time2 > time1, 'New timestamp should be greater than old one');
    });

    it('should enforce memory limits', async function() {
        this.timeout(5000); // Increase timeout for this test

        // Create a large document that exceeds cache limit
        const largeDocument = {
            fileName: '/test/path/test.ts',
            getText: () => 'x'.repeat(200 * 1024 * 1024), // 200MB
            languageId: 'typescript',
            version: 1,
            uri: { fsPath: '/test/path/test.ts' }
        } as vscode.TextDocument;

        await cacheManager.getOrAnalyzeFile(largeDocument);
        const usage = cacheManager.getMemoryUsage();
        assert.ok(usage.current <= usage.limit, 'Memory usage should not exceed limit');
    });

    it('should remove all cached entries when cleared', async () => {
        const mockDocument = {
            fileName: '/test/path/test.ts',
            getText: () => 'test content',
            languageId: 'typescript',
            version: 1,
            uri: { fsPath: '/test/path/test.ts' }
        } as vscode.TextDocument;

        await cacheManager.getOrAnalyzeFile(mockDocument);
        const usage1 = cacheManager.getMemoryUsage();
        assert.ok(usage1.current > 0);

        cacheManager.clear();
        const usage2 = cacheManager.getMemoryUsage();
        assert.strictEqual(usage2.current, 0);
    });

    it('should remove specific cache entry when invalidated', async function() {
        this.timeout(5000); // Increase timeout for this test

        const mockDocument1 = {
            fileName: '/test/path/test1.ts',
            getText: () => 'test content 1',
            languageId: 'typescript',
            version: 1,
            uri: { fsPath: '/test/path/test1.ts' }
        } as vscode.TextDocument;

        const mockDocument2 = {
            fileName: '/test/path/test2.ts',
            getText: () => 'test content 2',
            languageId: 'typescript',
            version: 1,
            uri: { fsPath: '/test/path/test2.ts' }
        } as vscode.TextDocument;

        // Initial analysis
        const result1 = await cacheManager.getOrAnalyzeFile(mockDocument1);
        const result2 = await cacheManager.getOrAnalyzeFile(mockDocument2);

        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 100));

        // Invalidate first document
        cacheManager.invalidate(mockDocument1.fileName);

        // Reanalyze first document
        const result3 = await cacheManager.getOrAnalyzeFile(mockDocument1);
        const result4 = await cacheManager.getOrAnalyzeFile(mockDocument2);

        // Parse timestamps and compare
        const time1 = new Date(result1.lastModified).getTime();
        const time3 = new Date(result3.lastModified).getTime();
        assert.ok(time3 > time1, 'Cache entry should be reanalyzed after invalidation');

        // Compare unrelated document (excluding lastModified)
        const rest2 = { ...result2, lastModified: undefined };
        const rest4 = { ...result4, lastModified: undefined };
        delete rest2.lastModified;
        delete rest4.lastModified;
        assert.deepStrictEqual(rest4, rest2, 'Unrelated cache entry should remain unchanged');
    });

    it('should report analysis progress through callback', async () => {
        const mockDocument = {
            fileName: '/test/path/test.ts',
            getText: () => 'test content',
            languageId: 'typescript',
            version: 1,
            uri: { fsPath: '/test/path/test.ts' }
        } as vscode.TextDocument;

        let progressReported = false;
        cacheManager.setProgressCallback(() => {
            progressReported = true;
        });

        await cacheManager.getOrAnalyzeFile(mockDocument);
        assert.ok(progressReported);
    });

    it('should evict entries under memory pressure', async function() {
        this.timeout(5000); // Increase timeout for this test

        // Create multiple documents to fill cache
        const docs = Array.from({ length: 5 }, (_, i) => ({
            fileName: `/test/path/test${i}.ts`,
            getText: () => 'x'.repeat(30 * 1024 * 1024), // 30MB each
            languageId: 'typescript',
            version: 1,
            uri: { fsPath: `/test/path/test${i}.ts` }
        } as vscode.TextDocument));

        // Fill cache
        for (const doc of docs) {
            await cacheManager.getOrAnalyzeFile(doc);
        }

        const usage = cacheManager.getMemoryUsage();
        assert.ok(usage.current <= usage.limit, 'Memory usage should not exceed limit after eviction');
    });
}); 