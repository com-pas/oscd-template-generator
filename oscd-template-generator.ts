/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { css, html, LitElement } from 'lit';
import { property, state, query } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { newEditEvent } from '@openenergytools/open-scd-core';

import {
  insertSelectedLNodeType,
  nsdToJson,
  LNodeDescription,
} from '@openscd/scl-lib';

import { TreeGrid, TreeSelection } from '@openenergytools/tree-grid';

import { MdFab } from '@scopedelement/material-web/fab/MdFab.js';
import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';
import { MdIconButton } from '@scopedelement/material-web/iconbutton/MdIconButton.js';
import { MdFilledSelect } from '@scopedelement/material-web/select/MdFilledSelect.js';
import { MdSelectOption } from '@scopedelement/material-web/select/MdSelectOption.js';
import { MdFilledSelect as MdOutlinedSelect } from '@scopedelement/material-web/select/MdOutlineSelect.js';
import { MdOutlinedTextField } from '@scopedelement/material-web/textfield/MdOutlinedTextField.js';
import { MdOutlinedButton } from '@scopedelement/material-web/button/outlined-button.js';
import { MdDialog } from '@scopedelement/material-web/dialog/dialog.js';
import { CdcChildren } from '@openscd/scl-lib/dist/tDataTypeTemplates/nsdToJson.js';
import { Snackbar } from './components/snackbar.js';
import { CreateDataObjectDialog } from './components/create-do-dialog.js';
import { DescriptionDialog } from './components/description-dialog.js';
import { PreviewDialog } from './components/preview-dialog.js';
import { SettingsDialog } from './components/settings-dialog.js';

import {
  cdClasses,
  lnClass74,
  STORAGE_KEY_LNODETYPE_ID_SETTING,
} from './constants.js';
import { NodeData, getSelectionByPath, processEnums } from './foundation.js';

let lastLNodeType = 'LPHD';
let lastSelection = {};
let lastFilter = '';

export default class TemplateGenerator extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'tree-grid': TreeGrid,
    'md-filled-select': MdFilledSelect,
    'md-select-option': MdSelectOption,
    'md-outlined-select': MdOutlinedSelect,
    'md-fab': MdFab,
    'md-icon': MdIcon,
    'md-icon-button': MdIconButton,
    'md-outlined-button': MdOutlinedButton,
    'md-dialog': MdDialog,
    'md-outlined-text-field': MdOutlinedTextField,
    'oscd-snackbar': Snackbar,
    'create-data-object-dialog': CreateDataObjectDialog,
    'description-dialog': DescriptionDialog,
    'preview-dialog': PreviewDialog,
    'settings-dialog': SettingsDialog,
  };

  @property({ attribute: false })
  doc?: XMLDocument;

  @query('tree-grid')
  treeUI!: TreeGrid;

  @query('md-filled-select')
  lNodeTypeUI?: MdFilledSelect;

  @query('create-data-object-dialog')
  createDOdialog!: CreateDataObjectDialog;

  @query('description-dialog')
  descriptionDialog!: DescriptionDialog;

  @query('preview-dialog')
  previewDialog!: PreviewDialog;

  @query('settings-dialog')
  settingsDialog!: SettingsDialog;

  @state()
  get selection(): TreeSelection {
    if (!this.treeUI) return {};
    return this.treeUI.selection;
  }

  set selection(selection: TreeSelection) {
    this.treeUI.selection = selection;
  }

  @state()
  get filter(): string {
    if (!this.treeUI) return '';
    return this.treeUI.filter ?? '';
  }

  set filter(filter: string) {
    this.treeUI.filter = filter;
  }

  @state()
  get lNodeType(): string {
    return this.lNodeTypeUI?.value || lastLNodeType;
  }

  set lNodeType(lNodeType: string) {
    if (!this.lNodeTypeUI) return;
    this.lNodeTypeUI.value = lNodeType;
    if (!this.lNodeTypeUI.value) this.lNodeTypeUI.value = lastLNodeType;
  }

  @state()
  addedLNode = '';

  @state()
  snackbarMessage = '';

  @state()
  snackbarType: 'success' | 'error' = 'success';

  // eslint-disable-next-line class-methods-use-this
  get lNodeTypeIdSetting(): string {
    return localStorage.getItem(STORAGE_KEY_LNODETYPE_ID_SETTING) || 'random';
  }

  private generateRandomId(): string {
    let id: string;
    do {
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        c => {
          const r = Math.floor(Math.random() * 16);
          const v = c === 'x' ? r : (r % 4) + 8;
          return v.toString(16);
        }
      );
      id = `${this.lNodeType}€${uuid}`;
    } while (this.doc?.querySelector(`LNodeType[id="${id}"]`));
    return id;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    lastSelection = this.selection;
    lastFilter = this.filter;
    lastLNodeType = this.lNodeType;
  }

  async firstUpdated() {
    await this.treeUI.updateComplete;
    await this.lNodeTypeUI!.updateComplete;

    this.treeUI.tree = nsdToJson(lastLNodeType) as any;
    this.lNodeType = lastLNodeType;
    this.filter = lastFilter;
    this.selection = lastSelection;

    await this.treeUI.updateComplete;

    this.autoSelectEnums();
  }

  saveTemplates(description: string, id?: string) {
    if (!this.doc) return;

    let lNodeTypeId: string | undefined;

    switch (this.lNodeTypeIdSetting) {
      case 'user':
        lNodeTypeId = id;
        break;
      case 'random':
        lNodeTypeId = this.generateRandomId();
        break;
      case 'content-hash':
        lNodeTypeId = undefined; // Leave undefined, scl-lib will auto-generate id from content hash
        break;
      default:
        lNodeTypeId = this.generateRandomId();
    }

    const inserts = insertSelectedLNodeType(this.doc, this.treeUI.selection, {
      class: this.lNodeType,
      ...(description !== undefined && { desc: description }),
      ...(lNodeTypeId !== undefined && { id: lNodeTypeId }),
      data: this.treeUI.tree as LNodeDescription,
    });

    const newLNodeType = inserts.find(
      insert => (insert.node as Element).tagName === 'LNodeType'
    )?.node as Element;

    if (newLNodeType) this.addedLNode = newLNodeType.getAttribute('id') ?? '';

    this.dispatchEvent(
      newEditEvent(inserts, {
        title: `Create LNodeType ${newLNodeType.getAttribute('id')}`,
      })
    );
  }

  async reset() {
    this.addedLNode = '';
    this.treeUI.tree = nsdToJson(this.lNodeType) as any;
    this.selection = {};
    this.filter = '';
    this.requestUpdate();
    this.treeUI.requestUpdate();

    await this.treeUI.updateComplete;
    this.autoSelectEnums();
  }

  private handleDOConfirm = (
    cdcType: string,
    doName: string,
    namespace: string | null
  ) => {
    if (!cdcType || !doName) return;
    try {
      this.createDataObject(
        cdcType as (typeof cdClasses)[number],
        doName,
        namespace
      );
      this.showNotification(
        `Data Object '${doName}' created successfully.`,
        'success'
      );
    } catch (error) {
      this.showNotification(
        'Failed to create Data Object. Please try again.',
        'error'
      );
    }
  };

  private createDataObject(
    cdcType: (typeof cdClasses)[number],
    doName: string,
    namespace: string | null
  ): void {
    let cdcChildren = nsdToJson(cdcType) as CdcChildren;

    if (namespace) {
      cdcChildren = {
        ...cdcChildren,
        dataNs: {
          ...cdcChildren?.dataNs,
          mandatory: true,
          val: namespace,
        },
      };
    }

    const cdcDescription = {
      tagName: 'DataObject',
      type: cdcType,
      descID: '',
      presCond: 'O',
      children: cdcChildren,
    };

    Object.assign(this.treeUI.tree, {
      [doName]: cdcDescription,
    });
    this.treeUI.requestUpdate();
  }

  showNotification(message: string, type: 'success' | 'error'): void {
    this.snackbarMessage = '';
    setTimeout(() => {
      this.snackbarMessage = message;
      this.snackbarType = type;
    }, 0);
  }

  private showPreview(): void {
    this.previewDialog.selection = this.treeUI.selection;
    this.previewDialog.show();
  }

  private updateSelectionAtPath(
    selection: TreeSelection,
    path: string[],
    newSelection: TreeSelection
  ): TreeSelection {
    if (path.length === 0) return newSelection;

    const [currentKey, ...remainingPath] = path;
    return {
      ...selection,
      [currentKey]: this.updateSelectionAtPath(
        selection[currentKey] || {},
        remainingPath,
        newSelection
      ),
    };
  }

  private handleNodeSelected = (event: CustomEvent) => {
    const { node, path } = event.detail;

    const currentSelectionAtPath = getSelectionByPath(
      this.treeUI.selection,
      path
    );

    const selectionWithEnums = processEnums(
      currentSelectionAtPath,
      node as NodeData
    );

    this.treeUI.selection = this.updateSelectionAtPath(
      this.treeUI.selection,
      path,
      selectionWithEnums
    );

    this.treeUI.requestUpdate();
  };

  private autoSelectEnums(): void {
    const tree = this.treeUI.tree as Record<string, NodeData>;
    const newSelection = { ...this.treeUI.selection };

    for (const [key, dataObject] of Object.entries(tree)) {
      if (newSelection[key]) {
        newSelection[key] = processEnums(newSelection[key], dataObject);
      }
    }

    this.treeUI.selection = newSelection;
    this.treeUI.requestUpdate();
  }

  render() {
    return html`<div class="container">
        <div class="btn-wrapper">
          <md-outlined-button @click=${() => this.createDOdialog.show()}>
            <md-icon slot="icon">add</md-icon>
            Add Data Object
          </md-outlined-button>
          <md-filled-select @input=${this.reset}>
            ${lnClass74.map(
              lNodeType =>
                html`<md-select-option value=${lNodeType}
                  >${lNodeType}</md-select-option
                >`
            )}
          </md-filled-select>
        </div>
        <tree-grid @node-selected=${this.handleNodeSelected}></tree-grid>
      </div>
      ${this.doc
        ? html`<div class="fab-wrapper">
            <div>
              <md-icon-button @click=${() => this.settingsDialog.show()}>
                <md-icon>settings</md-icon>
              </md-icon-button>
              <md-icon-button
                @click=${() => this.showPreview()}
                title="Preview"
              >
                <md-icon>preview</md-icon>
              </md-icon-button>
            </div>
            <md-fab
              label="${this.addedLNode || 'Add Type'}"
              @click=${() => this.descriptionDialog.show()}
            >
              <md-icon slot="icon">${this.addedLNode ? 'done' : 'add'}</md-icon>
            </md-fab>
          </div>`
        : html``}
      <create-data-object-dialog
        .cdClasses=${cdClasses}
        .tree=${this.treeUI?.tree}
        .onConfirm=${this.handleDOConfirm}
      ></create-data-object-dialog>
      <description-dialog
        .doc=${this.doc}
        .onConfirm=${(description: string, id?: string) =>
          this.saveTemplates(description, id)}
        .onCancel=${() => this.descriptionDialog.close()}
      ></description-dialog>
      <preview-dialog
        .tree=${this.treeUI?.tree}
        .lNodeType=${this.lNodeType}
      ></preview-dialog>
      <settings-dialog></settings-dialog>
      <oscd-snackbar
        .message=${this.snackbarMessage}
        .type=${this.snackbarType}
      ></oscd-snackbar>`;
  }

  static styles = css`
    * {
      --md-sys-color-primary: var(--oscd-primary);
      --md-sys-color-secondary: var(--oscd-secondary);
      --md-sys-typescale-body-large-font: var(--oscd-theme-text-font);
      --md-outlined-text-field-input-text-color: var(--oscd-base01);

      --md-sys-color-surface: var(--oscd-base3);
      --md-sys-color-on-surface: var(--oscd-base00);
      --md-sys-color-on-primary: var(--oscd-base2);
      --md-sys-color-on-surface-variant: var(--oscd-base00);
      --md-menu-container-color: var(--oscd-base3);
      font-family: var(--oscd-theme-text-font, 'Roboto');
      --md-sys-color-surface-container-highest: var(--oscd-base2);
      --md-list-item-activated-background: rgb(
        from var(--oscd-primary) r g b / 0.38
      );
      --md-menu-item-selected-container-color: rgb(
        from var(--oscd-primary) r g b / 0.38
      );
      --md-list-container-color: var(--oscd-base2);
      --md-fab-container-color: var(--oscd-secondary);
      --md-dialog-container-color: var(--oscd-base3);
      --md-dialog-container-shape: 4px;
      --md-text-button-container-shape: 4px;
    }

    md-outlined-button {
      text-transform: uppercase;
      --md-outlined-button-label-text-font: var(--oscd-theme-text-font, 'Roboto');
      --md-outlined-button-label-text-line-height: 1.25rem;
    }

    md-outlined-button::part(ripple),
    md-outlined-button::part(focus-ring) {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    md-icon {
      font-family: var(--oscd-theme-icon-font, 'Material Symbols Outlined');
    }

    .fab-wrapper {
      position: fixed;
      align-items: center;
      bottom: 32px;
      right: 32px;
      display: flex;
      gap: 16px;
    }

    .container {
      margin: 12px;
    }

    .btn-wrapper {
      display: flex;
      margin-bottom: 12px;
      gap: 12px;
    }
  `;
}
