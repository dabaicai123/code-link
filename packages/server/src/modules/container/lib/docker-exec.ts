import type Docker from 'dockerode';
import { PassThrough, Transform, TransformCallback } from 'stream';

let dockerInstance: Docker | null = null;

export function setDockerClient(client: Docker): void {
  dockerInstance = client;
}

function getDockerClient(): Docker {
  return dockerInstance!;
}

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
      const size = this.buffer.readUInt32BE(4);

      const totalFrameSize = DockerStreamDemuxer.HEADER_SIZE + size;

      if (this.buffer.length < totalFrameSize) {
        break;
      }

      const payload = this.buffer.slice(DockerStreamDemuxer.HEADER_SIZE, totalFrameSize);
      this.buffer = this.buffer.slice(totalFrameSize);

      this.push({
        type: type as 0 | 1 | 2,
        data: payload,
      });
    }
  }
}

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
    Tty: interactive,
    Env: options.env,
    WorkingDir: options.cwd,
    User: options.user,
  });

  return exec;
}

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
    hijack: interactive,
  });

  return { exec, execId, stream };
}

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

export function writeToExecStream(stream: NodeJS.WritableStream, data: string | Buffer): void {
  stream.write(data);
}

export function closeExecStdin(stream: NodeJS.WritableStream): void {
  if (stream.writable) {
    stream.end();
  }
}

export async function getExecInfo(
  containerId: string,
  execId: string
): Promise<Docker.ExecInspectInfo> {
  const docker = getDockerClient();
  const exec = docker.getExec(execId);
  return exec.inspect();
}

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

export async function execWithUserEnv(
  containerId: string,
  cmd: string[],
  interactive: boolean = false,
  userEnv: Record<string, string> = {}
): Promise<ExecSession> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);

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