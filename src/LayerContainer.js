//import mapboxgl from "mapbox-gl";
import mapboxgl from 'maplibre-gl'

import DefaultHoverComp from "./components/DefaultHoverComp"

import get from "lodash.get"

import {hasValue} from './components/utils'

let id = -1;
const getLayerId = () => `avl-layer-${ ++id }`;


const DefaultCallback = () => null;

const DefaultOptions = {
  setActive: true,
  isDynamic: false,
  filters: {},
  modals: {},
  mapActions: [],
  sources: [],
  layers: [],
  isVisible: true,
  toolbar: ["toggle-visibility"],
  legend: null,
  infoBoxes: [],
  props: {},
  state: {},
  mapboxMap: null,
  onHover: false,
  onClick: false,
  onBoxSelect: false
}

class LayerContainer {
  constructor(options = {}) {

    const Options = { ...DefaultOptions, ...options };
    for (const key in Options) {
      this[key] = Options[key];
    }

    this.id = getLayerId();

    this.layerVisibility = {};

    this.needsRender = this.setActive;

    this.callbacks = [];
    this.hoveredFeatures = new Map();

    this.dispatchStateUpdate = () => {};

    this.updateState = this.updateState.bind(this);
  }
  _init(mapboxMap, falcor) {
    this.mapboxMap = mapboxMap;
    this.falcor = falcor;
    return this.init(mapboxMap, falcor);
  }
  init(mapboxMap, falcor) {
    return Promise.resolve();
  }

// Don't attach any state directly to layers.
// Use this function to update layer state.
// This function causes an update in React through the map component.
// The React update will cause rerenders in layer components.
// Layer components, modals, infoboxes, etc., should pull from layer.state.
  updateState(newState) {
    if (typeof newState === "function") {
      this.state = newState(this.state);
    }
    else {
      this.state = { ...this.state, ...newState };
    }
    this.dispatchStateUpdate(this, this.state);
  }

  _onAdd(mapboxMap, falcor, updateHover) {
    this.sources.forEach(({ id, source }) => {
      if (!mapboxMap.getSource(id)) {
        mapboxMap.addSource(id, source);
      }
    });
    this.layers.forEach(layer => {
      if (!mapboxMap.getLayer(layer.id)) {
        if (layer.beneath && mapboxMap.getLayer(layer.beneath)) {
          mapboxMap.addLayer(layer, layer.beneath);
        }
        else {
          mapboxMap.addLayer(layer);
        }
        if (!this.isVisible) {
          this._setVisibilityNone(mapboxMap, layer.id);
        }
        this.layerVisibility[layer.id] = mapboxMap.getLayoutProperty(layer.id, "visibility");
      }
    });
    if (this.onHover) {
      this.addHover(mapboxMap, updateHover);
    }
    if (this.onClick) {
      this.addClick(mapboxMap);
    }
    if (this.onBoxSelect) {
      this.state = {
        ...this.state,
        selection: []
      };
      this.addBoxSelect(mapboxMap);
    }
    return this.onAdd(mapboxMap, falcor);
  }
  onAdd(mapboxMap, falcor) {
    return Promise.resolve();
  }

  addClick(mapboxMap) {
    function click(layerId, { point, features, lngLat }) {
      this.onClick.callback.call(this, layerId, features, lngLat, point);
    };

    this.onClick.layers.forEach(layerId => {
      if (layerId === "mapboxMap") {
        const callback = click.bind(this, layerId);
        this.callbacks.push({
          action: "click",
          callback
        });
        mapboxMap.on("click", callback);
      }
      else {
        const callback = click.bind(this, layerId);
        this.callbacks.push({
          action: "click",
          callback,
          layerId
        });
        mapboxMap.on("click", layerId, callback);
      }
    });
  }

  hoverLeave(mapboxMap, layerId) {
    if (!this.hoveredFeatures.has(layerId)) return;

    this.hoveredFeatures.get(layerId).forEach(value => {
      mapboxMap.setFeatureState(value, { hover: false });
    });
    this.hoveredFeatures.delete(layerId);
  }

  addHover(mapboxMap, updateHover) {

    const callback = get(this, ["onHover", "callback"], DefaultCallback).bind(this),
      HoverComp = get(this, ["onHover", "HoverComp"], DefaultHoverComp),
      property = get(this, ["onHover", "property"], null),
      filterFunc = get(this, ["onHover", "filterFunc"], null),
      pinnable = get(this, ["onHover", "pinnable"], true),
      sortOrder = get(this, ["onHover", "sortOrder"], Infinity);

    const mousemove = (layerId, { point, features, lngLat }) => {

      const hoveredFeatures = this.hoveredFeatures.get(layerId) || new Map();
      this.hoveredFeatures.set(layerId, new Map());

      const hoverFeatures = features => {
        features.forEach(({ id, source, sourceLayer }) => {

          if ((id === undefined) || (id === null)) return;

          if (hoveredFeatures.has(id)) {
            this.hoveredFeatures.get(layerId).set(id, hoveredFeatures.get(id));
            hoveredFeatures.delete(id);
          }
          else {
            const value = { id, source, sourceLayer };
            this.hoveredFeatures.get(layerId).set(id, value);
            mapboxMap.setFeatureState(value, { hover: true });
          }
        });
      }

      const featuresMap = new Map();

      if (property) {
        const properties = features.reduce((a, c) => {
          const prop = get(c, ["properties", property], null);
          if (prop) {
            a[prop] = true;
          }
          return a;
        }, {});
        mapboxMap.queryRenderedFeatures({
            layers: [layerId],
            filter: ["in", ["get", property], ["literal", Object.keys(properties)]]
          })
          .forEach(feature => {
            featuresMap.set(feature.id, feature);
          })
      }
      if (filterFunc) {
        const filter = filterFunc.call(this, layerId, features, lngLat, point);
        if (hasValue(filter)) {
          mapboxMap.queryRenderedFeatures({ layers: [layerId], filter })
            .forEach(feature => {
              featuresMap.set(feature.id, feature);
            });
        }
      }
      features.forEach(feature => {
        featuresMap.set(feature.id, feature);
      });

      hoverFeatures([...featuresMap.values()]);

      hoveredFeatures.forEach(value => {
        mapboxMap.setFeatureState(value, { hover: false });
      })

      const data = callback(layerId, features, lngLat, point);

      if (hasValue(data)) {
        updateHover({
          pos: [point.x, point.y],
          type: "hover-layer-move",
          HoverComp,
          layer: this,
          pinnable,
          sortOrder,
          lngLat,
          data
        });
      }
    };

    const mouseleave = (layerId, e) => {
      this.hoverLeave(mapboxMap, layerId);
      updateHover({
        type: "hover-layer-leave",
        layer: this
      });
    };

    this.onHover.layers.forEach(layerId => {
      let callback = mousemove.bind(this, layerId);
      this.callbacks.push({
        action: "mousemove",
        callback,
        layerId
      });
      mapboxMap.on("mousemove", layerId, callback);

      callback = mouseleave.bind(this, layerId);
      this.callbacks.push({
        action: "mouseleave",
        callback,
        layerId
      });
      mapboxMap.on("mouseleave", layerId, callback);
    }, this);
  }

  addBoxSelect(mapboxMap) {
    let start, current, box;

    const canvasContainer = mapboxMap.getCanvasContainer();

    const getPos = e => {
      const rect = canvasContainer.getBoundingClientRect();
      return new mapboxgl.Point(
        e.clientX - rect.left - canvasContainer.clientLeft,
        e.clientY - rect.top - canvasContainer.clientTop
      )
    }

    const mousemove = e => {
      e.preventDefault();

      current = getPos(e);

      if (!box) {
        const className = get(this, ["onBoxSelect", "className"], "bg-black bg-opacity-50 border-2 border-black");
        box = document.createElement("div");
        box.className = "absolute top-0 left-0 w-0 h-0 " + className;
        canvasContainer.appendChild(box);
      }

      var minX = Math.min(start.x, current.x),
        maxX = Math.max(start.x, current.x),
        minY = Math.min(start.y, current.y),
        maxY = Math.max(start.y, current.y);

        box.style.transform = `translate( ${ minX }px, ${ minY }px)`;
        box.style.width = `${ maxX - minX }px`;
        box.style.height = `${ maxY - minY }px`;
    }
    const mouseup = e => {
      finish([start, getPos(e)]);
    }
    const keyup = e => {
      if ((e.keyCode === 27) || (e.which === 27) || (e.code === 'Escape')) {
        finish();
      }
    }

    const finish = bbox => {
      document.removeEventListener('mousemove', mousemove);
      document.removeEventListener('mouseup', mouseup);
      document.removeEventListener('keydown', keyup);

      mapboxMap.dragPan.enable();

      if (box) {
        box.parentNode.removeChild(box);
        box = null;
      }

      if (bbox) {
        const queriedFeatures = mapboxMap.queryRenderedFeatures(bbox, {
          layers: get(this, ["onBoxSelect", "layers"]),
          filter: get(this, ["onBoxSelect", "filter"])
        })

        const featureMap = queriedFeatures.reduce((a, c) => {
          a[c.id] = c;
          return a;
        }, {});

        const features = Object.values(featureMap);

        const values = [];

        features.forEach(feature => {
          values.push({
            id: feature.id,
            source: feature.source,
            sourceLayer: feature.sourceLayer
          });
        });

        get(this, ["onBoxSelect", "selectedValues"], [])
          .forEach(value => {
            mapboxMap.setFeatureState(value, { select: false });
          });

        this.onBoxSelect.selectedValues = values;

        values.forEach(value => {
          mapboxMap.setFeatureState(value, { select: true });
        });

        this.updateState({ selection: features });
      }
    }

    const mousedown = e => {
      if (!(e.shiftKey && e.button === 0)) return;

      document.addEventListener('mousemove', mousemove);
      document.addEventListener('mouseup', mouseup);
      document.addEventListener('keydown', keyup);

      mapboxMap.dragPan.disable();

      start = getPos(e);
    }

    this.callbacks.push({
      action: "mousemove",
      callback: mousemove,
      element: canvasContainer
    });
    canvasContainer.addEventListener("mousedown", mousedown, true);

    mapboxMap.boxZoom.disable();

    this.onBoxSelect.selectedValues = [];
  }

  _onRemove(mapboxMap) {
    while (this.callbacks.length) {
      const { action, layerId, callback, element } = this.callbacks.pop();
      if (element) {
        element.removeEventListener(action, callback);
      }
      else if (layerId) {
        this.mapboxMap.off(action, layerId, callback);
      }
      else {
        this.mapboxMap.off(action, callback);
      }
    }
    this.layers.forEach(({ id }) => {
      this.mapboxMap.removeLayer(id);
    });
    this.onRemove(this.mapboxMap);
  }
  onRemove(mapboxMap) {

  }

  fetchData(falcor) {
    return Promise.resolve();
  }
  render(mapboxMap, falcor) {

  }

  // receiveProps(props, mapboxMap, falcor, MapActions) {
  //
  // }

  toggleVisibility(mapboxMap) {
    this.isVisible = !this.isVisible;
    this.layers.forEach(({ id }) => {
      if (this.isVisible) {
        this._setVisibilityVisible(mapboxMap, id);
      }
      else {
        this._setVisibilityNone(mapboxMap, id);
      }
    });
  }
  _setVisibilityVisible(mapboxMap, layerId) {
    if (this.layerVisibility[layerId] !== "none") {
      mapboxMap.setLayoutProperty(layerId, "visibility", "visible");
    }
  }
  _setVisibilityNone(mapboxMap, layerId) {
    const visibility = mapboxMap.getLayoutProperty(layerId, "visibility");
    if (visibility === "none") {
      this.layerVisibility[layerId] = "none";
    }
    else {
      mapboxMap.setLayoutProperty(layerId, "visibility", "none");
    }
  }
  setLayerVisibility(mapboxMap, layer, visibility) {
    const isVisible = this.isVisible && (visibility === "visible");
    this.layerVisibility[layer.id] = visibility;

    visibility = isVisible ? "visible" : "none";
    mapboxMap.setLayoutProperty(layer.id, "visibility", visibility);
  }

  onFilterChange(filterName, newValue, prevValue) {

  }

  onMapStyleChange(mapboxMap, falcor, updateHover) {
    this._onAdd(mapboxMap, falcor, updateHover)
      .then(() => this.render(mapboxMap, falcor))
  }
}
export { LayerContainer };
