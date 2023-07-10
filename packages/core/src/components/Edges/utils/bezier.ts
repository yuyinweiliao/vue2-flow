import { getBezierEdgeCenter } from './general'
import { Position } from '~/types'

export interface GetBezierPathParams {
  sourceX: number
  sourceY: number
  sourcePosition?: Position
  targetX: number
  targetY: number
  targetPosition?: Position
  curvature?: number
  controlOffsetX?: number
  controlOffsetY?: number
}

interface GetControlWithCurvatureParams {
  pos: Position
  x1: number
  y1: number
  x2: number
  y2: number
  c: number
}

function calculateControlOffset(distance: number, curvature: number) {
  if (distance >= 0) {
    return 0.5 * distance
  } else {
    return curvature * 25 * Math.sqrt(-distance)
  }
}

function getControlWithCurvature({ pos, x1, y1, x2, y2, c }: GetControlWithCurvatureParams): [number, number] {
  let ctX: number, ctY: number
  switch (pos) {
    case Position.Left:
      ctX = x1 - calculateControlOffset(x1 - x2, c)
      ctY = y1
      break
    case Position.Right:
      ctX = x1 + calculateControlOffset(x2 - x1, c)
      ctY = y1
      break
    case Position.Top:
      ctX = x1
      ctY = y1 - calculateControlOffset(y1 - y2, c)
      break
    case Position.Bottom:
      ctX = x1
      ctY = y1 + calculateControlOffset(y2 - y1, c)
      break
  }
  return [ctX, ctY]
}

export function getBezierPath({
  sourceX,
  sourceY,
  sourcePosition = Position.Bottom,
  targetX,
  targetY,
  targetPosition = Position.Top,
  curvature = 0.25,
  controlOffsetX = 0,
  controlOffsetY = 0,
}: GetBezierPathParams): [path: string, labelX: number, labelY: number, offsetX: number, offsetY: number] {
  let [sourceControlX, sourceControlY] = getControlWithCurvature({
    pos: sourcePosition,
    x1: sourceX,
    y1: sourceY,
    x2: targetX,
    y2: targetY,
    c: curvature,
  })
  let [targetControlX, targetControlY] = getControlWithCurvature({
    pos: targetPosition,
    x1: targetX,
    y1: targetY,
    x2: sourceX,
    y2: sourceY,
    c: curvature,
  })

  sourceControlX += controlOffsetX
  sourceControlY += controlOffsetY
  targetControlX += controlOffsetX
  targetControlY += controlOffsetY

  const [centerX, centerY, offsetX, offsetY] = getBezierEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceControlX,
    sourceControlY,
    targetControlX,
    targetControlY,
  })

  return [
    `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
    centerX,
    centerY,
    offsetX,
    offsetY,
  ]
}
