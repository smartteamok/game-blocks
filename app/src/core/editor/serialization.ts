type BlocklyLike = {
  Xml: {
    workspaceToDom: (workspace: unknown) => Element;
    domToText: (xml: Element) => string;
    textToDom: (text: string) => Element;
    domToWorkspace: (xml: Element, workspace: unknown) => void;
  };
};

// Serializes a workspace to XML text for persistence.
export const workspaceToXmlText = (Blockly: BlocklyLike, workspace: unknown): string => {
  const xml = Blockly.Xml.workspaceToDom(workspace);
  return Blockly.Xml.domToText(xml);
};

// Loads XML text into a workspace, clearing previous blocks.
export const loadXmlTextIntoWorkspace = (
  Blockly: BlocklyLike,
  workspace: { clear?: () => void },
  xmlText: string
): void => {
  workspace.clear?.();
  const xml = Blockly.Xml.textToDom(xmlText);
  Blockly.Xml.domToWorkspace(xml, workspace);
};
