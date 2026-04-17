import Docker from 'dockerode';

let dockerInstance: Docker | null = null;

export function getDockerClient(): Docker {
  if (!dockerInstance) {
    dockerInstance = new Docker();
  }
  return dockerInstance;
}
