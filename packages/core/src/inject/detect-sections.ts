const MARKDOWN_HEADING = /^##\s+/;
const TOOLS_HEADING = /^##\s*tools\b/i;
const XML_TOOLS_OPEN = /<tools>/i;
const XML_TOOLS_CLOSE = /<\/tools>/i;
const TOOLS_SENTENCE = /you have access to/i;

export type SectionWindow = { start: number; end: number };

function findMarkdownToolsWindow(lines: string[]): SectionWindow | null {
  const start = lines.findIndex((line) => TOOLS_HEADING.test(line.trim()));
  if (start === -1) return null;

  for (let index = start + 1; index < lines.length; index += 1) {
    if (MARKDOWN_HEADING.test(lines[index].trim())) {
      return { start, end: index };
    }
  }
  return { start, end: lines.length };
}

function findXmlToolsWindow(lines: string[]): SectionWindow | null {
  const open = lines.findIndex((line) => XML_TOOLS_OPEN.test(line));
  if (open === -1) return null;

  const close = lines.findIndex((line, index) => index >= open && XML_TOOLS_CLOSE.test(line));
  if (close === -1) return { start: open, end: lines.length };
  return { start: open, end: close + 1 };
}

function findToolsSentenceWindow(lines: string[]): SectionWindow | null {
  const sentenceIndex = lines.findIndex((line) => TOOLS_SENTENCE.test(line));
  if (sentenceIndex === -1) return null;

  for (let index = sentenceIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "") {
      return { start: sentenceIndex, end: index + 1 };
    }
  }
  return { start: sentenceIndex, end: lines.length };
}

export function detectToolsSection(systemPrompt: string): SectionWindow | null {
  const lines = String(systemPrompt).split("\n");
  return (
    findXmlToolsWindow(lines) ??
    findMarkdownToolsWindow(lines) ??
    findToolsSentenceWindow(lines)
  );
}
