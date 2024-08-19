import { getEventPosition } from '@xyflow/system'
import { ConnectionMode } from '../types'
import type {
  Actions,
  Connection,
  ConnectionHandle,
  ConnectionStatus,
  GraphEdge,
  GraphNode,
  HandleType,
  NodeHandleBounds,
  Position,
  ValidConnectionFunc,
  ValidHandleResult,
  XYPosition,
} from '../types'
import { getHandlePosition } from '.'

function defaultValidHandleResult(): ValidHandleResult {
  return {
    handleDomNode: null,
    isValid: false,
    connection: { source: '', target: '', sourceHandle: null, targetHandle: null },
    endHandle: null,
  }
}

export function resetRecentHandle(handleDomNode: Element): void {
  handleDomNode?.classList.remove('valid', 'connecting', 'vue-flow__handle-valid', 'vue-flow__handle-connecting')
}

// this functions collects all handles and adds an absolute position
// so that we can later find the closest handle to the mouse position
export function getHandles(
  node: GraphNode,
  handleBounds: NodeHandleBounds,
  type: HandleType,
  currentHandle: string,
): ConnectionHandle[] {
  const connectionHandles: ConnectionHandle[] = []

  for (const handle of handleBounds[type] || []) {
    if (`${node.id}-${handle.id}-${type}` !== currentHandle) {
      const { x, y } = getHandlePosition(node, handle)

      connectionHandles.push({
        id: handle.id || null,
        type,
        nodeId: node.id,
        x,
        y,
      })
    }
  }

  return connectionHandles
}

export function getClosestHandle(
  event: MouseEvent | TouchEvent,
  doc: Document | ShadowRoot,
  pos: XYPosition,
  connectionRadius: number,
  handles: ConnectionHandle[],
  validator: (handle: Pick<ConnectionHandle, 'nodeId' | 'id' | 'type'>) => ValidHandleResult,
) {
  // we always want to prioritize the handle below the mouse cursor over the closest distance handle,
  // because it could be that the center of another handle is closer to the mouse pointer than the handle below the cursor
  const { x, y } = getEventPosition(event)
  const domNodes = doc.elementsFromPoint(x, y)

  const handleBelow = domNodes.find((el) => el.classList.contains('vue-flow__handle'))

  if (handleBelow) {
    const handleNodeId = handleBelow.getAttribute('data-nodeid')

    if (handleNodeId) {
      const handleType = getHandleType(undefined, handleBelow)
      const handleId = handleBelow.getAttribute('data-handleid')
      const validHandleResult = validator({ nodeId: handleNodeId, id: handleId, type: handleType })

      if (validHandleResult) {
        const handle = handles.find((h) => h.nodeId === handleNodeId && h.type === handleType && h.id === handleId)

        return {
          handle: {
            id: handleId,
            type: handleType,
            nodeId: handleNodeId,
            x: handle?.x || pos.x,
            y: handle?.y || pos.y,
          },
          validHandleResult,
        }
      }
    }
  }

  // if we couldn't find a handle below the mouse cursor we look for the closest distance based on the connectionRadius
  let closestHandles: { handle: ConnectionHandle; validHandleResult: ValidHandleResult }[] = []
  let minDistance = Number.POSITIVE_INFINITY

  for (const handle of handles) {
    const distance = Math.sqrt((handle.x - pos.x) ** 2 + (handle.y - pos.y) ** 2)

    if (distance <= connectionRadius) {
      const validHandleResult = validator(handle)

      if (distance <= minDistance) {
        if (distance < minDistance) {
          closestHandles = [{ handle, validHandleResult }]
        } else if (distance === minDistance) {
          // when multiple handles are on the same distance we collect all of them
          closestHandles.push({
            handle,
            validHandleResult,
          })
        }

        minDistance = distance
      }
    }
  }

  if (!closestHandles.length) {
    return { handle: null, validHandleResult: defaultValidHandleResult() }
  }

  if (closestHandles.length === 1) {
    return closestHandles[0]
  }

  const hasValidHandle = closestHandles.some(({ validHandleResult }) => validHandleResult.isValid)
  const hasTargetHandle = closestHandles.some(({ handle }) => handle.type === 'target')

  // if multiple handles are layout on top of each other we prefer the one with type = target and the one that is valid
  return (
    closestHandles.find(({ handle, validHandleResult }) =>
      hasTargetHandle ? handle.type === 'target' : hasValidHandle ? validHandleResult.isValid : true,
    ) || closestHandles[0]
  )
}

// checks if  and returns connection in fom of an object { source: 123, target: 312 }
export function isValidHandle(
  event: MouseEvent | TouchEvent,
  handle: Pick<ConnectionHandle, 'nodeId' | 'id' | 'type'> | null,
  connectionMode: ConnectionMode,
  fromNodeId: string,
  fromHandleId: string | null,
  fromType: HandleType,
  isValidConnection: ValidConnectionFunc,
  doc: Document | ShadowRoot,
  edges: GraphEdge[],
  nodes: GraphNode[],
  findNode: Actions['findNode'],
) {
  const isTarget = fromType === 'target'

  const handleDomNode = doc.querySelector(`.vue-flow__handle[data-id="${handle?.nodeId}-${handle?.id}-${handle?.type}"]`)
  const { x, y } = getEventPosition(event)
  const elementBelow = doc.elementFromPoint(x, y)

  // we always want to prioritize the handle below the mouse cursor over the closest distance handle,
  // because it could be that the center of another handle is closer to the mouse pointer than the handle below the cursor
  const handleToCheck = elementBelow?.classList.contains('vue-flow__handle') ? elementBelow : handleDomNode

  const result = defaultValidHandleResult()

  if (handleToCheck) {
    result.handleDomNode = handleToCheck

    const handleType = getHandleType(undefined, handleToCheck)
    const handleNodeId = handleToCheck.getAttribute('data-nodeid')!
    const handleId = handleToCheck.getAttribute('data-handleid')
    const connectable = handleToCheck.classList.contains('connectable')
    const connectableEnd = handleToCheck.classList.contains('connectableend')

    const connection: Connection = {
      source: isTarget ? handleNodeId : fromNodeId,
      sourceHandle: isTarget ? handleId : fromHandleId,
      target: isTarget ? fromNodeId : handleNodeId,
      targetHandle: isTarget ? fromHandleId : handleId,
    }

    result.connection = connection

    const isConnectable = connectable && connectableEnd

    // in strict mode we don't allow target to target or source to source connections
    const isValid =
      isConnectable &&
      (connectionMode === ConnectionMode.Strict
        ? (isTarget && handleType === 'source') || (!isTarget && handleType === 'target')
        : handleNodeId !== fromNodeId || handleId !== fromHandleId)

    if (isValid) {
      result.isValid = isValidConnection(connection, {
        edges,
        nodes,
        sourceNode: findNode(connection.source)!,
        targetNode: findNode(connection.target)!,
      })

      result.endHandle = {
        nodeId: handleNodeId,
        handleId,
        type: handleType as HandleType,
        position: result.isValid ? (handleToCheck.getAttribute('data-handlepos') as Position) : null,
      }
    }
  }

  return result
}

interface GetHandleLookupParams {
  nodes: GraphNode[]
  nodeId: string
  handleId: string | null
  handleType: string
}

export function getHandleLookup({ nodes, nodeId, handleId, handleType }: GetHandleLookupParams) {
  const handleLookup: ConnectionHandle[] = []
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]

    const { handleBounds } = node

    let sourceHandles: ConnectionHandle[] = []
    let targetHandles: ConnectionHandle[] = []

    if (handleBounds) {
      sourceHandles = getHandles(node, handleBounds, 'source', `${nodeId}-${handleId}-${handleType}`)
      targetHandles = getHandles(node, handleBounds, 'target', `${nodeId}-${handleId}-${handleType}`)
    }

    handleLookup.push(...sourceHandles, ...targetHandles)
  }

  return handleLookup
}

export function getHandleType(edgeUpdaterType: HandleType | undefined, handleDomNode: Element | null): HandleType | null {
  if (edgeUpdaterType) {
    return edgeUpdaterType
  } else if (handleDomNode?.classList.contains('target')) {
    return 'target'
  } else if (handleDomNode?.classList.contains('source')) {
    return 'source'
  }

  return null
}

export function getConnectionStatus(isInsideConnectionRadius: boolean, isHandleValid: boolean) {
  let connectionStatus: ConnectionStatus | null = null

  if (isHandleValid) {
    connectionStatus = 'valid'
  } else if (isInsideConnectionRadius && !isHandleValid) {
    connectionStatus = 'invalid'
  }

  return connectionStatus
}
