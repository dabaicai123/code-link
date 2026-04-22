import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { PortManager } from '../src/modules/build/lib/port-manager.ts';

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

  // 端口耗尽测试
  it('should throw error when all ports are exhausted', () => {
    const smallManager = new PortManager(30000, 30002);
    smallManager.allocatePort(); // 30000
    smallManager.allocatePort(); // 30001
    smallManager.allocatePort(); // 30002

    expect(() => smallManager.allocatePort()).toThrow('No available ports');
  });

  // 构造函数验证测试
  it('should throw error when minPort >= maxPort', () => {
    expect(() => new PortManager(40000, 40000)).toThrow('minPort must be less than maxPort');
    expect(() => new PortManager(40001, 40000)).toThrow('minPort must be less than maxPort');
  });

  // releasePort 输入验证测试
  it('should throw error when releasing port out of valid range', () => {
    expect(() => manager.releasePort(29999)).toThrow('Port 29999 is out of valid range');
    expect(() => manager.releasePort(40001)).toThrow('Port 40001 is out of valid range');
  });

  // 自定义端口范围测试
  it('should work with custom port range', () => {
    const customManager = new PortManager(50000, 50010);
    const port = customManager.allocatePort();
    expect(port).toBeGreaterThanOrEqual(50000);
    expect(port).toBeLessThanOrEqual(50010);
  });
});
