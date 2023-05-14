import React from "react"

const LoadingLayer = ({ layer, progress }) => {
  return (
    <div className={ `
        bg-white w-72 p-1 mt-2
        rounded-tl rounded-bl rounded-tr-full rounded-br-full
      ` }
      style={ {
      } }>
      <div className={ `bg-white p-1 rounded-tr-full rounded-br-full` }>
        <div className={ `bg-white p-1 rounded-tr-full rounded-br-full flex` }>
          <div className="flex-1 text-lg font-medium flex items-center">
            <div className='flex-1'>{ layer.name }</div>
            <div className={`font-light px-2`}>
              {layer.state.progress ? `${layer.state.progress}%` : '' }
            </div>
          </div>
          <div className={ `text-blue-500` }>
            Loading
          </div>
        </div>
      </div>
    </div>
  )
}
export default LoadingLayer;
