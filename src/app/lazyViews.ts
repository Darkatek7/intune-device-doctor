/**
 * Selten gebrauchte Ansichten werden erst bei Bedarf nachgeladen (kleineres Start-Bundle).
 * Direktlinks (`?view=policies&policy=…`, `?device=…&view=connection-test`) laden den passenden
 * Chunk beim Rendern; bis dahin zeigt `ViewFallback` einen ruhigen Platzhalter.
 */
import { lazy } from 'react';

export const BulkView = lazy(() => import('../ui/BulkView').then((m) => ({ default: m.BulkView })));
export const ConnectionTestView = lazy(() =>
  import('./ConnectionTestView').then((m) => ({ default: m.ConnectionTestView })),
);
export const FleetView = lazy(() => import('./FleetView').then((m) => ({ default: m.FleetView })));
export const PoliciesView = lazy(() =>
  import('./PoliciesView').then((m) => ({ default: m.PoliciesView })),
);
export const PolicyDetailView = lazy(() =>
  import('./PolicyDetailView').then((m) => ({ default: m.PolicyDetailView })),
);
export const RecommendationsView = lazy(() =>
  import('./RecommendationsView').then((m) => ({ default: m.RecommendationsView })),
);
export const TenantView = lazy(() =>
  import('./TenantView').then((m) => ({ default: m.TenantView })),
);
export const ZipView = lazy(() => import('./ZipView').then((m) => ({ default: m.ZipView })));
