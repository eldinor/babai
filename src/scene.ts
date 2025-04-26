import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Animation,
  StandardMaterial,
  Mesh,
  Quaternion,
} from "@babylonjs/core";

// import { MatrixCloner, LinearCloner, RadialCloner, ObjectCloner, RandomEffector } from "./Cloner";
// @ts-ignore
import { GameEntity } from "./core/GameEntity";
import { GridMaterial } from "@babylonjs/materials/grid/gridMaterial";

export function createScene(engine: Engine, canvas: HTMLCanvasElement): Scene {
  // Create a basic BJS Scene
  const scene = new Scene(engine);

  // Create a camera
  const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), scene);
  camera.attachControl(canvas, true);

  // Add light
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  const ground = MeshBuilder.CreateGround("ground", { width: 20, height: 20 });
  const gridMat = new GridMaterial("gridMat", scene);
  ground.material = gridMat;

  const mesh1 = MeshBuilder.CreateBox("box");
  const mesh2 = MeshBuilder.CreateCapsule("mesh2");

  // Create first entity
  const entity1 = new GameEntity();
  entity1.name = "Parent";
  entity1.position.set(1, 0, 3);

  entity1.scaling.y = 3;

  // Create second entity
  const entity2 = new GameEntity();
  entity2.name = "Child";
  entity2.position.set(3, 1, 0);

  entity1.add(entity2);

  console.log(entity1);

  entity1.setRenderComponent(mesh1, (mesh1, { position, rotation, scaling }) => {
    mesh1.position.copyFrom(position);

    // Ensure rotation quaternion exists
    if (!mesh1.rotationQuaternion) {
      mesh1.rotationQuaternion = new Quaternion();
    }
    mesh1.rotationQuaternion.copyFrom(rotation);

    // CRITICAL: Apply scaling to mesh
    mesh1.scaling.copyFrom(scaling);

    console.log("Applied scaling:", scaling.toString()); // Debug output
  });

  entity2.setRenderComponent(mesh2, (mesh2, { position, rotation, scaling }) => {
    mesh2.position.copyFrom(position);

    // Ensure rotation quaternion exists
    if (!mesh2.rotationQuaternion) {
      mesh2.rotationQuaternion = new Quaternion();
    }
    mesh2.rotationQuaternion.copyFrom(rotation);

    // CRITICAL: Apply scaling to mesh
    mesh2.scaling.copyFrom(scaling);

    console.log("Applied scaling:", scaling.toString()); // Debug output
  });

  /*
  // Set up render components
  entity1.setRenderComponent(mesh1, (mesh, { position, rotation, scaling }) => {
    console.log("Updating mesh1 transform");
    mesh.position.copyFrom(position);
    if (!mesh.rotationQuaternion) mesh.rotationQuaternion = new Quaternion();
    mesh.rotationQuaternion.copyFrom(rotation);
    mesh.scaling.copyFrom(scaling);
  });

  entity2.setRenderComponent(mesh2, (mesh, { position, rotation, scaling }) => {
    console.log("Updating mesh2 transform");
    mesh.position.copyFrom(position);
    if (!mesh.rotationQuaternion) mesh.rotationQuaternion = new Quaternion();
    mesh.rotationQuaternion.copyFrom(rotation);
    mesh.scaling.copyFrom(scaling);
  });

*/

  // Establish hierarchy
  //

  // entity1.scaling = new Vector3(4, 1, 1);
  // console.log(entity1);

  // In your game loop:
  function gameLoop() {
    entity1.update();
    entity2.update();
    requestAnimationFrame(gameLoop);
  }

  //
  return scene;
}
function _syncEntityToRender(entity: GameEntity, renderComponent: Mesh) {
  renderComponent.position.copyFrom(entity.position);
  renderComponent.rotation.copyFrom(entity.rotation);
  renderComponent.scaling.copyFrom(entity.scaling);
  // renderComponent.computeWorldMatrix()
}
