import * as vscode from 'vscode';
import { autoClearCacheStorage } from './service/autoClearCacheStorage';
import { MarkdownEditorProvider } from './provider/markdownEditorProvider';
import { MarkdownService } from './service/markdownService';
// const httpExt:any = require('./bundle/extension.js');


export function activate(context: vscode.ExtensionContext) {

	// httpExt.activate(context);
	autoClearCacheStorage();

	const viewOption = { webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true } };
	const markdownService = new MarkdownService(context);
	context.subscriptions.push(
		vscode.commands.registerCommand('markdownk.paste', () => { markdownService.loadClipboardImage() }),
		vscode.window.registerCustomEditorProvider("markdownk.markdownViewer", new MarkdownEditorProvider(context), viewOption)
		);
}

export function deactivate() { }
