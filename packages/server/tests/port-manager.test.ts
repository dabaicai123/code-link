import { describe, it, expect, beforeEach } from 'vitest';
import { PortManager } from '../src/build/port-manager.ts';

describe('PortManager', () => {
  let manager: PortManager;

  beforeEach(() => {
    manager = new PortManager(30000, 40000);
  });

  it('should allocate a port', () => {
    const port = manager.allocatePort();
    expect(port).toBeGreaterThanOrEqual(30000);
    expect(port).toBeLessThanOrEqual(40000);
  });

  it('should not allocate the same port twice', () => {
    const port1 = manager.allocatePort();
    const port2 = manager.allocatePort();

    expect(port1).not.toBe(port2);
  });

  it('should release a port', () => {
    const port = manager.allocatePort();
    manager.releasePort(port);

    // 再次分配应该可能得到相同的端口
    const newPort = manager.allocatePort();
    expect(newPort).toBe(port);
  });

  it('should check if port is in use', () => {
    const port = manager.allocatePort();

    expect(manager.isPortInUse(port)).toBe(true);
    expect(manager.isPortInUse(30001)).toBe(false);
  });

  it('should get all allocated ports', () => {
    manager.allocatePort();
    manager.allocatePort();

    const ports = manager.getAllocatedPorts();
    expect(ports.size).toBe(2);
  });
});
