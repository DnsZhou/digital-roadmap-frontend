import axios from 'axios';
import {
  ApiError,
  getAllLifecycleAppstreams,
  getAppStreamSystems,
  getRelevantLifecycleAppstreams,
  getRhelSystems,
  getUpcomingSystems,
} from './api';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockSystemsResponse = {
  status: 200,
  data: {
    meta: { count: 2, total: 10 },
    data: [
      { id: 'uuid-1', display_name: 'host-1', os_major: 9, os_minor: 2 },
      { id: 'uuid-2', display_name: 'host-2', os_major: 9, os_minor: 2 },
    ],
  },
};

describe('Lifecycle AppStream list scope', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([8, 9, 10])('requests only major %i for counts and the static catalog', async (major) => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: { data: [] } });
    await getRelevantLifecycleAppstreams(major);
    await getAllLifecycleAppstreams(major);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      1,
      `/api/roadmap/v2/relevant/lifecycle/app-streams?related=true&major=${major}`,
      expect.any(Object)
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      2,
      `/api/roadmap/v2/lifecycle/app-streams/${major}/streams`,
      expect.any(Object)
    );
  });
});

describe('Systems API functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRhelSystems', () => {
    it('constructs correct URL with path params', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      await getRhelSystems(9, 2);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/api/roadmap/v2/relevant/lifecycle/rhel/9/2/systems',
        expect.any(Object)
      );
    });

    it('adds lifecycle_type param when not mainline', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      await getRhelSystems(8, 6, 'eus');

      const calledUrl = mockedAxios.get.mock.calls[0][0];
      expect(calledUrl).toContain('lifecycle_type=eus');
    });

    it('omits lifecycle_type param when mainline', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      await getRhelSystems(9, 2, 'mainline');

      const calledUrl = mockedAxios.get.mock.calls[0][0];
      expect(calledUrl).not.toContain('lifecycle_type');
    });

    it('includes pagination and search params', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      await getRhelSystems(9, 2, 'mainline', {
        offset: 10,
        limit: 20,
        search: 'server',
      });

      const calledUrl = mockedAxios.get.mock.calls[0][0];
      expect(calledUrl).toContain('offset=10');
      expect(calledUrl).toContain('limit=20');
      expect(calledUrl).toContain('search=server');
    });

    it('returns paginated response data', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      const result = await getRhelSystems(9, 2);

      expect(result.meta.total).toBe(10);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].display_name).toBe('host-1');
    });

    describe('unknown minor version', () => {
      it.each([null, 0])('keeps minor %s distinct and uses v2 pagination', async (minor) => {
        mockedAxios.get.mockResolvedValue(mockSystemsResponse);
        await getRhelSystems(9, minor, 'EUS', { offset: 10, limit: 20, search: 'SERVER', sort_order: 'desc' });
        const url = new URL(mockedAxios.get.mock.calls[0][0], 'http://localhost');
        expect(url.pathname).toBe(
          `/api/roadmap/v2/relevant/lifecycle/rhel/9${minor === null ? '' : '/0'}/systems`
        );
        expect(Object.fromEntries(url.searchParams)).toEqual({
          lifecycle_type: 'EUS',
          offset: '10',
          limit: '20',
          search: 'SERVER',
          sort_order: 'desc',
        });
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      });
      it('propagates authorization errors for unknown minor', async () => {
        mockedAxios.get.mockRejectedValue({ response: { data: { detail: 'Not authorized' }, status: 403 } });
        await expect(getRhelSystems(9, null)).rejects.toMatchObject({ name: 'ApiError', status_code: 403 });
      });
    });

    it('throws ApiError on server error with detail', async () => {
      mockedAxios.get.mockRejectedValue({
        response: { data: { detail: 'Not found' }, status: 404 },
      });

      await expect(getRhelSystems(99, 99)).rejects.toThrow(ApiError);
      await expect(getRhelSystems(99, 99)).rejects.toThrow('Not found');
    });

    it('throws ApiError on network error', async () => {
      mockedAxios.get.mockRejectedValue({
        message: 'Network Error',
      });

      await expect(getRhelSystems(9, 2)).rejects.toThrow(ApiError);
      await expect(getRhelSystems(9, 2)).rejects.toThrow('Network Error');
    });
  });

  describe('getAppStreamSystems', () => {
    it('encodes the exact parent identity, preserving null minor', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);
      const stream_id = JSON.stringify(['Node.js 22', 'Node.js 22', 8, null]);
      await getAppStreamSystems('nodejs', 8, null, { stream_id });
      const url = new URL(mockedAxios.get.mock.calls[0][0], 'http://localhost');
      expect(url.searchParams.get('stream_id')).toBe(stream_id);
      expect(url.searchParams.has('os_minor')).toBe(false);
    });

    it('constructs correct URL with required params', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      await getAppStreamSystems('nginx', 9);

      const calledUrl = mockedAxios.get.mock.calls[0][0];
      expect(calledUrl).toContain('/api/roadmap/v2/relevant/lifecycle/app-streams/systems');
      expect(calledUrl).toContain('name=nginx');
      expect(calledUrl).toContain('os_major=9');
    });

    it('includes os_minor when provided', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      await getAppStreamSystems('nginx', 9, 2);

      const calledUrl = mockedAxios.get.mock.calls[0][0];
      expect(calledUrl).toContain('os_minor=2');
    });

    it('omits os_minor when null', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      await getAppStreamSystems('nginx', 9, null);

      const calledUrl = mockedAxios.get.mock.calls[0][0];
      expect(calledUrl).not.toContain('os_minor');
    });

    it('includes pagination and search params', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      await getAppStreamSystems('nginx', 9, 0, {
        offset: 5,
        limit: 10,
        search: 'host',
      });

      const calledUrl = mockedAxios.get.mock.calls[0][0];
      expect(calledUrl).toContain('offset=5');
      expect(calledUrl).toContain('limit=10');
      expect(calledUrl).toContain('search=host');
    });

    it('throws ApiError on failure', async () => {
      mockedAxios.get.mockRejectedValue({
        response: { data: { detail: 'Server error' }, status: 500 },
      });

      await expect(getAppStreamSystems('nginx', 9)).rejects.toThrow(ApiError);
    });
  });

  describe('getUpcomingSystems', () => {
    it('constructs correct URL with required params', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      await getUpcomingSystems('Ruby 2.7 EOL', '9.0');

      const calledUrl = mockedAxios.get.mock.calls[0][0];
      expect(calledUrl).toContain('/api/roadmap/v2/relevant/upcoming-changes/systems');
      expect(calledUrl).toContain('name=Ruby+2.7+EOL');
      expect(calledUrl).toContain('release=9.0');
    });

    it('includes pagination and search params', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      await getUpcomingSystems('Ruby 2.7 EOL', '9.0', {
        offset: 0,
        limit: 50,
        search: 'prod',
      });

      const calledUrl = mockedAxios.get.mock.calls[0][0];
      expect(calledUrl).toContain('offset=0');
      expect(calledUrl).toContain('limit=50');
      expect(calledUrl).toContain('search=prod');
    });

    it('throws ApiError on failure', async () => {
      mockedAxios.get.mockRejectedValue({
        response: { data: { detail: 'Timeout' }, status: 504 },
      });

      await expect(getUpcomingSystems('Ruby 2.7 EOL', '9.0')).rejects.toThrow(ApiError);
    });
  });

  describe('DR_API base path', () => {
    it('uses v2 API prefix for all systems endpoints', async () => {
      mockedAxios.get.mockResolvedValue(mockSystemsResponse);

      await getRhelSystems(9, 2);
      expect(mockedAxios.get.mock.calls[0][0]).toMatch(/^\/api\/roadmap\/v2\//);

      await getAppStreamSystems('nginx', 9);
      expect(mockedAxios.get.mock.calls[1][0]).toMatch(/^\/api\/roadmap\/v2\//);

      await getUpcomingSystems('test', '9.0');
      expect(mockedAxios.get.mock.calls[2][0]).toMatch(/^\/api\/roadmap\/v2\//);
    });
  });
});
