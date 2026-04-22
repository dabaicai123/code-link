export interface ContainerStatus {
  containerId: string;
  status: string;
}

export interface ContainerStartResult {
  containerId: string;
  status: string;
}

export interface ContainerStopResult {
  containerId: string;
  status: string;
}