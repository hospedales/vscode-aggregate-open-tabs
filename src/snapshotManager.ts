import * as vscode from 'vscode';
import * as path from 'path';

export class SnapshotManager {
    private readonly snapshotsDir: string;

    constructor() {
        this.snapshotsDir = path.join(vscode.workspace.rootPath || '', '.vscode', 'snapshots');
    }

    async saveSnapshot(name: string, content: string): Promise<void> {
        await this.ensureSnapshotsDir();
        const filePath = this.getSnapshotPath(name);
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(filePath),
            Buffer.from(content)
        );
    }

    async loadSnapshot(name: string): Promise<string | undefined> {
        const filePath = this.getSnapshotPath(name);
        try {
            const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            return Buffer.from(content).toString('utf8');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load snapshot "${name}": ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }

    async listSnapshots(): Promise<string[]> {
        await this.ensureSnapshotsDir();
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(this.snapshotsDir));
            return entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
                .map(([name]) => name.replace(/\.md$/, ''));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to list snapshots: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }

    private async ensureSnapshotsDir(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(this.snapshotsDir));
        } catch (error) {
            // Directory might already exist
        }
    }

    private getSnapshotPath(name: string): string {
        return path.join(this.snapshotsDir, `${name}.md`);
    }
} 