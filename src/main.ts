import * as core from '@actions/core';

import { getInputs } from './context';
import Rancher from './rancher';

(async () => {
  const { rancher, dockerImage, serviceName, namespaceId } = await getInputs();

  const client = new Rancher(rancher.urlApi, rancher.accessKey, rancher.secretKey);

  const { data: projects } = await client.fetchProjectsAsync();
  for (const project of projects) {
    const { data: workloads } = await client.fetchProjectWorkloadsAsync(project);
    const workload = workloads.find(({ name, namespaceId: nsId }) => name === serviceName && (!namespaceId || namespaceId === nsId));
    if (workload) {
      const result = await client.changeImageAsync(workload, {
        name: serviceName,
        image: dockerImage
      });

      core.info(`Image changed for ${result.id}`);
      return;
    }
  }

  if (namespaceId) {
    throw new Error(`Couldn't found workload "${serviceName}" in namespace "${namespaceId}"`);
  } else {
    throw new Error(`Couldn't found workload "${serviceName}"`);
  }
})().catch(err => {
  core.setFailed(err.message);
});
