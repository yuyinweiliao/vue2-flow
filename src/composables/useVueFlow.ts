import { getCurrentInstance } from 'vue'
import { useEdgesState, useNodesState } from './useElementState'
import { EdgeChange, FlowOptions, GraphEdge, GraphNode, NodeChange, UseVueFlow } from '~/types'
import { applyChanges } from '~/utils'
import { VueFlow } from '~/context'
import { useStore } from '~/store'

const applyNodeChanges = (changes: NodeChange[], nodes: GraphNode[]) => applyChanges(changes, nodes)
const applyEdgeChanges = (changes: EdgeChange[], edges: GraphEdge[]) => applyChanges(changes, edges)

let id = 0
export default (options?: FlowOptions): UseVueFlow => {
  const currentInstance = getCurrentInstance()
  let vueFlow: UseVueFlow | false | undefined = currentInstance ? inject(VueFlow, undefined) : false
  if (!vueFlow || (vueFlow && options?.id && options.id !== vueFlow.id)) {
    const name = options?.id ?? `vue-flow-${id++}`
    const store = reactive(useStore(name, options))
    const applyNodes = (changes: NodeChange[]) => applyNodeChanges(changes, store.nodes)
    const applyEdges = (changes: EdgeChange[]) => applyEdgeChanges(changes, store.edges)
    vueFlow = {
      id: name,
      store,
      ...toRefs(store),
      useNodesState: (nodes, applyDefault = true) => useNodesState(store, applyNodes)({ nodes, applyDefault }),
      useEdgesState: (edges, applyDefault = true) => useEdgesState(store, applyEdges)({ edges, applyDefault }),
      applyNodeChanges: applyNodes,
      applyEdgeChanges: applyEdges,
      ...store.hooksOn,
    }
  }
  if (currentInstance) provide(VueFlow, vueFlow)

  return vueFlow
}
