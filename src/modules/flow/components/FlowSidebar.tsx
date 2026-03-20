import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

interface NavItem {
    path: string;
    label: string;
    icon: string;
    badge?: number;
}

export function FlowSidebar() {
    const location = useLocation();
    const navigate = useNavigate();

    const { data: dashboard } = useQuery({
        queryKey: ['flow', 'dashboard'],
        queryFn: () => api.flow.getDashboard(),
        staleTime: 60_000,
    });

    const { data: bildungsgaenge } = useQuery({
        queryKey: ['flow', 'bildungsgaenge'],
        queryFn: () => api.flow.getBildungsgaenge(),
    });

    const hauptNav: NavItem[] = [
        {
            path: '/teacher/flow',
            label: 'Dashboard',
            icon: '\u25A6',
        },
        {
            path: '/teacher/flow/aufgaben',
            label: 'Meine Aufgaben',
            icon: '\u2611',
            badge: dashboard?.statistik?.offen || undefined,
        },
    ];

    const isActive = (path: string) => {
        if (path === '/teacher/flow') {
            return location.pathname === '/teacher/flow' || location.pathname === '/teacher/flow/';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <aside className="flow-sidebar">
            <div className="flow-sidebar__header">
                <div className="flow-sidebar__title">Flow</div>
                <div className="flow-sidebar__subtitle">Kollaborationsformat</div>
            </div>

            <nav className="flow-sidebar__nav">
                {hauptNav.map((item) => (
                    <button
                        key={item.path}
                        className={`flow-sidebar__link ${isActive(item.path) ? 'flow-sidebar__link--active' : ''}`}
                        onClick={() => navigate(item.path)}
                    >
                        <span className="flow-sidebar__link-icon">{item.icon}</span>
                        {item.label}
                        {item.badge !== undefined && item.badge > 0 && (
                            <span className="flow-sidebar__badge">{item.badge}</span>
                        )}
                    </button>
                ))}

                {Array.isArray(bildungsgaenge) && bildungsgaenge.length > 0 && (
                    <>
                        <div className="flow-sidebar__section-label">Bildungsgaenge</div>
                        {bildungsgaenge.map((bg: { id: number; name: string }) => (
                            <button
                                key={bg.id}
                                className={`flow-sidebar__link ${isActive(`/teacher/flow/bildungsgang/${bg.id}`) ? 'flow-sidebar__link--active' : ''}`}
                                onClick={() => navigate(`/teacher/flow/bildungsgang/${bg.id}`)}
                            >
                                <span className="flow-sidebar__link-icon">{'\u25CB'}</span>
                                {bg.name}
                            </button>
                        ))}
                    </>
                )}
            </nav>

            <div className="flow-sidebar__footer">
                Flow v1.0
            </div>
        </aside>
    );
}
