export const createSSEConnection = (url: string, handlers: {
    onMessage: (event: MessageEvent) => void;
    onError?: (error: Event) => void;
}) => {
    let eventSource: EventSource | null = null;
    let retryCount = 0;
    const maxRetries = 5;

    const connect = () => {
        eventSource = new EventSource(url);

        eventSource.onmessage = handlers.onMessage;

        eventSource.onerror = (error) => {
            if (handlers.onError) {
                handlers.onError(error);
            }

            if (eventSource?.readyState === EventSource.CLOSED) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(() => {
                        connect();
                    }, 1000 * retryCount); // Exponential backoff
                }
            }
        };
    };

    connect();

    return () => {
        if (eventSource) {
            eventSource.close();
        }
    };
};