import * as path from 'path';
import * as fs from 'fs';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test runner script
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Create test workspace if it doesn't exist
        const testWorkspacePath = path.resolve(__dirname, './suite/test-workspace');
        if (!fs.existsSync(testWorkspacePath)) {
            fs.mkdirSync(testWorkspacePath, { recursive: true });
        }

        // Create test file
        const testFilePath = path.join(testWorkspacePath, 'test.ts');
        fs.writeFileSync(testFilePath, `
// Test file for workspace tests
export function add(a: number, b: number): number {
    return a + b;
}
`);

        // Create package.json
        const packageJsonPath = path.join(testWorkspacePath, 'package.json');
        fs.writeFileSync(packageJsonPath, JSON.stringify({
            name: 'test-workspace',
            version: '1.0.0',
            description: 'Test workspace for extension tests',
            main: 'test.js',
            scripts: {
                test: 'echo "Error: no test specified" && exit 1'
            },
            author: '',
            license: 'ISC'
        }, null, 4));

        // Create .vscode folder and settings.json
        const vscodePath = path.join(testWorkspacePath, '.vscode');
        if (!fs.existsSync(vscodePath)) {
            fs.mkdirSync(vscodePath, { recursive: true });
        }

        // Always recreate settings.json
        const settingsPath = path.join(vscodePath, 'settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify({
            'files.exclude': {
                '**/.git': true,
                '**/.svn': true,
                '**/.hg': true,
                '**/CVS': true,
                '**/.DS_Store': true,
                '**/Thumbs.db': true
            },
            'aggregateOpenTabs.includeTerminalOutput': true,
            'aggregateOpenTabs.maxTerminalLines': 100,
            'aggregateOpenTabs.cacheMemoryLimitMB': 100
        }, null, 4));

        // Always recreate workspace file
        const workspaceFilePath = path.join(testWorkspacePath, 'test.code-workspace');
        fs.writeFileSync(workspaceFilePath, JSON.stringify({
            folders: [{ path: '.' }],
            settings: {
                'aggregateOpenTabs.includeTerminalOutput': true,
                'aggregateOpenTabs.maxTerminalLines': 100,
                'aggregateOpenTabs.cacheMemoryLimitMB': 100
            }
        }, null, 4));

        // Download VS Code, unzip it and run the integration test
        await runTests({ 
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                workspaceFilePath, // Use workspace file instead of workspace path
                '--disable-extensions', // Disable other extensions
                '--disable-workspace-trust', // Disable workspace trust dialog
                '--skip-welcome', // Skip welcome page
                '--skip-release-notes', // Skip release notes
                '--disable-telemetry' // Disable telemetry
            ]
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main(); 