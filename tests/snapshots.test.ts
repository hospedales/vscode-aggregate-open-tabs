import * as vscode from 'vscode';
import * as assert from 'assert';
import { before, beforeEach, describe, it } from 'mocha';
import { SnapshotManager, EnhancedSnapshot } from '../src/snapshots';
import { FileMetadata } from '../src/utils';

describe('SnapshotManager', () => {
    let snapshotManager: SnapshotManager;
    const mockContext = {
        globalState: {
            get: async (key: string) => [],
            update: async (key: string, value: any) => {}
        }
    } as any as vscode.ExtensionContext;

    beforeEach(() => {
        snapshotManager = new SnapshotManager(mockContext);
    });

    describe('createSnapshot', () => {
        it('should create a snapshot with correct metadata', async () => {
            const files = new Map<string, FileMetadata>();
            files.set('test.ts', {
                fileName: 'test.ts',
                content: 'console.log("test");',
                size: 20,
                lastModified: new Date().toISOString(),
                languageId: 'typescript',
                analysis: {
                    frameworks: [],
                    dependencies: [],
                    imports: [],
                    exports: []
                }
            });

            const snapshot = await snapshotManager.createSnapshot(
                files,
                'Test snapshot',
                ['test']
            );

            assert.ok(snapshot.id);
            assert.ok(snapshot.timestamp);
            assert.strictEqual(snapshot.description, 'Test snapshot');
            assert.deepStrictEqual(snapshot.tags, ['test']);
            assert.strictEqual(snapshot.stats.totalFiles, 1);
            assert.strictEqual(snapshot.stats.totalSize, 20);
            assert.strictEqual(snapshot.stats.languageBreakdown.typescript, 1);
        });
    });

    describe('compareSnapshots', () => {
        let oldSnapshot: EnhancedSnapshot;
        let newSnapshot: EnhancedSnapshot;

        beforeEach(() => {
            // Create base snapshots for comparison
            oldSnapshot = {
                id: '1',
                timestamp: new Date().toISOString(),
                files: {
                    'unchanged.ts': {
                        content: 'console.log("unchanged");',
                        metadata: {
                            fileName: 'unchanged.ts',
                            content: 'console.log("unchanged");',
                            size: 24,
                            lastModified: new Date().toISOString(),
                            languageId: 'typescript',
                            analysis: {
                                frameworks: [],
                                dependencies: [],
                                imports: [],
                                exports: []
                            }
                        }
                    },
                    'modified.ts': {
                        content: 'console.log("old");',
                        metadata: {
                            fileName: 'modified.ts',
                            content: 'console.log("old");',
                            size: 19,
                            lastModified: new Date().toISOString(),
                            languageId: 'typescript',
                            analysis: {
                                frameworks: [],
                                dependencies: [],
                                imports: [],
                                exports: []
                            }
                        }
                    },
                    'removed.ts': {
                        content: 'console.log("removed");',
                        metadata: {
                            fileName: 'removed.ts',
                            content: 'console.log("removed");',
                            size: 23,
                            lastModified: new Date().toISOString(),
                            languageId: 'typescript',
                            analysis: {
                                frameworks: [],
                                dependencies: [],
                                imports: [],
                                exports: []
                            }
                        }
                    }
                },
                stats: {
                    totalFiles: 3,
                    totalSize: 66,
                    languageBreakdown: { typescript: 3 }
                }
            };

            newSnapshot = {
                id: '2',
                timestamp: new Date().toISOString(),
                files: {
                    'unchanged.ts': {
                        content: 'console.log("unchanged");',
                        metadata: {
                            fileName: 'unchanged.ts',
                            content: 'console.log("unchanged");',
                            size: 24,
                            lastModified: new Date().toISOString(),
                            languageId: 'typescript',
                            analysis: {
                                frameworks: [],
                                dependencies: [],
                                imports: [],
                                exports: []
                            }
                        }
                    },
                    'modified.ts': {
                        content: 'console.log("new");',
                        metadata: {
                            fileName: 'modified.ts',
                            content: 'console.log("new");',
                            size: 19,
                            lastModified: new Date().toISOString(),
                            languageId: 'typescript',
                            analysis: {
                                frameworks: [],
                                dependencies: [],
                                imports: [],
                                exports: []
                            }
                        }
                    },
                    'added.ts': {
                        content: 'console.log("added");',
                        metadata: {
                            fileName: 'added.ts',
                            content: 'console.log("added");',
                            size: 21,
                            lastModified: new Date().toISOString(),
                            languageId: 'typescript',
                            analysis: {
                                frameworks: [],
                                dependencies: [],
                                imports: [],
                                exports: []
                            }
                        }
                    }
                },
                stats: {
                    totalFiles: 3,
                    totalSize: 64,
                    languageBreakdown: { typescript: 3 }
                }
            };
        });

        it('should detect added files', async () => {
            const { changes, stats } = await snapshotManager.compareSnapshots(oldSnapshot, newSnapshot);
            const added = changes.filter(c => c.type === 'added');
            
            assert.strictEqual(added.length, 1);
            assert.strictEqual(added[0].filePath, 'added.ts');
            assert.strictEqual(stats.added, 1);
        });

        it('should detect modified files', async () => {
            const { changes, stats } = await snapshotManager.compareSnapshots(oldSnapshot, newSnapshot);
            const modified = changes.filter(c => c.type === 'modified');
            
            assert.strictEqual(modified.length, 1);
            assert.strictEqual(modified[0].filePath, 'modified.ts');
            assert.strictEqual(stats.modified, 1);
        });

        it('should detect removed files', async () => {
            const { changes, stats } = await snapshotManager.compareSnapshots(oldSnapshot, newSnapshot);
            const removed = changes.filter(c => c.type === 'removed');
            
            assert.strictEqual(removed.length, 1);
            assert.strictEqual(removed[0].filePath, 'removed.ts');
            assert.strictEqual(stats.removed, 1);
        });

        it('should count unchanged files', async () => {
            const { stats } = await snapshotManager.compareSnapshots(oldSnapshot, newSnapshot);
            assert.strictEqual(stats.unchanged, 1);
        });

        it('should generate diff summary for modified files', async () => {
            const { changes } = await snapshotManager.compareSnapshots(oldSnapshot, newSnapshot);
            const modified = changes.find(c => c.type === 'modified');
            
            assert.ok(modified?.diffSummary);
            assert.ok(modified.diffSummary.includes('-'));
            assert.ok(modified.diffSummary.includes('+'));
        });

        it('should respect diff options', async () => {
            // Add whitespace to test ignoreWhitespace option
            newSnapshot.files['modified.ts'].content = '  console.log("new");  ';
            
            const { changes } = await snapshotManager.compareSnapshots(oldSnapshot, newSnapshot);
            const modified = changes.find(c => c.type === 'modified');
            
            assert.ok(modified);
            assert.ok(modified.diffSummary);
        });
    });

    describe('metadata management', () => {
        let snapshot: EnhancedSnapshot;

        beforeEach(async () => {
            const files = new Map<string, FileMetadata>();
            files.set('test.ts', {
                fileName: 'test.ts',
                content: 'console.log("test");',
                size: 20,
                lastModified: new Date().toISOString(),
                languageId: 'typescript',
                analysis: {
                    frameworks: [],
                    dependencies: [],
                    imports: [],
                    exports: []
                }
            });

            snapshot = await snapshotManager.createSnapshot(files);
        });

        it('should update snapshot description', async () => {
            const updated = await snapshotManager.updateSnapshotMetadata(snapshot.id, {
                description: 'Updated description'
            });

            assert.strictEqual(updated, true);
            const retrieved = await snapshotManager.getSnapshot(snapshot.id);
            assert.strictEqual(retrieved?.description, 'Updated description');
        });

        it('should update snapshot tags', async () => {
            const updated = await snapshotManager.updateSnapshotMetadata(snapshot.id, {
                tags: ['tag1', 'tag2']
            });

            assert.strictEqual(updated, true);
            const retrieved = await snapshotManager.getSnapshot(snapshot.id);
            assert.deepStrictEqual(retrieved?.tags, ['tag1', 'tag2']);
        });

        it('should delete snapshots', async () => {
            const deleted = await snapshotManager.deleteSnapshot(snapshot.id);
            assert.strictEqual(deleted, true);

            const retrieved = await snapshotManager.getSnapshot(snapshot.id);
            assert.strictEqual(retrieved, undefined);
        });
    });
}); 