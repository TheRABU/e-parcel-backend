import { Router } from "express";
import { AgentControllers } from "./agent.controller.js";
import { checkAuth } from "../../middlewares/checkAuth.js";

const agentRoutes = Router();

agentRoutes.post(
  "/apply",
  checkAuth("customer"),
  AgentControllers.applyForAgent
);

// approve agents admin

agentRoutes.post(
  "/approve/:userId",
  checkAuth("admin"),
  AgentControllers.approveAgentApplication
);

agentRoutes.get(
  "/pending",
  checkAuth("admin"),
  AgentControllers.getPendingApplications
);

////// agent routes
agentRoutes.get(
  "/assigned-parcels",
  checkAuth("agent"),
  AgentControllers.getAssignedParcels
);

agentRoutes.put(
  "/assigned-update/:parcelId",
  checkAuth("agent"),
  AgentControllers.updateParcelStatus
);

agentRoutes.put(
  "/assigned-location",
  checkAuth("agent"),
  AgentControllers.updateAgentLocation
);

agentRoutes.put(
  "/availability",
  checkAuth("agent"),
  AgentControllers.toggleAvailability
);

export default agentRoutes;
