export class PortManager {
  private minPort: number;
  private maxPort: number;
  private allocatedPorts: Set<number> = new Set();
  private nextPort: number;

  constructor(minPort: number = 30000, maxPort: number = 40000) {
    this.minPort = minPort;
    this.maxPort = maxPort;
    this.nextPort = minPort;
  }

  allocatePort(): number {
    // 从下一个可用端口开始查找
    for (let i = this.nextPort; i <= this.maxPort; i++) {
      if (!this.allocatedPorts.has(i)) {
        this.allocatedPorts.add(i);
        this.nextPort = i + 1;
        return i;
      }
    }

    // 从头开始查找
    for (let i = this.minPort; i < this.nextPort; i++) {
      if (!this.allocatedPorts.has(i)) {
        this.allocatedPorts.add(i);
        this.nextPort = i + 1;
        return i;
      }
    }

    throw new Error('No available ports');
  }

  releasePort(port: number): void {
    this.allocatedPorts.delete(port);
    // 如果释放的端口小于当前 nextPort，回退指针以便重用
    if (port < this.nextPort) {
      this.nextPort = port;
    }
  }

  isPortInUse(port: number): boolean {
    return this.allocatedPorts.has(port);
  }

  getAllocatedPorts(): Set<number> {
    return new Set(this.allocatedPorts);
  }
}

// 全局单例
let portManagerInstance: PortManager | null = null;

export function getPortManager(): PortManager {
  if (!portManagerInstance) {
    portManagerInstance = new PortManager();
  }
  return portManagerInstance;
}
