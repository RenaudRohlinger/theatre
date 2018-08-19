import Project from '$tl/Project/Project'
import InternalTimeline from './InternalTimeline'
import TimelineInstanceObject from '$tl/objects/TimelineInstanceObject'
import {validateAndSanitiseSlashedPathOrThrow} from '$tl/handy/slashedPaths'
import {NativeObjectTypeConfig} from '$tl/objects/objectTypes'
import atom, {Atom} from '$shared/DataVerse2/atom'
import {Pointer} from '$shared/DataVerse2/pointer'
import {TimelineInstanceAddress} from '$tl/handy/addresses'

type State = {
  time: number
}

export default class TimelineInstance {
  _internalTimeline: InternalTimeline
  _objects: {[path: string]: TimelineInstanceObject} = {}
  _address: TimelineInstanceAddress
  protected _state: Atom<State> = atom({time: 0})
  public statePointer: Pointer<State>

  constructor(
    protected readonly _project: Project,
    protected readonly _path: string,
    public readonly _instanceId: string,
  ) {
    this._internalTimeline = _project._getInternalTimeline(_path)
    this.statePointer = this._state.pointer
    this._address = {
      ...this._internalTimeline._address,
      timelineInstanceId: _instanceId,
    }
  }

  createObject(
    _path: string,
    nativeObject: $FixMe,
    config?: NativeObjectTypeConfig,
  ): TimelineInstanceObject {
    const path = validateAndSanitiseSlashedPathOrThrow(
      _path,
      'timeline.createObject',
    )

    let object = this._objects[path]
    if (!object) {
      object = this._objects[path] = new TimelineInstanceObject(
        this,
        path,
        nativeObject,
        config,
      )
    } else {
      if (nativeObject !== object.nativeObject) {
        throw new Error(
          `Looks like you're creating two different objects on the same path "${path}". 
          If you're trying to create two different objects, give each a unique path.
          Otherwise if you're trying to query the same existing object, you can run 
          timeline.getObject(path) to get access to that object after it's been created.`,
        )
      }
    }

    return object
  }

  getObject(_path: string): TimelineInstanceObject | undefined {
    const path = validateAndSanitiseSlashedPathOrThrow(
      _path,
      'timeline.getObject',
    )

    return this._objects[path]
  }

  gotoTime = (t: number) => {
    this._state.reduceState(
      ['time'],
      () => (typeof t === 'number' && t >= 0 ? t : 0),
    )
  }
}
