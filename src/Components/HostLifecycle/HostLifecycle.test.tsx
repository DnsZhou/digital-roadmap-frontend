import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HostLifecycle from './HostLifecycle';
import * as api from '../../api';

jest.mock('../../api', () => ({
  getRelevantLifecycleSystems: jest.fn(),
  getRelevantLifecycleAppstreams: jest.fn(),
  ApiError: class ApiError extends Error {
    status_code?: number;
    constructor(message: string, status_code?: number) {
      super(message);
      this.name = 'ApiError';
      this.status_code = status_code;
    }
  },
}));

jest.mock('../../utils/utils', () => ({
  formatDate: jest.fn((date) => date || 'N/A'),
}));

const HOST_ID = '12345678-abcd-1234-abcd-123456789abc';

const mockSystemsResponse = {
  meta: { total: 2, count: 2 },
  data: [
    {
      name: 'RHEL',
      display_name: 'RHEL 9.4',
      major: 9,
      minor: 4,
      start_date: '2024-04-30',
      end_date: '2026-04-30',
      support_status: 'Supported',
      count: 5,
      lifecycle_type: 'mainline',
      related: false,
      systems_detail: [
        { id: HOST_ID, display_name: 'my-test-host.example.com' },
        { id: 'other-host-id', display_name: 'other-host.example.com' },
      ],
    },
    {
      name: 'RHEL',
      display_name: 'RHEL 8.9',
      major: 8,
      minor: 9,
      start_date: '2023-11-14',
      end_date: '2024-05-31',
      support_status: 'Retired',
      count: 3,
      lifecycle_type: 'mainline',
      related: false,
      systems_detail: [
        { id: 'different-host-id', display_name: 'another-host.example.com' },
      ],
    },
  ],
};

const mockAppStreamsResponse = {
  meta: { total: 1, count: 1 },
  data: [
    {
      name: 'nodejs',
      display_name: 'nodejs:20',
      os_major: 9,
      os_minor: 4,
      os_lifecycle: 'mainline',
      start_date: '2024-04-30',
      end_date: '2026-04-30',
      support_status: 'Supported',
      count: 2,
      application_stream_name: 'nodejs',
      rolling: false,
      related: false,
      systems_detail: [
        { id: HOST_ID, display_name: 'my-test-host.example.com' },
      ],
    },
  ],
};

const mockedApi = api as jest.Mocked<typeof api>;

describe('HostLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a loading spinner initially', () => {
    mockedApi.getRelevantLifecycleSystems.mockReturnValue(new Promise(() => {}));
    mockedApi.getRelevantLifecycleAppstreams.mockReturnValue(new Promise(() => {}));

    render(<HostLifecycle inventoryId={HOST_ID} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders RHEL lifecycle data for the matching host', async () => {
    mockedApi.getRelevantLifecycleSystems.mockResolvedValue(mockSystemsResponse);
    mockedApi.getRelevantLifecycleAppstreams.mockResolvedValue(mockAppStreamsResponse);

    render(<HostLifecycle inventoryId={HOST_ID} />);

    await waitFor(() => {
      expect(screen.getByText('RHEL Lifecycle')).toBeInTheDocument();
    });

    expect(screen.getByText('RHEL 9.4')).toBeInTheDocument();
    expect(screen.getAllByText('Supported').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('mainline')).toBeInTheDocument();
  });

  it('renders app stream data for the matching host', async () => {
    mockedApi.getRelevantLifecycleSystems.mockResolvedValue(mockSystemsResponse);
    mockedApi.getRelevantLifecycleAppstreams.mockResolvedValue(mockAppStreamsResponse);

    render(<HostLifecycle inventoryId={HOST_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Application Streams')).toBeInTheDocument();
    });

    expect(screen.getByText('nodejs:20')).toBeInTheDocument();
  });

  it('renders empty state when host is not found in lifecycle data', async () => {
    mockedApi.getRelevantLifecycleSystems.mockResolvedValue(mockSystemsResponse);
    mockedApi.getRelevantLifecycleAppstreams.mockResolvedValue({ meta: { total: 0, count: 0 }, data: [] });

    render(<HostLifecycle inventoryId="nonexistent-host-id" />);

    await waitFor(() => {
      expect(screen.getByText('No lifecycle data available')).toBeInTheDocument();
    });
  });

  it('renders error state when both API calls fail', async () => {
    mockedApi.getRelevantLifecycleSystems.mockRejectedValue(new Error('Network error'));
    mockedApi.getRelevantLifecycleAppstreams.mockRejectedValue(new Error('Network error'));

    render(<HostLifecycle inventoryId={HOST_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load lifecycle data')).toBeInTheDocument();
    });
  });

  it('renders partial data when only systems call succeeds', async () => {
    mockedApi.getRelevantLifecycleSystems.mockResolvedValue(mockSystemsResponse);
    mockedApi.getRelevantLifecycleAppstreams.mockRejectedValue(new Error('fail'));

    render(<HostLifecycle inventoryId={HOST_ID} />);

    await waitFor(() => {
      expect(screen.getByText('RHEL Lifecycle')).toBeInTheDocument();
    });

    expect(screen.getByText('RHEL 9.4')).toBeInTheDocument();
    expect(screen.queryByText('Application Streams')).not.toBeInTheDocument();
  });

  it('renders 403 error message for permission denied', async () => {
    const permError = new api.ApiError('Forbidden', 403);
    mockedApi.getRelevantLifecycleSystems.mockRejectedValue(permError);
    mockedApi.getRelevantLifecycleAppstreams.mockRejectedValue(permError);

    render(<HostLifecycle inventoryId={HOST_ID} />);

    await waitFor(() => {
      expect(screen.getByText(/do not have permission/)).toBeInTheDocument();
    });
  });

  it('filters correctly and does not show RHEL versions the host is not on', async () => {
    mockedApi.getRelevantLifecycleSystems.mockResolvedValue(mockSystemsResponse);
    mockedApi.getRelevantLifecycleAppstreams.mockResolvedValue({ meta: { total: 0, count: 0 }, data: [] });

    render(<HostLifecycle inventoryId={HOST_ID} />);

    await waitFor(() => {
      expect(screen.getByText('RHEL 9.4')).toBeInTheDocument();
    });

    expect(screen.queryByText('RHEL 8.9')).not.toBeInTheDocument();
  });
});
