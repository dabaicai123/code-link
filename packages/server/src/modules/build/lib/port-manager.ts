import { singleton } from 'tsyringe';

@singleton()
export class PortManager {
  private minPort: number;
  private maxPort: number;
  private allocatedPorts: Set<number> = new Set();
  private nextPort: number;

  /**
   * Creates a new PortManager instance.
   * @param minPort - The minimum port number (inclusive, default: 30000)
   * @param maxPort - The maximum port number (inclusive, default: 40000)
   * @throws Error if minPort >= maxPort
   */
  constructor(minPort: number = 30000, maxPort: number = 40000) {
    if (minPort >= maxPort) {
      throw new Error('minPort must be less than maxPort');
    }
    this.minPort = minPort;
    this.maxPort = maxPort;
    this.nextPort = minPort;
  }

  /**
   * Allocates an available port from the pool.
   * @returns The allocated port number
   * @throws Error if no ports are available
   */
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

  /**
   * Releases a previously allocated port.
   * @param port - The port number to release
   * @throws Error if port is out of valid range
   */
  releasePort(port: number): void {
    if (port < this.minPort || port > this.maxPort) {
      throw new Error(`Port ${port} is out of valid range [${this.minPort}, ${this.maxPort}]`);
    }
    this.allocatedPorts.delete(port);
    // 如果释放的端口小于当前 nextPort，回退指针以便重用
    if (port < this.nextPort) {
      this.nextPort = port;
    }
  }

  /**
   * Checks if a port is currently allocated.
   * @param port - The port number to check
   * @returns true if the port is in use, false otherwise
   */
  isPortInUse(port: number): boolean {
    return this.allocatedPorts.has(port);
  }

  /**
   * Gets a copy of all currently allocated ports.
   * @returns A Set containing all allocated port numbers
   */
  getAllocatedPorts(): Set<number> {
    return new Set(this.allocatedPorts);
  }
}

