// This file contains code adapted from https://github.com/James-Yu/LaTeX-Workshop/
// Original license below:
//////////////////////////////////////////////////////////////////////////////////////////
// The MIT License (MIT)
//
// Copyright (c) 2016 James Yu
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//////////////////////////////////////////////////////////////////////////////////////////

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {Extension} from './extension';

export class Completer implements vscode.CompletionItemProvider {
    extension: Extension;
    suggestions: vscode.CompletionItem[];
    referenceData: {[id: string]: {item: {[id: string]: any}, text: string, file: string}} = {};
    refreshTimer: number;

    constructor(extension: Extension) {
        this.extension = extension;
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken) : Promise<vscode.CompletionItem[]> {
        return new Promise((resolve, _reject) => {
            const line = document.lineAt(position.line).text.substr(0, position.character);           
            const reg = /(?:\\@ref\()([^\)]*)$/;
            const result = line.match(reg);
            let suggestions: vscode.CompletionItem[] = [];
            if (result) {
                suggestions = this.provide();
            }
            if (suggestions.length > 0) {
                resolve(suggestions);
                return;
            }
            resolve();
        });
    }

    provide() : vscode.CompletionItem[] {
        if (Date.now() - this.refreshTimer < 1000) {
            return this.suggestions;
        }
        this.refreshTimer = Date.now();
        const suggestions = {};
        Object.keys(this.referenceData).forEach(key => {
            suggestions[key] = this.referenceData[key].item;
        });

        if (vscode.window.activeTextEditor) {
            let content = '';
            if (this.extension.cfg().get('UseRmdFilesYAML')) {
                const ymlFile = path.join(vscode.workspace.rootPath, '_bookdown.yml');
                const rmdFilesRegex = /^rmd_files:\s* \[(.*)\]/m;
                this.extension.log(`Looking for YAML file: ${ymlFile}`);
                const regMatch = fs.readFileSync(ymlFile, 'utf8').match(rmdFilesRegex);
                if (regMatch) {
                    const rmdFiles = regMatch[1].split(',').map(item => item.trim().replace(/"/g, ''));
                    for (let i in rmdFiles) {
                        var curInput = path.join(vscode.workspace.rootPath, rmdFiles[i]);
                        this.extension.log(`Parsing text file: ${curInput}`);
                        content = content.concat(fs.readFileSync(curInput, 'utf8'));
                    }
                }
            } else {
                content = vscode.window.activeTextEditor.document.getText();
            }
            const labelReg = /\(\\#([^\)]*)\)/g; // Searches for: (\#label) 
            const rfigReg = /```{r\s*(.*?),.*fig\.cap.*/g; // Searches for: ```r label, .*, fig.cap
            let items = this.getReferenceItems(content, labelReg, '');
            Object.assign(items, this.getReferenceItems(content, rfigReg, 'fig:'));
            Object.keys(items).map(key => {
                if (!(key in suggestions)) {
                    suggestions[key] = items[key];
                }
            });
        }
        this.suggestions = [];
        Object.keys(suggestions).map(key => {
            const item = suggestions[key];
            const command = new vscode.CompletionItem(item.reference, vscode.CompletionItemKind.Reference);
            command.documentation = item.text;
            this.suggestions.push(command);
        });
        return this.suggestions;
    }

    getReferenceItems(content: string, itemReg: RegExp, prefix = '') {
        const items = {};
        const noELContent = content.split('\n').filter(para => para !== '').join('\n');
        while (true) {
            const result = itemReg.exec(content);
            if (result === null) {
                break;
            }
            if (!(result[1] in items)) {
                const prevContent = noELContent.substring(0, noELContent.substring(0, result.index).lastIndexOf('\n') - 1);
                const followLength = noELContent.substring(result.index, noELContent.length).split('\n', 4).join('\n').length;
                const positionContent = content.substring(0, result.index).split('\n');
                items[result[1]] = {
                    reference: prefix+result[1],
                    text: `${noELContent.substring(prevContent.lastIndexOf('\n') + 1, result.index + followLength)}\n...`,
                    position: new vscode.Position(positionContent.length - 1, positionContent[positionContent.length - 1].length)
                };
            }
        }
        return items;
    }
}