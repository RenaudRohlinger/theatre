// @flow
import * as React from 'react'
import * as D from '$shared/DataVerse'
import ElementifyDeclarativeComponent from './ElementifyDeclarativeComponent'
import type {Studio} from '$studio/handy'
import stringStartsWith from 'lodash/startsWith'

const identity = (a) => a

const getComponentDescriptorById = (id: D.IDerivation<string>, studio: D.IDerivation<$FixMe>): $FixMe =>
  D.derivations.withDeps({id, studio}, identity).flatMap(({id, studio}): $FixMe => {
    const idString = id.getValue()
    return stringStartsWith(idString, 'TheaterJS/Core/')
      ? studio.getValue().atom.pointer().prop('coreComponentDescriptorsById').prop(idString)
      : studio.getValue().atom.pointer().prop('state').prop('componentModel').prop('componentDescriptorsById').prop(idString)
  })

export const getAliasLessComponentDescriptor = (initialComponentId: D.IDerivation<string>, studio: D.IDerivation<Studio>): $FixMe => {
  return getComponentDescriptorById(initialComponentId, studio).flatMap((des): $FixMe => {
    if (!des) return

    return des.pointer().prop('type').flatMap((type) => {
      if (type === 'Alias') {
        return des.pointer().prop('aliasedComponentId').flatMap((aliasedComponentId) => getAliasLessComponentDescriptor(D.derivations.constant(aliasedComponentId), studio))
      } else {
        return des
      }
    })
  })
}

const elementify = (keyD, instantiationDescriptorP, studioD) => {
  const componentIdP = instantiationDescriptorP.prop('componentId')
  return getAliasLessComponentDescriptor(componentIdP, studioD).flatMap((componentDescriptor) => {
    if (!componentDescriptor) return D.derivations.autoDerive(() => {
      return <div>Cannot find component {componentIdP.getValue()}</div>
    })

    const componentDescriptorP = componentDescriptor.pointer()
    // const innerProps = D.atoms.dict({
    //   componentDescriptor: componentDescriptorP,
    //   props: instantiationDescriptorP.prop('props'),
    //   modifierInstantiationDescriptors: instantiationDescriptorP.prop('modifierInstantiationDescriptors'),
    // }).derivedDict()

    const componentDescriptorTypeP = componentDescriptorP.prop('type')
    return componentDescriptorTypeP.flatMap((type: string) => {
      if (type === 'HardCoded') {
        return elementifyHardCodedComponent(
          keyD, componentDescriptorP, instantiationDescriptorP.prop('props'), instantiationDescriptorP.prop('modifierInstantiationDescriptors'),
        )
        // return <ElementifyHardCodedComponent key={keyD.getValue()} props={innerProps} />
        // return <ElementifyHardCodedComponent key={keyD.getValue()} props={innerProps} />
      } else {
        return elementifyDeclarativeComponent(
          keyD, componentDescriptorP, instantiationDescriptorP.prop('props'), instantiationDescriptorP.prop('modifierInstantiationDescriptors'),
        )
        // return <ElementifyDeclarativeComponent key={keyD.getValue()} props={innerProps} />
      }
    })
  })
}

export default elementify

const elementifyHardCodedComponent = (keyD, componentDescriptorP, propsP, modifierInstantiationDescriptorsP) => {
  const reactComponentP = componentDescriptorP.prop('reactComponent')
  // debugger

  return D.derivations.autoDerive(() => {
    const Comp = reactComponentP.getValue()
    return <Comp
      key={keyD.getValue()}
      props={propsP}
      modifierInstantiationDescriptors={modifierInstantiationDescriptorsP}
    />
  })
}

const elementifyDeclarativeComponent = (keyD, componentDescriptorP, propsP, modifierInstantiationDescriptorsP) => {
  const innerPropsP = D.atoms.dict({
    componentDescriptor: componentDescriptorP,
    props: propsP,
    modifierInstantiationDescriptors: modifierInstantiationDescriptorsP,
  }).derivedDict().pointer()

  return keyD.flatMap((key) => {
    return <ElementifyDeclarativeComponent
      key={key}
      props={innerPropsP}
    />
  })
}