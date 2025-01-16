import * as vscode from 'vscode';
import { FileMetadata, FileAnalysis } from './utils';
import { analyzeFile } from './analyzer';

interface CacheEntry {
    metadata: FileMetadata;
    analysis?: FileAnalysis;
    lastModified: number;
    size: number;
    isDirty: boolean;
    chunks?: {
        content: string;
        startLine: number;
        endLine: number;
    }[];
}

interface ProgressInfo {
    message: string;
    increment: number;
}

export class CacheManager {
    private static instance: CacheManager;
    private cache: Map<string, CacheEntry> = new Map();
    private memoryLimit: number;
    private currentMemoryUsage: number = 0;
    private progressCallback?: (info: ProgressInfo) => void;

    private constructor() {
        // Default memory limit is 100MB, configurable through settings
        this.memoryLimit = vscode.workspace.getConfiguration('aggregateOpenTabs')
            .get<number>('cacheMemoryLimitMB', 100) * 1024 * 1024;
    }

    public static getInstance(): CacheManager {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }

    public setProgressCallback(callback: (info: ProgressInfo) => void): void {
        this.progressCallback = callback;
    }

    private reportProgress(message: string, increment: number): void {
        if (this.progressCallback) {
            this.progressCallback({ message, increment });
        }
    }

    private estimateEntrySize(entry: CacheEntry): number {
        // Rough estimation of memory usage in bytes
        let size = 0;
        size += entry.metadata.content.length * 2; // UTF-16 characters
        size += JSON.stringify(entry.analysis || {}).length * 2;
        if (entry.chunks) {
            size += entry.chunks.reduce((acc, chunk) => acc + chunk.content.length * 2, 0);
        }
        return size;
    }

    private async evictIfNeeded(requiredSize: number): Promise<void> {
        if (this.currentMemoryUsage + requiredSize <= this.memoryLimit) {
            return;
        }

        // Sort entries by last access time
        const entries = Array.from(this.cache.entries())
            .sort(([, a], [, b]) => a.lastModified - b.lastModified);

        for (const [key, entry] of entries) {
            if (this.currentMemoryUsage + requiredSize <= this.memoryLimit) {
                break;
            }
            const entrySize = this.estimateEntrySize(entry);
            this.cache.delete(key);
            this.currentMemoryUsage -= entrySize;
            this.reportProgress(`Evicting ${entry.metadata.fileName} from cache`, 0);
        }
    }

    public async getOrAnalyzeFile(
        document: vscode.TextDocument,
        forceRefresh: boolean = false
    ): Promise<FileMetadata> {
        const key = document.fileName;
        const currentTime = Date.now();

        // Check if we have a valid cache entry
        if (!forceRefresh && this.cache.has(key)) {
            const entry = this.cache.get(key)!;
            if (!entry.isDirty && entry.lastModified === document.version) {
                this.reportProgress(`Using cached version of ${document.fileName}`, 5);
                return entry.metadata;
            }
        }

        // Analyze the file
        this.reportProgress(`Analyzing ${document.fileName}`, 0);
        
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const analysis = await analyzeFile(document, {
            tailored: config.get<boolean>('tailoredSummaries', true),
            includeKeyPoints: config.get<boolean>('includeKeyPoints', true),
            includeImports: config.get<boolean>('includeImports', true),
            includeExports: config.get<boolean>('includeExports', true),
            includeDependencies: config.get<boolean>('includeDependencies', true),
            aiSummaryStyle: config.get('aiSummaryStyle', 'standard'),
            includeCrossReferences: config.get<boolean>('includeCrossReferences', true)
        });

        const metadata: FileMetadata = {
            fileName: document.fileName,
            relativePath: vscode.workspace.asRelativePath(document.fileName),
            content: document.getText(),
            size: Buffer.byteLength(document.getText(), 'utf8'),
            lastModified: new Date().toISOString(),
            languageId: document.languageId,
            analysis
        };

        // Create cache entry
        const entry: CacheEntry = {
            metadata,
            analysis,
            lastModified: currentTime,
            size: metadata.size,
            isDirty: false
        };

        // Check memory limits and evict if needed
        const entrySize = this.estimateEntrySize(entry);
        await this.evictIfNeeded(entrySize);

        // Update cache
        this.cache.set(key, entry);
        this.currentMemoryUsage += entrySize;
        this.reportProgress(`Cached ${document.fileName}`, 10);

        return metadata;
    }

    public markDirty(fileName: string): void {
        const entry = this.cache.get(fileName);
        if (entry) {
            entry.isDirty = true;
        }
    }

    public invalidate(fileName: string): void {
        const entry = this.cache.get(fileName);
        if (entry) {
            this.currentMemoryUsage -= this.estimateEntrySize(entry);
            this.cache.delete(fileName);
        }
    }

    public clear(): void {
        this.cache.clear();
        this.currentMemoryUsage = 0;
    }

    public getMemoryUsage(): { current: number; limit: number } {
        return {
            current: this.currentMemoryUsage,
            limit: this.memoryLimit
        };
    }
} 