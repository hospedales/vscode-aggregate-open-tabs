import * as vscode from 'vscode';
import * as https from 'https';

export class GistUploader {
    private token: string | undefined;

    constructor() {
        this.token = vscode.workspace.getConfiguration('aggregateOpenTabs').get('gistToken');
    }

    async upload(content: string): Promise<string | undefined> {
        if (!this.token) {
            const token = await vscode.window.showInputBox({
                prompt: 'Enter your GitHub Personal Access Token',
                password: true
            });
            
            if (!token) {
                vscode.window.showErrorMessage('GitHub token is required to upload gists');
                return undefined;
            }
            
            this.token = token;
            await vscode.workspace.getConfiguration('aggregateOpenTabs').update('gistToken', token, true);
        }

        const data = JSON.stringify({
            description: 'Aggregated Open Tabs',
            public: false,
            files: {
                aggregatedMd: {
                    content
                }
            }
        });

        try {
            const gistUrl = await this.makeRequest(data);
            return gistUrl;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to upload gist: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }

    private makeRequest(data: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: '/gists',
                method: 'POST',
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Type': 'application/json',
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'User-Agent': 'VSCode-Aggregate-Open-Tabs',
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Authorization': `token ${this.token}`,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Length': data.length
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 201) {
                        const response = JSON.parse(responseData);
                        resolve(response.html_url);
                    } else {
                        reject(new Error(`GitHub API returned status ${res.statusCode}: ${responseData}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }
} 