import { createBrowserRouter } from 'react-router';
import App from './App';
import { PublicOnly, RequireAuth, RequireOnboarded, TabLayout } from './routes/guards';
import ErrorScreen from './routes/ErrorScreen';
import Landing from './routes/Landing';
import Register from './routes/Register';
import Login from './routes/Login';
import Onboarding from './routes/Onboarding';
import Home from './routes/Home';
import Subscriptions from './routes/Subscriptions';
import AddSubscription from './routes/AddSubscription';
import SubscriptionDetail from './routes/SubscriptionDetail';
import EditSubscription from './routes/EditSubscription';
import Actions from './routes/Actions';
import Picks from './routes/Picks';
import Settings from './routes/Settings';
import Privacy from './routes/Privacy';
import NotFound from './routes/NotFound';

/** Route map (PRD 5). Analytics and its charts are lazy-loaded for first-load performance. */
export const router = createBrowserRouter([
  {
    element: <App />,
    errorElement: <ErrorScreen />,
    // Shown for a moment when the app opens directly on a lazy-loaded screen.
    hydrateFallbackElement: <div className="min-h-dvh bg-brand-gradient" />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { index: true, element: <Landing /> },
          { path: 'register', element: <Register /> },
          { path: 'login', element: <Login /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: 'onboarding', element: <Onboarding /> },
          {
            element: <RequireOnboarded />,
            children: [
              {
                element: <TabLayout />,
                children: [
                  { path: 'home', element: <Home /> },
                  { path: 'subs', element: <Subscriptions /> },
                  { path: 'subs/new', element: <AddSubscription /> },
                  { path: 'subs/:id', element: <SubscriptionDetail /> },
                  { path: 'subs/:id/edit', element: <EditSubscription /> },
                  { path: 'actions', element: <Actions /> },
                  {
                    path: 'analytics',
                    lazy: async () => ({ Component: (await import('./routes/Analytics')).default }),
                  },
                  { path: 'picks', element: <Picks /> },
                  { path: 'settings', element: <Settings /> },
                ],
              },
            ],
          },
        ],
      },
      { path: 'privacy', element: <Privacy /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
