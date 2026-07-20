import { Toaster } from "@/components/ui/sonner";
import AgentCorePage from "@/pages/AgentCorePage";
import CardiaPage from "@/pages/CardiaPage";
import CostPage from "@/pages/CostPage";
import DeploymentPage from "@/pages/DeploymentPage";
import GovernancePage from "@/pages/GovernancePage";
import HepaPage from "@/pages/HepaPage";
import IntegrityPage from "@/pages/IntegrityPage";
import LogocPage from "@/pages/LogocPage";
import LogocReviewPage from "@/pages/LogocReviewPage";
import NetworkPage from "@/pages/NetworkPage";
import OrganSystemPage from "@/pages/OrganSystemPage";
import OverviewPage from "@/pages/OverviewPage";
import PipelinePage from "@/pages/PipelinePage";
import PneumaPage from "@/pages/PneumaPage";
import SynapsePage from "@/pages/SynapsePage";
import SystemStatePage from "@/pages/SystemStatePage";
import VoxPage from "@/pages/VoxPage";
import BrokenGenesisPage from "@/pages/onboarding/BrokenGenesisPuzzle";
import HeparShadowMarketPage from "@/pages/onboarding/HeparShadowMarket";
import ArchonInterrogationPage from "@/pages/onboarding/ArchonInterrogation";
import LiveActivationGatePage from "@/pages/onboarding/LiveActivationGate";
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

const rootRoute = createRootRoute();

const routes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: OverviewPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/agent-core",
    component: AgentCorePage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/organ-system",
    component: OrganSystemPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/synapse",
    component: SynapsePage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/vox",
    component: VoxPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/pneuma",
    component: PneumaPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/hepar",
    component: HepaPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/cardia",
    component: CardiaPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/logoc",
    component: LogocPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/logoc-review",
    component: LogocReviewPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/network",
    component: NetworkPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/integrity",
    component: IntegrityPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/pipeline",
    component: PipelinePage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/deployment",
    component: DeploymentPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/cost",
    component: CostPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/governance",
    component: GovernancePage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/system-state",
    component: SystemStatePage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/onboarding/broken-genesis",
    component: BrokenGenesisPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/onboarding/shadow-market",
    component: HeparShadowMarketPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/onboarding/archon-gate",
    component: ArchonInterrogationPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/onboarding/live-activation",
    component: LiveActivationGatePage,
  }),
];

const routeTree = rootRoute.addChildren(routes);
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" theme="dark" />
    </>
  );
}
