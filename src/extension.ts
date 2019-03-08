'use strict';

import * as vscode from 'vscode';
import { isUndefined } from 'util';

import {Completer} from './completion';

export function activate(context: vscode.ExtensionContext) {
    const extension = new Extension();

    context.subscriptions.push(vscode.commands.registerCommand('Bookdown.ServeBook', () => {
        extension.execRCmd(`bookdown::serve_book('.')`);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('Bookdown.CloseBookServer', () => {
        extension.execRCmd(`servr::daemon_stop()`);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('Bookdown.CloseTerminal', () => {
        extension.getTerminal().dispose();
        extension.curTerminal = undefined;
    }));

    context.subscriptions.push(vscode.commands.registerCommand('Bookdown.RenderGitbook', () => {
        extension.execRCmd(`bookdown::render_book(${extension.cfg().get('Opts.Gitbook')})`);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('Bookdown.RenderPDFbook', () => {
        extension.execRCmd(`bookdown::render_book(${extension.cfg().get('Opts.PDFbook')})`);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('Bookdown.RenderCustom', () => {
        const optChoices = extension.cfg().get('Opts.Custom') as 
            {name: string, opts: string}[];
        if (!optChoices) {
            return;
        }
        let optChosen = optChoices[0];
        if (optChoices.length > 1) {
            vscode.window.showQuickPick(optChoices.map(build => build.name), {
                placeHolder: 'Select user-defined render'
            }).then(chosen => {
                if (!chosen) {
                    return;
                }
                optChosen = optChoices.filter(choices => choices.name === chosen)[0];
                extension.execRCmd(`bookdown::render_book(${optChosen.opts})`);
            });
        } else {
            extension.execRCmd(`bookdown::render_book(${optChosen.opts})`);
        }    
    }));

    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(
        {scheme: 'file', language: 'markdown'}, 
        extension.completer, '('));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(
        {scheme: 'file', language: 'rmd'}, 
        extension.completer, '('));
}

export class Extension {
    completer: Completer;
    showLog: Boolean;
    curTerminal: vscode.Terminal | undefined;
    logPanel: vscode.OutputChannel;

    constructor() {
        this.completer = new Completer(this);
        this.logPanel = vscode.window.createOutputChannel('Bookdown Tools');
        this.log(`Bookdown tools extension is now activated`);
    }

    cfg() {return(vscode.workspace.getConfiguration('Bookdown'));}

    log(msg: string) {
        if (this.cfg().get('ShowLog')) {
            this.logPanel.append(`${msg}\n`);
        }
    }

    getExecR() {
        let userVal : string = this.cfg().get('R');
        if (userVal !== '') {
            return userVal;
        } else if (process.platform === 'win32') {
            return 'R.exe';
        } else {
            return 'R';
        }
    }

    getTerminal() {
        if (isUndefined(this.curTerminal)) {
            this.log(`Creating new terminal`);
            this.curTerminal = vscode.window.createTerminal(`Bookdown R Prompt`, this.getExecR());
            this.log(`New terminal created`);
        }
        if (this.cfg().get('ShowTerminal')) {
            this.curTerminal.show();
        }
        return(this.curTerminal);
    }

    execRCmd(cmd: string){
        this.getTerminal().sendText(cmd);
        this.log(`Executed cmd`);
    }
}


export function deactivate() {
}