import React from "react";
import get from "lodash.get";

//import { Icon } from "./HoverCompContainer";

const InfoBoxContainer = ({
  activeLayers,
  width = 320,
  padding = 8,
  MapActions,
  ...props
}) => {
  const [  infoBoxLayers, infoBoxWidth] = React.useMemo(() => activeLayers.reduce(
    (a, c) => {
      
      const shownInfoBoxes = c.infoBoxes.filter(({ show = true }) => {
        let bool = show;
        if (typeof show === "function") {
          bool = show(c);
        }
        return bool;
      });
      if (shownInfoBoxes.length) {
        a[0].push([c, shownInfoBoxes]);
        a[1] = Math.max(
          a[1],
          c.infoBoxes.reduce((aa, cc) => Math.max(aa, get(cc, "width", 0)), 0)
        );
      }
      return a;
    },
    [[], [], width]
  ), [activeLayers, width]);

  return (
    <div
      className={`
        flex flex-col items-end z-30
        pointer-events-none
      `}
      style={{ padding: `${padding}px` }}
    >

      {!infoBoxLayers.length ? null : (
        <div
          style={{
            width: `${infoBoxWidth - padding * 2}px`,
          }}
        >
          {infoBoxLayers.map(([layer, infoBoxes],y) => (
            <div key={y}>
              {infoBoxes.map((box, i) => (
                <InfoBox
                  key={i}
                  {...props}
                  {...box}
                  layer={layer}
                  MapActions={MapActions}
                  activeLayers={activeLayers}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default InfoBoxContainer;

const InfoBox = ({
  layer,
  Component,
  MapActions,
  ...props
}) => {
  return ( 
    <>
      {!Component ? null : (
        <>
          {typeof Component === "function" ? (
            <Component layer={layer} MapActions={MapActions} {...props} />
          ) : (
            Component
          )}
        </>
      )}
    </>
  );
};

