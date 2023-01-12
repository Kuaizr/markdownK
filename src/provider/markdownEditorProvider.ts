import * as fs from 'fs';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { basename, dirname, isAbsolute, parse, resolve } from 'path';
import * as vscode from 'vscode';
import { Hanlder } from '../common/handler';
import { Util } from '../common/util';
import { Holder } from '../service/markdown/holder';
import { MarkdownService } from '../service/markdownService';

/**
 * support view and edit office files.
 */
export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {

    private extensionPath: string;
    private countStatus: vscode.StatusBarItem;
    private state: vscode.Memento;

    constructor(private context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
        this.countStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.state = context.globalState
    }

    private getFolders(): vscode.Uri[] {
        const data = [];
        for (var i = 65; i <= 90; i++) {
            data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`))
        }
        return data;
    }

    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {
        const uri = document.uri;
        const webview = webviewPanel.webview;
        const folderPath = vscode.Uri.joinPath(uri, '..')
        webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file("/"), ...this.getFolders()]
        }
        const handler = Hanlder.bind(webviewPanel, uri);
        this.handleMarkdown(document, handler, folderPath)
    }

    private handleMarkdown(document: vscode.TextDocument, handler: Hanlder, folderPath: vscode.Uri) {

        const uri = document.uri;
        const webview = handler.panel.webview;

        let content = document.getText();
        const contextPath = `${this.extensionPath}/resource/vditor`;
        const rootPath = webview.asWebviewUri(vscode.Uri.file(`${contextPath}`)).toString();

        Holder.activeDocument = document;
        handler.panel.onDidChangeViewState(e => {
            Holder.activeDocument = e.webviewPanel.visible ? document : Holder.activeDocument
            if (e.webviewPanel.visible) {
                this.updateCount(content)
                this.countStatus.show()
            } else {
                this.countStatus.hide()
            }
        });

        const config = vscode.workspace.getConfiguration("markdownk");
        handler.on("init", () => {
            const scrollTop = this.state.get(`scrollTop_${document.uri.fsPath}`, 0);
            handler.emit("open", {
                title: basename(uri.fsPath),
                config, scrollTop,
                language: vscode.env.language,
                rootPath, content
            })
            this.updateCount(content)
            this.countStatus.show()
        }).on("externalUpdate", e => {
            const updatedText = e.document.getText()?.replace(/\r/g, '');
            if (content == updatedText) return;
            content = updatedText;
            this.updateCount(content)
            handler.emit("update", updatedText)
        }).on("command", (command) => {
            vscode.commands.executeCommand(command)
        }).on("openLink", (uri: string) => {
            const resReg = /https:\/\/file.*\.net/i;
            if (uri.match(resReg)) {
                const localPath = uri.replace(resReg, '')
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(localPath));
            } else {
                vscode.env.openExternal(vscode.Uri.parse(uri));
            }
        }).on("scroll", ({ scrollTop }) => {
            this.state.update(`scrollTop_${document.uri.fsPath}`, scrollTop)
        }).on("img", (img) => {
            let rePath = vscode.workspace.getConfiguration("markdownk").get<string>("pasterImgPath");
            rePath = rePath.replace("${fileName}", parse(uri.fsPath).name.replace(/\s/g, '')).replace("${now}", new Date().getTime() + "")
            const imagePath = isAbsolute(rePath) ? rePath : `${resolve(uri.fsPath, "..")}/${rePath}`.replace(/\\/g, "/");
            const dir = dirname(imagePath)
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true })
            }
            const fileName = parse(rePath).name;
            fs.writeFileSync(imagePath, Buffer.from(img, 'binary'))
            console.log(img)
            vscode.env.clipboard.writeText(`![${fileName}](${rePath})`)
            vscode.commands.executeCommand("editor.action.clipboardPasteAction")
        }).on("editInVSCode", () => {
            vscode.commands.executeCommand('vscode.openWith', uri, "default", vscode.ViewColumn.Beside);
        }).on("save", (newContent) => {
            content = newContent
            this.updateTextDocument(document, newContent)
            this.updateCount(content)
        }).on("doSave", async (content) => {
            vscode.commands.executeCommand('workbench.action.files.save');
            this.updateCount(content)
        }).on("export", () => {
            vscode.commands.executeCommand('workbench.action.files.save');
            new MarkdownService(this.context).exportMarkdown(uri)
        }).on("exportMdToDocx", () => {
            vscode.commands.executeCommand('workbench.action.files.save');
            new MarkdownService(this.context).exportMarkdown(uri, 'docx')
        }).on("exportMdToHtml", () => {
            vscode.commands.executeCommand('workbench.action.files.save');
            new MarkdownService(this.context).exportMarkdown(uri, 'html')
        }).on("theme", () => {
            vscode.commands.executeCommand('workbench.action.selectTheme');
        }).on("saveOutline", (enable) => {
            config.update("openOutline", enable, true)
        })

        const baseUrl = webview.asWebviewUri(folderPath).toString().replace(/\?.+$/, '').replace('https://git', 'https://file');
        webview.html = Util.buildPath(
            readFileSync(`${this.extensionPath}/resource/vditor/index.html`, 'utf8')
                .replace("{{rootPath}}", rootPath)
                .replace("{{baseUrl}}", baseUrl),
            webview, contextPath);
    }

    private updateCount(content: string) {
        this.countStatus.text = `Line ${content.split(/\r\n|\r|\n/).length}    Count ${content.length}`
    }

    private updateTextDocument(document: vscode.TextDocument, content: any) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), content);
        return vscode.workspace.applyEdit(edit);
    }

}