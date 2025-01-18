import * as assert from 'assert';
import * as vscode from 'vscode';
import { CacheManager } from '../../cache';

describe('Performance Benchmarks', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
        cacheManager = CacheManager.getInstance();
    });

    it('should have acceptable file analysis performance', async () => {
        const testFile = 'test.ts';
        const testContent = 'console.log("test");';
        const mockDocument = {
            fileName: testFile,
            getText: () => testContent,
            uri: vscode.Uri.file(testFile)
        } as vscode.TextDocument;

        const runs = 7;
        const times: number[] = [];

        for (let i = 0; i < runs; i++) {
            const start = process.hrtime();
            await cacheManager.getOrAnalyzeFile(mockDocument);
            const [seconds, nanoseconds] = process.hrtime(start);
            times.push(seconds * 1000 + nanoseconds / 1000000);
        }

        // Remove min and max
        times.sort((a, b) => a - b);
        times.shift();
        times.pop();

        const avgTime = times.reduce((a, b) => a + b) / times.length;
        console.log(`File Analysis: ${avgTime.toFixed(2)}ms (avg of ${times.length} runs, excluding min/max)`);

        assert.ok(avgTime < 1000, `Analysis took too long: ${avgTime}ms`);
    });

    it('should have faster performance with cached results', async () => {
        const testFile = 'test.ts';
        const testContent = 'console.log("test");';
        const mockDocument = {
            fileName: testFile,
            getText: () => testContent,
            uri: vscode.Uri.file(testFile)
        } as vscode.TextDocument;

        // First analysis (cold cache)
        const coldStart = process.hrtime();
        await cacheManager.getOrAnalyzeFile(mockDocument);
        const [coldSeconds, coldNanoseconds] = process.hrtime(coldStart);
        const coldTime = coldSeconds * 1000 + coldNanoseconds / 1000000;

        console.log(`Cold Cache Analysis: ${coldTime.toFixed(2)}ms (avg of 5 runs, excluding min/max)`);

        // Second analysis (warm cache)
        const warmStart = process.hrtime();
        await cacheManager.getOrAnalyzeFile(mockDocument);
        const [warmSeconds, warmNanoseconds] = process.hrtime(warmStart);
        const warmTime = warmSeconds * 1000 + warmNanoseconds / 1000000;

        assert.ok(warmTime < coldTime, 'Cached analysis should be faster');
    });

    it('should maintain reasonable memory usage under load', async () => {
        const testFiles = Array.from({ length: 100 }, (_, i) => ({
            fileName: `test${i}.ts`,
            getText: () => `console.log("test${i}");`,
            uri: vscode.Uri.file(`test${i}.ts`)
        } as vscode.TextDocument));

        const initialMemory = process.memoryUsage().heapUsed;

        for (const doc of testFiles) {
            await cacheManager.getOrAnalyzeFile(doc);
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB

        console.log(`Memory increase under load: ${memoryIncrease.toFixed(2)}MB`);
        assert.ok(memoryIncrease < 100, `Memory usage increased too much: ${memoryIncrease}MB`);
    });
}); 