import 'reflect-metadata';
import { container } from 'tsyringe';
import { SocketServerService } from './socket-server.service.js';

export function registerSocketModule(): void {
  container.registerSingleton(SocketServerService);
}