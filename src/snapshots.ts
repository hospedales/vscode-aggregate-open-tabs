import * as vscode from 'vscode';
import { FileMetadata, FileAnalysis } from './utils';

/**
 * Represents a file change between snapshots
 */
export interface FileChange {
    type: 'added' | 'modified' | 'removed';
    filePath: string;
    oldContent?: string;
    newContent?: string;
    oldAnalysis?: FileAnalysis;
    newAnalysis?: FileAnalysis;
    diffSummary?: string;
}

/**
 * Enhanced snapshot with additional metadata
 */
export interface EnhancedSnapshot {
    id: string;
    timestamp: string;
    description?: string;
    tags?: string[];
    files: {
        [path: string]: {
            content: string;
            metadata: FileMetadata;
        };
    };
    stats: {
        totalFiles: number;
        totalSize: number;
        languageBreakdown: { [key: string]: number };
    };
}

/**
 * Manages enhanced snapshots with comparison and metadata tracking
 */
export class SnapshotManager {
    private readonly snapshotsKey = 'aggregateOpenTabs.enhancedSnapshots';
    private readonly maxSnapshots: number;
    private readonly diffOptions: {
        ignoreWhitespace: boolean;
        ignoreCase: boolean;
    };

    constructor(private context: vscode.ExtensionContext) {
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        this.maxSnapshots = config.get<number>('maxSnapshots', 10);
        this.diffOptions = {
            ignoreWhitespace: config.get<boolean>('diffIgnoreWhitespace', true),
            ignoreCase: config.get<boolean>('diffIgnoreCase', false)
        };
    }

    /**
     * Creates a new snapshot with enhanced metadata
     */
    public async createSnapshot(
        files: Map<string, FileMetadata>,
        description?: string,
        tags?: string[]
    ): Promise<EnhancedSnapshot> {
        const snapshot: EnhancedSnapshot = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            description,
            tags,
            files: {},
            stats: {
                totalFiles: 0,
                totalSize: 0,
                languageBreakdown: {}
            }
        };

        // Process each file
        for (const [path, metadata] of files.entries()) {
            snapshot.files[path] = {
                content: metadata.content,
                metadata: { ...metadata }
            };

            // Update stats
            snapshot.stats.totalFiles++;
            snapshot.stats.totalSize += metadata.size;
            snapshot.stats.languageBreakdown[metadata.languageId] =
                (snapshot.stats.languageBreakdown[metadata.languageId] || 0) + 1;
        }

        // Save the snapshot
        await this.saveSnapshot(snapshot);

        return snapshot;
    }

    /**
     * Compares two snapshots and returns the differences
     */
    public async compareSnapshots(
        oldSnapshot: EnhancedSnapshot,
        newSnapshot: EnhancedSnapshot
    ): Promise<{
        changes: FileChange[];
        stats: {
            added: number;
            modified: number;
            removed: number;
            unchanged: number;
        };
    }> {
        const changes: FileChange[] = [];
        const stats = {
            added: 0,
            modified: 0,
            removed: 0,
            unchanged: 0
        };

        // Find added and modified files
        for (const [path, newFile] of Object.entries(newSnapshot.files)) {
            const oldFile = oldSnapshot.files[path];
            
            if (!oldFile) {
                // File was added
                changes.push({
                    type: 'added',
                    filePath: path,
                    newContent: newFile.content,
                    newAnalysis: newFile.metadata.analysis
                });
                stats.added++;
            } else {
                // File exists in both snapshots
                const contentChanged = this.hasContentChanged(
                    oldFile.content,
                    newFile.content
                );
                const analysisChanged = this.hasAnalysisChanged(
                    oldFile.metadata.analysis,
                    newFile.metadata.analysis
                );

                if (contentChanged || analysisChanged) {
                    changes.push({
                        type: 'modified',
                        filePath: path,
                        oldContent: oldFile.content,
                        newContent: newFile.content,
                        oldAnalysis: oldFile.metadata.analysis,
                        newAnalysis: newFile.metadata.analysis,
                        diffSummary: contentChanged
                            ? await this.generateDiffSummary(oldFile.content, newFile.content)
                            : undefined
                    });
                    stats.modified++;
                } else {
                    stats.unchanged++;
                }
            }
        }

        // Find removed files
        for (const path of Object.keys(oldSnapshot.files)) {
            if (!newSnapshot.files[path]) {
                changes.push({
                    type: 'removed',
                    filePath: path,
                    oldContent: oldSnapshot.files[path].content,
                    oldAnalysis: oldSnapshot.files[path].metadata.analysis
                });
                stats.removed++;
            }
        }

        return { changes, stats };
    }

    /**
     * Generates a visual diff summary between two versions of content
     */
    private async generateDiffSummary(oldContent: string, newContent: string): Promise<string> {
        // Split content into lines
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        
        // Simple line-by-line diff
        const changes: string[] = [];
        let i = 0, j = 0;
        
        while (i < oldLines.length || j < newLines.length) {
            if (i >= oldLines.length) {
                // All remaining lines are additions
                changes.push(`+ ${newLines[j]}`);
                j++;
            } else if (j >= newLines.length) {
                // All remaining lines are deletions
                changes.push(`- ${oldLines[i]}`);
                i++;
            } else if (this.normalizeForComparison(oldLines[i]) === this.normalizeForComparison(newLines[j])) {
                // Lines are the same
                i++;
                j++;
            } else {
                // Lines are different
                changes.push(`- ${oldLines[i]}`);
                changes.push(`+ ${newLines[j]}`);
                i++;
                j++;
            }
        }

        return changes.join('\n');
    }

    /**
     * Normalizes content for comparison based on diff options
     */
    private normalizeForComparison(content: string): string {
        let normalized = content;
        if (this.diffOptions.ignoreWhitespace) {
            normalized = normalized.trim().replace(/\s+/g, ' ');
        }
        if (this.diffOptions.ignoreCase) {
            normalized = normalized.toLowerCase();
        }
        return normalized;
    }

    /**
     * Checks if file content has changed, respecting diff options
     */
    private hasContentChanged(oldContent: string, newContent: string): boolean {
        return (
            this.normalizeForComparison(oldContent) !==
            this.normalizeForComparison(newContent)
        );
    }

    /**
     * Checks if file analysis has changed
     */
    private hasAnalysisChanged(
        oldAnalysis?: FileAnalysis,
        newAnalysis?: FileAnalysis
    ): boolean {
        if (!oldAnalysis && !newAnalysis) return false;
        if (!oldAnalysis || !newAnalysis) return true;

        // Compare relevant analysis fields
        return (
            oldAnalysis.purpose !== newAnalysis.purpose ||
            JSON.stringify(oldAnalysis.frameworks) !== JSON.stringify(newAnalysis.frameworks) ||
            JSON.stringify(oldAnalysis.dependencies) !== JSON.stringify(newAnalysis.dependencies) ||
            JSON.stringify(oldAnalysis.imports) !== JSON.stringify(newAnalysis.imports) ||
            JSON.stringify(oldAnalysis.exports) !== JSON.stringify(newAnalysis.exports) ||
            JSON.stringify(oldAnalysis.tags) !== JSON.stringify(newAnalysis.tags)
        );
    }

    /**
     * Saves a snapshot to storage
     */
    private async saveSnapshot(snapshot: EnhancedSnapshot): Promise<void> {
        const snapshots = await this.getSnapshots();
        snapshots.unshift(snapshot);

        // Keep only the most recent snapshots
        if (snapshots.length > this.maxSnapshots) {
            snapshots.length = this.maxSnapshots;
        }

        await this.context.globalState.update(this.snapshotsKey, snapshots);
    }

    /**
     * Gets all saved snapshots
     */
    public async getSnapshots(): Promise<EnhancedSnapshot[]> {
        return this.context.globalState.get<EnhancedSnapshot[]>(this.snapshotsKey, []);
    }

    /**
     * Gets a specific snapshot by ID
     */
    public async getSnapshot(id: string): Promise<EnhancedSnapshot | undefined> {
        const snapshots = await this.getSnapshots();
        return snapshots.find(s => s.id === id);
    }

    /**
     * Deletes a snapshot by ID
     */
    public async deleteSnapshot(id: string): Promise<boolean> {
        const snapshots = await this.getSnapshots();
        const index = snapshots.findIndex(s => s.id === id);
        
        if (index === -1) return false;
        
        snapshots.splice(index, 1);
        await this.context.globalState.update(this.snapshotsKey, snapshots);
        return true;
    }

    /**
     * Updates snapshot metadata (description, tags)
     */
    public async updateSnapshotMetadata(
        id: string,
        updates: { description?: string; tags?: string[] }
    ): Promise<boolean> {
        const snapshots = await this.getSnapshots();
        const snapshot = snapshots.find(s => s.id === id);
        
        if (!snapshot) return false;
        
        if (updates.description !== undefined) {
            snapshot.description = updates.description;
        }
        if (updates.tags !== undefined) {
            snapshot.tags = updates.tags;
        }
        
        await this.context.globalState.update(this.snapshotsKey, snapshots);
        return true;
    }
} 