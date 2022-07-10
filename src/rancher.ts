import fetch from 'node-fetch';

type DeploymentConfig = {
  image: string;
  name: string;
};

type WorkloadActions = {
  redeploy: string;
  pause?: string;
  resume?: string;
  rollback?: string;
};

type WorkloadLinks = {
  remove: string;
  revisions: string;
  self: string;
  update: string;
  yaml: string;
};

type Container = {
  image: string;
  imagePullPolicy: 'Always';
  name: string;
};

type Workload = {
  id: string;
  actions: WorkloadActions;
  baseType: 'workload';
  containers: Container[];
  created: string;
  links: WorkloadLinks;
  name: string;
  namespaceId: string;
  paused: boolean;
  projectId: string;
};

type ProjectLinks = {
  workloads: string;
};

type Project = {
  id: string;
  name: string;
  namespaceId: string | null;
  links: ProjectLinks;
};

class Rancher {
  private readonly headers: any;

  constructor(private readonly rancherUrlApi: string, rancherAccessKey: string, rancherSecretKey: string) {
    const token = Buffer.from(rancherAccessKey + ':' + rancherSecretKey).toString('base64');
    this.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + token,
    };
  }

  async fetchProjectsAsync() {
    const req = await fetch(`${this.rancherUrlApi}/projects`, {
      method: 'GET',
      headers: this.headers
    });

    return req.json() as Promise<{
      data: Project[];
    }>;
  }

  async fetchProjectWorkloadsAsync(project: Project) {
    const { links } = project;
    const req = await fetch(links.workloads, {
      method: 'GET',
      headers: this.headers
    });

    return req.json() as Promise<{
      data: Workload[];
    }>;
  }

  async changeImageAsync(wl: Workload, config: DeploymentConfig): Promise<Workload> {
    const { links } = wl;

    const req = await fetch(links.self, { method: 'GET', headers: this.headers });
    if (req.status === 404) {
      const data = {
        containers: [
          {
            ...config,
            imagePullPolicy: 'Always'
          }
        ],
        name: config.name,
        namespaceId: wl.namespaceId
      };

      const req2 = await fetch(links.update, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data)
      });

      return req2.json() as Promise<Workload>;
    } else {
      const data: any = await req.json();
      data.containers[0].image = config.image;

      const { actions } = data;

      //due to a bug in rancher when redeploying, imagePullSecrets is removed and image pull from private repo is failed with error: Imagepullbackoff, if we do redeploy action two times it will save imagePullSecrets again from the initial parsed object
      await fetch(actions.redeploy, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(data)
      });

      const req2 = await fetch(actions.redeploy, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(data)
      });

      return req2.json() as Promise<Workload>;
    }
  }
}

export default Rancher;
