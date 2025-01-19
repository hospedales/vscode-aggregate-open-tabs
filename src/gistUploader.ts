import * as vscode from 'vscode';
import { Octokit } from '@octokit/rest';

export class GistUploader {
    private octokit: Octokit | undefined;

    constructor() {
        this.initializeOctokit();
    }

    private async initializeOctokit() {
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const token = config.get<string>('githubToken');
        
        if (token) {
            this.octokit = new Octokit({ auth: token });
        }
    }

    async uploadToGist(content: string, description: string = 'Aggregated Files'): Promise<string | undefined> {
        if (!this.octokit) {
            const response = await vscode.window.showInformationMessage(
                'GitHub token not configured. Would you like to configure it now?',
                'Yes',
                'No'
            );

            if (response === 'Yes') {
                const token = await vscode.window.showInputBox({
                    prompt: 'Enter your GitHub token',
                    password: true
                });

                if (token) {
                    await vscode.workspace.getConfiguration('aggregateOpenTabs').update(
                        'githubToken',
                        token,
                        vscode.ConfigurationTarget.Global
                    );
                    this.octokit = new Octokit({ auth: token });
                } else {
                    return undefined;
                }
            } else {
                return undefined;
            }
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `aggregated-files-${timestamp}.md`;

            const response = await this.octokit.gists.create({
                description,
                public: false,
                files: {
                    [filename]: {
                        content
                    }
                }
            });

            return response.data.html_url;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create Gist: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return undefined;
        }
    }

    async listGists(): Promise<{ id: string; description: string; url: string }[]> {
        if (!this.octokit) {
            vscode.window.showErrorMessage('GitHub token not configured');
            return [];
        }

        try {
            const response = await this.octokit.gists.list();
            return response.data
                .filter(gist => 
                    Object.keys(gist.files || {}).some(filename => 
                        filename.startsWith('aggregated-files-')
                    )
                )
                .map(gist => ({
                    id: gist.id,
                    description: gist.description || 'No description',
                    url: gist.html_url
                }));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to list Gists: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return [];
        }
    }

    async deleteGist(gistId: string): Promise<boolean> {
        if (!this.octokit) {
            vscode.window.showErrorMessage('GitHub token not configured');
            return false;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            await this.octokit.gists.delete({ gist_id: gistId });
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete Gist: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }
} 