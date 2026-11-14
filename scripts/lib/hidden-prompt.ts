import readline from "node:readline";

// A terminal prompt that never echoes what is typed or pasted (for secrets).
export function hiddenPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const lines: string[] = [];
  const waiting: ((line: string) => void)[] = [];
  rl.on("line", (line) => {
    const next = waiting.shift();
    if (next) next(line);
    else lines.push(line);
  });
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
  const ask = (question: string): Promise<string> => {
    process.stdout.write(question);
    const done = (answer: string) => {
      process.stdout.write("\n");
      return answer.trim();
    };
    const ready = lines.shift();
    if (ready !== undefined) return Promise.resolve(done(ready));
    return new Promise((resolve) => waiting.push((line) => resolve(done(line))));
  };
  return { ask, close: () => rl.close() };
}
