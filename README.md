# VSCode Aggregate Open Tabs Extension

This is a proposed Visual Studio Code extension that collects code from all currently open tabs and combines it into one file. You can use it to quickly gather all your open files’ contents and send them to an LLM or any other tool that needs a single, consolidated file.

---

## Table of Contents

1. [Overview](#overview)  
2. [Project Setup & Structure](#project-setup--structure)  
3. [Activation & Command Definition](#activation--command-definition)  
4. [Logic to Collect Text from Open Tabs](#logic-to-collect-text-from-open-tabs)  
5. [Writing/Generating the Aggregated File](#writinggenerating-the-aggregated-file)  
6. [Displaying the Aggregated File in a Split Editor](#displaying-the-aggregated-file-in-a-split-editor)  
7. [User Flow](#user-flow)  
8. [Edge Cases & Considerations](#edge-cases--considerations)  
9. [Testing & Validation](#testing--validation)  
10. [Publishing (Optional)](#publishing-optional)  
11. [Summary of Requirements](#summary-of-requirements)  

---

## 1. Overview

**Purpose**  
This extension allows you to:

1. Collect the text content from all open editor tabs in VS Code.  
2. Aggregate those contents into a single file.  
3. Automatically open a new (and optionally split) editor tab with the aggregated file.  

By providing a single command in VS Code, users can easily gather and send file content to an LLM or other processing tools.

---

## 2. Project Setup & Structure

1. **Initial Files and Folders**  
   - Create a new folder for your extension, e.g. `vscode-aggregate-open-tabs/`.
   - Inside, you will have:
     - **`package.json`** – Defines metadata (name, version, description, publisher, commands, activation events).  
     - **`tsconfig.json`** – If using TypeScript, defines compilation settings.  
     - **Extension source** – Typically at `src/extension.ts` (TypeScript) or `src/extension.js` (JavaScript).

2. **Dependencies**  
   - **Node.js** and **npm** (or **yarn**).  
   - **VS Code Extensions API** (`vscode` package) listed as a dependency in `package.json`.  
   - **TypeScript** (recommended) or plain JavaScript.

3. **VS Code Configuration** (optional but recommended)
   - **`.vscode/launch.json`** – Defines how to run/debug the extension in an Extension Development Host.  
   - **`.vscode/tasks.json`** – Automates build tasks.  
   - **`.vscode/extensions.json`** – Lists recommended extensions for contributors.

---

## 3. Activation & Command Definition

1. **Activation Event**  
   - Add an activation event for the command in `package.json`. Example:
     ```json
     {
       "activationEvents": [
         "onCommand:extension.aggregateOpenTabs"
       ]
     }
     ```
   - This means VS Code will load (activate) your extension when the user runs `extension.aggregateOpenTabs`.

2. **Command Declaration**  
   - In the `contributes` section of `package.json`, define the command:
     ```json
     {
       "contributes": {
         "commands": [
           {
             "command": "extension.aggregateOpenTabs",
             "title": "Aggregate Open Tabs into One File"
           }
         ]
       }
     }
     ```
   - This will make “Aggregate Open Tabs into One File” appear in the Command Palette.

---

## 4. Logic to Collect Text from Open Tabs

1. **Retrieve Open Editors**  
   - Use `vscode.window.visibleTextEditors` to get currently visible editors or `vscode.workspace.textDocuments` for all opened documents.  
   - Example using visible editors:
     ```ts
     const openEditors = vscode.window.visibleTextEditors;
     ```

2. **Fetch the File Content**  
   - For each editor, access the document’s text:
     ```ts
     const documentText = editor.document.getText();
     ```
   - Also record the file name or path for clarity.

3. **Combine All Contents**  
   - Concatenate all open file contents into a single string:
     ```ts
     let aggregatedContent = "";
     for (const editor of openEditors) {
       const fileName = editor.document.fileName;
       const fileContent = editor.document.getText();
       aggregatedContent += `// File: ${fileName}\n${fileContent}\n\n`;
     }
     ```

---

## 5. Writing/Generating the Aggregated File

1. **Decide Where to Place the File**  
   - **Untitled (In-Memory) Document**: Creates a temporary buffer within VS Code.  
   - **Physical File**: Writes to the workspace folder or a specified path on disk.

2. **Create a New Document**  
   - For an untitled document in TypeScript:
     ```ts
     const doc = await vscode.workspace.openTextDocument({
       content: aggregatedContent,
       language: "plaintext"
     });
     ```
   - Or write to disk using the FileSystem API or Node.js, then open the file.

---

## 6. Displaying the Aggregated File in a Split Editor

1. **Open the Document**  
   - Use the VS Code API to show the new document in the editor:
     ```ts
     await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
     ```
   - `ViewColumn.Beside` opens it in a split view.

2. **Editor Customizations** (Optional)  
   - Specify a language for syntax highlighting by changing the language ID.  
   - Scroll or reveal certain sections as needed.

---

## 7. User Flow

1. **User Opens Multiple Tabs**  
   - The user has several files open in VS Code.
2. **User Triggers Command**  
   - From the Command Palette, select “Aggregate Open Tabs into One File.”
3. **Extension Gathers Content**  
   - The extension looks at each open editor, extracts file content, and builds a single string.
4. **Aggregated File is Shown**  
   - A new editor pane (split if desired) is opened with the combined file.
5. **User Copies or Processes the File**  
   - The user can then copy all contents, or send it to an LLM or any other tool.

---

## 8. Edge Cases & Considerations

1. **Large Files or Many Tabs**  
   - Be mindful of performance when concatenating very large documents.
2. **Binary or Non-Text Files**  
   - Decide whether to ignore binary files or handle them differently.
3. **Untitled Editors**  
   - Label them as “Untitled-X” or similar.  
4. **Duplicate Tabs**  
   - If the same file appears in multiple splits, do you want to include it once or multiple times?
5. **Workspace Permissions**  
   - If writing to disk, watch for permission issues.

---

## 9. Testing & Validation

1. **Local Testing**  
   - Use `npm run compile` or `npm run watch` (for TypeScript).  
   - Press `F5` in VS Code to launch an Extension Development Host for testing.
2. **Edge Cases**  
   - Test no open editors.  
   - Test large files.  
   - Test multiple open tabs of the same file.
3. **Output Verification**  
   - Ensure the aggregated file content matches your expectations.

---

## 10. Publishing (Optional)

1. **VS Code Marketplace**  
   - Use `vsce package` to bundle your extension.  
   - Use `vsce publish` to publish (requires a Microsoft account and an Azure DevOps organization).
2. **Versioning**  
   - Update the version in `package.json` (e.g., `1.0.0` -> `1.1.0` for minor changes).

---

## 11. Summary of Requirements

- **VS Code Extension** with one main command to aggregate open files.  
- **Command**: `extension.aggregateOpenTabs`.  
- **Activation**: Triggered by `onCommand:extension.aggregateOpenTabs`.  
- **Implementation Steps**:
  1. Create your project scaffold (`package.json`, `tsconfig.json`, etc.).  
  2. Declare the extension command in `package.json`.  
  3. In your command callback:
     - Retrieve open tabs.  
     - For each tab, get the document text.  
     - Append text (with optional file headers) to a string buffer.  
     - Create or open a new file with this aggregated content.  
     - Show it in a split view (`ViewColumn.Beside`).  
  4. Handle edge cases (no open editors, unsaved docs, duplicates).  
  5. Test thoroughly and (optionally) publish to the VS Code Marketplace.

---

**Happy coding!** Use this guide to implement the extension, and enjoy effortlessly collecting all open tabs into a single file for quick reference or AI processing.