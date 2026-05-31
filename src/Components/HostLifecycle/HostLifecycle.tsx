import React, { useEffect, useState } from 'react';
import {
  Bullseye,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Label,
  Spinner,
  Split,
  SplitItem,
  Stack,
  StackItem,
  Title,
} from '@patternfly/react-core';
import CheckCircleIcon from '@patternfly/react-icons/dist/esm/icons/check-circle-icon';
import ExclamationCircleIcon from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import ExclamationTriangleIcon from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { ApiError, getRelevantLifecycleAppstreams, getRelevantLifecycleSystems } from '../../api';
import { SystemLifecycleChanges } from '../../types/SystemLifecycleChanges';
import { Stream } from '../../types/Stream';
import LifecycleChart from '../LifecycleChart/LifecycleChart';
import LifecycleChartSystem from '../LifecycleChartSystem/LifecycleChartSystem';

interface HostLifecycleProps {
  inventoryId: string;
}

interface HostLifecycleData {
  rhel: SystemLifecycleChanges | null;
  appStreams: Stream[];
}

const StatusLabel: React.FC<{ supportStatus: string }> = ({ supportStatus }) => {
  switch (supportStatus) {
    case 'Supported':
      return (
        <Label color="green" icon={<CheckCircleIcon />}>
          {supportStatus}
        </Label>
      );
    case 'Near retirement':
      return (
        <Label color="orange" icon={<ExclamationTriangleIcon />}>
          {supportStatus}
        </Label>
      );
    case 'Retired':
      return (
        <Label color="red" icon={<ExclamationCircleIcon />}>
          {supportStatus}
        </Label>
      );
    default:
      return <Label>{supportStatus}</Label>;
  }
};

const filterForHost = (
  systemsData: SystemLifecycleChanges[],
  appStreamsData: Stream[],
  inventoryId: string
): HostLifecycleData => {
  const rhel =
    systemsData.find((system) => system.systems_detail?.some((detail) => detail.id === inventoryId)) ?? null;

  const appStreams = appStreamsData.filter((stream) =>
    stream.systems_detail?.some((detail) => detail.id === inventoryId)
  );

  return { rhel, appStreams };
};

const HostLifecycle: React.FC<HostLifecycleProps> = ({ inventoryId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HostLifecycleData>({ rhel: null, appStreams: [] });

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [systemsResult, appStreamsResult] = await Promise.allSettled([
          getRelevantLifecycleSystems(),
          getRelevantLifecycleAppstreams(),
        ]);

        if (cancelled) return;

        const systemsData: SystemLifecycleChanges[] =
          systemsResult.status === 'fulfilled' ? systemsResult.value?.data ?? [] : [];
        const appStreamsData: Stream[] =
          appStreamsResult.status === 'fulfilled' ? appStreamsResult.value?.data ?? [] : [];

        if (systemsResult.status === 'rejected' && appStreamsResult.status === 'rejected') {
          const reason = systemsResult.reason;
          if (reason instanceof ApiError && reason.status_code === 403) {
            setError('You do not have permission to view lifecycle data for this system.');
          } else {
            setError('Failed to load lifecycle data. Please try again later.');
          }
          setLoading(false);
          return;
        }

        setData(filterForHost(systemsData, appStreamsData, inventoryId));
      } catch (err) {
        if (!cancelled) {
          setError('An unexpected error occurred while loading lifecycle data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [inventoryId]);

  if (loading) {
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  if (error) {
    return (
      <EmptyState variant={EmptyStateVariant.lg}>
        <Title headingLevel="h4" size="lg">
          Unable to load lifecycle data
        </Title>
        <EmptyStateBody>{error}</EmptyStateBody>
      </EmptyState>
    );
  }

  if (!data.rhel && data.appStreams.length === 0) {
    return (
      <EmptyState variant={EmptyStateVariant.lg}>
        <Title headingLevel="h4" size="lg">
          No lifecycle data available
        </Title>
        <EmptyStateBody>
          No RHEL lifecycle information was found for this system. The system may not have reported its operating
          system version, or lifecycle data may not yet be available.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <Stack hasGutter>
      {data.rhel && (
        <StackItem>
          <Split hasGutter style={{ marginBottom: 'var(--pf-t--global--spacer--sm)' }}>
            <SplitItem>
              <Title headingLevel="h3" size="lg">
                RHEL Lifecycle
              </Title>
            </SplitItem>
            <SplitItem>
              <StatusLabel supportStatus={data.rhel.support_status} />
            </SplitItem>
          </Split>
          <LifecycleChartSystem lifecycleData={[data.rhel]} />
        </StackItem>
      )}

      {data.appStreams.length > 0 && (
        <StackItem>
          <Title headingLevel="h3" size="lg" style={{ marginBottom: 'var(--pf-t--global--spacer--sm)' }}>
            Application Streams
          </Title>
          <LifecycleChart lifecycleData={data.appStreams} />
        </StackItem>
      )}
    </Stack>
  );
};

export default HostLifecycle;
