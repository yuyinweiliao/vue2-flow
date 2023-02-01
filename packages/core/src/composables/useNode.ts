import type { GraphNode } from '~/types'

/**
 * Access a node, it's parent (if one exists) and connected edges
 *
 * If no node id is provided, the node id is injected from context
 *
 * Meaning if you do not provide an id, this composable has to be called in a child of your custom node component, or it will throw
 */
export default function useNode<T extends GraphNode = GraphNode>(id?: string) {
  const nodeId = id ?? inject(NodeId, '')
  const nodeEl = inject(NodeRef, null)

  const { findNode, edges, emits } = useVueFlow()

  const node = findNode<T>(nodeId)!

  if (!node) {
    emits.error(new VueFlowError(ErrorCode.NODE_NOT_FOUND, nodeId))
  }

  return {
    id: nodeId,
    nodeEl,
    node,
    parentNode: computed(() => findNode(node.parentNode)),
    connectedEdges: computed(() => getConnectedEdges([node], edges.value)),
  }
}
