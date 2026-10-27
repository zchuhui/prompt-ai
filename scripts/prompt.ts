import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function promptLine(label: string): Promise<string> {
  if (!stdin.isTTY) {
    throw new Error("请在交互式终端中运行");
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(label)).trim();
  } finally {
    rl.close();
  }
}

export function promptHidden(label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(new Error("密码必须通过交互式终端输入"));
      return;
    }
    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      if (chunk === "\u0003") {
        cleanup();
        reject(new Error("已取消"));
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        cleanup();
        stdout.write("\n");
        resolve(value);
        return;
      }
      if (chunk === "\u007f" || chunk === "\b") {
        value = value.slice(0, -1);
        return;
      }
      if (chunk.startsWith("\u001b")) {
        return;
      }
      value += chunk;
    };
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.removeListener("data", onData);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}

export function rejectArguments(): void {
  if (process.argv.length > 2) {
    throw new Error("不要通过命令参数传入用户名或密码");
  }
}
