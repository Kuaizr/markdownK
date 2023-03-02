import { Output } from "../common/Output";
import { spawn } from 'child_process';
import chromeFinder from 'chrome-finder';
import { copyFileSync, existsSync, lstatSync, mkdirSync, renameSync } from 'fs';
import { homedir } from 'os';
import path, { dirname, extname, isAbsolute, join, parse } from 'path';
import * as vscode from 'vscode';
import { Holder } from '../common/holder';

export class MarkdownService {

    constructor(private context: vscode.ExtensionContext) {
    }

    public async loadClipboardImage() {

        const document = vscode.window.activeTextEditor?.document || Holder.activeDocument
        if (await vscode.env.clipboard.readText()) {
            vscode.commands.executeCommand("editor.action.clipboardPasteAction")
            return
        }

        if (!document || document.isUntitled || document.isClosed) {
            return
        }

        const uri: vscode.Uri = document.uri;
        let relPath = vscode.workspace.getConfiguration("markdownk").get<string>("pasterImgPath");
        relPath = relPath.replace("${fileName}", parse(uri.fsPath).name.replace(/\s/g, '')).replace("${now}", new Date().getTime() + "")
        const absolutePath = isAbsolute(relPath) ? relPath : `${dirname(uri.fsPath)}/${relPath}`.replace(/\\/g, "/");
        this.createImgDir(absolutePath);
        this.saveClipboardImageToFileAndGetPath(absolutePath, async (savedImagePath) => {
            if (!savedImagePath) return;
            if (savedImagePath === 'no image') {
                vscode.window.showErrorMessage('There is not an image in the clipboard.');
                return;
            }
            this.copyFromPath(savedImagePath, absolutePath);
            const editor = vscode.window.activeTextEditor;
            const imgName = parse(relPath).name;
            const oldExt = extname(absolutePath)
            const ext = "png";
            // const { ext = "png" } = (await fileTypeFromFile(absolutePath)) ?? {};
            if (oldExt != `.${ext}`) {
                relPath = relPath.replace(oldExt, `.${ext}`)
                renameSync(absolutePath, absolutePath.replace(oldExt, `.${ext}`))
            }
            if (editor) {
                editor?.edit(edit => {
                    let current = editor.selection;
                    if (current.isEmpty) {
                        edit.insert(current.start, `![${imgName}](${relPath})`);
                    } else {
                        edit.replace(current, `![${imgName}](${relPath})`);
                    }
                });
            } else {
                vscode.env.clipboard.writeText(`![${imgName}](${relPath})`)
                vscode.commands.executeCommand("editor.action.clipboardPasteAction")
            }
        })
    }

    /**
     * 如果粘贴板内是复制了一个文件, 取得路径进行复制
     */
    private copyFromPath(savedImagePath: string, targetPath: string) {
        if (savedImagePath.startsWith("copyed:")) {
            const copyedFile = savedImagePath.replace("copyed:", "");
            if (lstatSync(copyedFile).isDirectory()) {
                vscode.window.showErrorMessage('Not support paste directory.');
            } else {
                copyFileSync(copyedFile, targetPath);
            }
        }
    }

    private createImgDir(imagePath: string) {
        const dir = path.dirname(imagePath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }

    private saveClipboardImageToFileAndGetPath(imagePath: string, cb: (value: string) => void) {
        if (!imagePath) return;
        let platform = process.platform;
        if (platform === 'win32') {
            // Windows
            const scriptPath = path.join(this.context.extensionPath, '/lib/pc.ps1');
            const powershell = spawn('powershell', [
                '-noprofile',
                '-noninteractive',
                '-nologo',
                '-sta',
                '-executionpolicy', 'unrestricted',
                '-windowstyle', 'hidden',
                '-file', scriptPath,
                imagePath
            ]);
            powershell.on('exit', function (code, signal) {
            });
            powershell.stdout.on('data', function (data) {
                cb(data.toString().trim());
            });
        } else if (platform === 'darwin') {
            // Mac
            let scriptPath = path.join(this.context.extensionPath, './lib/mac.applescript');
            let ascript = spawn('osascript', [scriptPath, imagePath]);
            ascript.on('exit', function (code, signal) {
            });
            ascript.stdout.on('data', function (data) {
                cb(data.toString().trim());
            });
        } else {
            // Linux 
            let scriptPath = path.join(this.context.extensionPath, './lib/linux.sh');

            let ascript = spawn('sh', [scriptPath, imagePath]);
            ascript.on('exit', function (code, signal) {
            });
            ascript.stdout.on('data', function (data) {
                let result = data.toString().trim();
                if (result == "no xclip") {
                    vscode.window.showInformationMessage('You need to install xclip command first.');
                    return;
                }
                cb(result);
            });
        }
    }

}
