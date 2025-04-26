import { Vector3, Quaternion, Matrix } from "@babylonjs/core/Maths/math.vector";

/**
 * Base class for all game entities with optimized parent-child transforms.
 */
export class GameEntity {
  constructor() {
      // Debug identification
      this._debugId = Math.random().toString(36).substring(2, 9);
      console.debug(`[GameEntity] Constructing new entity (ID: ${this._debugId})`);

      // Basic properties
      this.name = "";
      this.active = true;
      this.children = [];
      this.parent = null;
      this.neighbors = [];
      this.neighborhoodRadius = 1;
      this.updateNeighborhood = false;

      // Transform properties
      this._position = Vector3.Zero();
      this._rotation = Quaternion.Identity();
      this._scaling = new Vector3(1, 1, 1);
      
      // World transform cache
      this._worldPosition = new Vector3();
      this._worldRotation = Quaternion.Identity();
      this._worldScale = new Vector3(1, 1, 1);
      
      // Direction vectors
      this.forward = new Vector3(0, 0, 1);
      this.up = new Vector3(0, 1, 0);
      
      // Physics/behavior properties
      this.boundingRadius = 0;
      this.maxTurnRate = Math.PI;
      this.canActivateTrigger = true;
      this.manager = null;

      // Rendering system
      this._renderComponent = null;
      this._renderComponentCallback = null;
      
      // Matrix system
      this._localMatrix = new Matrix();
      this._worldMatrix = new Matrix();
      this._worldMatrixDirty = true;
      this._localMatrixDirty = true;
      this._transformDirty = true;
      
      // State tracking
      this._started = false;
      this._uuid = null;
  }

  // Debug logger
  _log(...args) {
      console.debug(`[GameEntity:${this.name || this._debugId}]`, ...args);
  }

  // Position property with dirty flag handling
  get position() {
      return this._position;
  }
  
  set position(value) {
      if (!value ) {
          this._log("Invalid position assignment:", value);
          throw new Error("Position must be a Vector3");
      }
      if (!this._position.equalsWithEpsilon(value, 0.0001)) {
          this._position.copyFrom(value);
          this._markDirty();
      }
  }

  // Rotation property with dirty flag handling
  get rotation() {
      return this._rotation;
  }
  
  set rotation(value) {
      if (!value || !value._x) {
          this._log("Invalid rotation assignment:", value);
          throw new Error("Rotation must be a Quaternion");
      }
      if (!this._rotation.equalsWithEpsilon(value, 0.0001)) {
          this._rotation.copyFrom(value);
          this._markDirty();
      }
  }

  // scaling property with dirty flag handling
  get scaling() {
      return this._scaling;
  }
  
  set scaling(value) {
      if (!value ) {
          this._log("Invalid scaling assignment:", value);
          throw new Error("scaling must be a Vector3");
      }
      if (!this._scaling.equalsWithEpsilon(value, 0.0001)) {
          this._scaling.copyFrom(value);
          this._markDirty();
      }
  }

  get worldMatrix() {
      this._updateWorldMatrix();
      return this._worldMatrix;
  }

  get uuid() {
      if (this._uuid === null) {
          this._uuid = this._generateUUID();
      }
      return this._uuid;
  }

  start() {
      this._log("Entity started");
      this._started = true;
      return this;
  }

  update(delta) {
      if (this._transformDirty && this._renderComponent) {
          this._log("Syncing render component (transform dirty)");
          this._syncEntityToRender();
          this._transformDirty = false;
      }
      return this;
  }

  add(entity) {
      if (!entity) {
          this._log("Attempted to add null/undefined entity");
          return this;
      }

      this._log(`Adding child entity: ${entity.name || entity._debugId}`);

      if (entity.parent !== null) {
          entity.parent.remove(entity);
      }

      this.children.push(entity);
      entity.parent = this;
      entity._worldMatrixDirty = true;
      return this;
  }

  remove(entity) {
      if (!entity) {
          this._log("Attempted to remove null/undefined entity");
          return this;
      }

      const index = this.children.indexOf(entity);
      if (index !== -1) {
          this._log(`Removing child entity: ${entity.name || entity._debugId}`);
          this.children.splice(index, 1);
          entity.parent = null;
          entity._worldMatrixDirty = true;
      } else {
          this._log(`Child entity not found: ${entity.name || entity._debugId}`);
      }
      return this;
  }

  setRenderComponent(renderComponent, callback) {
      this._log("Setting render component", renderComponent);
      
      if (!renderComponent) {
          this._log("Render component is null/undefined");
          throw new Error("Render component cannot be null");
      }
      
      if (!callback || typeof callback !== 'function') {
          this._log("Invalid render callback", callback);
          throw new Error("Render callback must be a function");
      }

      this._renderComponent = renderComponent;
      this._renderComponentCallback = callback;
      
      // Immediate sync
      this._syncEntityToRender();
      return this;
  }

  _syncEntityToRender() {
      if (!this._renderComponent) {
          this._log("No render component to sync");
          return;
      }

      if (!this._renderComponentCallback) {
          this._log("No render callback available");
          return;
      }

      try {
          this._log("Syncing to render component");
          
          // Ensure world matrix is current
          this._updateWorldMatrix();
          
          // Extract world transforms
          const position = new Vector3();
          const rotation = new Quaternion();
          const scaling = new Vector3();
          
          this._worldMatrix.decompose(scaling, rotation, position);
          
          // Debug output
          this._log("World Transform - Position:", position.toString());
          this._log("World Transform - Rotation:", rotation.toString());
          this._log("World Transform - scaling:", scaling.toString());
          
          // Apply to render component
          this._renderComponentCallback(this._renderComponent, {
              position,
              rotation,
              scaling
          });
          
      } catch (error) {
          console.error(`[GameEntity:${this.name || this._debugId}] Sync error:`, error);
          throw error;
      }
  }

  // ... (keep all other existing methods like getWorldPosition, lookAt, etc.)

  _updateLocalMatrix() {
      if (this._localMatrixDirty) {
          this._log("Updating local matrix");
          Matrix.ComposeToRef(this._scaling, this._rotation, this._position, this._localMatrix);
          this._localMatrixDirty = false;
          this._worldMatrixDirty = true;
      }
  }

  _updateWorldMatrix() {
      if (!this._worldMatrixDirty) {
          this._log("World matrix already up-to-date");
          return;
      }
      
      this._log("Updating world matrix");
      this._updateLocalMatrix();
      
      if (this.parent) {
          this._log("Has parent - multiplying matrices");
          this.parent._updateWorldMatrix();
          this._localMatrix.multiplyToRef(this.parent._worldMatrix, this._worldMatrix);
      } else {
          this._log("No parent - using local matrix");
          this._worldMatrix.copyFrom(this._localMatrix);
      }
      
      this._worldMatrixDirty = false;
      this._transformDirty = true;
      
      // Mark children as dirty
      for (const child of this.children) {
          child._worldMatrixDirty = true;
      }
  }

  _markDirty() {
      this._log("Marking transform as dirty");
      this._localMatrixDirty = true;
      this._worldMatrixDirty = true;
      
      // Mark children as dirty
      for (const child of this.children) {
          child._worldMatrixDirty = true;
      }
  }

  _rotateTowards(targetRotation, maxAngle, tolerance) {
    this.rotation.normalize();
    targetRotation.normalize();

    const dot = Quaternion.Dot(this.rotation, targetRotation);
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const angle = 2 * Math.acos(clampedDot);

    if (angle < tolerance || isNaN(angle)) {
      this.rotation.copyFrom(targetRotation);
      return true;
    }

    const t = Math.min(1, maxAngle / angle);
    Quaternion.SlerpToRef(this.rotation, targetRotation, t, this.rotation);
    return false;
  }

  _generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  _entitiesToIds(array) {
    return array.map((entity) => entity.uuid);
  }
}