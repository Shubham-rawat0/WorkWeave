import {tool} from "ai"
import z from "zod"
import { getWorkflow, listWorkflows } from "../services/workflowService"
import { MAX_ID_LENGTH } from "../schemas/workflow";
import { prisma } from "@WorkOrchestrator/prisma";
import {
    getNodesByCategory,
    NODE_REGISTRY,
    type NodeCategory,
} from "@WorkOrchestrator/shared";

const list_workflow = tool({
    description: "List all workflows of a user",
    inputSchema: z.object({
        userId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    }),
    execute: async ({ userId }: { userId: string }) => {
        return await listWorkflows(userId);
    },
});

const get_workflow=tool({
    description:"get a particular workflow using workflowId and userId",
    inputSchema:z.object({
        workflowId:z.string().trim().min(1).max(MAX_ID_LENGTH),
        userId:z.string().min(1).max(MAX_ID_LENGTH)
    }),
    execute:async({userId,workflowId}:{userId:string,workflowId:string})=>{
        return await getWorkflow(userId,workflowId)
    }
})

const list_available_triggers=tool({
    description:"list all the available and valid triggers that can be used in workflow",
    inputSchema:z.object({}),
    execute:async ()=>{
        return await prisma.availableTrigger.findMany({
            select: {
                id: true,
                name: true,
            },
        }) 
    }
})

const list_available_actions=tool({
    description:"list all the available and valid actions that can be performed in workflow",
    inputSchema:z.object({}),
    execute:async ()=>{
        return await prisma.availableAction.findMany({
            select: {
                id: true,
                name: true,
            },
        }) 
    }
})

const list_node_types=tool({
    description:"get the node type and node definition",
    inputSchema:z.object({
        category:z.enum(["triggers", "utilities", "integrations", "logic"]).optional()
    }),
    execute:({category}:{category?:NodeCategory})=>{
        if (category){
            return getNodesByCategory()[category]
        }
        return NODE_REGISTRY
    }
})