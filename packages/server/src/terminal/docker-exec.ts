import Docker from 'dockerode';
import { PassThrough, Transform, TransformCallback } from 'stream';
import { getDockerClient } from '../docker/client.js';

export interface ExecSession {
  exec: Docker.Exec;
  execId: string;
  stream: NodeJS.ReadableStream;
}

export interface ExecOptions {
  interactive?: boolean;
  env?: string[];
  cwd?: string;
  user?: string;
}

/**
 * Docker 多路复用流解析器
 * Docker stream 格式: [type(1byte), padding(3bytes), size(4bytes), payload...]
 */
export class DockerStreamDemuxer extends Transform {
  private buffer: Buffer = Buffer.alloc(0);
  private static readonly HEADER_SIZE = 8;

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this._processBuffer();
    callback();
  }

  _flush(callback: TransformCallback): void {
    this._processBuffer();
    callback();
  }

  private _processBuffer(): void {
    while (this.buffer.length >= DockerStreamDemuxer.HEADER_SIZE) {
      const type = this.buffer[0];
      // 跳过 padding (bytes 1-3)
      // 读取 payload 大小 (bytes 4-7, big-endian)
      const size = this.buffer.readUInt32BE(4);

      const totalFrameSize = DockerStreamDemuxer.HEADER_SIZE + size;

      if (this.buffer.length < totalFrameSize) {
        // 数据不完整，等待更多数据
        break;
      }

      const payload = this.buffer.slice(DockerStreamDemuxer.HEADER_SIZE, totalFrameSize);
      this.buffer = this.buffer.slice(totalFrameSize);

      // type: 0=stdin, 1=stdout, 2=stderr
      this.push({
        type: type as 0 | 1 | 2,
        data: payload,
      });
    }
  }
}

/**
 * 创建 exec 实例
 * @param containerId 容器 ID
 * @param cmd 要执行的命令
 * @param interactive 是否交互模式（PTY）
 */
export async function createExecSession(
  containerId: string,
  cmd: string[],
  interactive: boolean = false,
  options: ExecOptions = {}
): Promise<Docker.Exec> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdin: interactive,
    AttachStdout: true,
    AttachStderr: true,
    Tty: interactive, // PTY 模式
    Env: options.env,
    WorkingDir: options.cwd,
    User: options.user,
  });

  return exec;
}

/**
 * 启动 exec 并获取流
 * @param containerId 容器 ID
 * @param cmd 要执行的命令
 * @param interactive 是否交互模式
 * @returns exec 实例和 stream
 */
export async function streamExecOutput(
  containerId: string,
  cmd: string[],
  interactive: boolean = false,
  options: ExecOptions = {}
): Promise<ExecSession> {
  const exec = await createExecSession(containerId, cmd, interactive, options);
  const execId = exec.id;

  const stream = await exec.start({
    Detach: false,
    Tty: interactive,
    stdin: interactive,
    hijack: interactive, // 交互模式使用 hijack 以支持 stdin
  });

  return { exec, execId, stream };
}

/**
 * 调整 TTY 大小
 * @param execId exec 实例 ID
 * @param cols 列数
 * @param rows 行数
 */
export async function resizeExecTTY(
  exec: Docker.Exec,
  cols: number,
  rows: number
): Promise<void> {
  await exec.resize({
    h: rows,
    w: cols,
  });
}

/**
 * 将输入写入 exec stream
 * @param stream exec stream
 * @param data 要写入的数据
 */
export function writeToExecStream(stream: NodeJS.WritableStream, data: string | Buffer): void {
  stream.write(data);
}

/**
 * 关闭 exec stream 的 stdin
 * @param stream exec stream
 */
export function closeExecStdin(stream: NodeJS.WritableStream): void {
  if (stream.writable) {
    stream.end();
  }
}

/**
 * 获取 exec 实例信息
 * @param containerId 容器 ID
 * @param execId exec 实例 ID
 */
export async function getExecInfo(
  containerId: string,
  execId: string
): Promise<Docker.ExecInspectInfo> {
  const docker = getDockerClient();
  const exec = docker.getExec(execId);
  return exec.inspect();
}

/**
 * 执行简单命令并获取输出（非交互式）
 * @param containerId 容器 ID
 * @param cmd 命令
 * @returns stdout, stderr, exitCode
 */
export async function execSimple(
  containerId: string,
  cmd: string[],
  options: ExecOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const { exec, stream } = await streamExecOutput(containerId, cmd, false, options);

  return new Promise((resolve, reject) => {
    const demuxer = new DockerStreamDemuxer();
    let stdout = '';
    let stderr = '';

    stream.pipe(demuxer);

    demuxer.on('data', (frame: { type: number; data: Buffer }) => {
      const content = frame.data.toString();
      if (frame.type === 1) {
        stdout += content;
      } else if (frame.type === 2) {
        stderr += content;
      }
    });

    stream.on('error', reject);

    stream.on('end', async () => {
      try {
        const info = await exec.inspect();
        resolve({ stdout, stderr, exitCode: info.ExitCode });
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * 带用户环境变量的 exec 创建
 * @param containerId 容器 ID
 * @param cmd 命令
 * @param interactive 是否交互模式
 * @param userEnv 用户环境变量对象
 * @returns exec session
 */
export async function execWithUserEnv(
  containerId: string,
  cmd: string[],
  interactive: boolean = false,
  userEnv: Record<string, string> = {}
): Promise<ExecSession> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);

  // 合并基础环境变量和用户环境变量
  const env = [
    'TERM=xterm-256color',
    ...Object.entries(userEnv)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}=${value}`),
  ];

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdin: interactive,
    AttachStdout: true,
    AttachStderr: true,
    Tty: interactive,
    Env: env,
    User: 'codelink',
  });

  const stream = await exec.start({
    Detach: false,
    Tty: interactive,
    stdin: interactive,
    hijack: interactive,
  });

  return { exec, execId: exec.id, stream };
}
