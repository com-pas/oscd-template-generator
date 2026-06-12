/* eslint-disable @typescript-eslint/no-unused-vars */
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { LitElement, html, css } from 'lit';
import { query, property } from 'lit/decorators.js';
import { MdDialog } from '@scopedelement/material-web/dialog/dialog.js';
import { MdTextButton } from '@scopedelement/material-web/button/text-button.js';
import { insertSelectedLNodeType, LNodeDescription } from '@openscd/scl-lib';
import { TreeSelection } from '@openenergytools/tree-grid';
import { createBaseSCLDoc, serializeAndFormat } from '../foundation.js';
import 'ace-custom-element';

const aceTheme = `solarized_${localStorage.getItem('theme') || 'light'}`;

export class PreviewDialog extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-dialog': MdDialog,
    'md-text-button': MdTextButton,
  };

  @query('md-dialog')
  dialog!: MdDialog;

  @query('ace-editor')
  aceEditor!: HTMLElement;

  @property({ type: Object })
  selection: TreeSelection = {};

  @property({ type: Object })
  tree: LNodeDescription | undefined = undefined;

  @property({ type: String })
  lNodeType: string = '';

  get xmlContent(): string {
    if (!this.selection || !this.tree || !this.lNodeType) {
      return '<!-- No data selected for preview -->';
    }
    try {
      const doc = createBaseSCLDoc();
      const inserts = insertSelectedLNodeType(doc, this.selection, {
        class: this.lNodeType,
        data: this.tree,
      });
      inserts.forEach(insert => {
        if (insert.parent && insert.node) {
          insert.parent.appendChild(insert.node);
        }
      });
      return serializeAndFormat(doc);
    } catch (error) {
      return `<!-- Error generating preview: ${error} -->`;
    }
  }

  show() {
    this.dialog?.show();
  }

  render() {
    return html`
      <md-dialog @closed=${() => this.dialog?.close()}>
        <div slot="headline">Preview LNodeType</div>
        <div slot="content">
          <ace-editor
            mode="ace/mode/xml"
            theme=${`ace/theme/${aceTheme}`}
            wrap
            style="width: 80vw;"
            .value=${this.xmlContent}
            readonly
          ></ace-editor>
        </div>
        <div slot="actions">
          <md-text-button @click=${() => this.dialog.close()} type="button"
            >Close</md-text-button
          >
        </div>
      </md-dialog>
    `;
  }

  static styles = css`
    md-dialog {
      --md-dialog-container-max-width: 90vw;
      max-width: 90vw;
      max-height: 100vh;
    }
    [slot='content'] {
      padding: 12px;
    }
    ace-editor {
      height: calc(100vh - 240px);
      box-sizing: border-box;
    }
    md-text-button {
      text-transform: uppercase;
    }
  `;
}
