import React from "react"


const DefaultHoverComp = ({ data, layer }) => {

  const groups = data.reduce((a, c, i) => {
    if ((i === 0) || (c.length === 1)) {
      a.push([]);
    }
    const ii = a.length - 1;
    a[ii].push(c);
    return a;
  }, []);

  return (
    <div className={ `
      bg-white p-1 rounded relative z-20 grid grid-cols-1 gap-1
    ` }>
      { groups.map((rows, g) => (
          <div key={ g } className={ `rounded relative px-1 bg-white` }>
            { rows.map((row, i) => (
                <div key={ i } className="flex">
                  { row.map((d, ii) =>
                      <div key={ ii }
                        className={ `
                          ${ ii === 0 ? "flex-1 font-bold" : "flex-0" }
                          ${ row.length > 1 && ii === 0 ? "mr-4" : "" }
                          ${ row.length === 1 && ii === 0 ? `border-b-2 text-lg ${ i > 0 ? "mt-1" : "" }` : "" }
                        ` }>
                        { d }
                      </div>
                    )
                  }
                </div>
              ))
            }
          </div>
        ))
      }
    </div>
  )
}
export default DefaultHoverComp;
