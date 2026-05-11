import Docker from 'dockerode';

let dockerClient: Docker | null = null;

export function getDockerClient(): Docker {
  if (!dockerClient) {
    dockerClient = new Docker({ socketPath: '/var/run/docker.sock' });
  }
  return dockerClient;
}

export async function getContainerStatus(containerName: string): Promise<'running' | 'stopped' | 'not_found'> {
  try {
    const docker = getDockerClient();
    const container = docker.getContainer(containerName);
    const data = await container.inspect();
    
    if (data.State.Running) {
      return 'running';
    } else {
      return 'stopped';
    }
  } catch (error: any) {
    if (error.statusCode === 404) {
      return 'not_found';
    }
    console.error(`Error checking container ${containerName}:`, error);
    return 'not_found';
  }
}

export async function startContainer(containerName: string): Promise<boolean> {
  try {
    const docker = getDockerClient();
    const container = docker.getContainer(containerName);
    await container.start();
    return true;
  } catch (error) {
    console.error(`Error starting container ${containerName}:`, error);
    return false;
  }
}

export async function restartContainer(containerName: string): Promise<boolean> {
  try {
    const docker = getDockerClient();
    const container = docker.getContainer(containerName);
    await container.restart();
    return true;
  } catch (error) {
    console.error(`Error restarting container ${containerName}:`, error);
    return false;
  }
}

export async function getAllContainers(): Promise<Array<{ id: string; name: string; status: string }>> {
  try {
    const docker = getDockerClient();
    const containers = await docker.listContainers({ all: true });
    return containers.map((c: any) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') || 'unknown',
      status: c.Status,
    }));
  } catch (error) {
    console.error('Error listing containers:', error);
    return [];
  }
}
