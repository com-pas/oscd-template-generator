/* eslint-disable @typescript-eslint/no-unused-vars */
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { LitElement, html, css } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { Tree, TreeNode } from '@openenergytools/tree-grid';
import { MdSelectOption } from '@scopedelement/material-web/select/MdSelectOption.js';
import { MdFilledSelect } from '@scopedelement/material-web/select/MdOutlineSelect.js';
import { MdOutlinedTextField } from '@scopedelement/material-web/textfield/MdOutlinedTextField.js';
import { MdDialog } from '@scopedelement/material-web/dialog/dialog.js';
import { MdTextButton } from '@scopedelement/material-web/button/text-button.js';
import {
  FormGroup,
  FormValue,
  Validators,
  type Validator,
  type Value,
} from '@compas-oscd/forms';
import { debounce } from '../utils/debounce.js';

// eslint-disable-next-line no-shadow
enum DONameStatus {
  Ok = 'Ok',
  Taken = 'Taken',
  InvalidCDC = 'InvalidCDC',
  CustomNamespaceNeeded = 'CustomNamespaceNeeded',
}

const firstTextBlockRegExp = /[A-Za-z]+/;

export class CreateDataObjectDialog extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-dialog': MdDialog,
    'md-text-button': MdTextButton,
    'md-outlined-select': MdFilledSelect,
    'md-select-option': MdSelectOption,
    'md-outlined-text-field': MdOutlinedTextField,
  };

  @property({ type: Array })
  cdClasses: string[] = [];

  @property()
  tree: Partial<Record<string, TreeNode>> = {};

  @property({ type: Function })
  onConfirm?: (
    cdcType: string,
    doName: string,
    namespace: string | null
  ) => void;

  @query('md-dialog')
  dialog!: MdDialog;

  @query('#cdc-type')
  cdcType!: MdFilledSelect;

  @query('#do-name')
  doName!: MdOutlinedTextField;

  @query('#namespace')
  namespace!: MdOutlinedTextField;

  private formGroup: FormGroup | null = null;

  private namespaceDefaultValue = 'User-Defined';

  @state()
  private isCustomNamespaceDisabled = true;

  get open() {
    return this.dialog?.open ?? false;
  }

  show() {
    this.formGroup = new FormGroup({
      name: {
        formField: this.doName,
        validators: [
          Validators.required('DO Name required'),
          this.doNameTakenValidator,
        ],
      },
      cdc: {
        formField: this.cdcType,
        validators: [
          Validators.required('CDC required'),
          this.cdcTypeValidator,
        ],
      },
      namespace: {
        formField: this.namespace,
        validators: [
          Validators.requiredIf(
            () => this.isCustomNamespaceRequired(),
            'Custom namespace required'
          ),
        ],
      },
    });

    this.dialog?.show();
  }

  close() {
    if (this.cdcType) {
      this.cdcType.errorText = '';
      this.cdcType.error = false;
      this.cdcType.reset();
    }

    if (this.doName) {
      this.doName.errorText = '';
      this.doName.error = false;
      this.doName.value = '';
    }

    if (this.namespace) {
      this.namespace.errorText = '';
      this.namespace.error = false;
      this.namespace.value = '';
    }

    this.dialog?.close();
  }

  private doNameTakenValidator: Validator = (doName: Value) => {
    const isTaken = (doName as string) in this.tree;
    return isTaken ? 'DO name already in use' : null;
  };

  private cdcTypeValidator: Validator = () => {
    const doNameStatus = this.getDONameStatus();
    return doNameStatus === DONameStatus.InvalidCDC
      ? 'CDC type invalid for this DO'
      : null;
  };

  private isCustomNamespaceRequired(): boolean {
    const doStatus = this.getDONameStatus();
    return doStatus === DONameStatus.CustomNamespaceNeeded;
  }

  private getDONameStatus(): DONameStatus {
    const doNameValue = this.doName.value;
    const cdcValue = this.cdcType.value;
    const isTaken = doNameValue in this.tree;

    if (isTaken) {
      return DONameStatus.Taken;
    }

    const multiTree = Object.keys(this.tree)
      .filter(key => (this.tree[key] as any).presCond === 'Omulti')
      .reduce((acc, key) => {
        acc[key] = this.tree[key];
        return acc;
      }, {} as any);

    const firstTextBlockMatch = doNameValue.match(firstTextBlockRegExp);

    if (firstTextBlockMatch) {
      const firstTextBlock = firstTextBlockMatch[0];
      const matchingTreeNode = multiTree[`${firstTextBlock}1`];

      if (matchingTreeNode) {
        const doCDCsMatch = cdcValue === matchingTreeNode.type;

        if (!doCDCsMatch) {
          return DONameStatus.InvalidCDC;
        }

        return DONameStatus.Ok;
      }
    }

    return DONameStatus.CustomNamespaceNeeded;
  }

  private onValueChange = debounce(() => {
    if (!this.cdcType.value || !this.doName.value) {
      this.isCustomNamespaceDisabled = true;
      return;
    }

    this.isCustomNamespaceDisabled = !this.isCustomNamespaceRequired();
  }, 300);

  /* eslint-disable class-methods-use-this */
  private resetErrorText(e: Event): void {
    const target = e.target as MdOutlinedTextField | MdFilledSelect;
    if (target.errorText && target.checkValidity()) {
      target.errorText = '';
      target.error = false;
    }
  }

  private handleConfirm() {
    if (!this.formGroup?.validate()) {
      return;
    }

    const status = this.getDONameStatus();

    const namespace =
      status === DONameStatus.CustomNamespaceNeeded
        ? this.namespace.value
        : null;
    this.onConfirm?.(this.cdcType?.value, this.doName?.value, namespace);
    this.close();
  }

  render() {
    return html`
      <md-dialog @closed=${() => this.close()}>
        <div slot="headline">Add Data Object</div>
        <div slot="content" class="dialog-content">
          <md-outlined-select
            id="cdc-type"
            class="cdc-type"
            label="Common Data Class"
            required
            @input=${(e: Event) => {
              this.resetErrorText(e);
              this.onValueChange();
            }}
          >
            ${this.cdClasses.map(
              cdClass =>
                html`<md-select-option value=${cdClass}
                  >${cdClass}</md-select-option
                >`
            )}
          </md-outlined-select>
          <md-outlined-text-field
            id="do-name"
            label="Data Object Name"
            required
            maxlength="12"
            pattern="[A-Z][0-9A-Za-z]*"
            @input=${(e: Event) => {
              this.resetErrorText(e);
              this.onValueChange();
            }}
          ></md-outlined-text-field>
          <md-outlined-text-field
            id="namespace"
            label="Namespace"
            placeholder=${this.namespaceDefaultValue}
            required
            .disabled=${this.isCustomNamespaceDisabled}
            @input=${this.resetErrorText}
          ></md-outlined-text-field>
        </div>
        <div slot="actions">
          <md-text-button id="cancel-btn" @click=${this.close} type="button"
            >Cancel</md-text-button
          >
          <md-text-button
            id="confirm-btn"
            @click=${this.handleConfirm}
            type="button"
            >Add</md-text-button
          >
        </div>
      </md-dialog>
    `;
  }

  static styles = css`
    md-text-button {
      text-transform: uppercase;
    }
    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `;
}
