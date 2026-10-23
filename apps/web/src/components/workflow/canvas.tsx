import {Node, Edge, OnNodesChange, OnEdgesChange, Connection } from "@xyflow/react";

interface WorkflowCanvasProps {
    nodes:Node[],
    edgs:Edge[],
    onNodesChange:OnNodesChange,
    onEdgesChange:OnEdgesChange,
    onConnect:(connection:Connection)=>void,
    onExecute?:()=>void,
    onExecuteTriggerNow?: (
        source: "cron" | "webhook",
        triggerNodeId: string,
    ) => void;
    isExecuting?: boolean;
    isCronTriggerRunning?: boolean;
    onOpenDrawer?: () => void;
    onTidyUp?: (layoutedNodes: Node[]) => void;
}

