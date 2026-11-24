import {
  getAllLifecycleAppstreams,
  getAllLifecycleSystems,
  getRelevantLifecycleAppstreams,
  getRelevantLifecycleSystems,
} from '../../api';
import { Stream } from '../../types/Stream';
import { SystemLifecycleChanges } from '../../types/SystemLifecycleChanges';

export type LifecycleScope = 'rhel' | 8 | 9 | 10;

export interface LifecycleData {
  relevantSystems: SystemLifecycleChanges[];
  allSystems: SystemLifecycleChanges[];
  relevantApps: Stream[];
  allApps: Stream[];
}

export const createLifecycleDataLoader = () => {
  const requests = new Map<string, Promise<unknown>>();

  const cached = <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const existing = requests.get(key);
    if (existing) return existing as Promise<T>;

    const request = Promise.resolve()
      .then(load)
      .catch((error) => {
        requests.delete(key);
        throw error;
      });
    requests.set(key, request);
    return request;
  };

  return async (scope: LifecycleScope): Promise<LifecycleData> => {
    if (scope === 'rhel') {
      const [relevantSystems, allSystems] = await Promise.all([
        cached<SystemLifecycleChanges[]>(
          'rhel-relevant',
          async () => (await getRelevantLifecycleSystems()).data || []
        ),
        cached<SystemLifecycleChanges[]>('rhel-all', async () => (await getAllLifecycleSystems()).data || []),
      ]);
      return { relevantSystems, allSystems, relevantApps: [], allApps: [] };
    }

    const [relevantApps, allApps] = await Promise.all([
      cached<Stream[]>(
        `appstream-${scope}-relevant`,
        async () => (await getRelevantLifecycleAppstreams(scope)).data || []
      ),
      cached<Stream[]>(`appstream-${scope}-all`, async () => (await getAllLifecycleAppstreams(scope)).data || []),
    ]);
    return { relevantSystems: [], allSystems: [], relevantApps, allApps };
  };
};

// One cache per browser document, including SPA navigation away and back.
// Successful and pending requests are reused until a full page reload.
export const loadLifecycleData = createLifecycleDataLoader();
