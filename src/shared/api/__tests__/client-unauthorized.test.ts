import {
  apiClient,
  setApiAuthRefreshHandler,
  setApiUnauthorizedHandler,
} from '@/src/shared/api/client';

type MockResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

function createErrorResponse(status: number, message: string): MockResponse {
  return {
    ok: false,
    status,
    text: async () => JSON.stringify({ message }),
  };
}

describe('api client unauthorized handling', () => {
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    setApiAuthRefreshHandler(null);
    setApiUnauthorizedHandler(null);
  });

  afterEach(() => {
    setApiAuthRefreshHandler(null);
    setApiUnauthorizedHandler(null);
  });

  it('triggers unauthorized handler for 401 responses on authenticated requests', async () => {
    const onUnauthorized = jest.fn();
    setApiUnauthorizedHandler(onUnauthorized);

    fetchMock.mockResolvedValueOnce(
      createErrorResponse(401, 'Invalid or expired token') as unknown as Response,
    );

    await expect(apiClient.getLessons('expired-token')).rejects.toEqual(
      expect.objectContaining({
        status: 401,
        message: 'Invalid or expired token',
      }),
    );
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not trigger unauthorized handler for unauthenticated requests', async () => {
    const onUnauthorized = jest.fn();
    setApiUnauthorizedHandler(onUnauthorized);

    fetchMock.mockResolvedValueOnce(
      createErrorResponse(401, 'Invalid credentials') as unknown as Response,
    );

    await expect(apiClient.login('wrong@example.com', 'wrong-pass')).rejects.toEqual(
      expect.objectContaining({
        status: 401,
        message: 'Invalid credentials',
      }),
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('retries once with refreshed token when auth refresh handler returns a new token', async () => {
    const onRefresh = jest.fn().mockResolvedValue('new-token');
    setApiAuthRefreshHandler(onRefresh);

    fetchMock
      .mockResolvedValueOnce(
        createErrorResponse(401, 'Invalid or expired token') as unknown as Response,
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            lessons: [],
          }),
      } as unknown as Response);

    const response = await apiClient.getLessons('old-token');
    expect(response.lessons).toEqual([]);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('logs out when refresh handler cannot provide a new token', async () => {
    const onRefresh = jest.fn().mockResolvedValue(null);
    const onUnauthorized = jest.fn();
    setApiAuthRefreshHandler(onRefresh);
    setApiUnauthorizedHandler(onUnauthorized);

    fetchMock.mockResolvedValueOnce(
      createErrorResponse(401, 'Invalid or expired token') as unknown as Response,
    );

    await expect(apiClient.getLessons('old-token')).rejects.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
