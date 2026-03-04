import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { restore, SinonSpy, spy } from 'sinon';
import { Insert } from '@openenergytools/open-scd-core';

import TemplateGenerator from './oscd-template-generator.js';
import { lNodeSelection } from './oscd-template-generator.testfiles.js';

customElements.define('template-generator', TemplateGenerator);

export const sclDocString = `<?xml version="1.0" encoding="UTF-8"?>
<SCL version="2007" revision="B" xmlns="http://www.iec.ch/61850/2003/SCL">
  <DataTypeTemplates></DataTypeTemplates>
</SCL>`;

describe('TemplateGenerator', () => {
  let element: TemplateGenerator;
  beforeEach(async () => {
    element = await fixture(html`<template-generator></template-generator>`);
  });

  it('displays no action button', () =>
    expect(element.shadowRoot?.querySelector('md-fab')).to.not.exist);

  it('starts with LPHD selected', () => {
    expect(element).to.have.property('lNodeType', 'LPHD');
    expect(element).shadowDom.to.equalSnapshot();
  });

  it('displays a button to create a new DO', () => {
    expect(element.shadowRoot?.querySelector('md-outlined-button')).to.exist;
    expect(
      element.shadowRoot?.querySelector('md-outlined-button')
    ).to.include.text('Add Data Object');
  });

  describe('dialog behavior', () => {
    it('opens a dialog on "Add Data Object" button click', async () => {
      expect(element.createDOdialog.open).to.be.false;

      const button = element.shadowRoot?.querySelector(
        'md-outlined-button'
      ) as HTMLElement;
      button.click();

      await waitUntil(() => element.createDOdialog.open);
      expect(element.createDOdialog.open).to.be.true;
    });

    it('validates the form fields', async () => {
      const dialog = element.createDOdialog;
      dialog.show();
      await waitUntil(() => dialog.open);
      expect(dialog.cdcType.error).to.be.false;
      expect(dialog.doName.error).to.be.false;

      const confirmButton = dialog.shadowRoot?.querySelector(
        '#confirm-btn'
      ) as HTMLElement;
      confirmButton.click();

      expect(dialog.cdcType.error).to.be.true;
      expect(dialog.cdcType.errorText).to.equal('CDC required');
      expect(dialog.doName.error).to.be.true;
      expect(dialog.doName.errorText).to.equal('DO name required');
      const doNameInput = dialog.shadowRoot?.querySelector(
        '#do-name'
      ) as HTMLInputElement;
      doNameInput.value = 'ValidDOName';
      doNameInput.dispatchEvent(new Event('input'));
      expect(dialog.doName.errorText).to.equal('');
    });

    it('creates a new DO on form submit', async () => {
      const dialog = element.createDOdialog;
      dialog.show();
      await waitUntil(() => dialog.open);

      const treeBefore = JSON.parse(JSON.stringify(element.treeUI.tree));

      const doNameInput = dialog.shadowRoot?.querySelector(
        '#do-name'
      ) as HTMLInputElement;
      doNameInput.value = 'TestDO';
      doNameInput.dispatchEvent(new Event('input'));

      const cdcTypeSelect = dialog.shadowRoot?.querySelector(
        '#cdc-type'
      ) as HTMLSelectElement;
      cdcTypeSelect.value = 'ACD';
      cdcTypeSelect.dispatchEvent(new Event('input'));

      dialog.namespace.value = 'custom-namespace';

      const confirmButton = dialog.shadowRoot?.querySelector(
        '#confirm-btn'
      ) as HTMLElement;
      confirmButton.click();

      await element.updateComplete;

      const treeAfter = JSON.parse(JSON.stringify(element.treeUI.tree));
      expect(treeAfter).to.not.deep.equal(treeBefore);
      expect(treeAfter.TestDO).to.have.property('type', 'ACD');
      expect(treeAfter.TestDO).to.have.property('tagName', 'DataObject');
      expect(treeAfter.TestDO).to.have.property('descID', '');
      expect(treeAfter.TestDO).to.have.property('presCond', 'O');
      expect(treeAfter.TestDO.children.dataNs.val).to.equal('custom-namespace');
      expect(treeAfter.TestDO.children.dataNs.mandatory).to.be.true;
    });

    it('displays a success notification when a Data Object is created', async () => {
      const dialog = element.createDOdialog;
      dialog.show();
      await element.updateComplete;

      const doNameInput = dialog.doName;
      doNameInput.value = 'TestDO';
      doNameInput.dispatchEvent(new Event('input'));

      const cdcTypeSelect = dialog.cdcType;
      cdcTypeSelect.value = 'ACD';
      cdcTypeSelect.dispatchEvent(new Event('input'));

      dialog.namespace.value = 'custom-namespace';

      const confirmButton = dialog.shadowRoot?.querySelector(
        '#confirm-btn'
      ) as HTMLElement;
      confirmButton.click();

      await waitUntil(() => {
        const snackbar = element.shadowRoot?.querySelector('oscd-snackbar');
        return (
          snackbar &&
          (snackbar as any).shadowRoot?.textContent?.includes(
            "Data Object 'TestDO' created successfully."
          )
        );
      });
      const snackbar = element.shadowRoot?.querySelector(
        'oscd-snackbar'
      ) as HTMLElement & { message?: string; type?: string };
      expect(snackbar).to.exist;
      expect(snackbar.shadowRoot?.textContent).to.include(
        "Data Object 'TestDO' created successfully."
      );
    });

    it('shows an error notification if Data Object creation fails', async () => {
      const dialog = element.createDOdialog;
      dialog.show();
      await waitUntil(() => dialog.open);

      dialog.doName.value = 'TestDO';
      dialog.cdcType.value = 'ACD';
      dialog.namespace.value = 'custom-namespace';

      const originalCreateDataObject = element['createDataObject'];
      element['createDataObject'] = () => {
        throw new Error('fail');
      };

      const confirmButton = dialog.shadowRoot?.querySelector(
        '#confirm-btn'
      ) as HTMLElement;
      confirmButton.click();

      // Wait up to 5 seconds for the snackbar to appear
      await waitUntil(
        () => {
          const snackbar = element.shadowRoot?.querySelector('oscd-snackbar');
          return (
            snackbar &&
            (snackbar as any).shadowRoot?.textContent?.includes(
              'Failed to create Data Object. Please try again.'
            )
          );
        },
        undefined,
        { timeout: 5000 }
      );
      const snackbar = element.shadowRoot?.querySelector(
        'oscd-snackbar'
      ) as HTMLElement & { message?: string; type?: string };
      expect(snackbar).to.exist;
      expect(snackbar.shadowRoot?.textContent).to.include(
        'Failed to create Data Object. Please try again.'
      );

      element['createDataObject'] = originalCreateDataObject;
    });
  });

  describe('given a loaded document', () => {
    let listener: SinonSpy;
    afterEach(restore);
    beforeEach(async () => {
      listener = spy();
      element.addEventListener('oscd-edit-v2', listener);
      element.doc = new DOMParser().parseFromString(
        sclDocString,
        'application/xml'
      );
      await element.updateComplete;
    });

    it('displays an action button', () => {
      expect(element.shadowRoot?.querySelector('md-fab')).to.exist;
    });

    it('adds Templates on action button click', async () => {
      (element.shadowRoot?.querySelector('md-fab') as HTMLElement).click();
      const descriptionDialog = element.descriptionDialog;
      descriptionDialog.show();
      await descriptionDialog.updateComplete;
      descriptionDialog.description.value = 'Test Description';

      const confirmButton = descriptionDialog.shadowRoot?.querySelector(
        '#confirm-button'
      ) as HTMLElement;
      confirmButton.click();
      /* expect five calls for
         - LPHD and its mandatory DOTypes
           - PhyHealth and its mandatory EnumType
             - stVal
           - PhyNam
           - Proxy
       */
      const edits = listener.args[0][0].detail.edit;
      expect(edits).to.have.lengthOf(5);
      edits.forEach((edit: any) => {
        expect(edit).to.have.property(
          'parent',
          element.doc?.querySelector('DataTypeTemplates')
        );
        expect(edit).to.have.property('node');
      });
    });

    it('adds missing DataTypeTemplates section on action button click', async () => {
      element.doc?.querySelector('DataTypeTemplates')?.remove();
      (element.shadowRoot?.querySelector('md-fab') as HTMLElement).click();

      const descriptionDialog = element.descriptionDialog;
      descriptionDialog.show();
      await descriptionDialog.updateComplete;
      descriptionDialog.description.value = 'Test Description';

      const confirmButton = descriptionDialog.shadowRoot?.querySelector(
        '#confirm-button'
      ) as HTMLElement;
      confirmButton.click();

      // expect one more call for the DTT section
      const edits = listener.args[0][0].detail.edit;
      expect(edits).to.have.lengthOf(6);
      expect(edits[0]).to.have.property('parent', element.doc?.documentElement);
      expect(edits[0])
        .property('node')
        .to.have.property('tagName', 'DataTypeTemplates');
    });

    it('adds LNodeTypes, DOTypes, DATypes, and EnumTypes as requested', async () => {
      element.lNodeType = 'LLN0';
      element.reset();
      await element.lNodeTypeUI?.updateComplete;
      await element.updateComplete;

      async function selectAll(column: number) {
        const item = element.treeUI.shadowRoot?.querySelector(
          `md-list:nth-of-type(${column + 1}) > md-list-item:first-of-type`
        ) as HTMLElement;
        item?.click();
        await element.treeUI.updateComplete;
        await element.updateComplete;
      }

      await selectAll(1);
      await selectAll(2);
      await selectAll(3);
      await selectAll(4);
      await selectAll(5);

      (element.shadowRoot?.querySelector('md-fab') as HTMLElement).click();
      const descriptionDialog = element.descriptionDialog;
      descriptionDialog.show();
      await descriptionDialog.updateComplete;
      descriptionDialog.description.value = 'Test Description';

      const confirmButton = descriptionDialog.shadowRoot?.querySelector(
        '#confirm-button'
      ) as HTMLElement;
      confirmButton.click();

      /* expect 30 calls for
        LNodeType LLN0
        DOType    Beh
                  Diag
                  GrRef
                  Health
                  InRef
                  LEDRs
                  Loc
                  LocKey
                  LocSta
                  MltLev
                  Mod
                  NamPlt
                  SwModKey
        DAType    origin
                  pulseConfig
                  SBOw
                  Oper
                  Cancel
                  SBOw
                  Oper
                  Cancel
        EnumType  stVal
                  subVal
                  orCat
                  cmdQual
                  ctlModel
                  sboClass
                  stVal
                  subVal
       */
      const edits = listener.args[0][0].detail.edit;
      expect(edits).to.have.lengthOf(30);
      const elms = edits.map((edit: { node: any }) => edit.node);
      expect(
        elms.filter((e: { tagName: string }) => e.tagName === 'LNodeType')
      ).to.have.lengthOf(1);
      expect(
        elms.filter((e: { tagName: string }) => e.tagName === 'DOType')
      ).to.have.lengthOf(13);
      expect(
        elms.filter((e: { tagName: string }) => e.tagName === 'DAType')
      ).to.have.lengthOf(8);
      expect(
        elms.filter((e: { tagName: string }) => e.tagName === 'EnumType')
      ).to.have.lengthOf(8);
    }).timeout(10000); // selecting 550 paths for a full LLN0 is rather slow.

    it('validates DOType inserts and IDs for multiple custom Data Objects', async () => {
      element.lNodeType = 'GGIO';
      element.reset();
      await element.lNodeTypeUI?.updateComplete;
      await element.updateComplete;

      expect(Object.keys(element.treeUI.tree)).to.have.lengthOf(38);

      const dataObjects = [
        { name: 'AnOut2', type: 'APC' },
        { name: 'CntVal2', type: 'BCR' },
        { name: 'DPCSO2', type: 'DPC' },
        { name: 'ISCSO2', type: 'INC' },
        { name: 'InRef2', type: 'ORG' },
        { name: 'SPCSO2', type: 'SPC' },
        { name: 'Ind2', type: 'SPS' },
      ];

      for (const { name, type } of dataObjects) {
        const dialog = element.createDOdialog;
        dialog.show();
        await waitUntil(() => dialog.open);

        const doNameInput = dialog.shadowRoot?.querySelector(
          '#do-name'
        ) as HTMLInputElement;
        doNameInput.value = name;
        doNameInput.dispatchEvent(new Event('input'));

        const cdcTypeSelect = dialog.shadowRoot?.querySelector(
          '#cdc-type'
        ) as HTMLSelectElement;
        cdcTypeSelect.value = type;
        cdcTypeSelect.dispatchEvent(new Event('input'));

        const confirmButton = dialog.shadowRoot?.querySelector(
          '#confirm-btn'
        ) as HTMLElement;
        confirmButton.click();

        await waitUntil(() => !dialog.open, undefined, { timeout: 5000 });
        await element.updateComplete;
        expect(element.treeUI.tree[name]).to.exist;
        expect(element.treeUI.tree[name]).to.have.property('type', type);
        expect(element.treeUI.tree[name]).to.have.property(
          'tagName',
          'DataObject'
        );
        expect(element.treeUI.tree[name]).to.have.property('descID', '');
        expect(element.treeUI.tree[name]).to.have.property('presCond', 'O');
        dialog.close();
      }

      expect(Object.keys(element.treeUI.tree)).to.have.lengthOf(45);

      element.treeUI.selection = lNodeSelection;
      const descriptionDialog = element.descriptionDialog;
      descriptionDialog.show();
      await descriptionDialog.updateComplete;
      descriptionDialog.description.value = 'Test Description';

      const confirmButton = descriptionDialog.shadowRoot?.querySelector(
        '#confirm-button'
      ) as HTMLElement;
      confirmButton.click();
      await element.updateComplete;

      const inserts = listener.args[0][0].detail.edit;
      const insertedDOs = inserts.filter(
        (insert: Insert) => (insert.node as Element).tagName === 'DOType'
      );
      const expectedIds = [
        'Beh$oscd$_',
        ...dataObjects.map(({ name }) => `${name}$oscd$_`),
      ];

      insertedDOs.forEach((insert: Insert, idx: number) => {
        const id = (insert.node as Element).getAttribute('id');
        expect(id, `Insert ID at index ${idx} is incorrect`).to.include(
          expectedIds[idx]
        );
      });
    }).timeout(10000);
  });
});
