import * as api from '../../api';
import { LifecycleScope, createLifecycleDataLoader } from './lifecycleData';

jest.mock('../../api', () => ({
  getRelevantLifecycleSystems: jest.fn(),
  getAllLifecycleSystems: jest.fn(),
  getRelevantLifecycleAppstreams: jest.fn(),
  getAllLifecycleAppstreams: jest.fn(),
}));

describe('Lifecycle document cache', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    [
      api.getRelevantLifecycleSystems,
      api.getAllLifecycleSystems,
      api.getRelevantLifecycleAppstreams,
      api.getAllLifecycleAppstreams,
    ].forEach((fetch) => jest.mocked(fetch).mockResolvedValue({ data: [] }));
  });

  it.each<LifecycleScope>([8, 9, 10, 'rhel'])('loads only scope %s and retains empty responses', async (scope) => {
    const load = createLifecycleDataLoader();
    await load(scope);
    await load(scope);
    if (scope === 'rhel') {
      expect(api.getRelevantLifecycleSystems).toHaveBeenCalledTimes(1);
      expect(api.getAllLifecycleSystems).toHaveBeenCalledTimes(1);
      expect(api.getRelevantLifecycleAppstreams).not.toHaveBeenCalled();
      expect(api.getAllLifecycleAppstreams).not.toHaveBeenCalled();
    } else {
      expect(api.getRelevantLifecycleAppstreams).toHaveBeenCalledTimes(1);
      expect(api.getRelevantLifecycleAppstreams).toHaveBeenCalledWith(scope);
      expect(api.getAllLifecycleAppstreams).toHaveBeenCalledTimes(1);
      expect(api.getAllLifecycleAppstreams).toHaveBeenCalledWith(scope);
      expect(api.getRelevantLifecycleSystems).not.toHaveBeenCalled();
      expect(api.getAllLifecycleSystems).not.toHaveBeenCalled();
    }
  });

  it('shares pending requests, isolates majors and starts fresh for a new document', async () => {
    let resolve: (value: { data: [] }) => void = () => undefined;
    jest
      .mocked(api.getRelevantLifecycleAppstreams)
      .mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    const load = createLifecycleDataLoader();
    const first = load(9);
    const second = load(9);
    await load(8);
    expect(api.getRelevantLifecycleAppstreams).toHaveBeenCalledTimes(2);
    resolve({ data: [] });
    await Promise.all([first, second]);
    await load(9);
    expect(api.getRelevantLifecycleAppstreams).toHaveBeenCalledTimes(2);

    await createLifecycleDataLoader()(9);
    expect(api.getRelevantLifecycleAppstreams).toHaveBeenCalledTimes(3);
  });

  it('retries only the failed request and retains its successful partner', async () => {
    jest.mocked(api.getRelevantLifecycleAppstreams).mockRejectedValueOnce(new Error('temporary failure'));
    const load = createLifecycleDataLoader();
    await expect(load(8)).rejects.toThrow('temporary failure');
    await load(8);
    expect(api.getRelevantLifecycleAppstreams).toHaveBeenCalledTimes(2);
    expect(api.getAllLifecycleAppstreams).toHaveBeenCalledTimes(1);
    await load(8);
    expect(api.getRelevantLifecycleAppstreams).toHaveBeenCalledTimes(2);
  });
});
