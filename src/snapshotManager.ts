import * as vscode from 'vscode';
import { FileMetadata } from './types';

interface Snapshot {
    timestamp: string;
    files: FileMetadata[];
}

export class SnapshotManager {
    private readonly snapshotKey = 'aggregateOpenTabs.snapshots';
    private readonly maxSnapshots = 10;

    constructor(private readonly storage: vscode.Memento) {}

    async saveSnapshot(files: FileMetadata[]): Promise<void> {
        const snapshots = await this.getSnapshots();
        
        // Create new snapshot
        const newSnapshot: Snapshot = {
            timestamp: new Date().toISOString(),
            files
        };

        // Add to beginning of array and maintain max size
        snapshots.unshift(newSnapshot);
        if (snapshots.length > this.maxSnapshots) {
            snapshots.pop();
        }

        // Save updated snapshots
        await this.storage.update(this.snapshotKey, snapshots);
    }

    async getSnapshots(): Promise<Snapshot[]> {
        return this.storage.get<Snapshot[]>(this.snapshotKey, []);
    }

    async getLatestSnapshot(): Promise<Snapshot | undefined> {
        const snapshots = await this.getSnapshots();
        return snapshots[0];
    }

    async compareWithLatest(currentFiles: FileMetadata[]): Promise<{
        added: string[];
        removed: string[];
        modified: string[];
    }> {
        const latestSnapshot = await this.getLatestSnapshot();
        if (!latestSnapshot) {
            return { added: [], removed: [], modified: [] };
        }

        const currentPaths = new Set(currentFiles.map(f => f.relativePath));
        const snapshotPaths = new Set(latestSnapshot.files.map(f => f.relativePath));

        const added = currentFiles
            .filter(f => !snapshotPaths.has(f.relativePath))
            .map(f => f.relativePath);

        const removed = latestSnapshot.files
            .filter(f => !currentPaths.has(f.relativePath))
            .map(f => f.relativePath);

        const modified = currentFiles
            .filter(current => {
                const snapshot = latestSnapshot.files.find(f => f.relativePath === current.relativePath);
                return snapshot && snapshot.content !== current.content;
            })
            .map(f => f.relativePath);

        return { added, removed, modified };
    }

    async clearSnapshots(): Promise<void> {
        await this.storage.update(this.snapshotKey, []);
    }
} 