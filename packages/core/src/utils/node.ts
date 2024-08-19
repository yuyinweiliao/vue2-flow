import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { getDimensions } from '@xyflow/system'
import type { Actions, GraphNode, HandleElement, Position } from '../types'

export function getHandleBounds(
  selector: string,
  nodeElement: HTMLDivElement,
  nodeBounds: DOMRect,
  zoom: number,
): HandleElement[] {
  const handles = nodeElement.querySelectorAll(`.vue-flow__handle${selector}`)

  const handlesArray = Array.from(handles) as HTMLDivElement[]

  return handlesArray.map((handle): HandleElement => {
    const handleBounds = handle.getBoundingClientRect()

    return {
      id: handle.getAttribute('data-handleid'),
      position: handle.getAttribute('data-handlepos') as unknown as Position,
      x: (handleBounds.left - nodeBounds.left) / zoom,
      y: (handleBounds.top - nodeBounds.top) / zoom,
      ...getDimensions(handle),
    }
  })
}

export function handleNodeClick(
  node: GraphNode,
  multiSelectionActive: boolean,
  addSelectedNodes: Actions['addSelectedNodes'],
  removeSelectedNodes: Actions['removeSelectedNodes'],
  nodesSelectionActive: Ref<boolean>,
  unselect = false,
  nodeEl: HTMLDivElement,
) {
  nodesSelectionActive.value = false

  if (!node.selected) {
    addSelectedNodes([node])
  } else if (unselect || (node.selected && multiSelectionActive)) {
    removeSelectedNodes([node])

    nextTick(() => {
      nodeEl.blur()
    })
  }
}
