import { Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlowSidebar } from './FlowSidebar';
import '../flow.css';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
        },
    },
});

export function FlowLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="flow-layout">
                <FlowSidebar />
                <main className="flow-content">
                    <Outlet />
                </main>
            </div>
        </QueryClientProvider>
    );
}
