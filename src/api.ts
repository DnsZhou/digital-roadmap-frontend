import axios, { AxiosResponse } from 'axios';

import {
  DR_ALL_LIFECYCLE_APPSTREAMS,
  DR_ALL_LIFECYCLE_SYSTEMS,
  DR_ALL_UPCOMING,
  DR_API,
  DR_RELEASE_NOTES,
  DR_RELEVANT_LIFECYCLE_APPSTREAMS,
  DR_RELEVANT_LIFECYCLE_SYSTEMS,
  DR_RELEVANT_UPCOMING,
  INVENTORY_API_ROOT,
  INVENTORY_HOSTS_ROOT,
} from './constants';

/* Digital Roadmap */

export class ApiError extends Error {
  name: string;
  status_code?: number;

  constructor(message: string, status_code?: number) {
    super(message);
    this.name = 'ApiError';
    this.status_code = status_code;
  }
}

export const getRelevantReleaseNotes = async (major: number, minor: number, keyword: string) => {
  const path = DR_API.concat(DR_RELEASE_NOTES).concat('/get-relevant-notes');
  const params = `?major=${major}&minor=${minor}&keywords=${keyword}`;
  const response = await axios
    .get(path.concat(params), {
      validateStatus: function (status) {
        return status === 200;
      },
    })
    .catch(function (error) {
      if (error.response.data.detail) {
        if (error.response.status) {
          throw new ApiError(error.response.data.detail, error.response.status);
        }
        throw new ApiError(error.response.data.detail);
      } else if (error.request.response) {
        if (error.request.status) {
          throw new ApiError(error.request.response, error.request.status);
        }
        throw new ApiError(error.request.response);
      } else if (error.detail) {
        throw new ApiError(error.detail);
      } else {
        throw new ApiError(error.message);
      }
    });

  return getResponseOrError(response);
};

export const getAllUpcomingChanges = async () => {
  const path = DR_API.concat(DR_ALL_UPCOMING);
  const response = await axios
    .get(path, {
      validateStatus: function (status) {
        return status === 200;
      },
    })
    .catch(function (error) {
      if (error.response.data.detail) {
        if (error.response.status) {
          throw new ApiError(error.response.data.detail, error.response.status);
        }
        throw new ApiError(error.response.data.detail);
      } else if (error.request.response) {
        if (error.request.status) {
          throw new ApiError(error.request.response, error.request.status);
        }
        throw new ApiError(error.request.response);
      } else if (error.detail) {
        throw new ApiError(error.detail);
      } else {
        throw new ApiError(error.message);
      }
    });

  return getResponseOrError(response);
};

export const getRelevantUpcomingChanges = async () => {
  const path = DR_API.concat(DR_RELEVANT_UPCOMING);
  const response = await axios
    .get(path, {
      validateStatus: function (status) {
        return status === 200;
      },
    })
    .catch(function (error) {
      if (error.response.data.detail) {
        if (error.response.status) {
          throw new ApiError(error.response.data.detail, error.response.status);
        }
        throw new ApiError(error.response.data.detail);
      } else if (error.request.response) {
        if (error.request.status) {
          throw new ApiError(error.request.response, error.request.status);
        }
        throw new ApiError(error.request.response);
      } else if (error.detail) {
        throw new ApiError(error.detail);
      } else {
        throw new ApiError(error.message);
      }
    });

  return getResponseOrError(response);
};

export const getRelevantLifecycleSystems = async () => {
  const path = DR_API.concat(DR_RELEVANT_LIFECYCLE_SYSTEMS);
  const response = await axios
    .get(path, {
      validateStatus: function (status) {
        return status === 200;
      },
    })
    .catch(function (error) {
      if (error.response.data.detail) {
        if (error.response.status) {
          throw new ApiError(error.response.data.detail, error.response.status);
        }
        throw new ApiError(error.response.data.detail);
      } else if (error.request.response) {
        if (error.request.status) {
          throw new ApiError(error.request.response, error.request.status);
        }
        throw new ApiError(error.request.response);
      } else if (error.detail) {
        throw new ApiError(error.detail);
      } else {
        throw new ApiError(error.message);
      }
    });
  return getResponseOrError(response);
};

export const getAllLifecycleSystems = async () => {
  const path = DR_API.concat(DR_ALL_LIFECYCLE_SYSTEMS);
  const response = await axios
    .get(path, {
      validateStatus: function (status) {
        return status === 200;
      },
    })
    .catch(function (error) {
      if (error.response.data.detail) {
        if (error.response.status) {
          throw new ApiError(error.response.data.detail, error.response.status);
        }
        throw new ApiError(error.response.data.detail);
      } else if (error.request.response) {
        if (error.request.status) {
          throw new ApiError(error.request.response, error.request.status);
        }
        throw new ApiError(error.request.response);
      } else if (error.detail) {
        throw new ApiError(error.detail);
      } else {
        throw new ApiError(error.message);
      }
    });
  return getResponseOrError(response);
};

export const getRelevantLifecycleAppstreams = async () => {
  const path = DR_API.concat(DR_RELEVANT_LIFECYCLE_APPSTREAMS);
  const response = await axios
    .get(path, {
      validateStatus: function (status) {
        return status === 200;
      },
    })
    .catch(function (error) {
      if (error.response.data.detail) {
        if (error.response.status) {
          throw new ApiError(error.response.data.detail, error.response.status);
        }
        throw new ApiError(error.response.data.detail);
      } else if (error.request.response) {
        if (error.request.status) {
          throw new ApiError(error.request.response, error.request.status);
        }
        throw new ApiError(error.request.response);
      } else if (error.detail) {
        throw new ApiError(error.detail);
      } else {
        throw new ApiError(error.message);
      }
    });
  return getResponseOrError(response);
};

export const getAllLifecycleAppstreams = async () => {
  const path = DR_API.concat(DR_ALL_LIFECYCLE_APPSTREAMS);
  const response = await axios
    .get(path, {
      validateStatus: function (status) {
        return status === 200;
      },
    })
    .catch(function (error) {
      if (error.response.data.detail) {
        if (error.response.status) {
          throw new ApiError(error.response.data.detail, error.response.status);
        }
        throw new ApiError(error.response.data.detail);
      } else if (error.request.response) {
        if (error.request.status) {
          throw new ApiError(error.request.response, error.request.status);
        }
        throw new ApiError(error.request.response);
      } else if (error.detail) {
        throw new ApiError(error.detail);
      } else {
        throw new ApiError(error.message);
      }
    });
  return getResponseOrError(response);
};

/* Inventory */

export const inventoryFetchSystems = (path: string = '') => {
  return getInventory(INVENTORY_HOSTS_ROOT.concat(path));
};

export const inventoryFetchSystemsByIds = (ids: string[], path: string = '') => {
  return getInventory(INVENTORY_HOSTS_ROOT.concat('/').concat(ids.join(',')).concat(path));
};

const getInventory = async (path: string) => {
  const response = await axios.get(INVENTORY_API_ROOT.concat(path)).catch(function (error) {
    return error;
  });

  return getResponseOrError(response);
};

/* Common functions */

const getResponseOrError = (response: AxiosResponse) => {
  if (response.status === 200) {
    return response.data;
  } else {
    // This shouldn't happen and should be handled by the validateStatus.
    // But in case this is called from function without implemented validateStatus,
    // this will handle the problem in some basic manner.
    throw new Error(String(response));
  }
};
