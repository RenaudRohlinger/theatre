// @flow
import {type ComponentDescriptor} from '$studio/componentModel/types'
import {makeReactiveComponent, elementify} from '$studio/handy'
// import * as React from 'react'
import * as D from '$shared/DataVerse'

const RenderCurrentCanvas = makeReactiveComponent({
  displayName: 'TheaterJS/Core/RenderCurrentCanvas',
  modifyPrototypalDict: (d) => d.extend({
    render(d) {
      const studioAtom = d.prop('studio').getValue().atom
      const componentIdToBeRenderedAsCurrentCanvasPointer = studioAtom.pointer().prop('state').prop('workspace').prop('componentIdToBeRenderedAsCurrentCanvas')
      const children = d.pointer().prop('props').prop('children')
      const instantiationDescriptorP = D.atoms.dict({
        componentId: D.atoms.box(componentIdToBeRenderedAsCurrentCanvasPointer),
        props: D.atoms.dict({}),
      }).derivedDict().pointer()

      return componentIdToBeRenderedAsCurrentCanvasPointer.flatMap((C) => {
        if (typeof C === 'string') {
          return elementify(
            D.derivations.constant('currentCanvas'),
            instantiationDescriptorP,
            d.prop('studio'),
          )
        } else {
          return children.getValue()
        }
      })
    },
  }),
})

const {object, primitive} = D.literals

const descriptor: ComponentDescriptor = object({
  id: primitive('TheaterJS/Core/RenderCurrentCanvas'),
  type: primitive('HardCoded'),
  reactComponent: primitive(RenderCurrentCanvas),
})

export default descriptor