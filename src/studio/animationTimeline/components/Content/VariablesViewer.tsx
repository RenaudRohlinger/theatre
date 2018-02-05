// @flow
import {React, connect, reduceStateAction} from '$studio/handy'
import {getVariablesByIds} from '$studio/animationTimeline/selectors'
import {
  VariableID,
  VariableObject,
  Point,
  PointPosition,
  PointHandles,
  NormalizedPoint,
} from '$studio/animationTimeline/types'
import css from './VariablesViewer.css'
import Variable from './Variable'
import BoxLegends from './BoxLegends'
import PointValuesEditor from './PointValuesEditor'
import * as _ from 'lodash'
import cx from 'classnames'
import {Subscriber} from 'react-broadcast';
import {SortableBoxDragChannel} from './SortableBox'
import DraggableArea from '$studio/common/components/DraggableArea'

type OwnProps = {
  variableIds: VariableID[],
  splitVariable: Function,
  panelWidth: number,
  duration: number,
  currentTime: number,
  focus: [number, number],
  boxHeight: number,
  tempIncludeTimeGrid?: boolean
}

type Props = OwnProps & {
  variables: VariableObject[],
  dispatch: Function,
}

type State = {
  svgWidth: number,
  svgHeight: number,
  svgTransform: number,
  svgExtremums: [number, number],
  activeVariableId: string,
  pointValuesEditorProps: undefined | null | Object,}
const resetExtremums = variableId => {
  return reduceStateAction(
    ['animationTimeline', 'variables', 'byId', variableId],
    variable => {
      const {points} = variable
      if (points.length === 0) return variable
      const newExtremums = points.reduce(
        (reducer, point, index) => {
          const {value} = point
          const prevValue = points[index - 1] ? points[index - 1].value : 0
          const nextValue = points[index + 1] ? points[index + 1].value : 0
          const handles = [
            point.handles[1] * Math.abs(prevValue - value),
            point.handles[3] * Math.abs(nextValue - value),
          ]
          return [
            Math.min(
              reducer[0],
              Math.min(value, value + handles[0] - 15, value + handles[1]) - 15,
            ),
            Math.max(
              reducer[1],
              Math.max(value, value + handles[0] + 15, value + handles[1]) + 15,
            ),
          ]
        },
        [0, 60],
      )
      return {
        ...variable,
        extremums: newExtremums,
      }
    },
  )
}

const colors = ['#3AAFA9', '#575790', '#B76C6C', '#FCE181']
class VariablesViewer extends React.Component<Props, State> {
  svgArea: HTMLElement

  constructor(props: Props) {
    super(props)
    this.state = {
      ...this._getSvgState(props),
      pointValuesEditorProps: null,activeVariableId: props.variableIds[0],}
  }

  componentWillReceiveProps(nextProps) {
    let activeVariableId = this.state.activeVariableId
    if (nextProps.variableIds.find(id => id === activeVariableId) == null) {
      activeVariableId = nextProps.variableIds[0]
    }
    if (
      this.state.activeVariableId !== activeVariableId ||
      nextProps.boxHeight !== this.props.boxHeight ||
      nextProps.duration !== this.props.duration ||
      nextProps.panelWidth !== this.props.panelWidth ||
      ((nextProps.focus[1] - nextProps.focus[0]) !== (this.props.focus[1] - this.props.focus[0])) 
    ) {
      this.setState(() => ({...this._getSvgState(nextProps), activeVariableId}))
    }
    // this.setState(() => ({...this._getSvgState(nextProps), activeVariableId}))
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextProps.boxHeight !== this.props.boxHeight) return true
    if (nextProps.canBeMerged !== this.props.canBeMerged) return true
    if (nextProps.shouldIndicateMerge !== this.props.shouldIndicateMerge) return true
    if (!_.isEqual(nextProps.variables, this.props.variables)) return true
    if (nextState.svgWidth !== this.state.svgWidth) return true
    if (nextState.activeVariableId !== this.state.activeVariableId) return true
    if (nextState.pointValuesEditorProps !== this.state.pointValuesEditorProps) return true
    return false
  }

  // componentDidUpdate(_, prevState) {
  //   if (prevState.svgTransform !== this.state.svgTransform) {
  //     this.container.scrollLeft = this.state.svgTransform
  //   }
  // }

  titleClickHandler(e: SyntheticMouseEvent<>, variableId: string) {
    if (e.altKey) {
      return this.props.splitVariable(variableId)
    }
    this.setActiveVariable(variableId)
  }

  setActiveVariable = (activeVariableId: string) => {
    this.setState(() => ({activeVariableId}))
  }

  _getSvgState(props) {
    const {boxHeight, duration, focus, panelWidth, variables} = props
    const svgHeight = boxHeight - 14
    const svgWidth = Math.floor(duration / (focus[1] - focus[0]) * panelWidth)
    const svgTransform = svgWidth * focus[0] / duration
    const svgExtremums = variables.reduce(
      (reducer, {extremums}) => {
        if (extremums[0] < reducer[0]) reducer[0] = extremums[0]
        if (extremums[1] > reducer[1]) reducer[1] = extremums[1]
        return reducer
      },
      [0, 0],
    )

    return {svgHeight, svgWidth, svgTransform, svgExtremums}
  }

  addPoint = (e: SyntheticMouseEvent<>) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const {top, left} = this.svgArea.getBoundingClientRect()
    const t = e.clientX - left
    const value = e.clientY - top
    const pointProps: Point = {
      t: this._deNormalizeX(t),
      value: this._deNormalizeValue(value),
      isConnected: true,
      handles: [-0.2, 0, 0.2, 0],
    }
    this.props.dispatch(
      reduceStateAction(
        ['animationTimeline', 'variables', 'byId', this.state.activeVariableId],
        variable => {
          const points = variable.points
          let atIndex = points.findIndex(point => point.t > pointProps.t)
          if (atIndex === -1) atIndex = points.length
          return {
            ...variable,
            points: points
              .slice(0, atIndex)
              .concat(pointProps, points.slice(atIndex)),
          }
        },
      ),
    )
    this.props.dispatch(resetExtremums(this.state.activeVariableId))
  }

  removePoint = (variableId: VariableID, pointIndex: number) => {
    this.props.dispatch(
      reduceStateAction(
        ['animationTimeline', 'variables', 'byId', variableId, 'points'],
        points =>
          points.slice(0, pointIndex).concat(points.slice(pointIndex + 1)),
      ),
    )
    this.props.dispatch(resetExtremums(variableId))
  }

  setPointPositionTo = (
    variableId: VariableID,
    pointIndex: number,
    newPosition: PointPosition,
  ) => {
    this.props.dispatch(
      reduceStateAction(
        ['animationTimeline', 'variables', 'byId', variableId, 'points', pointIndex],
        point => ({
          ...point,
          ...newPosition,
        }),
      ),
    )
    this.props.dispatch(resetExtremums(variableId))
  }

  showPointValuesEditor(
    variableId: VariableID,
    pointIndex: number,
    pos: {left: number, top: number},
  ) {
    this.setState(() => ({pointValuesEditorProps: {...pos, variableId, pointIndex}}))
  }

  changePointPositionBy = (
    variableId: VariableID,
    pointIndex: number,
    change: PointPosition,
  ) => {
    const deNormalizedChange = this.deNormalizePositionChange(change)
    this.props.dispatch(
      reduceStateAction(
        ['animationTimeline', 'variables', 'byId', variableId, 'points', pointIndex],
        point => ({
          ...point,
          t: point.t + deNormalizedChange.t,
          value: point.value + deNormalizedChange.value,
        }),
      ),
    )
    this.props.dispatch(resetExtremums(variableId))
  }

  changePointHandlesBy = (
    variableId: VariableID,
    pointIndex: number,
    change: PointHandles,
  ) => {
    const {points} = this.props.variables.find(({id}) => id === variableId)
    const deNormalizedChange = this._deNormalizeHandles(
      change,
      points[pointIndex],
      points[pointIndex - 1],
      points[pointIndex + 1],
    )
    this.props.dispatch(
      reduceStateAction(
        [
          'animationTimeline',
          'variables',
          'byId',
          variableId,
          'points',
          pointIndex,
          'handles',
        ],
        handles => {
          return handles.map(
            (handle, index) => handle + deNormalizedChange[index],
          )
        },
      ),
    )
    this.props.dispatch(resetExtremums(variableId))
  }

  addConnector = (variableId: VariableID, pointIndex: number) => {
    this.props.dispatch(
      reduceStateAction(
        ['animationTimeline', 'variables', 'byId', variableId, 'points', pointIndex],
        point => ({
          ...point,
          isConnected: true,
        }),
      ),
    )
  }

  removeConnector = (variableId: VariableID, pointIndex: number) => {
    this.props.dispatch(
      reduceStateAction(
        ['animationTimeline', 'variables', 'byId', variableId, 'points', pointIndex],
        point => ({
          ...point,
          isConnected: false,
        }),
      ),
    )
  }

  makeHandleHorizontal = (
    variableId: VariableID,
    pointIndex: number,
    side: 'left' | 'right',
  ) => {
    this.props.dispatch(
      reduceStateAction(
        [
          'animationTimeline',
          'variables',
          'byId',
          variableId,
          'points',
          pointIndex,
          'handles',
        ],
        handles => {
          if (side === 'left') {
            handles[1] = 0
          }
          if (side === 'right') {
            handles[3] = 0
          }
          return handles
        },
      ),
    )
    this.props.dispatch(resetExtremums(variableId))
  }

  _normalizeX(x: number) {
    return x * this.state.svgWidth / this.props.duration
  }

  _deNormalizeX(x: number) {
    return x * this.props.duration / this.state.svgWidth
  }

  _normalizeY(y: number) {
    const {svgHeight, svgExtremums} = this.state
    return -y * svgHeight / (svgExtremums[1] - svgExtremums[0])
  }

  _deNormalizeY(y: number) {
    const {svgHeight, svgExtremums} = this.state
    return -y * (svgExtremums[1] - svgExtremums[0]) / svgHeight
  }

  _normalizeValue(value: number) {
    return this._normalizeY(value - this.state.svgExtremums[1])
  }

  _deNormalizeValue(value: number) {
    return this.state.svgExtremums[1] + this._deNormalizeY(value)
  }

  normalizePositionChange = (position: PointPosition): PointPosition => {
    return {
      t: this._normalizeX(position.t),
      value: this._normalizeY(position.value),
    }
  }

  deNormalizePositionChange = (position: PointPosition): PointPosition => {
    return {
      t: this._deNormalizeX(position.t),
      value: this._deNormalizeY(position.value),
    }
  }

  _normalizeHandles = (
    handles: PointHandles,
    point: Point,
    prevPoint: undefined | null | Point,
    nextPoint: undefined | null | Point,
  ): PointHandles => {
    const handlesInPixels = [
      ...(prevPoint != null
        ? [
            handles[0] * Math.abs(prevPoint.t - point.t),
            handles[1] * Math.abs(prevPoint.value - point.value),
          ]
        : handles.slice(0, 2)),
      ...(nextPoint != null
        ? [
            handles[2] * Math.abs(nextPoint.t - point.t),
            handles[3] * Math.abs(nextPoint.value - point.value),
          ]
        : handles.slice(2)),
    ]
    return [
      this._normalizeX(handlesInPixels[0]),
      this._normalizeY(handlesInPixels[1]),
      this._normalizeX(handlesInPixels[2]),
      this._normalizeY(handlesInPixels[3]),
    ]
  }

  _deNormalizeHandles = (
    handles: PointHandles,
    point: Point,
    prevPoint: undefined | null | Point,
    nextPoint: undefined | null | Point,
  ): PointHandles => {
    const deNormalizedHandles: PointHandles = [
      this._deNormalizeX(handles[0]),
      this._deNormalizeY(handles[1]),
      this._deNormalizeX(handles[2]),
      this._deNormalizeY(handles[3]),
    ]
    return [
      ...(prevPoint != null
        ? [
            deNormalizedHandles[0] / Math.abs(prevPoint.t - point.t),
            deNormalizedHandles[1] / Math.abs(prevPoint.value - point.value),
          ]
        : [deNormalizedHandles[0], deNormalizedHandles[1]]),
      ...(nextPoint != null
        ? [
            deNormalizedHandles[2] / Math.abs(nextPoint.t - point.t),
            deNormalizedHandles[3] / Math.abs(nextPoint.value - point.value),
          ]
        : [deNormalizedHandles[2], deNormalizedHandles[3]]),
    ]
  }

  _normalizePoints(points: Point[]): NormalizedPoint[] {
    return points.map((point, index) => {
      const {t, value, handles, isConnected} = point
      return {
        _t: t,
        _value: value,
        t: this._normalizeX(t),
        value: this._normalizeValue(value),
        handles: this._normalizeHandles(
          handles,
          point,
          points[index - 1],
          points[index + 1],
        ),
        isConnected,
      }
    })
  }


  // variableIds={box.variables}
  // splitVariable={variableId => this.splitVariable(index, variableId)}
  // panelWidth={panelWidth}
  // duration={duration}
  // currentTime={currentTime}
  // focus={focus}
  // canBeMerged={canBeMerged}
  // shouldIndicateMerge={shouldIndicateMerge}

  render() {
    const {variables, shouldIndicateMerge, canBeMerged, tempIncludeTimeGrid} = this.props
    const {svgHeight, svgWidth, svgTransform, activeVariableId, pointValuesEditorProps} = this.state
    return (
      <Subscriber channel={SortableBoxDragChannel}>
        {({onDragStart, onDrag, onDragEnd}) => {
          return (
            <div
              ref={c => this.container = c}
              className={cx(css.container ,{[css.indicateMerge]: shouldIndicateMerge, [css.canBeMerged]: canBeMerged})}
              style={{width: svgWidth}}
            >
              {tempIncludeTimeGrid && <div className={css.timeGrid} />}
              <DraggableArea
                withShift={true}
                onDragStart={onDragStart}
                onDrag={(_, dy) => onDrag(dy)}
                onDragEnd={onDragEnd}
              >
                <div className={css.boxLegends}>
                  <BoxLegends
                    variables={variables.map(variable => _.pick(variable, ['id', 'component', 'property']))}
                    colors={colors}
                    activeVariableId={activeVariableId}
                    setActiveVariable={this.setActiveVariable}
                    splitVariable={this.props.splitVariable}
                  />
                </div>
              </DraggableArea>
              <div className={css.svgArea}>
                <svg
                  height={svgHeight}
                  width={svgWidth}
                  // style={{transform: `translateX(${-svgTransform}px)`}}
                  ref={svg => {
                    if (svg != null) this.svgArea = svg
                  }}
                  onClick={this.addPoint}
                >
                  {variables.map(({id, points}, index) => (
                    <Variable
                      key={id}
                      variableId={id}
                      points={this._normalizePoints(points)}
                      color={colors[index % colors.length]}
                      width={svgWidth}
                      showPointValuesEditor={(index, pos) =>
                        this.showPointValuesEditor(id, index, pos)
                      }
                      changePointPositionBy={(index, change) =>
                        this.changePointPositionBy(id, index, change)
                      }
                      changePointHandlesBy={(index, change) =>
                        this.changePointHandlesBy(id, index, change)
                      }
                      setPointPositionTo={(index, newPosition) =>
                        this.setPointPositionTo(id, index, newPosition)
                      }
                      removePoint={index => this.removePoint(id, index)}
                      addConnector={index => this.addConnector(id, index)}
                      removeConnector={index => this.removeConnector(id, index)}
                      makeHandleHorizontal={(index, side) =>
                        this.makeHandleHorizontal(id, index, side)
                      }
                    />
                  ))}
                </svg>
              </div>
              {pointValuesEditorProps != null &&
                <PointValuesEditor
                  {...(_.pick(pointValuesEditorProps, ['left', 'top', 'initialValue', 'initialTime']))}
                  onClose={() => this.setState(() => ({pointValuesEditorProps: null}))}
                  onSubmit={(newPosition) => this.setPointPositionTo(pointValuesEditorProps.variableId, pointValuesEditorProps.pointIndex, newPosition)}
                />
              }
            </div>
          )
        }}
      </Subscriber>
    )
  }
}

export default connect((s, op) => {
  return {
    variables: getVariablesByIds(s, op.variableIds),
  }
})(VariablesViewer)