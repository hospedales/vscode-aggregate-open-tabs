import * as assert from 'assert';
import * as vscode from 'vscode';
import { CacheManager } from '../../cache';

suite('CacheManager Test Suite', () => {
    let cacheManager: CacheManager;
    let mockDocument: vscode.TextDocument;

    setup(() => {
        // Reset the singleton instance before each test
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (CacheManager as any).instance = undefined;

        // Mock document
        mockDocument = {
            fileName: '/test/path/test.ts',
            getText: () => 'test content',
            languageId: 'typescript',
            version: 1,
            uri: { fsPath: '/test/path/test.ts' } as vscode.Uri
        } as vscode.TextDocument;

        // Initialize cache manager
        cacheManager = CacheManager.getInstance();
    });

    test('getInstance returns singleton instance', () => {
        const instance1 = CacheManager.getInstance();
        const instance2 = CacheManager.getInstance();
        assert.strictEqual(instance1, instance2);
    });

    test('getOrAnalyzeFile caches file metadata', async () => {
        const metadata = await cacheManager.getOrAnalyzeFile(mockDocument);
        assert.strictEqual(metadata.fileName, mockDocument.fileName);
        assert.strictEqual(metadata.content, 'test content');
        assert.strictEqual(metadata.languageId, 'typescript');
        
        // Verify cache hit
        const cachedMetadata = await cacheManager.getOrAnalyzeFile(mockDocument);
        assert.strictEqual(metadata, cachedMetadata);
    });

    test('markDirty forces reanalysis', async () => {
        const metadata1 = await cacheManager.getOrAnalyzeFile(mockDocument);
        cacheManager.markDirty(mockDocument.fileName);
        const metadata2 = await cacheManager.getOrAnalyzeFile(mockDocument);
        assert.notStrictEqual(metadata1, metadata2);
    });

    test('memory limit enforcement', async () => {
        // Create a large document that exceeds cache limit
        const largeDocument = {
            ...mockDocument,
            getText: () => 'x'.repeat(200 * 1024 * 1024) // 200MB
        } as vscode.TextDocument;

        await cacheManager.getOrAnalyzeFile(largeDocument);
        const usage = cacheManager.getMemoryUsage();
        assert.ok(usage.current <= usage.limit, 'Memory usage exceeds limit');
    });

    test('clear removes all cached entries', async () => {
        await cacheManager.getOrAnalyzeFile(mockDocument);
        cacheManager.clear();
        const usage = cacheManager.getMemoryUsage();
        assert.strictEqual(usage.current, 0);
    });

    test('invalidate removes specific cache entry', async () => {
        await cacheManager.getOrAnalyzeFile(mockDocument);
        const initialUsage = cacheManager.getMemoryUsage();
        cacheManager.invalidate(mockDocument.fileName);
        const finalUsage = cacheManager.getMemoryUsage();
        assert.ok(finalUsage.current < initialUsage.current, 'Cache entry was not removed');
    });

    test('progress callback reports analysis progress', async () => {
        let progressCalls = 0;
        cacheManager.setProgressCallback(() => {
            progressCalls++;
        });

        await cacheManager.getOrAnalyzeFile(mockDocument);
        assert.ok(progressCalls > 0, 'Progress callback was not called');
    });

    test('cache eviction under memory pressure', async () => {
        // Create multiple documents to fill cache
        const docs = Array.from({ length: 5 }, (_, i) => ({
            ...mockDocument,
            fileName: `/test/path/test${i}.ts`,
            getText: () => 'x'.repeat(30 * 1024 * 1024) // 30MB each
        } as vscode.TextDocument));

        // Fill cache
        for (const doc of docs) {
            await cacheManager.getOrAnalyzeFile(doc);
        }

        const usage = cacheManager.getMemoryUsage();
        assert.ok(usage.current <= usage.limit, 'Memory usage exceeds limit after eviction');
    });
}); 