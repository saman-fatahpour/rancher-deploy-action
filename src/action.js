const { default: fetch } = require('node-fetch');

(async () => {
  const rancherAccessKey = process.env['RANCHER_ACCESS_KEY'];
  const rancherSecretKey = process.env['RANCHER_SECRET_KEY'];
  const rancherUrlApi = process.env['RANCHER_URL_API'];
  const dockerImage = process.env['DOCKER_IMAGE'];
  const serviceName =process.env['SERVICE_NAME'];

  const token = Buffer.from(rancherAccessKey + ':' + rancherSecretKey).toString('base64')
  const headers = { Authorization: 'Basic ' + token }

  async function fetchProjectsAsync() {
    const req = await fetch(`${rancherUrlApi}/projects`, {
      method: 'GET',
      headers,
    })

    return req.json()
  }

  async function fetchProjectWorkloadsAsync(projectId) {
    const req = await fetch(`${rancherUrlApi}/projects/${projectId}/workloads`, {
      method: 'GET',
      headers,
    })

    return req.json()
  }

  async function changeImageAsync(workloadURL, namespaceId) {
    const req = await fetch(workloadURL, { method: 'GET', headers })
    if (req.status === 404) {
      const data = {
        containers: [
          {
            image: dockerImage,
            imagePullPolicy: 'Always',
            name: serviceName,
          },
        ],
        namespaceId,
        name: serviceName,
      }

      await fetch(workloadURL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      })
    } else {
      const data = await req.json()
      data.containers[0].image = dockerImage

      await fetch(workloadURL + '?action=redeploy', {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      })
    }
  }

  const { data: projects } = await fetchProjectsAsync()
  for (const project of projects) {
    const { data: workloads } = await fetchProjectWorkloadsAsync(project.id)
    const workload = workloads.find(({ name }) => name === serviceName)
    if (workload) {
      const { links, namespaceId } = workload
      await changeImageAsync(links.self, namespaceId)

      return
    }
  }
})().catch(console.error)
