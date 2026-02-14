export type OutputWriter = {
  write(chunk: string): unknown;
  isTTY?: boolean;
};

export type CommandIO = {
  stdin: NodeJS.ReadStream;
  stdout: OutputWriter;
  stderr: OutputWriter;
  cwd(): string;
};
