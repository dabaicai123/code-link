import type Docker from 'dockerode';

export interface IDockerService {
  createProjectContainer(projectId: number, templateType: string, volumePath: string): Promise<string>;
  startContainer(containerId: string): Promise<void>;
  stopContainer(containerId: string): Promise<void>;
  removeContainer(containerId: string): Promise<void>;
  getContainerStatus(containerId: string): Promise<string>;
  getProjectContainer(projectId: number): Promise<Docker.Container | null>;
  execInContainer(containerId: string, command: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  volumeExists(projectId: number): Promise<boolean>;
  createProjectVolume(projectId: number): Promise<string>;
  removeProjectVolume(projectId: number): Promise<void>;
  cleanupTestContainers(): Promise<void>;
}