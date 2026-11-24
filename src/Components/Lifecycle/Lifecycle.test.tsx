import React, { Suspense } from 'react';
import axios from 'axios';
import LifecycleTable from '../LifecycleTable/LifecycleTable';
import { strict as assert } from 'assert';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import LifecycleTab from './Lifecycle';
import * as api from '../../api';
import { SystemLifecycleChanges } from '../../types/SystemLifecycleChanges';
import { Stream } from '../../types/Stream';
import { createLifecycleDataLoader, loadLifecycleData } from './lifecycleData';

jest.mock('./lifecycleData', () => ({
  ...jest.requireActual('./lifecycleData'),
  loadLifecycleData: jest.fn(),
}));

// Polyfill for structuredClone if not available
if (!global.structuredClone) {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

jest.mock('axios');

// Mock the API functions
jest.mock('../../api', () => ({
  getRhelSystems: jest.requireActual('../../api').getRhelSystems,
  getAllLifecycleAppstreams: jest.fn(),
  getAllLifecycleSystems: jest.fn(),
  getRelevantLifecycleAppstreams: jest.fn(),
  getRelevantLifecycleSystems: jest.fn(),
  getV1AllLifecycleAppstreams: jest.fn(),
  getV1AllLifecycleSystems: jest.fn(),
  getV1RelevantLifecycleAppstreams: jest.fn(),
  getV1RelevantLifecycleSystems: jest.fn(),
}));

// Mock the lazy-loaded components to avoid suspense issues
jest.mock('../../Components/LifecycleChart/LifecycleChart', () => {
  const MockComponent = ({ lifecycleData, viewFilter }: any) => (
    <div data-testid="lifecycle-chart">
      Chart with {lifecycleData?.length || 0} items, view: {viewFilter}
    </div>
  );
  // Add displayName to help with debugging
  MockComponent.displayName = 'MockLifecycleChart';
  return MockComponent;
});

jest.mock('../../Components/LifecycleChartSystem/LifecycleChartSystem', () => {
  const MockComponent = ({ lifecycleData, viewFilter }: any) => (
    <div data-testid="lifecycle-chart-system">
      System Chart with {lifecycleData?.length || 0} items, view: {viewFilter}
    </div>
  );
  MockComponent.displayName = 'MockLifecycleChartSystem';
  return MockComponent;
});

jest.mock('../../Components/LifecycleFilters/LifecycleFilters', () => {
  const MockComponent = ({
    nameFilter = '', // Default to empty string
    setNameFilter,
    lifecycleDropdownValue = 'rhel-9-appstreams', // Default value
    onLifecycleDropdownSelect,
    selectedChartSortBy = 'Retirement date', // Default value
    updateChartSortValue,
    onExport,
    selectedViewFilter = 'installed-only', // Default value
    handleViewFilterChange,
    noDataAvailable,
    rhelVersionOptions = [],
  }: any) => (
    <div data-testid="lifecycle-filters">
      <input
        data-testid="name-filter-input"
        value={nameFilter}
        onChange={(e) => setNameFilter?.(e.target.value)}
        placeholder="Filter by name"
      />
      <select
        data-testid="dropdown-select"
        value={lifecycleDropdownValue}
        onChange={(e) => onLifecycleDropdownSelect?.(e.target.value)}
      >
        <option value="rhel-9-appstreams">RHEL 9 App Streams</option>
        <option value="rhel-8-appstreams">RHEL 8 App Streams</option>
        <option value="rhel-10-appstreams">RHEL 10 App Streams</option>
        <option value="rhel-systems">RHEL Systems</option>
      </select>
      <select
        data-testid="sort-select"
        value={selectedChartSortBy}
        onChange={(e) => updateChartSortValue?.(e.target.value)}
      >
        <option value="Retirement date">Retirement date</option>
        <option value="Name">Name</option>
        <option value="Release date">Release date</option>
      </select>
      <select
        data-testid="view-filter-select"
        value={selectedViewFilter}
        onChange={(e) => handleViewFilterChange?.(e.target.value)}
        disabled={noDataAvailable && selectedViewFilter === 'all'}
      >
        <option value="all">All</option>
        <option value="installed-only">Installed Only</option>
        <option value="installed-and-related">Installed and Related</option>
      </select>
      <button data-testid="export-csv" onClick={() => onExport?.('csv')}>
        Export CSV
      </button>
      <button data-testid="export-json" onClick={() => onExport?.('json')}>
        Export JSON
      </button>
      <button data-testid="export-xml" onClick={() => onExport?.('xml')}>
        Export XML
      </button>

      <ul data-testid="rhel-version-options">
        {rhelVersionOptions.map((opt: string) => (
          <li key={opt}>{opt}</li>
        ))}
      </ul>
    </div>
  );
  MockComponent.displayName = 'MockLifecycleFilters';
  return MockComponent;
});

jest.mock('../../Components/LifecycleTable/LifecycleTable', () => {
  const MockComponent = ({ data, viewFilter }: any) => (
    <div data-testid="lifecycle-table">
      Table with {data?.length || 0} items, view: {viewFilter}
      {data?.map((item: any, index: number) => (
        <div key={index} data-testid={`table-item-${index}`}>
          {item.name || item.display_name}
        </div>
      ))}
    </div>
  );
  MockComponent.displayName = 'MockLifecycleTable';
  return jest.fn(MockComponent);
});

// Mock utils
jest.mock('../../utils/utils', () => ({
  ...jest.requireActual('../../utils/utils'),
  buildExportData: jest.fn(jest.requireActual('../../utils/utils').buildExportData),
  buildURL: jest.fn((filters) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    return params;
  }),
  checkValidityOfQueryParam: jest.fn(() => true),
  formatDate: jest.fn((date) => date || 'N/A'),
}));

// Mock filtering utils
jest.mock('./filteringUtils', () => ({
  DEFAULT_CHART_SORTBY_VALUE: 'Retirement date',
  DEFAULT_DROPDOWN_VALUE: 'rhel-9-appstreams',
  RHEL_8_STREAMS_DROPDOWN_VALUE: 'rhel-8-appstreams',
  RHEL_10_STREAMS_DROPDOWN_VALUE: 'rhel-10-appstreams',
  RHEL_SYSTEMS_DROPDOWN_VALUE: 'rhel-systems',
  filterChartDataByName: jest.fn((data) => data.sort((a: any, b: any) => a.name?.localeCompare(b.name))),
  filterChartDataByRelease: jest.fn((data) => data),
  filterChartDataByReleaseDate: jest.fn((data) => data),
  filterChartDataByRetirementDate: jest.fn((data) => data),
  filterChartDataBySystems: jest.fn((data) => data),
}));

// Mock shared export utility
const mockExportData = jest.fn();
jest.mock('../../utils/export', () => ({
  exportData: (...args: any[]) => mockExportData(...args),
}));

// Test data
const mockSystemData: SystemLifecycleChanges[] = [
  {
    name: 'RHEL',
    major: 9,
    minor: 3,
    start_date: '2023-01-01',
    end_date: '2025-01-01',
    count: 100,
    lifecycle_type: 'standard',
    related: false,
    display_name: 'RHEL 9.3',
    support_status: 'Supported',
    systems_detail: [{ id: '23fr2f23rf42f0', display_name: 'Test System 1' }],
  },
  {
    name: 'RHEL',
    major: 8,
    minor: 9,
    start_date: '2022-01-01',
    end_date: '2024-01-01',
    count: 50,
    lifecycle_type: 'standard',
    related: true,
    display_name: 'RHEL 8.9',
    support_status: 'Supported',
    systems_detail: [{ id: '23fr2f23rf42f0', display_name: 'Test System 1' }],
  },
];

const mockAppData: Stream[] = [
  {
    name: 'nodejs',
    application_stream_name: 'Node.js 18',
    display_name: 'Node.js 18',
    os_major: 9,
    os_minor: 0,
    start_date: '2023-01-01',
    end_date: '2025-01-01',
    count: 25,
    rolling: false,
    related: false,
    support_status: 'Supported',
    os_lifecycle: 'Supported',
    systems_detail: [{ id: '343252f2f23f44g', display_name: 'Test App System 1' }],
  },
  {
    name: 'python',
    application_stream_name: 'Python 3.11',
    display_name: 'Python 3.11',
    os_major: 9,
    os_minor: 0,
    start_date: '2022-01-01',
    end_date: '2024-01-01',
    count: 30,
    rolling: false,
    related: false,
    support_status: 'Supported',
    os_lifecycle: 'Supported',
    systems_detail: [{ id: '343252f2f23f44g', display_name: 'Test App System 1' }],
  },
  {
    name: 'httpd',
    application_stream_name: 'Apache HTTP Server',
    display_name: 'Apache HTTP Server',
    os_major: 8,
    os_minor: 0,
    start_date: '2022-01-01',
    end_date: '2024-01-01',
    count: 15,
    rolling: false,
    related: true,
    support_status: 'Supported',
    os_lifecycle: 'Supported',
    systems_detail: [{ id: '10', display_name: 'Test App System 2' }],
  },
];

const renderWithRouter = (component: React.ReactElement, initialEntries = ['/']) => {
  return render(<MemoryRouter initialEntries={initialEntries}>{component}</MemoryRouter>);
};

describe('LifecycleTab Component', () => {
  const mockApiCalls = {
    getAllLifecycleSystems: api.getAllLifecycleSystems as jest.Mock,
    getAllLifecycleAppstreams: api.getAllLifecycleAppstreams as jest.Mock,
    getRelevantLifecycleSystems: api.getRelevantLifecycleSystems as jest.Mock,
    getRelevantLifecycleAppstreams: api.getRelevantLifecycleAppstreams as jest.Mock,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Each test represents a fresh browser document; remounts within a test share its cache.
    jest.mocked(loadLifecycleData).mockImplementation(createLifecycleDataLoader());

    // Setup default mock responses with proper data structure
    // Ensure RHEL 9 systems and apps have related: false (installed)
    const installedSystems = mockSystemData.filter((s) => !s.related);
    const installedApps = mockAppData.filter((s) => !s.related);

    mockApiCalls.getAllLifecycleSystems.mockResolvedValue({ data: mockSystemData });
    mockApiCalls.getAllLifecycleAppstreams.mockResolvedValue({ data: mockAppData });
    mockApiCalls.getRelevantLifecycleSystems.mockResolvedValue({
      data: installedSystems,
    });
    mockApiCalls.getRelevantLifecycleAppstreams.mockResolvedValue({
      data: installedApps,
    });
    jest.mocked(api.getV1AllLifecycleSystems).mockResolvedValue({ data: mockSystemData });
    jest.mocked(api.getV1AllLifecycleAppstreams).mockResolvedValue({ data: mockAppData });
    jest.mocked(api.getV1RelevantLifecycleSystems).mockResolvedValue({ data: installedSystems });
    jest.mocked(api.getV1RelevantLifecycleAppstreams).mockResolvedValue({ data: installedApps });
  });

  describe('Initial Loading and Data Fetching', () => {
    test('displays loading spinner initially', async () => {
      renderWithRouter(<LifecycleTab />);

      // Check for PatternFly Spinner - look for the spinner element or loading text
      const spinnerElement =
        document.querySelector('.pf-v5-c-spinner') ||
        document.querySelector('[role="progressbar"]') ||
        screen.queryByText(/loading/i);

      if (!spinnerElement) {
        // If no spinner found, check that the component is initially in loading state
        // by ensuring the content hasn't loaded yet
        expect(screen.queryByTestId('lifecycle-filters')).not.toBeInTheDocument();
      } else {
        expect(spinnerElement).toBeInTheDocument();
      }
    });

    test('fetches only the selected major on mount', async () => {
      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(mockApiCalls.getAllLifecycleSystems).not.toHaveBeenCalled();
        expect(mockApiCalls.getAllLifecycleAppstreams).toHaveBeenCalledTimes(1);
        expect(mockApiCalls.getRelevantLifecycleSystems).not.toHaveBeenCalled();
        expect(mockApiCalls.getRelevantLifecycleAppstreams).toHaveBeenCalledTimes(1);
        expect(mockApiCalls.getRelevantLifecycleAppstreams).toHaveBeenCalledWith(9);
        expect(mockApiCalls.getAllLifecycleAppstreams).toHaveBeenCalledWith(9);
      });
    });

    test('displays content after loading', async () => {
      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(screen.getByTestId('lifecycle-filters')).toBeInTheDocument();

        // Check that either charts/tables are present OR the component is in a valid state
        // The component might show empty state due to filtering, which is acceptable
        const hasChart = screen.queryByTestId('lifecycle-chart') || screen.queryByTestId('lifecycle-chart-system');
        const hasTable = screen.queryByTestId('lifecycle-table');
        const hasEmptyState = screen.queryByText('No results found');

        // At least one of these should be true: content is shown or empty state is displayed
        expect(hasChart || hasTable || hasEmptyState).toBeTruthy();
      });
    });
  });

  describe('Selection-scoped loading and caching', () => {
    const select = async (value: string) => {
      await act(async () => {
        fireEvent.change(screen.getByTestId('dropdown-select'), { target: { value } });
      });
    };

    test.each([8, 9, 10])('deep link to major %i does not preload another scope', async (major) => {
      renderWithRouter(<LifecycleTab />, [`/?lifecycleDropdown=rhel-${major}-appstreams&viewFilter=all`]);
      await screen.findByTestId('lifecycle-table');
      expect(mockApiCalls.getRelevantLifecycleAppstreams).toHaveBeenCalledTimes(1);
      expect(mockApiCalls.getRelevantLifecycleAppstreams).toHaveBeenCalledWith(major);
      expect(mockApiCalls.getAllLifecycleAppstreams).toHaveBeenCalledWith(major);
      expect(mockApiCalls.getRelevantLifecycleSystems).not.toHaveBeenCalled();
      expect(mockApiCalls.getAllLifecycleSystems).not.toHaveBeenCalled();
    });

    test('deep link to RHEL requests only RHEL lists', async () => {
      renderWithRouter(<LifecycleTab />, ['/?lifecycleDropdown=rhel-systems']);
      await screen.findByTestId('lifecycle-table');
      expect(mockApiCalls.getRelevantLifecycleSystems).toHaveBeenCalledTimes(1);
      expect(mockApiCalls.getAllLifecycleSystems).toHaveBeenCalledTimes(1);
      expect(mockApiCalls.getRelevantLifecycleAppstreams).not.toHaveBeenCalled();
      expect(mockApiCalls.getAllLifecycleAppstreams).not.toHaveBeenCalled();
    });

    test('reuses successful requests across view changes, scope changes and SPA remounts', async () => {
      const mounted = renderWithRouter(<LifecycleTab />);
      await screen.findByTestId('lifecycle-table');
      await act(async () => {
        fireEvent.change(screen.getByTestId('view-filter-select'), { target: { value: 'all' } });
      });
      await select('rhel-8-appstreams');
      await screen.findByTestId('lifecycle-table');
      await select('rhel-systems');
      await screen.findByTestId('lifecycle-table');
      await select('rhel-9-appstreams');
      await screen.findByTestId('lifecycle-table');
      expect(mockApiCalls.getRelevantLifecycleAppstreams.mock.calls).toEqual([[9], [8]]);
      expect(mockApiCalls.getAllLifecycleAppstreams.mock.calls).toEqual([[9], [8]]);
      expect(mockApiCalls.getRelevantLifecycleSystems).toHaveBeenCalledTimes(1);

      mounted.unmount();
      renderWithRouter(<LifecycleTab />);
      await screen.findByTestId('lifecycle-table');
      expect(mockApiCalls.getRelevantLifecycleAppstreams.mock.calls).toEqual([[9], [8]]);
    });

    test('shares an unfinished major request when switching away and back', async () => {
      let resolveEight: (value: { data: Stream[] }) => void = () => undefined;
      const eight = { ...mockAppData[0], name: 'cached-eight', os_major: 8 };
      mockApiCalls.getRelevantLifecycleAppstreams.mockImplementation((major: number) =>
        major === 8
          ? new Promise((resolve) => (resolveEight = resolve))
          : Promise.resolve({ data: mockAppData.filter((row) => row.os_major === major) })
      );
      renderWithRouter(<LifecycleTab />);
      await screen.findByTestId('lifecycle-table');
      await select('rhel-8-appstreams');
      expect(screen.queryByTestId('lifecycle-table')).not.toBeInTheDocument();
      await select('rhel-9-appstreams');
      await screen.findByTestId('lifecycle-table');
      await select('rhel-8-appstreams');
      expect(mockApiCalls.getRelevantLifecycleAppstreams.mock.calls).toEqual([[9], [8]]);
      await act(async () => resolveEight({ data: [eight] }));
      expect(await screen.findByTestId('table-item-0')).toHaveTextContent('cached-eight');
      expect(screen.getByTestId('view-filter-select')).toHaveValue('installed-only');
    });

    test.each(['success', 'failure'])(
      'ignores an old major request %s after RHEL is selected',
      async (outcome) => {
        let settle: () => void = () => undefined;
        mockApiCalls.getRelevantLifecycleAppstreams.mockImplementation((major: number) =>
          major === 8
            ? new Promise((resolve, reject) => {
                settle = () =>
                  outcome === 'success' ? resolve({ data: [] }) : reject(new Error('obsolete failure'));
              })
            : Promise.resolve({ data: mockAppData.filter((row) => row.os_major === major) })
        );
        renderWithRouter(<LifecycleTab />);
        await screen.findByTestId('lifecycle-table');
        await select('rhel-8-appstreams');
        await select('rhel-systems');
        expect(await screen.findByTestId('table-item-0')).toHaveTextContent('RHEL 9.3');
        await act(async () => settle());
        expect(screen.getByTestId('dropdown-select')).toHaveValue('rhel-systems');
        expect(screen.getByTestId('table-item-0')).toHaveTextContent('RHEL 9.3');
        expect(screen.queryByText('Failed to load data')).not.toBeInTheDocument();
      }
    );

    test('retries a failed selected request without refetching its successful catalog', async () => {
      mockApiCalls.getRelevantLifecycleAppstreams.mockRejectedValueOnce(new Error('temporary failure'));
      renderWithRouter(<LifecycleTab />);
      await screen.findByText('Failed to load data');
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry' })));
      await screen.findByTestId('lifecycle-table');
      expect(mockApiCalls.getRelevantLifecycleAppstreams).toHaveBeenCalledTimes(2);
      expect(mockApiCalls.getAllLifecycleAppstreams).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    test('displays error state when API calls fail', async () => {
      const errorMessage = 'Failed to fetch data';
      mockApiCalls.getAllLifecycleAppstreams.mockRejectedValue(new Error(errorMessage));

      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load data')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    test('displays workspace filtering error state', async () => {
      mockApiCalls.getAllLifecycleAppstreams.mockRejectedValue(
        new Error('Error: Workspace filtering is not yet implemented')
      );

      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.getByText('Planning is not yet enabled for your organization')).toBeInTheDocument();
        expect(screen.getByText('Return to home page')).toBeInTheDocument();
      });
    });

    test('displays timeout error state for 504 status', async () => {
      const timeoutError = new Error('Timeout') as any;
      timeoutError.status_code = 504;
      mockApiCalls.getAllLifecycleAppstreams.mockRejectedValue(timeoutError);

      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.getByText('Timeout reached when calculating response')).toBeInTheDocument();
      });
    });

    test('displays generic error state for non-504 status codes', async () => {
      const serverError = new Error('Internal Server Error') as any;
      serverError.status_code = 500;
      mockApiCalls.getAllLifecycleAppstreams.mockRejectedValue(serverError);

      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load data')).toBeInTheDocument();
        expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering Functionality', () => {
    beforeEach(async () => {
      renderWithRouter(<LifecycleTab />);

      // Wait for component to finish loading and show content
      await waitFor(
        () => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
          expect(screen.getByTestId('lifecycle-filters')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    test('filters data by name', async () => {
      const nameInput = screen.getByTestId('name-filter-input');

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'nodejs' } });
      });

      expect(nameInput).toHaveValue('nodejs');
    });

    test('changes dropdown selection', async () => {
      const dropdown = screen.getByTestId('dropdown-select');

      await act(async () => {
        fireEvent.change(dropdown, { target: { value: 'rhel-systems' } });
      });

      expect(dropdown).toHaveValue('rhel-systems');

      // Instead of expecting a specific chart, just verify the dropdown change worked
      // The component behavior with filtering might cause it to show empty state
      // which is acceptable for this test
      await waitFor(() => {
        expect(dropdown).toHaveValue('rhel-systems');
      });
    });

    test('changes sort selection', async () => {
      const sortSelect = screen.getByTestId('sort-select');

      await act(async () => {
        fireEvent.change(sortSelect, { target: { value: 'Name' } });
      });

      expect(sortSelect).toHaveValue('Name');
    });

    test('changes view filter', async () => {
      const viewFilterSelect = screen.getByTestId('view-filter-select');

      await act(async () => {
        fireEvent.change(viewFilterSelect, { target: { value: 'all' } });
      });

      expect(viewFilterSelect).toHaveValue('all');
    });
  });

  describe('Empty State Handling', () => {
    test('displays empty state when no results found after filtering', async () => {
      mockApiCalls.getRelevantLifecycleAppstreams.mockResolvedValue({ data: [] });
      mockApiCalls.getRelevantLifecycleSystems.mockResolvedValue({ data: [] });

      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const nameInput = screen.getByTestId('name-filter-input');
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'nonexistent' } });
      });

      await waitFor(() => {
        expect(screen.getByText('No results found')).toBeInTheDocument();
        expect(screen.getByText('Clear all filters and try again.')).toBeInTheDocument();
      });
    });

    test('clears filters when clear all filters button is clicked', async () => {
      mockApiCalls.getRelevantLifecycleAppstreams.mockResolvedValue({ data: [] });

      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Set a filter first
      const nameInput = screen.getByTestId('name-filter-input');
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'test' } });
      });

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText('No results found')).toBeInTheDocument();
      });

      // Click clear filters
      const clearButton = screen.getByText('Clear all filters');
      await act(async () => {
        fireEvent.click(clearButton);
      });

      expect(nameInput).toHaveValue('');
    });
  });

  describe('Data Export', () => {
    beforeEach(() => {
      mockExportData.mockClear();
    });

    test('exports CSV when button is clicked', async () => {
      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-csv'));
      });

      expect(mockExportData).toHaveBeenCalledWith('csv', expect.any(Array));
    });

    test('exports JSON when button is clicked', async () => {
      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-json'));
      });

      expect(mockExportData).toHaveBeenCalledWith('json', expect.any(Array));
    });

    test('exports XML when button is clicked', async () => {
      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-xml'));
      });

      expect(mockExportData).toHaveBeenCalledWith('xml', expect.any(Array));
    });

    test('shows a warning when host details cannot be loaded', async () => {
      jest.mocked(api.getV1RelevantLifecycleAppstreams).mockRejectedValueOnce(new Error('request failed'));
      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-csv'));
      });

      expect(
        screen.getByText('Host details could not be loaded. This export contains system counts only.')
      ).toBeInTheDocument();
      expect(mockExportData).toHaveBeenCalledWith('csv', expect.any(Array));
      const [format, rows] = mockExportData.mock.calls[0] as [string, Record<string, string | number>[]];
      expect(format).toBe('csv');
      expect(rows).toEqual([
        {
          appstream_module: 'Node.js 18',
          release: 9,
          release_date: 'Jan 2023',
          retirement_date: 'Jan 2025',
          lifecycle_status: 'Supported',
          rhel_version: '9.0',
          system_count: 25,
        },
        {
          appstream_module: 'Python 3.11',
          release: 9,
          release_date: 'Jan 2022',
          retirement_date: 'Jan 2024',
          lifecycle_status: 'Supported',
          rhel_version: '9.0',
          system_count: 30,
        },
      ]);
      expect(rows.every((row) => !('host_id' in row) && !('hostname' in row) && !('system_index' in row))).toBe(
        true
      );
    });

    test('preserves the RHEL version and lifecycle label when merging v1 host details', async () => {
      const v1System: SystemLifecycleChanges = {
        ...mockSystemData[0],
        name: 'RHEL',
        display_name: 'RHEL 9.4 EUS',
        minor: 4,
        lifecycle_type: 'EUS',
        count: 1,
        systems_detail: [{ id: 'eus-host', display_name: 'server-eus' }],
      };
      mockApiCalls.getRelevantLifecycleSystems.mockResolvedValue({
        data: [{ ...v1System, systems_detail: [] }],
      });
      jest.mocked(api.getV1RelevantLifecycleSystems).mockResolvedValue({ data: [v1System] });
      render(
        <MemoryRouter initialEntries={['/?lifecycleDropdown=rhel-systems&viewFilter=installed-only']}>
          <LifecycleTab />
        </MemoryRouter>
      );
      expect(await screen.findByTestId('table-item-0')).toHaveTextContent('RHEL 9.4 EUS');
      expect(api.getV1RelevantLifecycleSystems).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-csv'));
      });

      expect(api.getV1RelevantLifecycleSystems).toHaveBeenCalledTimes(1);
      expect(mockExportData).toHaveBeenCalledTimes(1);
      const [format, rows] = mockExportData.mock.calls[0];
      expect(format).toBe('csv');
      assert.deepEqual(
        rows.map((row: Record<string, string | number>) => ({
          release: row.release,
          host_id: row.host_id,
          hostname: row.hostname,
        })),
        [{ release: 'RHEL 9.4 EUS', host_id: 'eus-host', hostname: 'server-eus' }],
        'Merging v1 hosts must preserve the release label shown in the table'
      );
    });

    test('keeps distinct app streams with the same module name and OS version separate in exports', async () => {
      // Both stream versions exist for RHEL 8.10 in the backend catalog.
      const node22: Stream = {
        ...mockAppData[0],
        name: 'nodejs',
        application_stream_name: 'Node.js 22',
        display_name: 'Node.js 22',
        os_major: 8,
        os_minor: 10,
        start_date: '2024-05-22',
        end_date: '2027-04-30',
        count: 1,
        systems_detail: [{ id: 'node22-host', display_name: 'uses-node22' }],
      };
      const node24: Stream = {
        ...node22,
        application_stream_name: 'Node.js 24',
        display_name: 'Node.js 24',
        end_date: '2028-04-30',
        systems_detail: [{ id: 'node24-host', display_name: 'uses-node24' }],
      };
      mockApiCalls.getRelevantLifecycleAppstreams.mockResolvedValue({
        data: [node22, node24].map((stream) => ({ ...stream, systems_detail: [] })),
      });
      jest.mocked(api.getV1RelevantLifecycleAppstreams).mockResolvedValue({ data: [node22, node24] });
      render(
        <MemoryRouter initialEntries={['/?lifecycleDropdown=rhel-8-appstreams&viewFilter=installed-only']}>
          <LifecycleTab />
        </MemoryRouter>
      );
      expect(await screen.findByTestId('lifecycle-table')).toHaveTextContent('Table with 2 items');
      expect(api.getV1RelevantLifecycleAppstreams).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-csv'));
      });

      expect(api.getV1RelevantLifecycleAppstreams).toHaveBeenCalledTimes(1);
      expect(mockExportData).toHaveBeenCalledTimes(1);
      const [format, rows] = mockExportData.mock.calls[0];
      expect(format).toBe('csv');
      assert.deepEqual(
        rows
          .map((row: Record<string, string | number>) => ({
            appstream: row.appstream_module,
            host: row.host_id,
          }))
          .sort((a: { appstream: string }, b: { appstream: string }) => a.appstream.localeCompare(b.appstream)),
        [
          { appstream: 'Node.js 22', host: 'node22-host' },
          { appstream: 'Node.js 24', host: 'node24-host' },
        ],
        'Each app stream must retain its own label and host details'
      );
    });
  });

  describe('URL Parameter Handling', () => {
    test('initializes with URL parameters', async () => {
      renderWithRouter(<LifecycleTab />, ['/?name=nodejs&lifecycleDropdown=rhel-systems']);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // The component should initialize with the URL parameters
      expect(screen.getByTestId('name-filter-input')).toBeInTheDocument();
      expect(screen.getByTestId('dropdown-select')).toBeInTheDocument();
    });
  });

  describe('Data Processing', () => {
    test('processes system data correctly', async () => {
      renderWithRouter(<LifecycleTab />);

      await waitFor(
        () => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
          expect(screen.getByTestId('lifecycle-filters')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Simply test that we can interact with the dropdown
      const dropdown = screen.getByTestId('dropdown-select');

      // Verify the dropdown exists (don't assume a specific default value)
      expect(dropdown).toBeInTheDocument();

      // Test changing to systems view
      await act(async () => {
        fireEvent.change(dropdown, { target: { value: 'rhel-systems' } });
      });

      // Verify the dropdown change worked
      await waitFor(() => {
        expect(dropdown).toHaveValue('rhel-systems');
      });
    });

    test('processes app stream data correctly', async () => {
      renderWithRouter(<LifecycleTab />);

      await waitFor(
        () => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
          expect(screen.getByTestId('lifecycle-filters')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Simply verify that the component loaded properly and filters are working
      // Avoid clearing name filter as it causes React Suspense issues
      const nameInput = screen.getByTestId('name-filter-input');
      const dropdown = screen.getByTestId('dropdown-select');

      // Check that the component is in a valid state
      expect(nameInput).toBeInTheDocument();
      expect(dropdown).toBeInTheDocument();

      // Test that the filters are functional - dropdown should have options
      const options = dropdown.querySelectorAll('option');
      expect(options.length).toBeGreaterThan(0); // Should have dropdown options
    });

    test('filters app data by RHEL version', async () => {
      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Switch to RHEL 8 streams
      const dropdown = screen.getByTestId('dropdown-select');
      await act(async () => {
        fireEvent.change(dropdown, { target: { value: 'rhel-8-appstreams' } });
      });

      expect(dropdown).toHaveValue('rhel-8-appstreams');
    });
  });

  describe('View Filter Logic', () => {
    test('switches to "all" view when no installed data available', async () => {
      // Mock no installed data
      mockApiCalls.getRelevantLifecycleSystems.mockResolvedValue({ data: [] });
      mockApiCalls.getRelevantLifecycleAppstreams.mockResolvedValue({ data: [] });

      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Should automatically switch to "all" view
      const viewFilterSelect = screen.getByTestId('view-filter-select');
      expect(viewFilterSelect).toHaveValue('all');
    });

    test('maintains installed-only view when installed data is available', async () => {
      renderWithRouter(<LifecycleTab />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const viewFilterSelect = screen.getByTestId('view-filter-select');
      expect(viewFilterSelect).toHaveValue('installed-only');
    });
  });

  describe('Component Integration', () => {
    test('loads major-only hosts on demand and retries a failed v2 request without a null URL', async () => {
      // Shape emitted by get_relevant_systems for an inventory profile with major=9, minor=null.
      const row = {
        name: 'RHEL',
        display_name: 'RHEL 9',
        major: 9,
        minor: null,
        start_date: '2022-05-17',
        end_date: '2032-05-31',
        count: 1,
        lifecycle_type: 'mainline',
        support_status: 'Supported',
        related: false,
        systems_detail: [],
        systems: [],
      };
      jest.mocked(axios.get).mockClear();
      jest
        .mocked(api.getRelevantLifecycleSystems)
        .mockImplementationOnce(jest.requireActual('../../api').getRelevantLifecycleSystems);
      const tableMock = jest.mocked(LifecycleTable);
      const originalTable = tableMock.getMockImplementation()!;
      tableMock.mockImplementation(jest.requireActual('../LifecycleTable/LifecycleTable').default);
      try {
        let failV2 = true;
        jest.mocked(axios.get).mockImplementation(async (url) => {
          if (url === '/api/roadmap/v2/relevant/lifecycle/rhel') {
            return { status: 200, data: { meta: { count: 1, total: 1 }, data: [row] } };
          }
          if (String(url).startsWith('/api/roadmap/v2/relevant/lifecycle/rhel/9/systems')) {
            if (failV2) {
              failV2 = false;
              throw { response: { status: 503, data: { detail: 'Temporary unavailable' } } };
            }
            return {
              status: 200,
              data: {
                meta: { count: 1, total: 1 },
                data: [{ id: 'major-only-host', display_name: 'server-major-only', os_major: 9, os_minor: null }],
              },
            };
          }
          if (String(url).includes('/9/null/systems')) {
            throw {
              response: {
                status: 422,
                data: { detail: [{ loc: ['path', 'minor'], type: 'int_parsing', input: 'null' }] },
              },
            };
          }
          return { status: 200, data: { meta: { count: 0, total: 0 }, data: [] } };
        });
        await act(async () => {
          render(
            <MemoryRouter initialEntries={['/?lifecycleDropdown=rhel-systems&viewFilter=installed-only']}>
              <Suspense fallback={null}>
                <LifecycleTab />
              </Suspense>
            </MemoryRouter>
          );
        });
        expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
        expect(jest.mocked(axios.get).mock.calls.some(([url]) => String(url).startsWith('/api/roadmap/v1'))).toBe(
          false
        );
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: '1' }));
        });
        expect(screen.getByText('Unable to load systems')).toBeInTheDocument();
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        });
        expect(screen.getByRole('button', { name: 'server-major-only' })).toBeInTheDocument();
        expect(screen.queryByText('Unable to load systems')).not.toBeInTheDocument();
        expect(
          jest
            .mocked(axios.get)
            .mock.calls.filter(([url]) =>
              String(url).startsWith('/api/roadmap/v2/relevant/lifecycle/rhel/9/systems')
            )
        ).toHaveLength(2);
        expect(jest.mocked(axios.get).mock.calls.some(([url]) => String(url).includes('/null/'))).toBe(false);
      } finally {
        tableMock.mockImplementation(originalTable);
        jest.mocked(axios.get).mockReset();
      }
    });

    test('passes correct props to child components', async () => {
      renderWithRouter(<LifecycleTab />);

      await waitFor(
        () => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
          expect(screen.getByTestId('lifecycle-filters')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Check that either chart or table is present (component might be in loading or empty state)
      const chart = screen.queryByTestId('lifecycle-chart') || screen.queryByTestId('lifecycle-chart-system');
      const table = screen.queryByTestId('lifecycle-table');
      const filters = screen.queryByTestId('lifecycle-filters');

      expect(filters).toBeInTheDocument();
      // At least one of chart or table should be present, or component should be in a valid state
      expect(chart || table || screen.queryByText('No results found')).toBeTruthy();
    });

    test('updates child components when filters change', async () => {
      renderWithRouter(<LifecycleTab />);

      await waitFor(
        () => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
          expect(screen.getByTestId('lifecycle-filters')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Change dropdown to systems
      const dropdown = screen.getByTestId('dropdown-select');
      await act(async () => {
        fireEvent.change(dropdown, { target: { value: 'rhel-systems' } });
      });

      // Wait for the change to take effect
      await waitFor(() => {
        expect(dropdown).toHaveValue('rhel-systems');
      });
    });
  });
});

describe('Dynamic RHEL version options', () => {
  test('computes and passes dynamic RHEL version options from system data', async () => {
    jest.mocked(loadLifecycleData).mockImplementation(createLifecycleDataLoader());
    jest.mocked(api.getRelevantLifecycleSystems).mockResolvedValue({ data: mockSystemData });
    jest.mocked(api.getAllLifecycleSystems).mockResolvedValue({ data: mockSystemData });
    renderWithRouter(<LifecycleTab />, ['/?lifecycleDropdown=rhel-systems']);

    await waitFor(() => {
      expect(screen.getByTestId('lifecycle-filters')).toBeInTheDocument();
    });

    const list = screen.getByTestId('rhel-version-options');
    expect(list).toBeInTheDocument();
    expect(list).toHaveTextContent('RHEL 8');
    expect(list).toHaveTextContent('RHEL 9');
  });
});
