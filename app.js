const STORAGE_KEY = "seo-topic-map-state-v2";
const LEGACY_STORAGE_KEY = "mind-garden-state-v1";
const SUPABASE_URL = "https://ztmypwifpmevuqijxypj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0bXlwd2lmcG1ldnVxaWp4eXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDIwMzYsImV4cCI6MjA5MjkxODAzNn0.kGvYx9J1by_SZjxWHuHVOrO1kc3ysEsBP4MoraRpgQE";
const SUPABASE_TABLE = "mindmap_documents";
const TEAM_DOCUMENT_SLUG = "team-default";
const NODE_WIDTH = 248;
const NODE_HEIGHT = 160;
const MIN_SCALE = 0.18;
const MAX_SCALE = 1.8;
const MAX_HISTORY = 120;
const EDGE_INSERT_THRESHOLD = 34;
const MARQUEE_DRAG_THRESHOLD = 6;
const LAYOUT_START_X = 120;
const LAYOUT_START_Y = 120;
const LAYOUT_DEPTH_GAP = 240;
const LAYOUT_SIBLING_GAP = 84;
const LAYOUT_ROOT_GAP = 140;

const state = {
  folders: [],
  activeFolderId: null,
  activeMapId: null,
  drag: null,
  categoryEditorId: null,
  onlineDocId: null,
  onlineShareToken: null,
  onlineLoadMode: null,
  onlineLoadedTarget: null,
  user: null,
  keyboard: {
    spacePressed: false,
  },
};

const historyState = {
  past: [],
  future: [],
};

const touchPointers = new Map();

const elements = {
  canvasShell: document.getElementById("canvas-shell"),
  canvasContent: document.getElementById("canvas-content"),
  connections: document.getElementById("connections"),
  nodesLayer: document.getElementById("nodes-layer"),
  workspaceLocked: document.getElementById("workspace-locked"),
  nodeTemplate: document.getElementById("node-template"),
  workspaceTitle: document.getElementById("workspace-title"),
  folderNameInput: document.getElementById("folder-name-input"),
  mapNameInput: document.getElementById("map-name-input"),
  authStatus: document.getElementById("auth-status"),
  passcodeInput: document.getElementById("passcode-input"),
  authEmailInput: document.getElementById("auth-email-input"),
  loginButton: document.getElementById("login-btn"),
  logoutButton: document.getElementById("logout-btn"),
  folderList: document.getElementById("folder-list"),
  mapList: document.getElementById("map-list"),
  newFolderButton: document.getElementById("new-folder-btn"),
  duplicateFolderButton: document.getElementById("duplicate-folder-btn"),
  deleteFolderButton: document.getElementById("delete-folder-btn"),
  newMapButton: document.getElementById("new-map-btn"),
  duplicateMapButton: document.getElementById("duplicate-map-btn"),
  deleteMapButton: document.getElementById("delete-map-btn"),
  addRootButton: document.getElementById("add-root-btn"),
  addChildButton: document.getElementById("add-child-btn"),
  duplicateNodeButton: document.getElementById("duplicate-node-btn"),
  disconnectNodeButton: document.getElementById("disconnect-node-btn"),
  deleteNodeButton: document.getElementById("delete-node-btn"),
  centerViewButton: document.getElementById("center-view-btn"),
  saveOnlineButton: document.getElementById("save-online-btn"),
  loadOnlineButton: document.getElementById("load-online-btn"),
  shareOnlineButton: document.getElementById("share-online-btn"),
  exportPngButton: document.getElementById("export-png-btn"),
  exportButton: document.getElementById("export-btn"),
  importInput: document.getElementById("import-input"),
  nodeTitleInput: document.getElementById("node-title-input"),
  nodeNoteInput: document.getElementById("node-note-input"),
  nodeColorInput: document.getElementById("node-color-input"),
  nodeLinkInput: document.getElementById("node-link-input"),
  parentNodeDisplay: document.getElementById("parent-node-display"),
  childNodeDisplay: document.getElementById("child-node-display"),
  nodeCategoryList: document.getElementById("node-category-list"),
  categorySelectionNote: document.getElementById("category-selection-note"),
  categoryEditorNote: document.getElementById("category-editor-note"),
  categoryManagerList: document.getElementById("category-manager-list"),
  categoryNameInput: document.getElementById("category-name-input"),
  categoryColorInput: document.getElementById("category-color-input"),
  addCategoryButton: document.getElementById("add-category-btn"),
  saveCategoryButton: document.getElementById("save-category-btn"),
  deleteCategoryButton: document.getElementById("delete-category-btn"),
  selectionStatus: document.getElementById("selection-status"),
  saveStatus: document.getElementById("save-status"),
};

let saveStatusTimer = null;
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) ?? null;

initialize();

async function initialize() {
  hydrateState();
  hydrateOnlineTarget();
  resetHistory();
  bindEvents();
  render();
  await restoreAuthSession();

  if (state.user && state.onlineShareToken) {
    loadSharedOnlineDocument(state.onlineShareToken);
  } else if (state.user && state.onlineDocId) {
    loadOnlineDocument(state.onlineDocId);
  } else if (state.user) {
    loadTeamOnlineDocument();
  }
}

function bindEvents() {
  elements.newFolderButton.addEventListener("click", createFolder);
  elements.duplicateFolderButton.addEventListener("click", duplicateActiveFolder);
  elements.deleteFolderButton.addEventListener("click", deleteActiveFolder);
  elements.newMapButton.addEventListener("click", createMap);
  elements.duplicateMapButton.addEventListener("click", duplicateActiveMap);
  elements.deleteMapButton.addEventListener("click", deleteActiveMap);

  elements.folderNameInput.addEventListener("change", (event) => {
    renameActiveFolder(event.target.value.trim());
  });

  elements.mapNameInput.addEventListener("change", (event) => {
    renameActiveMap(event.target.value.trim());
  });

  elements.loginButton.addEventListener("click", signInWithPassword);
  elements.logoutButton.addEventListener("click", signOutOnline);
  elements.passcodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      signInWithPassword();
    }
  });
  elements.folderList.addEventListener("click", handleFolderListClick);
  elements.mapList.addEventListener("click", handleMapListClick);

  elements.addRootButton.addEventListener("click", () => {
    createNode(null);
  });

  elements.addChildButton.addEventListener("click", () => {
    const primaryNode = getPrimarySelectedNode();
    createNode(primaryNode?.id ?? null);
  });

  elements.duplicateNodeButton.addEventListener("click", duplicateSelectedNodes);
  elements.disconnectNodeButton.addEventListener("click", disconnectSelectedNodes);
  elements.deleteNodeButton.addEventListener("click", deleteSelectedNodes);

  elements.centerViewButton.addEventListener("click", () => {
    centerView();
    persistState("表示を整えました");
    render();
  });

  elements.saveOnlineButton.addEventListener("click", saveOnlineDocument);
  elements.loadOnlineButton.addEventListener("click", promptLoadOnlineDocument);
  elements.shareOnlineButton.addEventListener("click", copyOnlineShareLink);
  elements.exportPngButton.addEventListener("click", exportPng);
  elements.exportButton.addEventListener("click", exportState);
  elements.importInput.addEventListener("change", importState);

  elements.nodeTitleInput.addEventListener("input", (event) => {
    updateSelectedNodes({ title: event.target.value }, { singleOnly: true });
  });

  elements.nodeNoteInput.addEventListener("input", (event) => {
    updateSelectedNodes({ note: event.target.value }, { singleOnly: true });
  });

  elements.nodeColorInput.addEventListener("input", (event) => {
    updateSelectedNodes({ color: event.target.value });
  });

  elements.nodeLinkInput.addEventListener("input", (event) => {
    updateSelectedNodes({ link: event.target.value.trim() }, { singleOnly: true });
  });

  elements.addCategoryButton.addEventListener("click", addCategory);
  elements.saveCategoryButton.addEventListener("click", saveCategoryEdits);
  elements.deleteCategoryButton.addEventListener("click", deleteSelectedCategory);
  elements.nodeCategoryList.addEventListener("click", handleCategoryChipClick);
  elements.categoryManagerList.addEventListener("click", handleCategoryManagerClick);

  elements.canvasShell.addEventListener("mousedown", handleCanvasMouseDown);
  elements.canvasShell.addEventListener("pointerdown", startCanvasInteraction);
  elements.canvasShell.addEventListener("wheel", zoomCanvas, { passive: false });

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", finishPointerAction);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("resize", renderConnections);
}

function hydrateState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      applyDataSnapshot(normalizeData(parsed));
      return;
    } catch (error) {
      console.warn("Saved state could not be restored.", error);
    }
  }

  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacyRaw) {
    try {
      const parsed = JSON.parse(legacyRaw);
      applyDataSnapshot(migrateLegacyState(parsed));
      persistState("旧データを移行しました", { recordHistory: false });
      return;
    } catch (error) {
      console.warn("Legacy state could not be restored.", error);
    }
  }

  applyDataSnapshot(createDefaultData());
}

function createDefaultData() {
  const folder = createFolderRecord("一分金ワークスペース");
  const map = createMapRecord("一分金 SEOマップ");

  map.categories = [
    createCategoryRecord("カテゴリーページ", "#d97742"),
    createCategoryRecord("個別記事", "#5ca878"),
    createCategoryRecord("調査対象", "#4b9cf1"),
  ];

  map.nodes = [
    createNodeRecord({
      title: "一分・二分・二朱金 買取",
      note: "Buyinglistカテゴリーページ",
      x: 420,
      y: 120,
      color: "#ed8f5b",
      categoryIds: [map.categories[0].id],
    }),
    createNodeRecord({
      title: "一分金 種類",
      note: "コラム記事",
      parentId: null,
      x: 60,
      y: 420,
      color: "#4b9cf1",
      categoryIds: [map.categories[1].id],
    }),
    createNodeRecord({
      title: "天保二朱判金",
      note: "Buyinglist",
      parentId: null,
      x: 500,
      y: 420,
      color: "#ed8f5b",
      categoryIds: [map.categories[1].id],
    }),
  ];

  map.nodes[1].parentId = map.nodes[0].id;
  map.nodes[2].parentId = map.nodes[0].id;
  map.selectionIds = [map.nodes[0].id];
  folder.maps.push(map);

  return {
    schemaVersion: 2,
    folders: [folder],
    activeFolderId: folder.id,
    activeMapId: map.id,
  };
}

function migrateLegacyState(legacyState) {
  const folder = createFolderRecord("移行ワークスペース");
  const map = createMapRecord("移行したマップ");
  map.nodes = Array.isArray(legacyState.nodes)
    ? legacyState.nodes.map((node) => normalizeNode(node))
    : [];
  map.viewport = normalizeViewport(legacyState.viewport);
  map.selectionIds = legacyState.selectedNodeId ? [legacyState.selectedNodeId] : [];
  folder.maps.push(map);

  return {
    schemaVersion: 2,
    folders: [folder],
    activeFolderId: folder.id,
    activeMapId: map.id,
  };
}

function normalizeData(raw) {
  const folders = Array.isArray(raw?.folders)
    ? raw.folders.map((folder) => normalizeFolder(folder))
    : [];

  if (folders.length === 0) {
    return createDefaultData();
  }

  const activeFolderId = folders.some((folder) => folder.id === raw.activeFolderId)
    ? raw.activeFolderId
    : folders[0].id;
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const activeMapId = activeFolder.maps.some((map) => map.id === raw.activeMapId)
    ? raw.activeMapId
    : activeFolder.maps[0].id;

  return {
    schemaVersion: 2,
    folders,
    activeFolderId,
    activeMapId,
  };
}

function normalizeFolder(folder) {
  const maps = Array.isArray(folder?.maps) ? folder.maps.map((map) => normalizeMap(map)) : [];
  const safeMaps = maps.length > 0 ? maps : [createMapRecord("空のマップ")];

  return {
    id: folder?.id ?? generateId("folder"),
    name: folder?.name || "新しいフォルダ",
    maps: safeMaps,
  };
}

function normalizeMap(map) {
  const nodes = Array.isArray(map?.nodes) ? map.nodes.map((node) => normalizeNode(node)) : [];
  const categories = Array.isArray(map?.categories)
    ? map.categories.map((category) => normalizeCategory(category))
    : [];
  const selectionIds = Array.isArray(map?.selectionIds)
    ? map.selectionIds.filter((id) => nodes.some((node) => node.id === id))
    : [];

  return {
    id: map?.id ?? generateId("map"),
    name: map?.name || "新しいマップ",
    nodes,
    categories,
    viewport: normalizeViewport(map?.viewport),
    selectionIds,
  };
}

function normalizeNode(node) {
  return {
    id: node?.id ?? generateId("node"),
    parentId: node?.parentId ?? null,
    title: node?.title ?? "無題ノード",
    note: node?.note ?? "",
    x: Number(node?.x) || 0,
    y: Number(node?.y) || 0,
    color: normalizeColor(node?.color ?? "#ffb347"),
    link: typeof node?.link === "string" ? node.link : "",
    categoryIds: Array.isArray(node?.categoryIds) ? [...new Set(node.categoryIds)] : [],
  };
}

function normalizeCategory(category) {
  return {
    id: category?.id ?? generateId("category"),
    name: category?.name || "カテゴリー",
    color: normalizeColor(category?.color ?? "#5ca878"),
  };
}

function normalizeViewport(viewport) {
  return {
    x: Number(viewport?.x) || 120,
    y: Number(viewport?.y) || 80,
    scale: clamp(Number(viewport?.scale) || 1, MIN_SCALE, MAX_SCALE),
  };
}

function createFolderRecord(name) {
  return {
    id: generateId("folder"),
    name,
    maps: [],
  };
}

function createMapRecord(name) {
  return {
    id: generateId("map"),
    name,
    nodes: [],
    categories: [],
    viewport: { x: 120, y: 80, scale: 1 },
    selectionIds: [],
  };
}

function createCategoryRecord(name, color) {
  return {
    id: generateId("category"),
    name,
    color,
  };
}

function createNodeRecord(overrides = {}) {
  return {
    id: generateId("node"),
    parentId: overrides.parentId ?? null,
    title: overrides.title ?? "新しいノード",
    note: overrides.note ?? "",
    x: overrides.x ?? 200,
    y: overrides.y ?? 160,
    color: overrides.color ?? "#ffb347",
    link: overrides.link ?? "",
    categoryIds: [...(overrides.categoryIds ?? [])],
  };
}

function applyDataSnapshot(snapshot) {
  state.folders = snapshot.folders;
  state.activeFolderId = snapshot.activeFolderId;
  state.activeMapId = snapshot.activeMapId;
  state.drag = null;
}

function getDataSnapshot() {
  return {
    schemaVersion: 2,
    folders: cloneData(state.folders),
    activeFolderId: state.activeFolderId,
    activeMapId: state.activeMapId,
  };
}

function getActiveFolder() {
  return state.folders.find((folder) => folder.id === state.activeFolderId) ?? null;
}

function getActiveMap() {
  return getActiveFolder()?.maps.find((map) => map.id === state.activeMapId) ?? null;
}

function findNode(map, nodeId) {
  return map?.nodes.find((node) => node.id === nodeId) ?? null;
}

function getPrimarySelectedNode() {
  const map = getActiveMap();
  if (!map || map.selectionIds.length === 0) {
    return null;
  }

  return findNode(map, map.selectionIds[map.selectionIds.length - 1]);
}

function getSelectedNodes() {
  const map = getActiveMap();
  if (!map) {
    return [];
  }

  return map.selectionIds
    .map((id) => findNode(map, id))
    .filter(Boolean);
}

function setSelection(selectionIds) {
  const map = getActiveMap();
  if (!map) {
    return;
  }

  map.selectionIds = [...new Set(selectionIds)].filter((id) => map.nodes.some((node) => node.id === id));
}

function toggleSelection(nodeId) {
  const map = getActiveMap();
  if (!map) {
    return;
  }

  if (map.selectionIds.includes(nodeId)) {
    map.selectionIds = map.selectionIds.filter((id) => id !== nodeId);
  } else {
    map.selectionIds.push(nodeId);
  }
}

function createFolder() {
  const folder = createFolderRecord(`新しいフォルダ ${state.folders.length + 1}`);
  const map = createMapRecord("新しいマップ");
  folder.maps.push(map);
  state.folders.push(folder);
  state.activeFolderId = folder.id;
  state.activeMapId = map.id;
  persistState("フォルダを作成しました");
  render();
}

function duplicateActiveFolder() {
  const folder = getActiveFolder();
  if (!folder) {
    return;
  }

  const clonedFolder = cloneFolder(folder, `${folder.name} コピー`);
  const folderIndex = state.folders.findIndex((item) => item.id === folder.id);
  state.folders.splice(folderIndex + 1, 0, clonedFolder);
  state.activeFolderId = clonedFolder.id;
  state.activeMapId = clonedFolder.maps[0].id;
  persistState("フォルダを複製しました");
  render();
}

function deleteActiveFolder() {
  const folder = getActiveFolder();
  if (!folder) {
    return;
  }

  if (state.folders.length === 1) {
    const replacementFolder = createFolderRecord("新しいフォルダ");
    const replacementMap = createMapRecord("新しいマップ");
    replacementFolder.maps.push(replacementMap);
    state.folders = [replacementFolder];
    state.activeFolderId = replacementFolder.id;
    state.activeMapId = replacementMap.id;
    persistState("フォルダを削除しました");
    render();
    return;
  }

  const currentIndex = state.folders.findIndex((item) => item.id === folder.id);
  state.folders = state.folders.filter((item) => item.id !== folder.id);
  const nextFolder = state.folders[Math.min(currentIndex, state.folders.length - 1)];
  state.activeFolderId = nextFolder.id;
  state.activeMapId = nextFolder.maps[0]?.id ?? null;
  persistState("フォルダを削除しました");
  render();
}

function renameActiveFolder(name) {
  const folder = getActiveFolder();
  if (!folder || !name) {
    renderWorkspaceManager();
    return;
  }

  folder.name = name;
  persistState("フォルダ名を保存しました");
  renderWorkspaceManager();
}

function createMap() {
  const folder = getActiveFolder();
  if (!folder) {
    return;
  }

  const map = createMapRecord(`新しいマップ ${folder.maps.length + 1}`);
  folder.maps.push(map);
  state.activeMapId = map.id;
  persistState("マップを作成しました");
  render();
}

function duplicateActiveMap() {
  const folder = getActiveFolder();
  const map = getActiveMap();
  if (!folder || !map) {
    return;
  }

  const clonedMap = cloneMap(map, `${map.name} コピー`);
  const mapIndex = folder.maps.findIndex((item) => item.id === map.id);
  folder.maps.splice(mapIndex + 1, 0, clonedMap);
  state.activeMapId = clonedMap.id;
  persistState("マップを複製しました");
  render();
}

function deleteActiveMap() {
  const folder = getActiveFolder();
  const map = getActiveMap();
  if (!folder || !map) {
    return;
  }

  if (folder.maps.length === 1) {
    const replacementMap = createMapRecord("新しいマップ");
    folder.maps = [replacementMap];
    state.activeMapId = replacementMap.id;
    persistState("マップを削除しました");
    render();
    return;
  }

  const currentIndex = folder.maps.findIndex((item) => item.id === map.id);
  folder.maps = folder.maps.filter((item) => item.id !== map.id);
  const nextMap = folder.maps[Math.min(currentIndex, folder.maps.length - 1)];
  state.activeMapId = nextMap.id;
  persistState("マップを削除しました");
  render();
}

function renameActiveMap(name) {
  const map = getActiveMap();
  if (!map || !name) {
    renderWorkspaceManager();
    return;
  }

  map.name = name;
  persistState("マップ名を保存しました");
  renderWorkspaceManager();
  renderWorkspaceTitle();
}

function handleFolderListClick(event) {
  const button = event.target.closest("[data-folder-id]");
  if (!button) {
    return;
  }

  const folderId = button.dataset.folderId;
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder) {
    return;
  }

  state.activeFolderId = folder.id;
  state.activeMapId = folder.maps[0]?.id ?? null;
  saveSnapshotSilently();
  render();
}

function handleMapListClick(event) {
  const button = event.target.closest("[data-map-id]");
  if (!button) {
    return;
  }

  const mapId = button.dataset.mapId;
  const folder = getActiveFolder();
  const map = folder?.maps.find((item) => item.id === mapId);
  if (!map) {
    return;
  }

  state.activeMapId = map.id;
  saveSnapshotSilently();
  render();
}

function createNode(parentId) {
  const map = getActiveMap();
  if (!map) {
    return;
  }

  const parentNode = parentId ? findNode(map, parentId) : null;
  const referenceNode = parentNode ?? getPrimarySelectedNode();
  const offset = parentNode ? getChildOffset(map, parentNode.id) : { x: 90, y: 90 };

  const node = createNodeRecord({
    parentId: parentNode?.id ?? null,
    title: parentNode ? "新しい子ノード" : "新しいルート",
    x: referenceNode ? referenceNode.x + offset.x : 200,
    y: referenceNode ? referenceNode.y + offset.y : 160,
    color: parentNode?.color ?? "#ffb347",
  });

  map.nodes.push(node);
  setSelection([node.id]);
  persistState("ノードを保存しました");
  render();
}

function updateSelectedNodes(patch, options = {}) {
  const selectedNodes = getSelectedNodes();
  if (selectedNodes.length === 0) {
    return;
  }

  if (options.singleOnly && selectedNodes.length !== 1) {
    return;
  }

  for (const node of selectedNodes) {
    Object.assign(node, patch);
  }

  persistState("ノード変更を保存しました");
  render();
}

function duplicateSelectedNodes() {
  const map = getActiveMap();
  if (!map || map.selectionIds.length === 0) {
    return;
  }

  const selectionSet = new Set(map.selectionIds);
  const rootIds = map.selectionIds.filter((nodeId) => {
    let currentNode = findNode(map, nodeId);
    while (currentNode?.parentId) {
      if (selectionSet.has(currentNode.parentId)) {
        return false;
      }
      currentNode = findNode(map, currentNode.parentId);
    }
    return true;
  });

  const clonedIds = [];
  const offsetX = 70;
  const offsetY = 70;

  for (const rootId of rootIds) {
    duplicateNodeTree(map, rootId, null, clonedIds, offsetX, offsetY);
  }

  setSelection(clonedIds);
  persistState("選択ノードを複製しました");
  render();
}

function duplicateNodeTree(map, originalNodeId, forcedParentId, clonedIds, offsetX, offsetY) {
  const originalNode = findNode(map, originalNodeId);
  if (!originalNode) {
    return null;
  }

  const cloneNodeRecord = {
    ...cloneData(originalNode),
    id: generateId("node"),
    parentId: forcedParentId ?? originalNode.parentId,
    title: forcedParentId === null ? `${originalNode.title} コピー` : originalNode.title,
    x: originalNode.x + offsetX,
    y: originalNode.y + offsetY,
  };

  map.nodes.push(cloneNodeRecord);
  clonedIds.push(cloneNodeRecord.id);

  for (const childNode of map.nodes.filter((node) => node.parentId === originalNode.id)) {
    duplicateNodeTree(map, childNode.id, cloneNodeRecord.id, clonedIds, offsetX, offsetY);
  }

  return cloneNodeRecord;
}

function disconnectSelectedNodes() {
  const selectedNodes = getSelectedNodes();
  if (selectedNodes.length === 0) {
    return;
  }

  let didDisconnect = false;
  for (const node of selectedNodes) {
    if (node.parentId) {
      node.parentId = null;
      didDisconnect = true;
    }
  }

  if (!didDisconnect) {
    return;
  }

  persistState("接続を外しました");
  render();
}

function deleteSelectedNodes() {
  const map = getActiveMap();
  if (!map || map.selectionIds.length === 0) {
    return;
  }

  const idsToRemove = new Set(map.selectionIds);

  for (const node of map.nodes) {
    if (idsToRemove.has(node.id) || !node.parentId || !idsToRemove.has(node.parentId)) {
      continue;
    }

    node.parentId = findNearestRemainingParentId(map, node.parentId, idsToRemove);
  }

  map.nodes = map.nodes.filter((node) => !idsToRemove.has(node.id));
  setSelection([]);
  persistState("ノードを削除しました");
  render();
}

function addCategory() {
  const map = getActiveMap();
  if (!map) {
    return;
  }

  const name = elements.categoryNameInput.value.trim();
  if (!name) {
    return;
  }

  const category = createCategoryRecord(name, normalizeColor(elements.categoryColorInput.value));
  map.categories.push(category);
  state.categoryEditorId = category.id;
  persistState("カテゴリーを追加しました");
  render();
}

function handleCategoryChipClick(event) {
  const button = event.target.closest("[data-category-id]");
  if (!button) {
    return;
  }

  const map = getActiveMap();
  const selectedNodes = getSelectedNodes();
  const categoryId = button.dataset.categoryId;
  if (!map || selectedNodes.length === 0) {
    return;
  }

  const assignedToAll = selectedNodes.every((node) => node.categoryIds.includes(categoryId));
  for (const node of selectedNodes) {
    if (assignedToAll) {
      node.categoryIds = node.categoryIds.filter((id) => id !== categoryId);
    } else if (!node.categoryIds.includes(categoryId)) {
      node.categoryIds.push(categoryId);
    }
  }

  persistState("カテゴリー変更を保存しました");
  render();
}

function handleCategoryManagerClick(event) {
  const button = event.target.closest("[data-category-editor-id]");
  if (!button) {
    return;
  }

  state.categoryEditorId = button.dataset.categoryEditorId;
  renderInspector();
}

function saveCategoryEdits() {
  const map = getActiveMap();
  const category = map?.categories.find((item) => item.id === state.categoryEditorId);
  const nextName = elements.categoryNameInput.value.trim();
  if (!map || !category || !nextName) {
    return;
  }

  category.name = nextName;
  category.color = normalizeColor(elements.categoryColorInput.value);
  persistState("カテゴリー編集を保存しました");
  render();
}

function deleteSelectedCategory() {
  const map = getActiveMap();
  if (!map || !state.categoryEditorId) {
    return;
  }

  const categoryId = state.categoryEditorId;
  map.categories = map.categories.filter((category) => category.id !== categoryId);
  for (const node of map.nodes) {
    node.categoryIds = node.categoryIds.filter((id) => id !== categoryId);
  }

  state.categoryEditorId = null;
  persistState("カテゴリーを削除しました");
  render();
}

function render() {
  renderWorkspaceManager();
  renderWorkspaceTitle();
  renderViewport();
  renderNodes();
  renderConnections();
  renderInspector();
  renderCanvasShellState();
  renderOnlineAccessState();
}

function renderOnlineAccessState() {
  const isWorkspaceUnlocked = Boolean(state.user);
  elements.passcodeInput.disabled = Boolean(state.user);
  elements.authEmailInput.disabled = Boolean(state.user);
  elements.loginButton.disabled = Boolean(state.user);
  elements.logoutButton.disabled = !state.user;
  elements.saveOnlineButton.disabled = !state.user;
  elements.loadOnlineButton.disabled = !state.user;
  elements.shareOnlineButton.disabled = !state.user;

  if (!isWorkspaceUnlocked) {
    elements.selectionStatus.textContent = "未選択";
  }
}

function renderWorkspaceManager() {
  const folder = getActiveFolder();
  const map = getActiveMap();

  elements.folderNameInput.value = folder?.name ?? "";
  elements.mapNameInput.value = map?.name ?? "";

  elements.folderList.innerHTML = state.folders
    .map(
      (item) => `
        <button type="button" class="${item.id === state.activeFolderId ? "is-active" : ""}" data-folder-id="${item.id}">
          <span class="selection-title">${escapeHtml(item.name)}</span>
          <span class="selection-meta">${item.maps.length} マップ</span>
        </button>
      `,
    )
    .join("");

  elements.mapList.innerHTML = (folder?.maps ?? [])
    .map(
      (item) => `
        <button type="button" class="${item.id === state.activeMapId ? "is-active" : ""}" data-map-id="${item.id}">
          <span class="selection-title">${escapeHtml(item.name)}</span>
          <span class="selection-meta">${item.nodes.length} ノード</span>
        </button>
      `,
    )
    .join("");
}

function renderWorkspaceTitle() {
  const folder = getActiveFolder();
  const map = getActiveMap();
  const canShowMapName = Boolean(state.user);
  elements.workspaceTitle.textContent = canShowMapName && map
    ? `${folder.name} / ${map.name}`
    : "アクティブマップ";
}

function renderViewport() {
  const map = getActiveMap();
  if (!map) {
    return;
  }

  const { x, y, scale } = map.viewport;
  elements.canvasContent.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function renderNodes() {
  const map = getActiveMap();
  if (!map) {
    elements.nodesLayer.innerHTML = "";
    return;
  }

  elements.nodesLayer.innerHTML = "";

  for (const node of map.nodes) {
    const fragment = elements.nodeTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".node-card");
    const accent = fragment.querySelector(".node-card__accent");
    const connector = fragment.querySelector(".node-card__connector");
    const title = fragment.querySelector(".node-card__title");
    const categories = fragment.querySelector(".node-card__categories");
    const note = fragment.querySelector(".node-card__note");
    const link = fragment.querySelector(".node-card__link");

    card.dataset.nodeId = node.id;
    card.classList.toggle("is-selected", map.selectionIds.includes(node.id));
    card.classList.toggle("is-connect-target", state.drag?.type === "connector" && state.drag.hoverNodeId === node.id);
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    accent.style.background = node.color;
    title.textContent = node.title || "無題ノード";
    note.textContent = node.note || "メモなし";

    categories.innerHTML = getNodeCategories(map, node)
      .slice(0, 3)
      .map(
        (category) => `
          <span class="node-card__category" style="background:${category.color}">
            ${escapeHtml(category.name)}
          </span>
        `,
      )
      .join("");

    const clickableLink = normalizeLinkUrl(node.link);
    link.hidden = !clickableLink;
    if (clickableLink) {
      link.href = clickableLink;
      link.title = node.link;
      link.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      link.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
    }

    card.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(".node-card__connector")) {
        return;
      }

      event.stopPropagation();
      handleNodePointerDown(event, node.id);
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
    });

    connector.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      event.stopPropagation();
      beginConnectorDrag(event, node.id);
      event.currentTarget.setPointerCapture(event.pointerId);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        zoomToNode(node);
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        setSelection([node.id]);
        renderInspector();
        renderNodes();
      }
    });

    elements.nodesLayer.appendChild(fragment);
  }
}

function renderConnections() {
  const map = getActiveMap();
  if (!map) {
    elements.connections.innerHTML = "";
    return;
  }

  const parts = [renderConnectionDefs()];

  for (const childNode of map.nodes.filter((node) => node.parentId)) {
    const parentNode = findNode(map, childNode.parentId);
    if (!parentNode) {
      continue;
    }

    const edgeKey = getEdgeKey(parentNode.id, childNode.id);
    const className = edgeKey === state.drag?.edgeCandidate?.key ? "connection-line is-drop-target" : "connection-line";
    parts.push(
      `<path class="${className}" marker-end="url(#edge-arrow)" d="${buildEdgePath(parentNode, childNode)}" />`,
    );
  }

  if (state.drag?.type === "connector") {
    parts.push(renderPreviewConnection(state.drag));
  }

  if (state.drag?.type === "marquee" && state.drag.moved) {
    const rect = getNormalizedRect(state.drag.startWorld, state.drag.currentWorld);
    parts.push(
      `<rect class="selection-box" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="12" ry="12" />`,
    );
  }

  elements.connections.innerHTML = parts.join("");
}

function renderConnectionDefs() {
  return `
    <defs>
      <marker id="edge-arrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M 0 0 L 12 6 L 0 12 z" fill="rgba(102, 70, 45, 0.62)"></path>
      </marker>
    </defs>
  `;
}

function renderInspector() {
  const map = getActiveMap();
  const selectedNodes = getSelectedNodes();
  const primaryNode = getPrimarySelectedNode();
  const editingCategory = map?.categories.find((category) => category.id === state.categoryEditorId) ?? null;
  const hasSelection = selectedNodes.length > 0;
  const isSingleSelection = selectedNodes.length === 1;
  const anyConnected = selectedNodes.some((node) => node.parentId);

  elements.addChildButton.disabled = !isSingleSelection;
  elements.duplicateNodeButton.disabled = !hasSelection;
  elements.disconnectNodeButton.disabled = !anyConnected;
  elements.deleteNodeButton.disabled = !hasSelection;
  elements.nodeTitleInput.disabled = !isSingleSelection;
  elements.nodeNoteInput.disabled = !isSingleSelection;
  elements.nodeColorInput.disabled = !hasSelection;
  elements.nodeLinkInput.disabled = !isSingleSelection;
  elements.saveCategoryButton.disabled = !editingCategory;
  elements.deleteCategoryButton.disabled = !editingCategory;

  if (!hasSelection) {
    elements.parentNodeDisplay.textContent = "親ノード: なし";
    elements.childNodeDisplay.textContent = "子ノード数: 0";
    elements.nodeTitleInput.value = "";
    elements.nodeNoteInput.value = "";
    elements.nodeColorInput.value = "#ffb347";
    elements.nodeLinkInput.value = "";
    elements.selectionStatus.textContent = "未選択";
    elements.categorySelectionNote.textContent = "選択ノードに割り当てます";
    elements.categoryEditorNote.textContent = editingCategory ? "選択中カテゴリーを編集できます" : "一覧から選ぶと編集できます";
    renderCategoryChips([]);
    renderCategoryManagerList(map, editingCategory);
    syncCategoryEditor(editingCategory);
    return;
  }

  if (isSingleSelection) {
    const parentNode = primaryNode.parentId ? findNode(map, primaryNode.parentId) : null;
    const childCount = map.nodes.filter((node) => node.parentId === primaryNode.id).length;
    elements.parentNodeDisplay.textContent = `親ノード: ${parentNode?.title ?? "ルート"}`;
    elements.childNodeDisplay.textContent = `子ノード数: ${childCount}`;
    elements.nodeTitleInput.value = primaryNode.title;
    elements.nodeNoteInput.value = primaryNode.note;
    elements.nodeLinkInput.value = primaryNode.link;
    elements.selectionStatus.textContent = `選択中: ${primaryNode.title || "無題ノード"}`;
  } else {
    elements.parentNodeDisplay.textContent = `親ノード: 複数選択 (${selectedNodes.length}件)`;
    elements.childNodeDisplay.textContent = `子ノード数: 合計 ${selectedNodes.reduce((count, node) => count + map.nodes.filter((child) => child.parentId === node.id).length, 0)}`;
    elements.nodeTitleInput.value = "";
    elements.nodeNoteInput.value = "";
    elements.nodeLinkInput.value = "";
    elements.selectionStatus.textContent = `${selectedNodes.length}ノードを選択中`;
  }

  elements.nodeColorInput.value = normalizeColor(primaryNode.color);
  elements.categorySelectionNote.textContent = isSingleSelection
    ? "クリックでカテゴリーを切り替えます"
    : "クリックで選択中すべてに反映します";
  elements.categoryEditorNote.textContent = editingCategory ? "選択中カテゴリーを編集できます" : "一覧から選ぶと編集できます";
  renderCategoryChips(selectedNodes);
  renderCategoryManagerList(map, editingCategory);
  syncCategoryEditor(editingCategory);
}

function renderCategoryChips(selectedNodes) {
  const map = getActiveMap();
  if (!map || map.categories.length === 0) {
    elements.nodeCategoryList.innerHTML = `<span class="helper-note">カテゴリーはまだありません</span>`;
    return;
  }

  const selectedCount = selectedNodes.length;
  elements.nodeCategoryList.innerHTML = map.categories
    .map((category) => {
      const assignedCount = selectedNodes.filter((node) => node.categoryIds.includes(category.id)).length;
      const isOn = selectedCount > 0 && assignedCount === selectedCount;
      const isMixed = assignedCount > 0 && assignedCount < selectedCount;
      const style = isOn ? `style="background:${category.color};border-color:${category.color}"` : "";
      const classes = ["tag-chip"];
      if (isOn) {
        classes.push("is-on");
      }
      if (isMixed) {
        classes.push("is-mixed");
      }

      return `<button type="button" class="${classes.join(" ")}" data-category-id="${category.id}" ${style}>${escapeHtml(category.name)}</button>`;
    })
    .join("");
}

function renderCategoryManagerList(map, editingCategory) {
  if (!map || map.categories.length === 0) {
    elements.categoryManagerList.innerHTML = `<span class="helper-note">カテゴリーはまだありません</span>`;
    return;
  }

  elements.categoryManagerList.innerHTML = map.categories
    .map((category) => {
      const assignedCount = map.nodes.filter((node) => node.categoryIds.includes(category.id)).length;
      return `
        <button
          type="button"
          class="${editingCategory?.id === category.id ? "is-active" : ""}"
          data-category-editor-id="${category.id}"
        >
          <span class="selection-title">${escapeHtml(category.name)}</span>
          <span class="selection-meta">${assignedCount} ノード / ${category.color}</span>
        </button>
      `;
    })
    .join("");
}

function syncCategoryEditor(editingCategory) {
  if (!editingCategory) {
    if (document.activeElement !== elements.categoryNameInput) {
      elements.categoryNameInput.value = "";
    }
    elements.categoryColorInput.value = "#5ca878";
    return;
  }

  if (document.activeElement !== elements.categoryNameInput) {
    elements.categoryNameInput.value = editingCategory.name;
  }
  elements.categoryColorInput.value = editingCategory.color;
}

function renderCanvasShellState() {
  elements.canvasShell.classList.toggle("is-panning", state.drag?.type === "pan");
  const isWorkspaceUnlocked = Boolean(state.user);
  elements.canvasShell.hidden = !isWorkspaceUnlocked;
  elements.workspaceLocked.hidden = isWorkspaceUnlocked;
}

function handleCanvasMouseDown(event) {
  if (event.button === 1) {
    event.preventDefault();
  }
}

function startCanvasInteraction(event) {
  if (event.pointerType === "touch") {
    startTouchCanvasInteraction(event);
    return;
  }

  const isMiddleButtonPan = event.button === 1;
  const isPrimaryButton = event.button === 0;

  if ((!isPrimaryButton && !isMiddleButtonPan) || (!isMiddleButtonPan && event.target.closest(".node-card"))) {
    return;
  }

  const map = getActiveMap();
  if (!map) {
    return;
  }

  if (isMiddleButtonPan || state.keyboard.spacePressed || event.altKey) {
    event.preventDefault();
    state.drag = {
      type: "pan",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originalX: map.viewport.x,
      originalY: map.viewport.y,
      moved: false,
    };
    elements.canvasShell.setPointerCapture(event.pointerId);
    renderCanvasShellState();
    return;
  }

  state.drag = {
    type: "marquee",
    pointerId: event.pointerId,
    additive: event.shiftKey,
    startWorld: screenToWorld(event.clientX, event.clientY),
    currentWorld: screenToWorld(event.clientX, event.clientY),
    baseSelectionIds: event.shiftKey ? [...map.selectionIds] : [],
    moved: false,
  };
  elements.canvasShell.setPointerCapture(event.pointerId);
  renderConnections();
}

function startTouchCanvasInteraction(event) {
  const map = getActiveMap();
  if (!map) {
    return;
  }

  event.preventDefault();
  touchPointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY,
  });

  if (touchPointers.size === 1) {
    const point = getTouchPoints()[0];
    state.drag = {
      type: "touch-pan",
      pointerId: event.pointerId,
      startClientX: point.clientX,
      startClientY: point.clientY,
      originalX: map.viewport.x,
      originalY: map.viewport.y,
      moved: false,
    };
    elements.canvasShell.setPointerCapture(event.pointerId);
    renderCanvasShellState();
    return;
  }

  if (touchPointers.size === 2) {
    const points = getTouchPoints();
    const midpoint = getTouchMidpoint(points);
    state.drag = {
      type: "touch-pinch",
      startDistance: getTouchDistance(points),
      startMidpoint: midpoint,
      originalScale: map.viewport.scale,
      originalX: map.viewport.x,
      originalY: map.viewport.y,
      worldX: (midpoint.clientX - map.viewport.x) / map.viewport.scale,
      worldY: (midpoint.clientY - map.viewport.y) / map.viewport.scale,
      moved: false,
    };
    elements.canvasShell.setPointerCapture(event.pointerId);
    renderCanvasShellState();
  }
}

function handleNodePointerDown(event, nodeId) {
  const map = getActiveMap();
  const alreadySelected = map.selectionIds.includes(nodeId);

  if (event.shiftKey) {
    if (!alreadySelected) {
      map.selectionIds.push(nodeId);
    }
  } else if (!alreadySelected) {
    setSelection([nodeId]);
  }

  const movingIds = map.selectionIds.includes(nodeId) ? [...map.selectionIds] : [nodeId];
  state.drag = {
    type: "node-move",
    pointerId: event.pointerId,
    movingIds,
    startClientX: event.clientX,
    startClientY: event.clientY,
    originals: movingIds.map((id) => {
      const node = findNode(map, id);
      return { id, x: node.x, y: node.y };
    }),
    moved: false,
    edgeCandidate: null,
  };

  render();
}

function beginConnectorDrag(event, nodeId) {
  setSelection([nodeId]);
  state.drag = {
    type: "connector",
    pointerId: event.pointerId,
    sourceNodeId: nodeId,
    currentClientX: event.clientX,
    currentClientY: event.clientY,
    hoverNodeId: null,
    edgeCandidate: null,
  };
  render();
}

function handlePointerMove(event) {
  const drag = state.drag;

  if (event.pointerType === "touch") {
    handleTouchPointerMove(event);
    return;
  }

  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  if (drag.type === "pan") {
    const map = getActiveMap();
    map.viewport.x = drag.originalX + (event.clientX - drag.startClientX);
    map.viewport.y = drag.originalY + (event.clientY - drag.startClientY);
    drag.moved = true;
    renderViewport();
    renderConnections();
    return;
  }

  if (drag.type === "marquee") {
    drag.currentWorld = screenToWorld(event.clientX, event.clientY);
    drag.moved = getRectDistance(drag.startWorld, drag.currentWorld) > MARQUEE_DRAG_THRESHOLD / getActiveMap().viewport.scale;
    updateSelectionFromMarquee(drag);
    renderNodes();
    renderConnections();
    renderInspector();
    return;
  }

  if (drag.type === "node-move") {
    const map = getActiveMap();
    const deltaX = (event.clientX - drag.startClientX) / map.viewport.scale;
    const deltaY = (event.clientY - drag.startClientY) / map.viewport.scale;

    for (const original of drag.originals) {
      const node = findNode(map, original.id);
      if (!node) {
        continue;
      }
      node.x = Math.round(original.x + deltaX);
      node.y = Math.round(original.y + deltaY);
    }

    drag.moved = drag.moved || Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;
    drag.edgeCandidate = drag.movingIds.length === 1
      ? getEdgeDropCandidate(event.clientX, event.clientY, drag.movingIds[0])
      : null;
    render();
    return;
  }

  if (drag.type === "connector") {
    drag.currentClientX = event.clientX;
    drag.currentClientY = event.clientY;
    drag.hoverNodeId = getDropNodeTarget(event.clientX, event.clientY, drag.sourceNodeId);
    drag.edgeCandidate = drag.hoverNodeId ? null : getEdgeDropCandidate(event.clientX, event.clientY, drag.sourceNodeId);
    renderNodes();
    renderConnections();
  }
}

function handleTouchPointerMove(event) {
  if (!touchPointers.has(event.pointerId)) {
    return;
  }

  event.preventDefault();
  touchPointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY,
  });

  const map = getActiveMap();
  const drag = state.drag;
  if (!map || !drag) {
    return;
  }

  if (drag.type === "touch-pan" && touchPointers.size === 1) {
    const point = getTouchPoints()[0];
    map.viewport.x = drag.originalX + (point.clientX - drag.startClientX);
    map.viewport.y = drag.originalY + (point.clientY - drag.startClientY);
    drag.moved = true;
    renderViewport();
    renderConnections();
    return;
  }

  if (drag.type === "touch-pinch" && touchPointers.size >= 2) {
    const points = getTouchPoints().slice(0, 2);
    const midpoint = getTouchMidpoint(points);
    const nextScale = clamp(
      drag.originalScale * (getTouchDistance(points) / drag.startDistance),
      MIN_SCALE,
      MAX_SCALE,
    );
    map.viewport.scale = nextScale;
    map.viewport.x = midpoint.clientX - drag.worldX * nextScale;
    map.viewport.y = midpoint.clientY - drag.worldY * nextScale;
    drag.moved = true;
    renderViewport();
    renderConnections();
  }
}

function finishPointerAction(event) {
  if (event.pointerType === "touch") {
    finishTouchPointerAction(event);
    return;
  }

  const drag = state.drag;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  let didChange = false;

  if (drag.type === "marquee") {
    if (!drag.moved && !drag.additive) {
      setSelection([]);
    }
  }

  if (drag.type === "node-move") {
    didChange = applyMoveDropAction(event, drag) || drag.moved;
  }

  if (drag.type === "connector") {
    didChange = applyConnectorDropAction(event, drag);
  }

  if (drag.type === "pan") {
    didChange = drag.moved;
  }

  state.drag = null;
  render();

  if (didChange) {
    persistState("変更を保存しました");
  }
}

function finishTouchPointerAction(event) {
  const drag = state.drag;
  touchPointers.delete(event.pointerId);

  if (touchPointers.size === 1) {
    const map = getActiveMap();
    const point = getTouchPoints()[0];
    if (map && point) {
      state.drag = {
        type: "touch-pan",
        pointerId: Number(touchPointers.keys().next().value),
        startClientX: point.clientX,
        startClientY: point.clientY,
        originalX: map.viewport.x,
        originalY: map.viewport.y,
        moved: false,
      };
      renderCanvasShellState();
      return;
    }
  }

  const didChange = Boolean(drag?.moved);
  state.drag = null;
  render();

  if (didChange) {
    persistState("表示位置を保存しました");
  }
}

function applyMoveDropAction(event, drag) {
  if (drag.movingIds.length !== 1) {
    return false;
  }

  const movingNodeId = drag.movingIds[0];
  const edgeCandidate = getEdgeDropCandidate(event.clientX, event.clientY, movingNodeId);
  if (edgeCandidate) {
    return insertNodeOnEdge(movingNodeId, edgeCandidate.parentId, edgeCandidate.childId);
  }

  return false;
}

function applyConnectorDropAction(event, drag) {
  const hoverNodeId = getDropNodeTarget(event.clientX, event.clientY, drag.sourceNodeId);
  if (hoverNodeId) {
    return connectNodeToParent(drag.sourceNodeId, hoverNodeId);
  }

  const edgeCandidate = getEdgeDropCandidate(event.clientX, event.clientY, drag.sourceNodeId);
  if (edgeCandidate) {
    return insertNodeOnEdge(drag.sourceNodeId, edgeCandidate.parentId, edgeCandidate.childId);
  }

  return false;
}

function updateSelectionFromMarquee(drag) {
  const map = getActiveMap();
  const rect = getNormalizedRect(drag.startWorld, drag.currentWorld);
  const insideIds = map.nodes
    .filter((node) => node.x < rect.x + rect.width
      && node.x + NODE_WIDTH > rect.x
      && node.y < rect.y + rect.height
      && node.y + NODE_HEIGHT > rect.y)
    .map((node) => node.id);

  if (drag.additive) {
    setSelection([...drag.baseSelectionIds, ...insideIds]);
  } else {
    setSelection(insideIds);
  }
}

function zoomCanvas(event) {
  const map = getActiveMap();
  if (!map) {
    return;
  }

  event.preventDefault();
  const rect = elements.canvasShell.getBoundingClientRect();
  const cursorX = event.clientX - rect.left;
  const cursorY = event.clientY - rect.top;
  const previousScale = map.viewport.scale;
  const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
  const nextScale = clamp(previousScale * zoomFactor, MIN_SCALE, MAX_SCALE);

  if (nextScale === previousScale) {
    return;
  }

  const worldX = (cursorX - map.viewport.x) / previousScale;
  const worldY = (cursorY - map.viewport.y) / previousScale;
  map.viewport.scale = nextScale;
  map.viewport.x = cursorX - worldX * nextScale;
  map.viewport.y = cursorY - worldY * nextScale;
  persistState("ズームを保存しました");
  render();
}

function zoomToNode(node) {
  const map = getActiveMap();
  if (!map) {
    return;
  }

  const rect = elements.canvasShell.getBoundingClientRect();
  const maxScaleX = rect.width / (NODE_WIDTH * 1.8);
  const maxScaleY = rect.height / (NODE_HEIGHT * 1.8);
  const targetScale = clamp(Math.min(maxScaleX, maxScaleY, 1.5), MIN_SCALE, MAX_SCALE);
  const nextScale = Math.max(map.viewport.scale, targetScale);
  map.viewport.scale = nextScale;

  const nodeCenterX = node.x + NODE_WIDTH / 2;
  const nodeCenterY = node.y + NODE_HEIGHT / 2;
  map.viewport.x = Math.round(rect.width / 2 - nodeCenterX * map.viewport.scale);
  map.viewport.y = Math.round(rect.height / 2 - nodeCenterY * map.viewport.scale);

  setSelection([node.id]);
  persistState("ノードにズームしました");
  render();
}

function centerView() {
  const map = getActiveMap();
  if (!map) {
    return;
  }

  if (map.nodes.length === 0) {
    const rect = elements.canvasShell.getBoundingClientRect();
    map.viewport.scale = 1;
    map.viewport.x = Math.round(rect.width * 0.18);
    map.viewport.y = Math.round(rect.height * 0.16);
    return;
  }

  arrangeMapLayout(map);
  fitMapToViewport(map);
}

function handleKeyDown(event) {
  const isTypingField = isKeyboardShortcutBlocked(document.activeElement);

  if (event.key === " ") {
    state.keyboard.spacePressed = true;
  }

  if (event.key === "Enter" && !isTypingField) {
    const primaryNode = getPrimarySelectedNode();
    if (primaryNode) {
      event.preventDefault();
      zoomToNode(primaryNode);
      return;
    }
  }

  if (event.key === "Delete" && !isTypingField) {
    deleteSelectedNodes();
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !isTypingField) {
    event.preventDefault();
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y" && !isTypingField) {
    event.preventDefault();
    redo();
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && !isTypingField) {
    event.preventDefault();
    duplicateSelectedNodes();
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    exportState();
  }
}

function handleKeyUp(event) {
  if (event.key === " ") {
    state.keyboard.spacePressed = false;
  }
}

function isKeyboardShortcutBlocked(activeElement) {
  if (!activeElement) {
    return false;
  }

  if (activeElement.closest(".node-card")) {
    return false;
  }

  const tagName = activeElement.tagName ?? "";
  return ["TEXTAREA", "INPUT", "BUTTON", "SELECT", "OPTION", "A"].includes(tagName)
    || activeElement.isContentEditable;
}

function getDropNodeTarget(clientX, clientY, sourceNodeId) {
  const connectorElement = elements.nodesLayer.querySelector(`[data-node-id="${sourceNodeId}"]`);
  if (connectorElement) {
    connectorElement.style.pointerEvents = "none";
  }

  const candidateElement = document.elementFromPoint(clientX, clientY)?.closest(".node-card");

  if (connectorElement) {
    connectorElement.style.pointerEvents = "";
  }

  const candidateId = candidateElement?.dataset.nodeId;
  if (!candidateId || !canConnectNodeToParent(sourceNodeId, candidateId)) {
    return null;
  }

  return candidateId;
}

function getEdgeDropCandidate(clientX, clientY, sourceNodeId) {
  const map = getActiveMap();
  const point = screenToWorld(clientX, clientY);
  let bestCandidate = null;

  for (const childNode of map.nodes.filter((node) => node.parentId)) {
    const parentNode = findNode(map, childNode.parentId);
    if (!parentNode || !canInsertNodeOnEdge(sourceNodeId, parentNode.id, childNode.id)) {
      continue;
    }

    const distance = getConnectionDistance(point, parentNode, childNode);
    if (distance > EDGE_INSERT_THRESHOLD) {
      continue;
    }

    if (!bestCandidate || distance < bestCandidate.distance) {
      bestCandidate = {
        key: getEdgeKey(parentNode.id, childNode.id),
        parentId: parentNode.id,
        childId: childNode.id,
        distance,
      };
    }
  }

  return bestCandidate;
}

function canConnectNodeToParent(nodeId, parentId) {
  if (!nodeId || !parentId || nodeId === parentId) {
    return false;
  }

  const map = getActiveMap();
  return !collectDescendantIds(map, nodeId).has(parentId);
}

function canInsertNodeOnEdge(nodeId, parentId, childId) {
  if (!nodeId || !parentId || !childId) {
    return false;
  }

  if (nodeId === parentId || nodeId === childId) {
    return false;
  }

  if (!canConnectNodeToParent(nodeId, parentId)) {
    return false;
  }

  const map = getActiveMap();
  return !collectDescendantIds(map, nodeId).has(childId);
}

function connectNodeToParent(nodeId, parentId) {
  const map = getActiveMap();
  if (!map || !canConnectNodeToParent(nodeId, parentId)) {
    return false;
  }

  const node = findNode(map, nodeId);
  const parentNode = findNode(map, parentId);
  if (!node || !parentNode) {
    return false;
  }

  node.parentId = parentNode.id;
  placeNodeNearParent(map, node, parentNode);
  setSelection([node.id]);
  return true;
}

function insertNodeOnEdge(nodeId, parentId, childId) {
  const map = getActiveMap();
  if (!map || !canInsertNodeOnEdge(nodeId, parentId, childId)) {
    return false;
  }

  const node = findNode(map, nodeId);
  const parentNode = findNode(map, parentId);
  const childNode = findNode(map, childId);
  if (!node || !parentNode || !childNode) {
    return false;
  }

  node.parentId = parentNode.id;
  childNode.parentId = node.id;
  node.x = Math.round((parentNode.x + childNode.x) / 2);
  node.y = Math.round((parentNode.y + childNode.y) / 2);
  setSelection([node.id]);
  return true;
}

function placeNodeNearParent(map, node, parentNode) {
  if (!isNodeOverlapping(node, parentNode)) {
    return;
  }

  const siblings = map.nodes.filter((item) => item.parentId === parentNode.id && item.id !== node.id).length;
  const directionX = node.x >= parentNode.x ? 1 : -1;
  const directionY = siblings % 2 === 0 ? 1 : -1;
  node.x = parentNode.x + directionX * 290;
  node.y = parentNode.y + directionY * (70 + Math.floor(siblings / 2) * 96);
}

function isNodeOverlapping(firstNode, secondNode) {
  return Math.abs(firstNode.x - secondNode.x) < NODE_WIDTH * 0.72
    && Math.abs(firstNode.y - secondNode.y) < NODE_HEIGHT * 0.72;
}

function collectDescendantIds(map, rootId) {
  const ids = new Set([rootId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const node of map.nodes) {
      if (!ids.has(node.id) && node.parentId && ids.has(node.parentId)) {
        ids.add(node.id);
        changed = true;
      }
    }
  }

  return ids;
}

function findNearestRemainingParentId(map, parentId, idsToRemove) {
  let currentId = parentId;

  while (currentId && idsToRemove.has(currentId)) {
    const currentNode = findNode(map, currentId);
    currentId = currentNode?.parentId ?? null;
  }

  return currentId ?? null;
}

function getChildOffset(map, parentId) {
  const siblings = map.nodes.filter((node) => node.parentId === parentId).length;
  const direction = siblings % 2 === 0 ? 1 : -1;
  return {
    x: 300,
    y: direction * (90 + Math.floor(siblings / 2) * 126),
  };
}

function getNodeCategories(map, node) {
  return node.categoryIds
    .map((id) => map.categories.find((category) => category.id === id))
    .filter(Boolean);
}

function arrangeMapLayout(map) {
  for (const node of map.nodes) {
    if (node.parentId && !findNode(map, node.parentId)) {
      node.parentId = null;
    }
  }

  const childMap = new Map();
  for (const node of map.nodes) {
    const key = node.parentId ?? "__root__";
    if (!childMap.has(key)) {
      childMap.set(key, []);
    }
    childMap.get(key).push(node);
  }

  for (const children of childMap.values()) {
    children.sort(compareNodesForLayout);
  }

  const subtreeHeights = new Map();
  const rootNodes = [...(childMap.get("__root__") ?? [])].sort(compareNodesForLayout);

  if (rootNodes.length === 0) {
    return;
  }

  for (const rootNode of rootNodes) {
    measureSubtreeHeight(rootNode, childMap, subtreeHeights);
  }

  let currentTop = LAYOUT_START_Y;
  for (const rootNode of rootNodes) {
    const subtreeHeight = subtreeHeights.get(rootNode.id) ?? NODE_HEIGHT;
    layoutSubtree(rootNode, 0, currentTop, subtreeHeight, childMap, subtreeHeights);
    currentTop += subtreeHeight + LAYOUT_ROOT_GAP;
  }
}

function measureSubtreeHeight(node, childMap, subtreeHeights) {
  const children = childMap.get(node.id) ?? [];
  if (children.length === 0) {
    subtreeHeights.set(node.id, NODE_WIDTH);
    return NODE_WIDTH;
  }

  let totalWidth = 0;
  for (const childNode of children) {
    totalWidth += measureSubtreeHeight(childNode, childMap, subtreeHeights);
  }
  totalWidth += LAYOUT_SIBLING_GAP * Math.max(0, children.length - 1);

  const subtreeWidth = Math.max(NODE_WIDTH, totalWidth);
  subtreeHeights.set(node.id, subtreeWidth);
  return subtreeWidth;
}

function layoutSubtree(node, depth, top, subtreeHeight, childMap, subtreeHeights) {
  node.x = Math.round(top + (subtreeHeight - NODE_WIDTH) / 2);
  node.y = LAYOUT_START_Y + depth * LAYOUT_DEPTH_GAP;

  const children = childMap.get(node.id) ?? [];
  if (children.length === 0) {
    return;
  }

  const childrenWidth = children.reduce(
    (sum, childNode) => sum + (subtreeHeights.get(childNode.id) ?? NODE_WIDTH),
    0,
  ) + LAYOUT_SIBLING_GAP * Math.max(0, children.length - 1);

  let currentLeft = top + (subtreeHeight - childrenWidth) / 2;
  for (const childNode of children) {
    const childWidth = subtreeHeights.get(childNode.id) ?? NODE_WIDTH;
    layoutSubtree(childNode, depth + 1, currentLeft, childWidth, childMap, subtreeHeights);
    currentLeft += childWidth + LAYOUT_SIBLING_GAP;
  }
}

function compareNodesForLayout(firstNode, secondNode) {
  if (firstNode.x !== secondNode.x) {
    return firstNode.x - secondNode.x;
  }

  if (firstNode.y !== secondNode.y) {
    return firstNode.y - secondNode.y;
  }

  return firstNode.title.localeCompare(secondNode.title, "ja");
}

function fitMapToViewport(map) {
  const rect = elements.canvasShell.getBoundingClientRect();
  if (!rect.width || !rect.height || map.nodes.length === 0) {
    return;
  }

  const bounds = getNodeBounds(map.nodes);
  const paddingX = Math.max(56, rect.width * 0.08);
  const paddingY = Math.max(56, rect.height * 0.08);
  const availableWidth = Math.max(1, rect.width - paddingX * 2);
  const availableHeight = Math.max(1, rect.height - paddingY * 2);
  const scale = clamp(
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height),
    MIN_SCALE,
    MAX_SCALE,
  );

  map.viewport.scale = scale;
  map.viewport.x = Math.round((rect.width - bounds.width * scale) / 2 - bounds.minX * scale);
  map.viewport.y = Math.round((rect.height - bounds.height * scale) / 2 - bounds.minY * scale);
}

function getNodeBounds(nodes) {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + NODE_WIDTH));
  const maxY = Math.max(...nodes.map((node) => node.y + NODE_HEIGHT));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function buildEdgePath(parentNode, childNode) {
  const start = getConnectorAnchor(parentNode);
  const end = getNodeCenter(childNode);
  const curve = Math.max(48, Math.abs(end.x - start.x) * 0.38);
  return `M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${end.x - curve} ${end.y}, ${end.x} ${end.y}`;
}

function renderPreviewConnection(drag) {
  const map = getActiveMap();
  const sourceNode = findNode(map, drag.sourceNodeId);
  if (!sourceNode) {
    return "";
  }

  const start = getConnectorAnchor(sourceNode);
  const end = drag.hoverNodeId
    ? getNodeCenter(findNode(map, drag.hoverNodeId))
    : screenToWorld(drag.currentClientX, drag.currentClientY);
  const curve = Math.max(48, Math.abs(end.x - start.x) * 0.38);

  return `<path class="connection-line is-preview" marker-end="url(#edge-arrow)" d="M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${end.x - curve} ${end.y}, ${end.x} ${end.y}" />`;
}

function getConnectorAnchor(node) {
  return {
    x: node.x + NODE_WIDTH - 26,
    y: node.y + NODE_HEIGHT - 26,
  };
}

function getNodeCenter(node) {
  return {
    x: node.x + NODE_WIDTH * 0.5,
    y: node.y + NODE_HEIGHT * 0.5,
  };
}

function screenToWorld(clientX, clientY) {
  const map = getActiveMap();
  const rect = elements.canvasShell.getBoundingClientRect();
  return {
    x: (clientX - rect.left - map.viewport.x) / map.viewport.scale,
    y: (clientY - rect.top - map.viewport.y) / map.viewport.scale,
  };
}

function getConnectionDistance(point, parentNode, childNode) {
  let minimumDistance = Infinity;
  let previousPoint = getPointOnEdge(parentNode, childNode, 0);

  for (let step = 1; step <= 24; step += 1) {
    const currentPoint = getPointOnEdge(parentNode, childNode, step / 24);
    minimumDistance = Math.min(minimumDistance, distanceToSegment(point, previousPoint, currentPoint));
    previousPoint = currentPoint;
  }

  return minimumDistance;
}

function getPointOnEdge(parentNode, childNode, t) {
  const start = getConnectorAnchor(parentNode);
  const end = getNodeCenter(childNode);
  const curve = Math.max(48, Math.abs(end.x - start.x) * 0.38);
  const controlOne = { x: start.x + curve, y: start.y };
  const controlTwo = { x: end.x - curve, y: end.y };
  const inverse = 1 - t;

  return {
    x: (inverse ** 3) * start.x
      + 3 * (inverse ** 2) * t * controlOne.x
      + 3 * inverse * (t ** 2) * controlTwo.x
      + (t ** 3) * end.x,
    y: (inverse ** 3) * start.y
      + 3 * (inverse ** 2) * t * controlOne.y
      + 3 * inverse * (t ** 2) * controlTwo.y
      + (t ** 3) * end.y,
  };
}

function distanceToSegment(point, start, end) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared;
  const clamped = clamp(projection, 0, 1);
  const closestX = start.x + deltaX * clamped;
  const closestY = start.y + deltaY * clamped;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function getNormalizedRect(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function getRectDistance(start, end) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function getTouchPoints() {
  return [...touchPointers.values()];
}

function getTouchDistance(points) {
  return Math.hypot(
    points[0].clientX - points[1].clientX,
    points[0].clientY - points[1].clientY,
  );
}

function getTouchMidpoint(points) {
  const rect = elements.canvasShell.getBoundingClientRect();
  return {
    clientX: ((points[0].clientX + points[1].clientX) / 2) - rect.left,
    clientY: ((points[0].clientY + points[1].clientY) / 2) - rect.top,
  };
}

function getEdgeKey(parentId, childId) {
  return `${parentId}->${childId}`;
}

function persistState(statusText, options = {}) {
  if (options.recordHistory !== false) {
    recordHistorySnapshot();
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(getDataSnapshot()));
  elements.saveStatus.textContent = statusText;
  clearTimeout(saveStatusTimer);
  saveStatusTimer = window.setTimeout(() => {
    elements.saveStatus.textContent = "自動保存済み";
  }, 900);
}

function saveSnapshotSilently() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getDataSnapshot()));
}

function hydrateOnlineTarget() {
  const params = new URLSearchParams(window.location.search);
  state.onlineShareToken = params.get("share");
  state.onlineDocId = state.onlineShareToken
    ? null
    : params.get("doc");
  state.onlineLoadMode = state.onlineShareToken ? "shared" : state.onlineDocId ? "owner" : null;
}

async function restoreAuthSession() {
  if (!supabaseClient) {
    elements.authStatus.textContent = "Supabase Authを読み込めませんでした";
    elements.logoutButton.disabled = true;
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  applyAuthSession(data.session ?? null);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    applyAuthSession(session);
  });
}

function applyAuthSession(session) {
  state.user = session?.user ?? null;
  elements.authStatus.textContent = state.user ? "ログイン済み" : "未ログイン";
  renderOnlineAccessState();
  loadInitialOnlineTargetIfReady();
}

function requireOnlineSignedIn() {
  if (state.user) {
    return true;
  }

  alert("先にメールアドレスとパスワードでログインしてください。");
  return false;
}

function loadInitialOnlineTargetIfReady() {
  if (!state.user) {
    return;
  }

  if (state.onlineShareToken && state.onlineLoadedTarget !== `share:${state.onlineShareToken}`) {
    loadSharedOnlineDocument(state.onlineShareToken);
    return;
  }

  if (state.onlineDocId && state.onlineLoadedTarget !== `doc:${state.onlineDocId}`) {
    loadOnlineDocument(state.onlineDocId);
    return;
  }

  if (!state.onlineDocId && state.onlineLoadedTarget !== `team:${TEAM_DOCUMENT_SLUG}`) {
    loadTeamOnlineDocument();
  }
}

async function signInWithPassword() {
  if (!supabaseClient) {
    alert("Supabase Authを読み込めませんでした。ネットワーク接続を確認してください。");
    return;
  }

  const email = elements.authEmailInput.value.trim();
  if (!email) {
    alert("メールアドレスを入力してください。");
    return;
  }

  const password = elements.passcodeInput.value.trim();
  if (!password) {
    alert("パスワードを入力してください。");
    return;
  }

  elements.saveStatus.textContent = "ログイン中...";
  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert(`ログインに失敗しました。\n\n${error.message}`);
    elements.saveStatus.textContent = "ログイン失敗";
    return;
  }

  elements.passcodeInput.value = "";
  elements.saveStatus.textContent = "ログインしました";
}

async function signOutOnline() {
  if (!supabaseClient) {
    return;
  }

  await supabaseClient.auth.signOut();
  elements.saveStatus.textContent = "ログアウトしました";
}

async function getSupabaseAccessToken() {
  if (!supabaseClient) {
    return SUPABASE_ANON_KEY;
  }

  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? SUPABASE_ANON_KEY;
}

async function saveOnlineDocument() {
  if (!requireOnlineSignedIn()) {
    return;
  }

  if (state.onlineLoadMode === "shared") {
    const shouldCreateCopy = confirm("共有リンクで開いたマップは直接編集保存できません。自分のオンラインマップとして保存しますか？");
    if (!shouldCreateCopy) {
      return;
    }
    state.onlineDocId = null;
    state.onlineShareToken = null;
    state.onlineLoadMode = null;
  }

  const snapshot = getDataSnapshot();
  const title = getActiveMap()?.name || "SEOトピック管理マップ";
  elements.saveStatus.textContent = "オンライン保存中...";

  try {
    const payload = {
      title,
      data: snapshot,
      slug: TEAM_DOCUMENT_SLUG,
      updated_at: new Date().toISOString(),
    };

    let rows = state.onlineDocId
      ? await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(state.onlineDocId)}&select=id,title`, {
        method: "PATCH",
        body: JSON.stringify(payload),
        prefer: "return=representation",
      })
      : await supabaseRequest(`${SUPABASE_TABLE}?slug=eq.${encodeURIComponent(TEAM_DOCUMENT_SLUG)}&select=id,title`, {
        method: "PATCH",
        body: JSON.stringify(payload),
        prefer: "return=representation",
      });

    let savedDocument = Array.isArray(rows) ? rows[0] : null;
    if (!savedDocument) {
      rows = await supabaseRequest(`${SUPABASE_TABLE}?select=id,title`, {
        method: "POST",
        body: JSON.stringify(payload),
        prefer: "return=representation",
      });
      savedDocument = Array.isArray(rows) ? rows[0] : null;
    }

    if (!savedDocument?.id) {
      throw new Error("保存結果にドキュメントIDがありません。");
    }

    setOnlineDocumentId(savedDocument.id);
    elements.saveStatus.textContent = "オンライン保存済み";
  } catch (error) {
    console.error(error);
    alert(`オンライン保存に失敗しました。\n\n${error.message}`);
    elements.saveStatus.textContent = "オンライン保存失敗";
  }
}

async function promptLoadOnlineDocument() {
  if (!requireOnlineSignedIn()) {
    return;
  }

  const input = prompt("共有URLまたはドキュメントIDを入力してください。空欄ならチームマップを読み込みます。", state.onlineShareToken ?? state.onlineDocId ?? "");
  const target = parseOnlineTarget(input);
  if (!target.value) {
    await loadTeamOnlineDocument();
    return;
  }

  if (target.type === "share") {
    await loadSharedOnlineDocument(target.value);
  } else {
    await loadOnlineDocument(target.value);
  }
}

async function loadOnlineDocument(docId) {
  if (!requireOnlineSignedIn()) {
    return;
  }

  elements.saveStatus.textContent = "オンライン読込中...";

  try {
    const rows = await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(docId)}&select=id,title,data`, {
      method: "GET",
    });
    const documentRecord = Array.isArray(rows) ? rows[0] : null;
    if (!documentRecord?.data) {
      throw new Error("指定されたオンラインマップが見つかりません。");
    }

    applyDataSnapshot(normalizeData(documentRecord.data));
    setOnlineDocumentId(documentRecord.id);
    state.onlineLoadedTarget = `doc:${documentRecord.id}`;
    resetHistory();
    saveSnapshotSilently();
    render();
    elements.saveStatus.textContent = "オンラインから読み込みました";
  } catch (error) {
    console.error(error);
    alert(`オンライン読み込みに失敗しました。\n\n${error.message}`);
    elements.saveStatus.textContent = "オンライン読込失敗";
  }
}

async function loadTeamOnlineDocument() {
  if (!requireOnlineSignedIn()) {
    return;
  }

  elements.saveStatus.textContent = "チームマップ読込中...";

  try {
    const rows = await supabaseRequest(`${SUPABASE_TABLE}?slug=eq.${encodeURIComponent(TEAM_DOCUMENT_SLUG)}&select=id,title,data`, {
      method: "GET",
    });
    const documentRecord = Array.isArray(rows) ? rows[0] : null;
    if (!documentRecord?.data) {
      state.onlineLoadedTarget = `team:${TEAM_DOCUMENT_SLUG}`;
      elements.saveStatus.textContent = "チームマップは未作成です";
      return;
    }

    applyDataSnapshot(normalizeData(documentRecord.data));
    setOnlineDocumentId(documentRecord.id);
    state.onlineLoadedTarget = `team:${TEAM_DOCUMENT_SLUG}`;
    resetHistory();
    saveSnapshotSilently();
    render();
    elements.saveStatus.textContent = "チームマップを読み込みました";
  } catch (error) {
    console.error(error);
    alert(`チームマップの読み込みに失敗しました。\n\n${error.message}`);
    elements.saveStatus.textContent = "チーム読込失敗";
  }
}

async function loadSharedOnlineDocument(shareToken) {
  if (!requireOnlineSignedIn()) {
    return;
  }

  elements.saveStatus.textContent = "共有マップ読込中...";

  try {
    const rows = await supabaseRpc("get_mindmap_by_share_token", {
      p_share_token: shareToken,
    });
    const documentRecord = Array.isArray(rows) ? rows[0] : null;
    if (!documentRecord?.data) {
      throw new Error("指定された共有マップが見つかりません。");
    }

    applyDataSnapshot(normalizeData(documentRecord.data));
    setSharedOnlineToken(shareToken);
    state.onlineLoadedTarget = `share:${shareToken}`;
    resetHistory();
    saveSnapshotSilently();
    render();
    elements.saveStatus.textContent = "共有マップを読み込みました";
  } catch (error) {
    console.error(error);
    alert(`共有マップの読み込みに失敗しました。\n\n${error.message}`);
    elements.saveStatus.textContent = "共有読込失敗";
  }
}

async function copyOnlineShareLink() {
  if (!requireOnlineSignedIn()) {
    return;
  }

  if (!state.onlineDocId) {
    await saveOnlineDocument();
  }

  if (!state.onlineDocId) {
    return;
  }

  try {
    const shareUrl = buildOwnerOnlineUrl(state.onlineDocId);
    try {
      await navigator.clipboard.writeText(shareUrl);
      elements.saveStatus.textContent = "共有リンクをコピーしました";
    } catch (error) {
      console.warn("Clipboard copy failed.", error);
      prompt("共有リンクです。", shareUrl);
    }
  } catch (error) {
    console.error(error);
    alert(`共有リンクの作成に失敗しました。\n\n${error.message}`);
  }
}

async function supabaseRequest(path, options = {}) {
  const accessToken = await getSupabaseAccessToken();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase API error: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function supabaseRpc(functionName, payload) {
  return supabaseRequest(`rpc/${functionName}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function setOnlineDocumentId(docId) {
  state.onlineDocId = docId;
  state.onlineShareToken = null;
  state.onlineLoadMode = "owner";
  const nextUrl = buildOwnerOnlineUrl(docId);
  window.history.replaceState(null, "", nextUrl);
}

function setSharedOnlineToken(shareToken) {
  state.onlineDocId = null;
  state.onlineShareToken = shareToken;
  state.onlineLoadMode = "shared";
  const nextUrl = buildOnlineShareUrl(shareToken);
  window.history.replaceState(null, "", nextUrl);
}

function parseOnlineTarget(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return { type: null, value: null };
  }

  try {
    const url = new URL(text);
    const shareToken = url.searchParams.get("share");
    if (shareToken) {
      return { type: "share", value: shareToken };
    }

    const docId = url.searchParams.get("doc");
    if (docId) {
      return { type: "doc", value: docId };
    }
  } catch {
    // Plain IDs are treated as share tokens first because they are safer to pass around.
  }

  return { type: "doc", value: text };
}

function buildOwnerOnlineUrl(docId) {
  const url = new URL(window.location.href);
  url.searchParams.set("doc", docId);
  url.searchParams.delete("share");
  return url.toString();
}

function buildOnlineShareUrl(shareToken) {
  const url = new URL(window.location.href);
  url.searchParams.set("share", shareToken);
  url.searchParams.delete("doc");
  return url.toString();
}

function resetHistory() {
  historyState.past = [getDataSnapshot()];
  historyState.future = [];
}

function recordHistorySnapshot() {
  const snapshot = getDataSnapshot();
  const previousSnapshot = historyState.past[historyState.past.length - 1];
  if (previousSnapshot && JSON.stringify(previousSnapshot) === JSON.stringify(snapshot)) {
    return;
  }

  historyState.past.push(snapshot);
  if (historyState.past.length > MAX_HISTORY) {
    historyState.past.shift();
  }
  historyState.future = [];
}

function undo() {
  if (historyState.past.length < 2) {
    return;
  }

  const currentSnapshot = historyState.past.pop();
  historyState.future.push(currentSnapshot);
  applyDataSnapshot(normalizeData(historyState.past[historyState.past.length - 1]));
  persistState("元に戻しました", { recordHistory: false });
  render();
}

function redo() {
  if (historyState.future.length === 0) {
    return;
  }

  const nextSnapshot = historyState.future.pop();
  historyState.past.push(nextSnapshot);
  applyDataSnapshot(normalizeData(nextSnapshot));
  persistState("やり直しました", { recordHistory: false });
  render();
}

function exportState() {
  const blob = new Blob([JSON.stringify(getDataSnapshot(), null, 2)], {
    type: "application/json",
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "seo-topic-map.json";
  link.click();
  URL.revokeObjectURL(link.href);
  elements.saveStatus.textContent = "JSONを書き出しました";
}

function importState(event) {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      applyDataSnapshot(normalizeData(parsed));
      resetHistory();
      persistState("JSONを読み込みました", { recordHistory: false });
      render();
    } catch (error) {
      alert("JSONの読み込みに失敗しました。");
      console.error(error);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function exportPng() {
  const map = getActiveMap();
  if (!map || map.nodes.length === 0) {
    return;
  }

  const bounds = getMapBounds(map);
  const padding = 90;
  const exportWidth = bounds.width + padding * 2;
  const exportHeight = bounds.height + padding * 2;
  const scaleFactor = Math.min(2, 5000 / exportWidth, 5000 / exportHeight);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = Math.max(1, Math.ceil(exportWidth * scaleFactor));
  canvas.height = Math.max(1, Math.ceil(exportHeight * scaleFactor));
  context.scale(scaleFactor, scaleFactor);

  drawExportBackground(context, exportWidth, exportHeight);
  context.translate(padding - bounds.minX, padding - bounds.minY);
  drawExportGrid(context, bounds, padding);
  drawExportEdges(context, map);
  drawExportNodes(context, map);

  canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${sanitizeFilename(map.name)}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
    elements.saveStatus.textContent = "PNGを書き出しました";
  }, "image/png");
}

function drawExportBackground(context, width, height) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fdf8f1");
  gradient.addColorStop(0.55, "#f3e7d9");
  gradient.addColorStop(1, "#efe2d4");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const glowA = context.createRadialGradient(100, 80, 10, 100, 80, 260);
  glowA.addColorStop(0, "rgba(247, 185, 120, 0.36)");
  glowA.addColorStop(1, "rgba(247, 185, 120, 0)");
  context.fillStyle = glowA;
  context.fillRect(0, 0, width, height);

  const glowB = context.createRadialGradient(width - 120, height - 80, 10, width - 120, height - 80, 240);
  glowB.addColorStop(0, "rgba(165, 209, 177, 0.28)");
  glowB.addColorStop(1, "rgba(165, 209, 177, 0)");
  context.fillStyle = glowB;
  context.fillRect(0, 0, width, height);
}

function drawExportGrid(context, bounds, padding) {
  const startX = Math.floor((bounds.minX - padding) / 28) * 28;
  const startY = Math.floor((bounds.minY - padding) / 28) * 28;
  const endX = bounds.maxX + padding;
  const endY = bounds.maxY + padding;

  context.save();
  context.strokeStyle = "rgba(128, 104, 88, 0.08)";
  context.lineWidth = 1;

  for (let x = startX; x <= endX; x += 28) {
    context.beginPath();
    context.moveTo(x, startY);
    context.lineTo(x, endY);
    context.stroke();
  }

  for (let y = startY; y <= endY; y += 28) {
    context.beginPath();
    context.moveTo(startX, y);
    context.lineTo(endX, y);
    context.stroke();
  }

  context.restore();
}

function drawExportEdges(context, map) {
  context.save();
  context.strokeStyle = "rgba(102, 70, 45, 0.38)";
  context.fillStyle = "rgba(102, 70, 45, 0.62)";
  context.lineWidth = 3;
  context.lineCap = "round";

  for (const childNode of map.nodes.filter((node) => node.parentId)) {
    const parentNode = findNode(map, childNode.parentId);
    if (!parentNode) {
      continue;
    }

    const start = getConnectorAnchor(parentNode);
    const end = getNodeCenter(childNode);
    const curve = Math.max(48, Math.abs(end.x - start.x) * 0.38);

    context.beginPath();
    context.moveTo(start.x, start.y);
    context.bezierCurveTo(start.x + curve, start.y, end.x - curve, end.y, end.x, end.y);
    context.stroke();

    const angle = Math.atan2(end.y - (end.y - 6), end.x - (end.x - 12));
    drawArrowHead(context, end.x, end.y, angle);
  }

  context.restore();
}

function drawArrowHead(context, x, y, angle) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-12, -6);
  context.lineTo(-12, 6);
  context.closePath();
  context.fill();
  context.restore();
}

function drawExportNodes(context, map) {
  for (const node of map.nodes) {
    const linkUrl = normalizeLinkUrl(node.link);
    const x = node.x;
    const y = node.y;

    context.save();
    context.shadowColor = "rgba(51, 32, 18, 0.12)";
    context.shadowBlur = 18;
    context.shadowOffsetY = 10;
    context.fillStyle = "rgba(255, 251, 247, 0.96)";
    fillRoundedRect(context, x, y, NODE_WIDTH, NODE_HEIGHT, 24);
    context.restore();

    context.save();
    context.strokeStyle = map.selectionIds.includes(node.id) ? "rgba(217, 119, 66, 0.75)" : "rgba(88, 58, 37, 0.1)";
    context.lineWidth = map.selectionIds.includes(node.id) ? 2 : 1;
    strokeRoundedRect(context, x, y, NODE_WIDTH, NODE_HEIGHT, 24);
    context.restore();

    context.fillStyle = normalizeColor(node.color);
    fillRoundedRect(context, x + 16, y + 16, 56, 8, 999);

    context.fillStyle = "#2d1c14";
    context.font = '600 17px "Zen Maru Gothic", "Segoe UI", sans-serif';
    drawWrappedText(context, node.title || "無題ノード", x + 16, y + 50, NODE_WIDTH - 56, 24, 2);

    const categories = getNodeCategories(map, node).slice(0, 2);
    let categoryOffsetY = y + 82;
    for (const category of categories) {
      context.fillStyle = category.color;
      fillRoundedRect(context, x + 16, categoryOffsetY - 16, context.measureText(category.name).width + 18, 24, 999);
      context.fillStyle = "#ffffff";
      context.font = '600 11px "Outfit", "Segoe UI", sans-serif';
      context.fillText(category.name, x + 25, categoryOffsetY);
      categoryOffsetY += 30;
    }

    context.fillStyle = "#7d6556";
    context.font = '400 13px "Outfit", "Segoe UI", sans-serif';
    drawWrappedText(context, node.note || "メモなし", x + 16, categoryOffsetY + 8, NODE_WIDTH - 32, 19, linkUrl ? 3 : 4);

    if (linkUrl) {
      context.fillStyle = "rgba(217, 119, 66, 0.12)";
      fillRoundedRect(context, x + 16, y + NODE_HEIGHT - 46, 92, 28, 999);
      context.fillStyle = "#8f4a24";
      context.font = '600 12px "Outfit", "Segoe UI", sans-serif';
      context.fillText("リンク", x + 36, y + NODE_HEIGHT - 28);
    }

    context.fillStyle = "#915100";
    context.beginPath();
    context.arc(x + NODE_WIDTH - 26, y + NODE_HEIGHT - 26, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff7ed";
    context.beginPath();
    context.arc(x + NODE_WIDTH - 26, y + NODE_HEIGHT - 26, 5, 0, Math.PI * 2);
    context.fill();
  }
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = Array.from(String(text).replace(/\r/g, ""));
  if (chars.length === 0) {
    return;
  }

  const lines = [];
  let currentLine = "";
  let truncated = false;

  for (const char of chars) {
    if (char === "\n") {
      lines.push(currentLine);
      currentLine = "";
      if (lines.length === maxLines) {
        truncated = true;
        break;
      }
      continue;
    }

    const candidate = `${currentLine}${char}`;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = char;

    if (lines.length === maxLines) {
      truncated = true;
      break;
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(trimTextToWidth(context, currentLine, maxWidth));
  }

  const visibleLines = lines.slice(0, maxLines);
  if (truncated || lines.length > maxLines) {
    visibleLines[maxLines - 1] = trimTextToWidth(context, `${visibleLines[maxLines - 1]}...`, maxWidth);
  }

  visibleLines.forEach((line, index) => {
    context.fillText(line, x, y + lineHeight * index);
  });
}

function trimTextToWidth(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  let trimmed = text;
  while (trimmed.length > 1 && context.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  return `${trimmed}...`;
}

function fillRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  roundedRectPath(context, x, y, width, height, radius);
  context.fill();
}

function strokeRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  roundedRectPath(context, x, y, width, height, radius);
  context.stroke();
}

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function getMapBounds(map) {
  const minX = Math.min(...map.nodes.map((node) => node.x));
  const minY = Math.min(...map.nodes.map((node) => node.y));
  const maxX = Math.max(...map.nodes.map((node) => node.x + NODE_WIDTH));
  const maxY = Math.max(...map.nodes.map((node) => node.y + NODE_HEIGHT));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function cloneFolder(folder, nextName) {
  return {
    id: generateId("folder"),
    name: nextName,
    maps: folder.maps.map((map) => cloneMap(map, map.name)),
  };
}

function cloneMap(map, nextName) {
  const categoryIdMap = new Map();
  const categories = map.categories.map((category) => {
    const nextId = generateId("category");
    categoryIdMap.set(category.id, nextId);
    return {
      ...cloneData(category),
      id: nextId,
    };
  });

  const nodeIdMap = new Map();
  const nodes = map.nodes.map((node) => {
    const nextId = generateId("node");
    nodeIdMap.set(node.id, nextId);
    return {
      ...cloneData(node),
      id: nextId,
    };
  });

  for (const node of nodes) {
    node.parentId = node.parentId ? nodeIdMap.get(node.parentId) ?? null : null;
    node.categoryIds = node.categoryIds.map((id) => categoryIdMap.get(id)).filter(Boolean);
  }

  return {
    id: generateId("map"),
    name: `${nextName} コピー`,
    nodes,
    categories,
    viewport: { ...map.viewport },
    selectionIds: [],
  };
}

function normalizeColor(color) {
  if (typeof color !== "string" || !color.startsWith("#")) {
    return "#ffb347";
  }

  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
  }

  return color.toLowerCase();
}

function normalizeLinkUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return "";
  }

  const raw = value.trim();
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(withProtocol).toString();
  } catch (error) {
    return "";
  }
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeFilename(value) {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
