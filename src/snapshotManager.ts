import * as vscode from 'vscode';

export class SnapshotManager {
    private readonly snapshotsKey = 'aggregateOpenTabs.snapshots';

    constructor(private storage: vscode.Memento) {}

    async saveSnapshot(name: string, content: string): Promise<void> {
        const snapshots = await this.getSnapshots();
        snapshots[name] = {
            content,
            timestamp: new Date().toISOString()
        };
        await this.storage.update(this.snapshotsKey, snapshots);
    }

    async loadSnapshot(name: string): Promise<string | undefined> {
        const snapshots = await this.getSnapshots();
        return snapshots[name]?.content;
    }

    async listSnapshots(): Promise<string[]> {
        const snapshots = await this.getSnapshots();
        return Object.keys(snapshots).sort();
    }

    async deleteSnapshot(name: string): Promise<void> {
        const snapshots = await this.getSnapshots();
        delete snapshots[name];
        await this.storage.update(this.snapshotsKey, snapshots);
    }

    private async getSnapshots(): Promise<Record<string, { content: string; timestamp: string }>> {
        return this.storage.get<Record<string, { content: string; timestamp: string }>>(this.snapshotsKey) || {};
    }
} 